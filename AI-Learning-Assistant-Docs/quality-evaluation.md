# Quality Evaluation Standard

## 1. Purpose

This document defines how the AI Learning Assistant must be evaluated throughout development.

The goal is not merely to make features work. The project must also be reliable, secure, maintainable, understandable, and useful to learners.

This document is the quality standard for:
- Backend services and APIs
- Website
- Telegram bot
- AI provider integrations
- Image understanding and OCR
- Summaries, quizzes, math solving, and logical reasoning
- Database, file storage, background jobs, and deployment configuration

The agent must use this document together with:
- `architecture.md`
- `feature.md`
- `test.md`
- `agent.md`

If two documents conflict, follow the precedence rules in `agent.md` and report the conflict instead of silently choosing an interpretation.

---

## 2. Evaluation principles

1. **Evidence over claims:** Never report a test, review, or evaluation as passed unless it was actually performed.
2. **Test the behavior, not the implementation alone:** A feature is not complete just because its endpoint returns HTTP 200.
3. **Protect learner data:** Privacy, authorization, and secure file handling are release requirements.
4. **Validate AI output:** Model-generated content must be checked before it reaches the user.
5. **Keep interfaces consistent:** Website and Telegram must use the same core application behavior and user data.
6. **Prefer simple, maintainable solutions:** Avoid unnecessary abstractions, duplicated business logic, and premature complexity.
7. **Make failures understandable:** Users should receive useful error messages without seeing internal secrets or stack traces.
8. **Do not hide weaknesses:** Record known limitations, failed checks, and unresolved risks.

---

## 3. Quality dimensions and scoring

Score each dimension from 0 to 5.

| Score | Meaning |
|---|---|
| 0 | Not implemented, not evaluated, or critically broken |
| 1 | Major defects; unsafe or unreliable |
| 2 | Partially works; important gaps remain |
| 3 | Acceptable; meets minimum requirements with known minor issues |
| 4 | Good; well-tested and maintainable, with only small issues |
| 5 | Excellent; strong evidence, robust edge-case handling, and clear documentation |

Use **N/A** only when a dimension genuinely does not apply to the feature. Explain why.

### 3.1 Functional correctness

Evaluate whether:
- The feature meets the requirements in `feature.md`.
- Normal use cases work.
- Invalid, empty, ambiguous, and boundary inputs are handled.
- Errors are handled without crashing unrelated features.
- The result is correct, not merely syntactically valid.
- Existing features continue to work after the change.

Evidence may include unit tests, integration tests, end-to-end tests, manual test records, and reproducible examples.

### 3.2 Test quality

Evaluate whether:
- Tests cover the main success path.
- Tests cover invalid inputs and edge cases.
- Failure paths and provider outages are tested where relevant.
- Authorization and ownership are tested.
- Tests are deterministic and do not depend on a live AI provider unless explicitly marked as integration tests.
- Mocks are realistic and do not replace all meaningful behavior.
- Tests are readable and can be run using documented commands.

A test that only checks that a function exists or an endpoint responds is not sufficient proof of correctness.

### 3.3 Architecture and maintainability

Evaluate whether:
- Responsibilities follow `architecture.md`.
- Business logic is not duplicated between the website and Telegram bot.
- UI and Telegram layers call shared backend application services.
- AI provider-specific code is isolated behind the agreed provider abstraction.
- Modules have clear responsibilities and sensible dependencies.
- Names, types, errors, and interfaces are understandable.
- Complex logic has useful comments or documentation.
- No unnecessary framework, library, or abstraction has been added.
- Configuration is centralized and environment-specific values are not hardcoded.

### 3.4 AI answer quality

Evaluate the quality of AI-generated results separately from ordinary software correctness.

Check:
- **Relevance:** Does the answer address the learner's actual question?
- **Correctness:** Is the answer factually or mathematically correct?
- **Completeness:** Does it include the important steps or concepts?
- **Clarity:** Is the explanation understandable to the intended learner?
- **Grounding:** Does it avoid inventing details from an uploaded image or unclear prompt?
- **Uncertainty:** Does it ask for clarification or state uncertainty when the input is ambiguous?
- **Format validity:** Does the output match the expected schema?
- **Consistency:** Do equivalent requests produce reasonably consistent results?

Use a version-controlled evaluation set containing representative examples for:
- Summarization
- Quiz generation
- Arithmetic and algebra
- Equations with no solution or infinitely many solutions
- Logical deduction and syllogisms
- Image-based questions
- Blurry, incomplete, or ambiguous images
- Follow-up questions that depend on conversation context

For each example, record:
- Input and relevant context
- Expected key points or answer
- Actual output
- Correctness result
- Explanation quality
- Failure category, if any

Do not require exact wording when multiple answers can be correct. Evaluate against expected facts, steps, and constraints.

For math and logic, use deterministic verification where practical. Do not trust the language model as the only correctness checker.

### 3.5 Security and privacy

Evaluate whether:
- Authentication and authorization are enforced on protected operations.
- Users can access only their own conversations, files, quizzes, and history.
- File uploads validate type, size, and content as appropriate.
- File names and paths cannot cause path traversal.
- Secrets are loaded from environment or secret management, never committed.
- Logs do not expose passwords, tokens, API keys, or unnecessary personal content.
- Rate limits and quotas protect expensive operations.
- CORS, webhook verification, and API validation are configured appropriately.
- User-provided text and images are treated as untrusted input.
- Prompt injection or malicious instructions in uploaded content cannot override system rules or expose secrets.
- Data deletion behaves as documented.

Any confirmed cross-user data exposure, secret leak, authentication bypass, or serious file-handling vulnerability is a release blocker.

### 3.6 Performance and reliability

Evaluate:
- API response time for ordinary non-AI operations.
- AI request timeout and retry behavior.
- Handling of provider rate limits and temporary outages.
- Background job retry limits and idempotency.
- Large image and file handling.
- Concurrent requests and duplicate submissions.
- Database query behavior and indexes where needed.
- Memory and resource usage under realistic test conditions.

Record the test environment, dataset size, concurrency, and measurement method. Do not claim production performance based only on a small local test.

### 3.7 User experience and accessibility

Evaluate:
- Clear loading, success, empty, and error states.
- Understandable AI failure messages and retry guidance.
- Responsive website layout on common screen sizes.
- Keyboard navigation and visible focus where applicable.
- Labels and accessible names for interactive controls.
- Readable summaries, quizzes, and mathematical output.
- Consistent behavior between Telegram and the website.
- No misleading success messages when an operation has failed.

### 3.8 Documentation and operations

Evaluate:
- Setup instructions work on a clean environment.
- `.env.example` lists required configuration without real secrets.
- Database migration and startup instructions are documented.
- Test commands are accurate.
- API behavior and important design decisions are documented.
- Known limitations and operational risks are recorded.
- Logs and health checks provide useful diagnostics without exposing sensitive data.

---

## 4. Feature-level quality gate

Every feature must pass this gate before it is marked complete.

### Required checks

- [ ] Requirement and acceptance criteria are identified from `feature.md`.
- [ ] Relevant architecture boundaries are respected.
- [ ] Main success path is implemented and tested.
- [ ] Invalid input and important edge cases are tested.
- [ ] Authorization and data ownership are tested where relevant.
- [ ] Error handling is tested.
- [ ] Relevant regression tests pass.
- [ ] AI output is evaluated against representative examples when AI behavior changes.
- [ ] Security implications are reviewed.
- [ ] User-facing behavior is checked on the relevant platform.
- [ ] Documentation and configuration examples are updated.
- [ ] No known critical issue is left unresolved.
- [ ] Evaluation results are recorded in `QUALITY_REPORT.md`.

A feature may be marked **Blocked** or **Needs work**. Do not mark it **Passed** just to keep development moving.

### Feature status definitions

- **Not evaluated:** No meaningful evaluation has been completed.
- **Needs work:** One or more required checks failed or evidence is insufficient.
- **Blocked:** A dependency, environment, or unresolved critical issue prevents evaluation.
- **Passed:** All applicable required checks passed and evidence is recorded.

---

## 5. Project-level release gate

Before a release or final submission, evaluate the complete system.

### Mandatory release conditions

- All required tests in `test.md` have been run, or any unrun test is explicitly justified and approved by the project owner.
- No failing critical or high-priority test remains.
- No known critical security vulnerability remains.
- Cross-user data access tests pass.
- Website and Telegram use the same core business rules.
- AI outputs are validated and failure cases are handled.
- AI provider outage and rate-limit behavior are tested.
- Database migrations work from a clean database.
- Setup instructions are verified on a clean environment.
- Required secrets are not present in the repository.
- Known limitations are documented.
- The final evaluation report is complete.

A high average score cannot cancel a critical security or correctness failure.

### Suggested release score

For each applicable quality dimension, assign a score from 0 to 5 and calculate:

`Overall score = sum of dimension scores / number of applicable dimensions`

Release recommendation:
- **4.5–5.0:** Strong quality; release may proceed if all mandatory gates pass.
- **4.0–4.49:** Good; release may proceed after reviewing remaining issues.
- **3.0–3.99:** Needs improvement; do not call it production-ready.
- **Below 3.0:** Not ready.

The score is a summary, not a substitute for mandatory release conditions.

---

## 6. AI evaluation procedure

Use the same evaluation examples when comparing model or prompt changes.

For each AI feature:

1. Select representative examples from the evaluation set.
2. Run the current implementation with recorded model/provider configuration.
3. Save the output in a safe evaluation artifact. Remove personal or sensitive data.
4. Compare the output with expected facts, steps, and constraints.
5. Score correctness, relevance, completeness, clarity, uncertainty handling, and schema validity from 0 to 5.
6. Record failures by category.
7. Compare against the previous baseline when changing a model, prompt, OCR component, or routing rule.
8. Investigate regressions before accepting the change.

Do not use only a single impressive example to claim that an AI feature is reliable.

### AI evaluation result

For every evaluation run, record:
- Evaluation ID and date
- Feature being evaluated
- Application commit hash
- Model/provider and relevant version or identifier
- Prompt/template version, if applicable
- Dataset/evaluation-set version
- Number of examples
- Pass count and failure count
- Average scores by criterion
- Important failure examples
- Comparison with previous baseline
- Decision: Pass, Needs work, or Blocked

Do not place API keys, private user conversations, or sensitive uploaded images in evaluation reports.

---

## 7. Regression policy

A change must not silently reduce the quality of an existing feature.

Before merging or completing a change:
- Run tests for the changed module.
- Run related integration tests.
- Run the relevant regression suite.
- Re-run AI evaluation examples if prompts, models, OCR, context handling, or output schemas changed.
- Re-check website and Telegram parity if shared behavior changed.
- Record any intentional behavior change in the documentation.

If a regression is found:
1. Record the failing test or example.
2. Identify the likely cause.
3. Fix it or mark the feature as Needs work.
4. Add a regression test so the same problem is less likely to return.
5. Re-run the relevant checks.

---

## 8. Quality report file

Maintain a separate root-level file named `QUALITY_REPORT.md`.

Update it after each feature evaluation and after every project-level release evaluation.

Use this template:

# Quality Report

## Project status
- Last updated:
- Current branch:
- Evaluated commit:
- Overall status: Not evaluated / Needs work / Blocked / Passed

## Latest evaluation summary

| Dimension | Score (0–5) | Status | Evidence / Notes |
|---|---:|---|---|
| Functional correctness | | | |
| Test quality | | | |
| Architecture and maintainability | | | |
| AI answer quality | | | |
| Security and privacy | | | |
| Performance and reliability | | | |
| User experience and accessibility | | | |
| Documentation and operations | | | |

## Feature evaluation history

| Feature | Commit | Tests run | Result | Main findings |
|---|---|---|---|---|
| | | | | |

## Failed checks and known issues

| ID | Severity | Description | Owner / Next action | Status |
|---|---|---|---|---|
| | | | | |

## AI evaluation history

| Evaluation ID | Feature | Model/provider | Examples | Result | Baseline comparison |
|---|---|---|---:|---|---|
| | | | | | |

## Security review
- Findings:
- Resolved:
- Open:
- Release blockers:

## Performance observations
- Environment:
- Workload:
- Measurements:
- Limitations:

## Release decision
- Decision: Not ready / Ready after fixes / Ready
- Conditions:
- Evaluated by:
- Date:

Keep historical results. Do not erase failed evaluations after fixing them; add a new result so progress remains visible.

---

## 9. Evaluation frequency

Run evaluation at these points:

- **Every feature:** Run the feature-level quality gate and update `QUALITY_REPORT.md`.
- **Every bug fix:** Run the relevant regression tests and add a regression test when appropriate.
- **Every AI prompt/model/OCR change:** Run the relevant AI evaluation set and compare against the previous baseline.
- **Every database or authentication change:** Run migration, authorization, ownership, and security-related tests.
- **Every integration change:** Test the affected integration and its failure modes.
- **Before a release:** Run the full project-level release gate.
- **After a serious incident:** Record the cause, impact, corrective action, and regression test.

---

## 10. Rules for the implementation agent

The agent must:

1. Read this document before implementing a feature.
2. Use `test.md` for test cases and this document for quality standards.
3. Add or update tests when requirements or behavior change.
4. Update `QUALITY_REPORT.md` after evaluating each completed feature.
5. Record exact commands used and whether they passed or failed.
6. Include relevant test output, evaluation examples, or other evidence in its report.
7. Report skipped tests and explain why they were skipped.
8. Keep known issues visible instead of hiding or deleting them.
9. Never invent scores, test results, benchmark results, or AI accuracy claims.
10. Never lower a quality threshold merely to make a feature pass.
11. Ask the project owner when a requirement or acceptance criterion is genuinely ambiguous.
12. Provide the proposed Git commands and commit message after a feature passes, following `agent.md`. Do not commit or push unless explicitly authorized.

### Required feature completion report

For each feature, report:

- Feature name:
- Requirements implemented:
- Files/modules changed:
- Tests executed:
- Exact test commands:
- Test results:
- Quality dimension scores:
- AI evaluation results, if applicable:
- Security review:
- Known issues or limitations:
- `QUALITY_REPORT.md` updated: Yes/No
- Status: Passed / Needs work / Blocked
- Proposed Git commands:
- Proposed commit message:

---

## 11. Definition of quality

The project is not high quality simply because it has many features or uses a powerful AI model.

It is high quality when:
- Learners receive useful and reasonably correct results.
- Incorrect or uncertain results are handled honestly.
- User data remains private and protected.
- The website and Telegram bot behave consistently.
- Failures are recoverable and understandable.
- Tests provide meaningful evidence.
- Developers can understand, modify, and extend the code.
- The project can be installed, evaluated, and operated using documented instructions.
