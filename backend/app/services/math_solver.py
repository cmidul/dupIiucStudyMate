"""Mathematical Problem Solver Service.

Provides safe, deterministic AST-based math parsing with SymPy,
ambiguity detection, AI step-by-step explanations, and verification.
Strictly avoids Python eval().
"""

import ast
import re
from typing import Any, Dict, List, Optional, Set, Tuple

import sympy
from fastapi import HTTPException, status

from app.ai.base import BaseAIProvider
from app.ai.router import ai_router
from app.ai.schemas import MathSolutionSchema, MathStep, MathVerification, TextGenerationRequest
from app.core.quota import quota_manager
from app.core.responses import AppException
from app.schemas.solver import MathSolveRequest, MathSolveResponse


class SafeMathSecurityError(Exception):
    """Raised when an expression contains disallowed or dangerous syntax."""
    pass


class SafeMathParser:
    """Restricted mathematical parser and AST validator.
    
    Ensures mathematical inputs execute zero arbitrary Python code,
    blocks dunder attributes, imports, arbitrary calls, and unsafe operators.
    """

    ALLOWED_FUNCTIONS: Set[str] = {
        "sqrt", "sin", "cos", "tan", "log", "ln", "exp", "abs",
        "diff", "integrate", "limit"
    }

    ALLOWED_SYMBOLS: Set[str] = {
        "x", "y", "z", "t", "a", "b", "c", "d", "n", "k", "m",
        "pi", "e", "i"
    }

    ALLOWED_NODES = (
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Constant,
        ast.Name,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Pow,
        ast.Mod,
        ast.USub,
        ast.UAdd,
        ast.Call,
        ast.Load,
    )

    FORBIDDEN_PATTERNS = [
        r"__",
        r"\bimport\b",
        r"\beval\b",
        r"\bexec\b",
        r"\bopen\b",
        r"\bos\b",
        r"\bsys\b",
        r"\bsubprocess\b",
        r"\bglobals\b",
        r"\blocals\b",
        r"\bgetattr\b",
        r"\bcompile\b",
        r"\blambda\b",
        r";",
    ]

    AMBIGUOUS_PATTERNS = [
        # Pattern like 1/2x or a/bc without parentheses around denominator or product
        re.compile(r"(?<![\w(])(\d+)\s*/\s*(\d+)\s*([a-zA-Z])(?![a-zA-Z])"),
    ]

    def validate_safety(self, expression_str: str) -> None:
        """Verify that the raw expression string has no injection payloads."""
        if len(expression_str) > 500:
            raise SafeMathSecurityError("Expression exceeds maximum allowed length of 500 characters.")

        for pattern in self.FORBIDDEN_PATTERNS:
            if re.search(pattern, expression_str, re.IGNORECASE):
                raise SafeMathSecurityError(f"Expression contains disallowed keyword or token matching '{pattern}'.")

    def check_ambiguity(self, expression_str: str) -> Optional[str]:
        """Detect ambiguous expressions such as 1/2x that lack explicit grouping."""
        for pattern in self.AMBIGUOUS_PATTERNS:
            match = pattern.search(expression_str)
            if match:
                num, den, var = match.groups()
                return (
                    f"The expression '{num}/{den}{var}' is ambiguous. "
                    f"Did you mean '({num}/{den})*{var}' or '{num}/({den}*{var})'?"
                )
        return None

    def normalize_math_syntax(self, expression_str: str) -> str:
        """Transform user-friendly math syntax into valid SymPy/Python expressions safely."""
        expr = expression_str.strip()
        # Remove trailing periods or question marks if sent as natural sentences
        expr = re.sub(r"[\?\.]$", "", expr).strip()

        # Handle power syntax: ^ to **
        expr = expr.replace("^", "**")

        # Handle implicit multiplication: 2x -> 2*x, 5(x) -> 5*(x), (x+1)(x+2) -> (x+1)*(x+2)
        expr = re.sub(r"(\d)([a-zA-Z(])", r"\1*\2", expr)
        expr = re.sub(r"(\))([a-zA-Z0-9(])", r"\1*\2", expr)

        return expr

    def validate_ast(self, python_expr: str) -> None:
        """Parse expression with Python's AST and verify every node against whitelist."""
        try:
            tree = ast.parse(python_expr, mode="eval")
        except SyntaxError as e:
            raise SafeMathSecurityError(f"Invalid mathematical syntax: {e}")

        for node in ast.walk(tree):
            if not isinstance(node, self.ALLOWED_NODES):
                raise SafeMathSecurityError(f"Disallowed syntax element: {type(node).__name__}")

            if isinstance(node, ast.Call):
                if not isinstance(node.func, ast.Name):
                    raise SafeMathSecurityError("Only direct mathematical functions are allowed.")
                if node.func.id.lower() not in self.ALLOWED_FUNCTIONS:
                    raise SafeMathSecurityError(f"Disallowed mathematical function: '{node.func.id}'")

            if isinstance(node, ast.Name):
                name_lower = node.id.lower()
                if name_lower.startswith("_"):
                    raise SafeMathSecurityError("Underscore identifiers are strictly forbidden.")
                if name_lower not in self.ALLOWED_SYMBOLS and name_lower not in self.ALLOWED_FUNCTIONS:
                    # Allow standard single-character algebraic variable symbols
                    if not (len(node.id) == 1 and node.id.isalpha()):
                        raise SafeMathSecurityError(f"Disallowed identifier or function: '{node.id}'")


class MathSolverService:
    """Service for solving, explaining, and verifying mathematical problems."""

    def __init__(self, ai_provider: BaseAIProvider):
        self.ai_provider = ai_provider
        self.parser = SafeMathParser()

    async def solve(self, request: MathSolveRequest) -> MathSolveResponse:
        """Solve a math problem with deterministic verification and AI explanation."""
        raw_problem = request.problem.strip()

        # Step 1: Security & injection check
        try:
            self.parser.validate_safety(raw_problem)
        except SafeMathSecurityError as e:
            raise AppException(
                code="UNSAFE_EXPRESSION",
                message=f"Mathematical safety check failed: {str(e)}",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Step 2: Ambiguity check (e.g. 1/2x)
        ambiguity_msg = self.parser.check_ambiguity(raw_problem)
        if ambiguity_msg:
            return MathSolveResponse(
                problem=raw_problem,
                category="ambiguous_expression",
                status="ambiguous",
                steps=[],
                final_answer="Ambiguous expression; clarification required.",
                verification=MathVerification(performed=False, status="ambiguous", method="none"),
                clarification_needed=True,
                clarification_question=ambiguity_msg,
            )

        # Step 3: Deterministic computation using SymPy
        det_result = self._solve_deterministically(raw_problem, domain=request.domain)

        # If unsupported problem
        if det_result["category"] == "unsupported":
            return MathSolveResponse(
                problem=raw_problem,
                category="unsupported",
                status="unsupported",
                steps=[
                    MathStep(
                        step=1,
                        explanation="This mathematical problem is currently beyond the supported MVP symbolic algebra scope.",
                        expression=raw_problem,
                    )
                ],
                final_answer="Unsupported advanced mathematical problem.",
                verification=MathVerification(performed=False, status="not_available", method="none"),
            )

        # Step 4: AI explanation & step generation
        ai_solution = await self._generate_ai_explanation(
            raw_problem,
            category=det_result["category"],
            det_answer=det_result["final_answer"],
            det_steps=det_result["steps"],
        )

        # Step 5: Verification comparison
        verification_status = self._verify_solution(det_result, ai_solution)

        return MathSolveResponse(
            problem=raw_problem,
            category=det_result["category"],
            status="solved",
            steps=ai_solution.steps if ai_solution.steps else [
                MathStep(step=s["step"], explanation=s["explanation"], expression=s["expression"])
                for s in det_result["steps"]
            ],
            final_answer=det_result["final_answer"],
            verification=MathVerification(
                performed=True,
                status=verification_status,
                method="sympy",
            ),
        )

    def _solve_deterministically(self, problem: str, domain: str = "real") -> Dict[str, Any]:
        """Compute deterministic answer using SymPy."""
        # Clean problem string of prompt prefixes like "Solve", "Evaluate", etc.
        clean_expr = re.sub(r"^(solve|evaluate|calculate|find|simplify)\s+", "", problem, flags=re.IGNORECASE).strip()

        # Check for equation
        if "=" in clean_expr:
            parts = clean_expr.split("=")
            if len(parts) != 2:
                return {"category": "unsupported", "final_answer": "", "steps": []}
            left_str = self.parser.normalize_math_syntax(parts[0])
            right_str = self.parser.normalize_math_syntax(parts[1])

            try:
                self.parser.validate_ast(left_str)
                self.parser.validate_ast(right_str)
            except SafeMathSecurityError as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

            return self._solve_equation(left_str, right_str, domain)
        else:
            # Pure arithmetic / expression evaluation
            normalized = self.parser.normalize_math_syntax(clean_expr)
            try:
                self.parser.validate_ast(normalized)
            except SafeMathSecurityError as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

            return self._evaluate_expression(normalized)

    def _evaluate_expression(self, expr_str: str) -> Dict[str, Any]:
        """Evaluate an arithmetic or symbolic expression."""
        try:
            # Construct safe local symbols dict
            local_dict = {s: sympy.Symbol(s) for s in SafeMathParser.ALLOWED_SYMBOLS}
            local_dict.update({
                "sqrt": sympy.sqrt,
                "sin": sympy.sin,
                "cos": sympy.cos,
                "tan": sympy.tan,
                "log": sympy.log,
                "ln": sympy.log,
                "exp": sympy.exp,
                "abs": sympy.Abs,
            })

            sym_expr = sympy.parse_expr(expr_str, local_dict=local_dict, evaluate=True)
            result_str = str(sym_expr)

            return {
                "category": "arithmetic",
                "final_answer": result_str,
                "steps": [
                    {"step": 1, "explanation": "Evaluate operations following operator precedence.", "expression": f"{expr_str} = {result_str}"}
                ],
            }
        except Exception:
            return {"category": "unsupported", "final_answer": "", "steps": []}

    def _solve_equation(self, left_str: str, right_str: str, domain: str) -> Dict[str, Any]:
        """Solve a linear or quadratic equation."""
        try:
            local_dict = {s: sympy.Symbol(s) for s in SafeMathParser.ALLOWED_SYMBOLS}
            local_dict.update({
                "sqrt": sympy.sqrt,
                "sin": sympy.sin,
                "cos": sympy.cos,
                "tan": sympy.tan,
                "log": sympy.log,
                "ln": sympy.log,
                "exp": sympy.exp,
                "abs": sympy.Abs,
            })

            lhs = sympy.parse_expr(left_str, local_dict=local_dict, evaluate=False)
            rhs = sympy.parse_expr(right_str, local_dict=local_dict, evaluate=False)

            # Equation form: lhs - rhs = 0
            diff_expr = sympy.simplify(lhs - rhs)
            variables = diff_expr.free_symbols

            # Check for constant equations (like 0x = 0 or 0x = 5)
            if not variables:
                if diff_expr == 0:
                    return {
                        "category": "linear_equation",
                        "final_answer": "Infinitely many solutions (All real numbers)",
                        "steps": [
                            {"step": 1, "explanation": "Simplify both sides of the equation.", "expression": "0 = 0"},
                            {"step": 2, "explanation": "The identity holds for all values of x.", "expression": "All real numbers"},
                        ],
                    }
                else:
                    return {
                        "category": "linear_equation",
                        "final_answer": "No solution",
                        "steps": [
                            {"step": 1, "explanation": "Simplify both sides of the equation.", "expression": f"{diff_expr} = 0"},
                            {"step": 2, "explanation": "A contradiction arises; no value satisfies this equation.", "expression": "No solution"},
                        ],
                    }

            # Choose main variable (prefer 'x')
            var = next((v for v in variables if v.name == "x"), list(variables)[0])

            # Check polynomial degree
            poly = diff_expr.as_poly(var)
            if poly is None:
                degree = 1
            else:
                degree = poly.degree()

            if degree == 1:
                # Linear equation
                sol = sympy.solve(sympy.Eq(lhs, rhs), var)
                if not sol:
                    return {
                        "category": "linear_equation",
                        "final_answer": "No solution",
                        "steps": [{"step": 1, "explanation": "Equation has no solution.", "expression": "No solution"}],
                    }
                answer_val = str(sol[0])
                return {
                    "category": "linear_equation",
                    "final_answer": f"{var.name} = {answer_val}",
                    "steps": [
                        {"step": 1, "explanation": f"Isolate variable term for {var.name}.", "expression": f"{lhs} = {rhs}"},
                        {"step": 2, "explanation": f"Solve for {var.name}.", "expression": f"{var.name} = {answer_val}"},
                    ],
                }

            elif degree == 2:
                # Quadratic equation
                # Solve quadratic
                all_solutions = sympy.solve(sympy.Eq(lhs, rhs), var)
                real_solutions = [s for s in all_solutions if s.is_real]

                if not real_solutions:
                    complex_roots = " or ".join([f"{var.name} = {str(s).replace('*I', 'i').replace('I', 'i')}" for s in all_solutions])
                    if domain == "complex":
                        final_ans = f"Complex roots: {complex_roots}"
                    else:
                        final_ans = f"No real roots (Complex roots: {complex_roots})"

                    return {
                        "category": "quadratic_equation",
                        "final_answer": final_ans,
                        "steps": [
                            {"step": 1, "explanation": "Compute discriminant b^2 - 4ac.", "expression": "b^2 - 4ac < 0"},
                            {"step": 2, "explanation": "Since discriminant is negative, there are no real solutions.", "expression": final_ans},
                        ],
                    }

                # Real roots exist
                roots_str = " or ".join([f"{var.name} = {str(s)}" for s in real_solutions])
                return {
                    "category": "quadratic_equation",
                    "final_answer": roots_str,
                    "steps": [
                        {"step": 1, "explanation": "Express quadratic in standard form ax^2 + bx + c = 0.", "expression": f"{diff_expr} = 0"},
                        {"step": 2, "explanation": "Factor or apply the quadratic formula.", "expression": roots_str},
                    ],
                }

            else:
                # Higher order or other supported equations
                sols = sympy.solve(sympy.Eq(lhs, rhs), var)
                roots_str = " or ".join([f"{var.name} = {str(s)}" for s in sols])
                return {
                    "category": "algebra",
                    "final_answer": roots_str,
                    "steps": [{"step": 1, "explanation": "Solve symbolically.", "expression": roots_str}],
                }

        except Exception:
            return {"category": "unsupported", "final_answer": "", "steps": []}

    async def _generate_ai_explanation(
        self, problem: str, category: str, det_answer: str, det_steps: List[Dict[str, Any]]
    ) -> MathSolutionSchema:
        """Prompt AI to generate readable step-by-step mathematical explanation."""
        prompt = (
            f"Solve and explain the following math problem step by step:\n"
            f"Problem: {problem}\n"
            f"Category: {category}\n"
            f"Deterministic Answer: {det_answer}\n\n"
            f"Provide clear, pedagogical steps and the final answer according to MathSolutionSchema."
        )

        try:
            req = TextGenerationRequest(
                prompt=prompt,
                system_prompt="You are an expert, encouraging mathematical tutor. Explain steps with clarity and precision.",
                temperature=0.1,
                response_schema=MathSolutionSchema,
            )
            response = await self.ai_provider.generate_text(req)
            if response.structured_data:
                return MathSolutionSchema(**response.structured_data)
        except Exception:
            pass

        # Fallback to deterministic steps if AI generation unavailable
        return MathSolutionSchema(
            problem=problem,
            category=category,
            status="solved",
            steps=[
                MathStep(step=s["step"], explanation=s["explanation"], expression=s["expression"])
                for s in det_steps
            ],
            final_answer=det_answer,
            verification=MathVerification(performed=True, status="passed", method="sympy"),
        )

    def _verify_solution(self, det_result: Dict[str, Any], ai_solution: MathSolutionSchema) -> str:
        """Verify whether AI final answer aligns with deterministic computation.
        
        Returns:
            'passed', 'failed', 'not_available', or 'ambiguous'.
        """
        if det_result["category"] == "unsupported":
            return "not_available"

        det_ans = det_result["final_answer"].strip().lower()
        ai_ans = ai_solution.final_answer.strip().lower()

        # Direct normalization comparison
        clean_det = re.sub(r"\s+", "", det_ans)
        clean_ai = re.sub(r"\s+", "", ai_ans)

        if clean_det == clean_ai:
            return "passed"

        # Check for subset / equivalence in roots
        # e.g. "x = 2 or x = 3" vs "x = 3 or x = 2"
        if "or" in det_ans:
            det_parts = set(p.strip() for p in det_ans.split("or"))
            ai_parts = set(p.strip() for p in ai_ans.split("or"))
            if det_parts == ai_parts:
                return "passed"

        # Check numerical equality if both can be converted
        try:
            det_val = float(clean_det.replace("x=", ""))
            ai_val = float(clean_ai.replace("x=", ""))
            if abs(det_val - ai_val) < 1e-6:
                return "passed"
        except (ValueError, TypeError):
            pass

        # If deterministic answer is clearly contradicted
        return "failed"


# Shared service instance
math_solver_service = MathSolverService(ai_router)

