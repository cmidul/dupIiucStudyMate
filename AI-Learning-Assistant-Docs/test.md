# AI Learning Assistant — Test Plan

**Audience:** Developers and AI coding agents  
**Related documents:** `architecture.md`, `feature.md`, `agent.md`  
**Purpose:** Define repeatable tests for every MVP feature, including unit, integration, security, UI, Telegram, and end-to-end behavior.

---

## 1. Testing principles

1. Test observable behavior, not implementation details.
2. Run tests against the actual repository code.
3. Use deterministic fake AI providers for automated tests. Do not depend on a free provider API being available during normal CI.
4. Keep a smaller optional live-provider smoke test separate from the required test suite.
5. Never use real user files, credentials, or personal data in automated tests.
6. Every bug fix must include a regression test.
7. A test passes only when its assertion succeeds. A successful HTTP status alone is not proof of correctness.
8. Security tests must verify that unauthorized users cannot infer or retrieve another user's data.
9. Do not weaken or delete a test merely to make the suite green. If a requirement changes, update this document and explain why.
10. Record the command, result, and relevant test report for each run.

## 2. Test environments

### 2.1 Required automated environment

- Backend test configuration
- Test PostgreSQL database or isolated test database
- Redis test instance when background jobs are implemented
- Fake/mock text AI provider
- Fake/mock vision AI provider
- Telegram Bot API mock or test double
- Frontend test environment
- Synthetic image fixtures

Use isolated test data. Reset or roll back database state between tests.

### 2.2 Optional live-provider smoke tests

Run only when a developer supplies a valid provider key and explicitly enables live tests.

- One short text question
- One small educational image
- One summary request
- One quiz-generation request

Live tests must be marked separately, rate-limited, and excluded from default CI. Do not print API keys or full private prompts in logs.

### 2.3 Test data fixtures

Create synthetic fixtures such as:

| Fixture | Purpose | Expected result |
|---|---|---|
| `bst_notes.png` | Educational notes | Data Structures / Binary Search Tree |
| `neural_network.png` | Diagram with labels | AI / Neural Networks and diagram description |
| `quadratic_equation.png` | Equation image | Extracted equation with readable symbols |
| `blurry_notes.png` | Low-quality image | Uncertainty warning |
| `non_educational.png` | Unrelated image | No invented educational topic |
| `corrupt_image.bin` | Invalid image bytes | Rejected safely |
| `oversized_image.png` | Size-limit test | Rejected before provider call |
| `sample_math.txt` | Math solver | Known deterministic answer |
| `sample_logic.txt` | Logic solver | Known conclusion |

Do not assume the AI will return identical prose. Assert schema, meaning, required fields, and deterministic values where applicable.

---

## 3. Test result format

For every test case, record:

- Test ID
- Feature
- Preconditions
- Steps or input
- Expected result
- Actual result
- Status: `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`
- Evidence: test report, screenshot, log reference, or request ID
- Defect/reference if failed

A feature is not complete if required tests are `FAIL`, `BLOCKED`, or `NOT RUN`.

---

# 4. Authentication and identity tests

## AUTH-001 — Register a valid user

**Type:** API integration

Input: valid email and password.

Expected:
- Account is created.
- Response contains safe user information.
- Password/hash is never returned.
- User can authenticate afterward.

## AUTH-002 — Reject duplicate email

Input: register the same email twice.

Expected:
- Second registration is rejected with a stable error.
- No duplicate user is created.
- Response does not reveal sensitive account internals.

## AUTH-003 — Reject invalid registration input

Try malformed email, missing fields, and passwords below configured policy.

Expected:
- Validation error.
- No account is created.
- No stack trace is returned.

## AUTH-004 — Login success and failure

Test valid credentials and invalid credentials.

Expected:
- Valid login creates a valid session.
- Invalid login returns a generic authentication error.
- No password or hash is exposed.

## AUTH-005 — Session persistence and logout

Steps:
1. Sign in.
2. Refresh the website.
3. Access a protected endpoint.
4. Sign out.
5. Access the protected endpoint again.

Expected:
- Session works after refresh.
- Session is invalid after logout.

## AUTH-006 — Unauthenticated access

Call every protected API without a valid session/token.

Expected:
- Request is rejected.
- No private data is returned.

## AUTH-007 — Cross-user ownership

Create User A and User B. Create a conversation, upload, quiz, job, summary, and attempt for User A. Request each resource as User B.

Expected:
- Access is denied or a consistent not-found response is returned.
- No content, metadata, file URL, answer key, or existence-sensitive detail is leaked.

---

# 5. Telegram account-linking tests

## LINK-001 — Create a linking token

Expected:
- Authenticated user receives a random, short-lived token or deep link.
- Token is single-use.
- Raw token is not logged.

## LINK-002 — Complete linking successfully

Steps:
1. User requests a token from the website.
2. Telegram bot receives the deep-link token from a verified Telegram update.
3. Backend completes linking.

Expected:
- Telegram ID is associated with the correct internal user.
- Website reflects linked status.
- Both interfaces use the same internal user identity.

## LINK-003 — Reject expired token

Expected:
- Linking fails.
- No account association is created.

## LINK-004 — Reject reused token

Expected:
- First valid use succeeds.
- Second use fails.

## LINK-005 — Reject token claimed by another Telegram account

Expected:
- Token cannot be transferred or claimed by an unintended identity.

## LINK-006 — Prevent duplicate Telegram linking

Try linking one Telegram ID to two application users.

Expected:
- Second link is rejected.
- Original link remains unchanged.

## LINK-007 — Unlink account

Expected:
- Authenticated owner can unlink.
- Unrelated users cannot unlink it.
- Previous Telegram identity can no longer access the linked account.

---

# 6. Chat, intent, and topic detection tests

## CHAT-001 — General text question

Input: `Explain binary search in simple words.`

Expected:
- User message is saved.
- Intent is `general_question` or an appropriate explanation intent.
- Response is returned and saved.
- Response is associated with the correct conversation.

## CHAT-002 — Topic detection

Use examples from Mathematics, Computer Science, Physics, and Biology.

Expected:
- Subject/topic/subtopic are populated when identifiable.
- Difficulty is one of the allowed enum values.
- Confidence is between 0 and 1.
- Unknown values use `unknown`, not fabricated labels.

## CHAT-003 — Ambiguous request

Input: `Explain this.` with no source or previous context.

Expected:
- Bot asks what the user wants explained.
- It does not invent missing context.

## CHAT-004 — Follow-up context

Steps:
1. Ask about binary search.
2. Ask `Give me an example of that.`

Expected:
- Second answer uses the same conversation context.
- It does not use another conversation's content.

## CHAT-005 — Conversation isolation

Create two conversations with unrelated topics. Ask a follow-up in one.

Expected:
- Only relevant conversation context is used.

## CHAT-006 — Empty and oversized messages

Expected:
- Empty input is rejected or handled with a clear prompt.
- Oversized input is rejected before an uncontrolled provider call.
- User receives a useful message.

## CHAT-007 — Provider failure

Configure fake provider to timeout or return an error.

Expected:
- Safe error response.
- No fake answer is generated.
- Conversation data remains consistent.
- Request ID is available.

---

# 7. Image upload and understanding tests

## IMG-001 — Valid JPEG upload

Expected:
- Upload is accepted.
- Private storage record is created.
- Processing job is created.
- File is not publicly accessible.

## IMG-002 — Valid PNG/WEBP upload

Expected:
- Supported formats are accepted according to configuration.
- Unsupported formats are rejected.

## IMG-003 — MIME spoofing

Upload a text or executable file renamed to `.png`.

Expected:
- Actual file content/type validation rejects it.
- No vision-provider call is made.

## IMG-004 — Corrupt image

Expected:
- Image is rejected or marked unreadable.
- Worker does not crash.
- User receives a clear error.

## IMG-005 — Oversized image

Expected:
- Upload is rejected before provider processing.
- Usage quota is not consumed incorrectly.
- No oversized file is sent to the provider.

## IMG-006 — Educational text extraction

Input: `bst_notes.png`.

Expected:
- Extracted text contains the visible core concepts.
- Topic metadata identifies the relevant subject/topic.
- Structured response validates against the extraction schema.

## IMG-007 — Diagram understanding

Input: `neural_network.png`.

Expected:
- System describes visible layers and relationships.
- It distinguishes diagram interpretation from extracted text.
- It does not claim labels that are not visible.

## IMG-008 — Equation extraction

Input: `quadratic_equation.png`.

Expected:
- Equation is extracted correctly when legible.
- Uncertain symbols are flagged.
- The system does not silently replace ambiguous symbols.

## IMG-009 — Blurry image

Input: `blurry_notes.png`.

Expected:
- Uncertainty is reported.
- The system asks for a clearer image when necessary.
- It does not fabricate unreadable content.

## IMG-010 — Non-educational image

Input: `non_educational.png`.

Expected:
- System reports that useful educational context was not detected.
- No fabricated summary or quiz is created.

## IMG-011 — Reuse extracted content

Steps:
1. Upload and process an image.
2. Generate a summary.
3. Generate a quiz.
4. Ask a follow-up.

Expected:
- Existing extracted content is reused.
- The image is not needlessly reprocessed.
- All outputs reference the correct source.

## IMG-012 — Image ownership

User B attempts to read or process User A's upload.

Expected:
- Access is denied.
- No private storage location is exposed.

## IMG-013 — Provider failure during image processing

Expected:
- Job becomes `failed` after bounded retries.
- Safe error is stored.
- User can retry if appropriate.
- No false `completed` status is shown.

---

# 8. Topic and intent classification tests

## TOPIC-001 — Controlled enum validation

Feed valid and invalid difficulty, input type, and intent values to the schema validator.

Expected:
- Valid values pass.
- Invalid values fail validation or are normalized to `unknown` according to the documented policy.

## TOPIC-002 — Low-confidence classification

Fake provider returns low confidence.

Expected:
- System asks for clarification or marks the result uncertain.
- It does not route to a risky or unrelated workflow.

## TOPIC-003 — Multiple topics

Input contains two distinct topics.

Expected:
- Multiple topics are represented or a primary topic and related topics are returned.
- No relevant topic is silently discarded.

## TOPIC-004 — Context-aware classification

Use a follow-up that depends on the previous question.

Expected:
- Relevant conversation context improves classification.
- Unrelated conversation context is excluded.

---

# 9. Summarization tests

## SUM-001 — Short summary

Expected:
- Overview is concise.
- Main idea and essential points are preserved.

## SUM-002 — Detailed summary

Expected:
- Important sections and relationships are covered.
- No unsupported claims are added.

## SUM-003 — Exam notes summary

Expected:
- Definitions, key points, formulas, and revision points appear when present in the source.
- Output follows the summary schema.

## SUM-004 — Summary from image content

Expected:
- Summary uses saved extracted content.
- It references the correct source.

## SUM-005 — Incomplete source

Expected:
- Missing/incomplete context is acknowledged.
- The model does not fill gaps with invented source facts.

## SUM-006 — Invalid AI output

Fake provider returns malformed JSON or missing required fields.

Expected:
- One controlled repair attempt occurs.
- Invalid output is not saved as a valid summary.
- A safe error is returned if repair fails.

## SUM-007 — Summary persistence and ownership

Expected:
- Summary appears in history.
- Another user cannot access it.
- Deletion follows the documented source-dependency policy.

---

# 10. Quiz generation and attempt tests

## QUIZ-001 — Generate five MCQs from source

Expected:
- Requested number of valid questions is returned.
- Every question has non-empty text and valid options.
- Correct option ID exists in its options.

## QUIZ-002 — Generate quiz from a topic only

Expected:
- Quiz is generated without a source ID.
- Topic and difficulty are stored.

## QUIZ-003 — Difficulty levels

Run beginner, intermediate, and advanced requests.

Expected:
- Difficulty metadata is correct.
- Questions are reasonably aligned with requested difficulty.

## QUIZ-004 — Invalid question count

Try zero, negative, and above-maximum counts.

Expected:
- Request is rejected with validation error.
- Provider is not called for invalid requests.

## QUIZ-005 — Malformed generated quiz

Fake provider returns duplicate question IDs, missing options, or nonexistent correct option ID.

Expected:
- Schema validation catches the issue.
- One controlled repair attempt is allowed.
- Invalid quiz is not published.

## QUIZ-006 — Answer-key secrecy

Call quiz delivery endpoint before submission.

Expected:
- Response contains question and option text only.
- `correct_option_id` and explanation are absent.
- Inspect serialized API response, not only frontend visibility.

## QUIZ-007 — Correct score

Submit all correct answers.

Expected:
- Backend calculates 100%.
- Result matches stored answer key.

## QUIZ-008 — Incorrect and unanswered answers

Submit incorrect and partial answers.

Expected:
- Incorrect and unanswered questions count as incorrect.
- Score and percentage are calculated by backend.

## QUIZ-009 — Invalid submission

Try unknown question ID, unknown option ID, duplicate answer, malformed payload, and another user's quiz.

Expected:
- Invalid submissions are rejected.
- No score is saved for invalid data.
- Cross-user access is denied.

## QUIZ-010 — Attempt persistence

Submit an attempt and reload history.

Expected:
- Attempt, score, and timestamp are persisted.
- Review shows correct answers and explanations only after submission.

---

# 11. Mathematical solver tests

## MATH-001 — Arithmetic

Input: `25 * (8 + 2)`

Expected final answer: `250`.

## MATH-002 — Linear equation

Input: `2x + 6 = 14`

Expected final answer: `x = 4`.

## MATH-003 — Quadratic equation

Input: `x^2 - 5x + 6 = 0`

Expected roots: `x = 2` and `x = 3`.

## MATH-004 — No real roots

Input: `x^2 + 1 = 0` over the real numbers.

Expected:
- Correctly reports no real roots.
- If complex roots are supported, reports `i` and `-i` with the domain made explicit.

## MATH-005 — Infinite or no-solution linear equation

Test `0x = 0` and `0x = 5`.

Expected:
- First is identified as infinitely many solutions.
- Second is identified as no solution.

## MATH-006 — Image-derived equation

Use a clear equation image.

Expected:
- Extracted expression is confirmed or displayed.
- Solver result is based on the extracted expression.
- Uncertain symbols trigger clarification.

## MATH-007 — Ambiguous expression

Input with unclear grouping, such as `1/2x` where interpretation matters.

Expected:
- System asks whether the user means `(1/2)*x` or `1/(2x)` when context cannot resolve it.

## MATH-008 — Verification

Expected:
- Deterministic engine result is compared with the proposed answer.
- `passed`, `failed`, `not_available`, or `ambiguous` is accurate.
- A failed verification is never labeled passed.

## MATH-009 — Unsafe expression

Try Python-like code, imports, file access, function calls, and malicious payloads.

Expected:
- No arbitrary code executes.
- Safe parser rejects unsupported syntax.
- Execution is time/complexity bounded.

## MATH-010 — Unsupported advanced problem

Expected:
- System explains the current limitation.
- It does not invent a verified solution.

---

# 12. Logical solver tests

## LOGIC-001 — Deductive reasoning

Input: `All A are B. All B are C. Are all A also C?`

Expected: `Yes`, with a valid explanation.

## LOGIC-002 — Syllogism with invalid conclusion

Input: `All cats are animals. Some animals are dogs. Therefore some cats are dogs.`

Expected:
- Conclusion is not logically guaranteed.
- Explanation identifies the invalid inference.

## LOGIC-003 — Propositional truth table

Test a known expression such as `P AND NOT P`.

Expected:
- Expression is false for every assignment.
- Truth-table result is deterministic.

## LOGIC-004 — Sequence/pattern question

Use a simple sequence with a clear intended rule.

Expected:
- System states the inferred rule.
- If multiple rules are plausible, it acknowledges ambiguity.

## LOGIC-005 — Assumptions

Provide an underspecified puzzle.

Expected:
- Assumptions are listed.
- Clarification is requested if assumptions materially change the answer.

## LOGIC-006 — No fabricated proof

Use an invalid argument.

Expected:
- System does not present an unsupported conclusion as proven.
- Confidence and explanation are appropriately cautious.

---

# 13. Follow-up and context tests

## CONTEXT-001 — Follow-up on active source

Upload notes and ask a question referring to `this topic`.

Expected:
- Correct active source is used.

## CONTEXT-002 — Multiple possible sources

Upload two unrelated sources and ask `Summarize this`.

Expected:
- System asks which source is intended.

## CONTEXT-003 — Explicit source selection

Provide a valid source ID owned by the user.

Expected:
- That source is used, regardless of the most recently uploaded source.

## CONTEXT-004 — Cross-user source ID

Provide another user's source ID.

Expected:
- Access is denied.
- No source content is included in the AI prompt.

## CONTEXT-005 — Token/context limit

Use long conversation and source content.

Expected:
- Context is bounded.
- Relevant content is selected.
- System does not silently exceed configured model limits.

---

# 14. Learning history tests

## HIST-001 — History listing

Create conversations, uploads, summaries, quizzes, attempts, and solver results.

Expected:
- All supported activity types appear.
- Results are ordered newest first.

## HIST-002 — Pagination

Create enough records to exceed one page.

Expected:
- No duplicates or missing records across pages.
- Ordering remains stable.

## HIST-003 — Cross-user history

Expected:
- User sees only their own activity.

## HIST-004 — Delete source

Expected:
- Confirmation is required for destructive action.
- Dependent-resource policy is applied consistently.
- Deleted source is not accessible through API.

## HIST-005 — Telegram/web shared history

Create an activity through Telegram using a linked account.

Expected:
- Same activity appears on website history.
- Internal user ID is consistent.

---

# 15. Telegram bot tests

## TG-001 — `/start`

Expected:
- Welcome message is sent.
- Unlinked user receives safe linking instructions.
- Linked user receives normal usage instructions.

## TG-002 — `/help`

Expected:
- Supported commands and examples are shown.

## TG-003 — Normal text

Expected:
- Message reaches shared backend.
- Result is sent to the correct Telegram chat.
- Activity is stored for the linked internal user.

## TG-004 — Image message

Expected:
- Bot retrieves the correct Telegram file.
- File validation runs.
- Processing job is created.
- User receives acknowledgement and final result.

## TG-005 — Inline action

Tap Summarize, Generate Quiz, or Explain Topic.

Expected:
- Correct backend operation runs.
- Callback is acknowledged.
- Duplicate callback delivery does not create duplicate results.

## TG-006 — Long response

Expected:
- Message is split safely within Telegram limits.
- Formatting entities are valid.
- No content is silently truncated.

## TG-007 — Formatting fallback

Fake a message parse error.

Expected:
- Bot retries as plain text.
- No infinite retry loop occurs.

## TG-008 — Unlinked user

Expected:
- Bot does not attach activity to an arbitrary account.
- User receives account-linking instructions.

## TG-009 — Invalid webhook secret/signature

Expected:
- Update is rejected.
- No business action is performed.

## TG-010 — Telegram provider/API outage

Expected:
- Failure is logged safely.
- User/job state remains consistent.
- Retry is bounded.

## TG-011 — Telegram and web parity

Perform one general question, one image analysis, one summary, and one quiz action through both clients.

Expected:
- Shared backend behavior and schemas are consistent.
- Interface-specific formatting may differ.

---

# 16. Website UI tests

## WEB-001 — Responsive layout

Test desktop, tablet, and mobile viewport sizes.

Expected:
- Navigation and core workflows remain usable.
- No essential control is clipped or inaccessible.

## WEB-002 — Dashboard

Expected:
- Welcome, quick actions, and recent activity render.
- Empty state appears for a new account.

## WEB-003 — Chat

Expected:
- New conversation works.
- Messages appear in correct order.
- Loading indicator appears during processing.
- Recoverable errors preserve unsent input.

## WEB-004 — Upload

Expected:
- Drag-and-drop and file picker work.
- Upload progress and job status are visible.
- Invalid file errors are understandable.

## WEB-005 — Summary workspace

Expected:
- Headings, lists, formulas, and key terms render correctly.
- Copy action copies expected content.
- Regeneration follows quota rules.

## WEB-006 — Quiz workspace

Expected:
- Questions and options render.
- Navigation/progress work.
- Submit confirmation works.
- Answers cannot be changed after final submission unless retake behavior is explicitly supported.
- Review displays explanations after submission.

## WEB-007 — Solver pages

Expected:
- Text and optional image input work.
- Steps, final answer, and verification status are visible.
- Ambiguity prompts are actionable.

## WEB-008 — History and settings

Expected:
- History opens the correct resource.
- Delete confirmation works.
- Telegram linking status is accurate.

## WEB-009 — Accessibility basics

Expected:
- Inputs have labels.
- Buttons are keyboard accessible.
- Focus is visible.
- Color is not the only way to communicate status.
- Images have useful alternative text where appropriate.

## WEB-010 — Error and empty states

Expected:
- Network failure, empty history, no search results, failed job, and quota limit have clear UI states.
- Raw stack traces are never shown.

---

# 17. Background job and reliability tests

## JOB-001 — Job lifecycle

Expected:
- Job transitions only through valid states.
- Completion includes a result reference.
- Failure includes a safe error code.

## JOB-002 — Ownership

Expected:
- User cannot inspect another user's job.

## JOB-003 — Worker restart

Stop worker while jobs are queued, restart it.

Expected:
- Accepted queued jobs are not silently lost.
- Jobs resume or fail visibly according to the queue design.

## JOB-004 — Transient failure retry

Simulate a temporary provider timeout.

Expected:
- Bounded retry occurs.
- Job completes if a later attempt succeeds.

## JOB-005 — Permanent failure

Simulate invalid input or provider authentication failure.

Expected:
- No endless retry.
- Job reaches failed state with safe error.

## JOB-006 — Idempotency

Deliver the same job/event twice.

Expected:
- No duplicate summary, quiz, or attempt is created.

## JOB-007 — Concurrent jobs

Submit multiple jobs for one user and multiple users.

Expected:
- Configured concurrency limits are respected.
- One user's workload does not corrupt another's job.

---

# 18. AI provider abstraction tests

## AI-001 — Text provider contract

Fake provider returns a valid text result.

Expected:
- Adapter normalizes it to the internal response format.

## AI-002 — Vision provider contract

Fake vision provider returns valid extraction data.

Expected:
- Image service receives normalized output.

## AI-003 — Capability routing

Send text and image requests.

Expected:
- Text uses a text-capable provider.
- Image uses a vision-capable provider.
- Text-only model is never selected for image analysis.

## AI-004 — Provider replacement

Swap provider configuration without changing feature-service code.

Expected:
- Same internal contract continues to work.

## AI-005 — Rate limit and timeout

Expected:
- Errors normalize to stable application errors.
- Bounded backoff/fallback works where configured.

## AI-006 — Invalid structured output

Expected:
- Schema validator catches invalid output.
- One repair attempt maximum.
- No malformed result is persisted as complete.

## AI-007 — Secret handling

Inspect logs, API responses, frontend bundles, and repository.

Expected:
- No provider key or Telegram token is exposed.

---

# 19. Usage, security, and privacy tests

## SEC-001 — Rate limiting

Send requests above configured threshold.

Expected:
- Further requests are limited.
- Response uses stable error code.
- Limits apply across Telegram and web for the same user.

## SEC-002 — Quota enforcement

Exceed daily or per-feature quota.

Expected:
- Provider is not called after quota rejection.
- Usage is not double-counted for rejected requests.

## SEC-003 — Private file access

Try direct unauthenticated access to stored file paths/URLs.

Expected:
- Access is denied.

## SEC-004 — Path traversal

Try filenames and paths containing traversal patterns.

Expected:
- No file outside the intended storage area can be read or overwritten.

## SEC-005 — Injection and unsafe input

Test HTML/JavaScript payloads, SQL-like strings, prompt-injection text in uploaded content, and unsafe math syntax.

Expected:
- No script executes in the website.
- Database queries remain parameterized.
- Uploaded content is treated as untrusted data, not system instructions.
- Unsafe math syntax is rejected.

## SEC-006 — Sensitive logging

Search test logs for known fake secrets, passwords, cookies, and linking tokens.

Expected:
- No secrets appear.

## SEC-007 — Deletion behavior

Delete an account-owned resource.

Expected:
- It becomes inaccessible.
- Dependent records follow documented policy.
- Private stored file is removed or queued for deletion as specified.

## SEC-008 — CORS and browser security

Expected:
- Only configured origins are allowed.
- Security headers and cookie settings match deployment configuration.

---

# 20. API contract tests

For every endpoint in `feature.md`:

- Verify method and path.
- Verify authentication requirement.
- Verify request schema and validation.
- Verify success response schema.
- Verify error response schema.
- Verify ownership enforcement.
- Verify pagination where applicable.
- Verify no internal fields leak.
- Verify status codes are consistent.

Required endpoint groups:
- Authentication
- Conversations and chat
- Uploads and jobs
- Extracted content
- Summaries
- Quizzes and attempts
- Math and logic solvers
- Telegram linking

---

# 21. End-to-end acceptance scenarios

## E2E-001 — Complete website learning flow

1. Register and sign in.
2. Upload `bst_notes.png`.
3. Wait for extraction job to complete.
4. Inspect topic and extracted content.
5. Generate an exam-notes summary.
6. Generate a five-question MCQ quiz.
7. Answer questions and submit.
8. Review score and explanations.
9. Ask a follow-up question about the source.
10. Open learning history.

Expected:
- Every step works.
- Source context is reused.
- Records appear in history.
- No answer key is exposed before submission.

## E2E-002 — Complete Telegram learning flow

1. Link Telegram account.
2. Send a normal educational question.
3. Send an educational image.
4. Use inline Summarize action.
5. Generate a quiz.
6. Submit quiz answers.
7. Open website history.

Expected:
- Same internal account is used.
- Telegram actions call shared backend services.
- Website shows the resulting activity.

## E2E-003 — Math and logic flow

1. Submit a supported math equation.
2. Check steps and deterministic verification.
3. Submit a logic problem.
4. Check reasoning, assumptions, and conclusion.

Expected:
- Correct results for fixed fixtures.
- Verification and uncertainty labels are accurate.

## E2E-004 — Cross-user security flow

1. Create User A and User B.
2. Create resources under User A.
3. Attempt to access them using User B from API, website routes, and job endpoints.

Expected:
- All access attempts are rejected.
- No private data is leaked.

## E2E-005 — Provider outage flow

1. Start a valid operation.
2. Configure fake provider to fail.
3. Observe job and UI/Telegram status.
4. Restore provider and retry if allowed.

Expected:
- No fabricated result.
- Safe failure is visible.
- Retry does not create duplicate resources.

---

# 22. Release gate

A milestone may be marked complete only when:

- All tests assigned to that milestone have been run.
- All required tests pass.
- No known critical/high security defect remains.
- Relevant regression tests pass.
- Lint, type-check, and build commands pass.
- Test evidence is recorded.
- Documentation is updated.
- Agent reports limitations honestly.

Do not mark a test `PASS` because code looks correct or because an AI provider returned a plausible answer. Execute the test.

## 23. Test report template

```text
Milestone:
Commit / branch:
Environment:
Date:

Commands executed:
1.
2.
3.

Results:
- Passed:
- Failed:
- Blocked:
- Not run:

Failed test IDs:
- 

Security checks:
- 

Known limitations:
- 

Overall status: PASS / FAIL / BLOCKED

Evidence:
- Test report path:
- Screenshot/log/request IDs:
```
