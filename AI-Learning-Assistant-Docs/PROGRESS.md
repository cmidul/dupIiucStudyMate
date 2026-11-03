# Project Progress Tracker

## Purpose

This file is the live development tracker for the AI Learning Assistant.

The implementation agent must maintain this file throughout development. It must reflect the actual state of the repository, not the intended or assumed state.

Use this file together with:
- `architecture.md` — system architecture
- `feature.md` — feature requirements and acceptance criteria
- `test.md` — test cases
- `agent.md` — implementation workflow and rules
- `quality-evaluation.md` — quality standards
- `QUALITY_REPORT.md` — evaluation results and quality history

## 1. Project overview

| Field | Value |
|---|---|
| Project name | AI Learning Assistant |
| Current phase | Not started |
| Overall status | Not started |
| Current milestone | M0 — Repository inspection and setup |
| Current feature | None |
| Last updated | YYYY-MM-DD |
| Current branch | |
| Latest commit | |

### Status definitions

- **Not started:** Work has not begun.
- **In progress:** Work is actively being implemented.
- **Needs work:** Implementation or evaluation found issues that must be fixed.
- **Blocked:** Work cannot continue because of a dependency, decision, or unresolved issue.
- **Passed:** Acceptance criteria and applicable tests have passed, and evaluation evidence is recorded.
- **Deferred:** The project owner has explicitly postponed the work.

Do not use **Passed** just because code has been written.

## 2. Overall milestone tracker

Update the status and evidence for every milestone.

| ID | Milestone | Main deliverable | Status | Completion date | Evidence / Notes |
|---|---|---|---|---|---|
| M0 | Repository inspection and setup | Existing code reviewed, environment documented, project structure ready | Not started | | |
| M1 | Backend foundation | Application structure, configuration, database connection, health endpoint | Not started | | |
| M2 | Authentication and user identity | Website accounts and Telegram account linking | Not started | | |
| M3 | Shared conversation system | Conversations, messages, context, and history | Not started | | |
| M4 | AI provider foundation | Provider abstraction, free-provider integration, validation and error handling | Not started | | |
| M5 | Text question answering | Text input, intent/topic handling, answer generation | Not started | | |
| M6 | Image understanding | Upload validation, image processing/OCR or vision workflow | Not started | | |
| M7 | Summarization | Summary generation and display | Not started | | |
| M8 | Quiz system | Quiz generation, attempts, scoring, and answer review | Not started | | |
| M9 | Math solver | Mathematical question solving and verification | Not started | | |
| M10 | Logical reasoning solver | Logic question handling and explanation | Not started | | |
| M11 | Website experience | Responsive interface and integration with shared backend | Not started | | |
| M12 | Telegram bot | Commands, messages, uploads, and shared user history | Not started | | |
| M13 | Reliability and security | Rate limits, retries, authorization, privacy, and failure handling | Not started | | |
| M14 | System integration | Cross-platform and end-to-end acceptance tests | Not started | | |
| M15 | Release readiness | Full test suite, quality report, setup guide, and release decision | Not started | | |

The agent may split milestones into smaller tasks, but must not remove a required feature from `feature.md` without project-owner approval.

## 3. Feature-level progress

Add one row for every feature from `feature.md`. Keep feature IDs stable.

| Feature ID | Feature | Milestone | Status | Implementation | Tests | Quality evaluation | Notes |
|---|---|---|---|---|---|---|---|
| F-001 | Example: Backend health endpoint | M1 | Not started | Not started | Not run | Not evaluated | Replace this example with a real feature |

Use these values:
- Implementation: Not started / In progress / Complete
- Tests: Not run / Running / Passed / Failed / Partially passed
- Quality evaluation: Not evaluated / Needs work / Passed / Blocked

A feature is **Passed** only when its acceptance criteria are met, relevant tests pass, and its evaluation is recorded in `QUALITY_REPORT.md`.

## 4. Current work

Only keep the current active task(s) here.

- **Current milestone:**
- **Current feature ID and name:**
- **Objective:**
- **Work completed:**
- **Work remaining:**
- **Files/modules being changed:**
- **Current test status:**
- **Current blockers:**
- **Next action:**

When a feature is finished or paused, update this section before moving to another feature.

## 5. Completed work log

Add a new entry whenever a feature or meaningful project task passes.

| Date | Feature / Task | Commit | Tests and evaluation | Result | Notes |
|---|---|---|---|---|---|
| YYYY-MM-DD | Example task | commit hash or N/A | Test commands and report reference | Passed | Replace this example |

Do not delete historical entries. If a completed feature later regresses, add a new entry describing the regression and change its current status in Section 3.

## 6. Blockers and risks

| ID | Date reported | Blocker / Risk | Impact | Required action | Owner | Status |
|---|---|---|---|---|---|---|
| B-001 | YYYY-MM-DD | Describe the issue | Low / Medium / High / Critical | Specific next action | Agent / Project owner | Open |

Examples:
- Free AI provider has strict request limits.
- Vision capability is unavailable from the selected free provider.
- Telegram webhook deployment requires a public HTTPS endpoint.
- Database migration fails on a clean database.
- A required environment variable or external service is unavailable.

Do not invent blockers. Record only observed issues or clearly identified risks.

## 7. Decisions and changes

Record important decisions that affect implementation.

| Date | Decision / Change | Reason | Affected documents or modules | Approved by |
|---|---|---|---|---|
| YYYY-MM-DD | Describe the decision | Explain why | Files or components | Project owner / Agent within existing requirements |

If a decision changes requirements, update the relevant source document (`architecture.md` or `feature.md`) as well. Do not silently change project scope.

## 8. Test status

Summarize the latest test execution. Detailed cases and results belong in test reports or `QUALITY_REPORT.md`.

| Test group | Last run | Result | Failed / skipped tests | Evidence |
|---|---|---|---|---|
| Backend unit tests | Not run | Not run | | |
| Backend integration tests | Not run | Not run | | |
| Frontend tests | Not run | Not run | | |
| Telegram bot tests | Not run | Not run | | |
| AI evaluation set | Not run | Not run | | |
| Security tests | Not run | Not run | | |
| End-to-end tests | Not run | Not run | | |

Always record the exact command and relevant output or report location when updating a result. Never mark tests as passed based on expectation.

## 9. Quality status

Refer to `QUALITY_REPORT.md` for the detailed scores and evidence.

- **Latest quality evaluation date:**
- **Evaluated commit:**
- **Overall quality status:** Not evaluated
- **Open high/critical issues:**
- **AI evaluation status:** Not evaluated
- **Security review status:** Not evaluated
- **Release recommendation:** Not ready

Update these fields after each feature evaluation and project-level evaluation.

## 10. Git history and proposed commits

Record completed commits. The agent must follow the Git rules in `agent.md`.

| Date | Feature / Change | Branch | Commit hash | Commit message |
|---|---|---|---|---|
| YYYY-MM-DD | Example task | branch-name | hash | feat: add example task |

The agent must provide proposed Git commands and a commit message after a feature passes. It must not commit or push unless the project owner explicitly authorizes it.

## 11. Next steps

List the next three concrete actions in priority order.

1. [ ] Action 1
2. [ ] Action 2
3. [ ] Action 3

Keep this list current. Do not list vague tasks such as “continue coding.”

## 12. Agent maintenance rules

The implementation agent must:

1. Read `PROGRESS.md` at the start of every work session.
2. Check the actual repository and Git state before trusting the recorded status.
3. Update **Current work** when starting, pausing, or switching a task.
4. Update the feature tracker when implementation, tests, or evaluation status changes.
5. Update milestone status only when the milestone deliverables are actually complete.
6. Add a completed-work entry only after the relevant feature passes its quality gate.
7. Record blockers as soon as they are discovered, with a concrete next action.
8. Record important scope or architecture decisions in the decisions table.
9. Update test and quality summaries after running evaluations.
10. Keep historical logs; do not erase failures or rewrite history to make progress appear better.
11. Never invent dates, commits, test results, scores, or completion claims.
12. Keep this file concise and factual. Put detailed test output in test reports and detailed quality evidence in `QUALITY_REPORT.md`.
13. At the end of each work session, update this file and report what changed.
14. If the repository state conflicts with this file, verify the actual state and correct this file. Explain the discrepancy in the work summary.

## 13. Session handoff

Complete this section before ending a work session so the next session can continue safely.

- **Session date:**
- **Last completed task:**
- **Current task and status:**
- **Files changed but not yet verified:**
- **Tests run and results:**
- **Known problems:**
- **Exact next action:**
- **Commands needed to resume, if any:**

Do not include secrets, API keys, passwords, private user data, or raw sensitive conversations in this file.
