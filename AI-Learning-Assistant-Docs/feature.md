# AI Learning Assistant — Feature Specification

**Audience:** AI coding agents and developers  
**Status:** MVP implementation specification  
**Related document:** `architecture.md`

## 1. Purpose

Build a multimodal AI learning assistant with two interfaces:

- **Telegram bot:** accepts text questions and educational images.
- **Web application:** provides chat, uploads, summaries, quizzes, problem solving, and learning history.

Both clients must use the same backend services, database, AI provider layer, and user identity. This document defines expected behavior, data contracts, validation, security, and acceptance criteria. Treat it as the functional source of truth alongside `architecture.md`.

## 2. Product principles

1. **One backend:** Do not duplicate AI or business logic in Telegram handlers and frontend code.
2. **Provider independence:** Application services call an internal AI interface, never a provider SDK directly.
3. **Reusable context:** Extract uploaded material once and reuse the saved context for summaries, quizzes, and follow-up questions.
4. **Structured output:** Validate AI-generated JSON against schemas before saving or displaying it.
5. **Honest results:** Identify uncertainty, unsupported inputs, and failed verification. Never fabricate successful processing.
6. **MVP first:** Do not add voice, subscriptions, collaborative classrooms, or personalized recommendations unless requested.

## 3. Users and identity

### 3.1 Registered user

A user can:
- Register and sign in on the website.
- Link one Telegram account.
- Ask questions and upload images.
- View their own conversations and learning resources.
- Generate summaries and quizzes.
- Submit quiz attempts and review scores.
- Use math and logic solvers.
- View and delete their own learning history.

### 3.2 Identity rules

- Every persistent resource belongs to an internal `user_id`.
- Telegram `telegram_id` is an external identity, not the primary application user ID.
- One Telegram account can be linked to only one application user.
- Do not link accounts based on usernames or display names.
- All private-resource queries must enforce ownership on the backend.
- Guest access is optional. If implemented, guest data must be temporary and isolated from registered users.

## 4. Shared user experience

Website pages:
1. Dashboard
2. AI Chat
3. Upload / Analyze
4. Summaries
5. Quizzes
6. Math Solver
7. Logic Solver
8. Learning History
9. Settings

Both clients should support the core actions: ask, upload, summarize, generate quiz, explain, solve, and follow up. The website may offer richer controls; Telegram uses messages, commands, and inline keyboards.

Every long-running operation must expose a status: `queued`, `processing`, `completed`, or `failed`.

---

## 5. F-01 — Website authentication

### Behavior

- Implement email/password authentication or a trusted authentication provider.
- Validate email and password requirements.
- If passwords are stored, hash them using a modern password-hashing algorithm.
- Use secure HTTP-only cookies for browser sessions where practical.
- Provide sign-in, sign-out, and account recovery if password authentication is used.
- Never expose password hashes, session secrets, or provider credentials.

### Acceptance criteria

- Users can register, sign in, and sign out.
- Invalid credentials return a generic error.
- Protected endpoints reject unauthenticated requests.
- One user cannot access another user's records.
- Authentication survives a normal page refresh.

---

## 6. F-02 — Telegram account linking

### Website-to-Telegram flow

1. User opens Settings and selects **Link Telegram**.
2. Backend creates a cryptographically random, single-use token.
3. Token expires after a short period, recommended 5–10 minutes.
4. Website displays a Telegram deep link containing the token.
5. User opens the bot.
6. Bot sends the token and verified Telegram identity to the backend.
7. Backend validates the token, links the Telegram ID, and invalidates the token.
8. Website shows linked status.

### Security requirements

- Store tokens securely, preferably as hashes.
- Reject expired, used, malformed, or already-claimed tokens.
- Never trust a Telegram ID supplied by an arbitrary website client.
- Provide an authenticated unlink action.
- Do not allow one Telegram ID to be linked to multiple application users.

### Acceptance criteria

- A user can link through the bot deep link.
- Telegram and website activity is associated with the same internal user.
- Reused or expired tokens fail.
- An already-linked Telegram account cannot be claimed by another user.

---

## 7. F-03 — Text questions and AI chat

### Input

```json
{
  "conversation_id": "optional-id",
  "message": "Explain binary search trees",
  "source_content_id": null
}
```

### Processing

1. Authenticate the user and validate input.
2. Create or load the requested conversation.
3. Save the user message.
4. Classify intent and topic.
5. Route to the relevant service.
6. Include only relevant conversation/source context within a configured token budget.
7. Generate and validate the response.
8. Save the assistant response.
9. Return the response or a background job ID.

### Supported intents

- `general_question`
- `summarize`
- `generate_quiz`
- `math_solve`
- `logic_solve`
- `explain_topic`
- `follow_up`
- `unknown`

Example classifier result:

```json
{
  "intent": "general_question",
  "subject": "Computer Science",
  "topic": "Data Structures",
  "subtopic": "Binary Search Tree",
  "difficulty": "beginner",
  "confidence": 0.94,
  "requires_source_context": false
}
```

`confidence` must be between 0 and 1. Use `unknown` when classification is uncertain. Ask a short clarification question when ambiguity could lead to the wrong workflow.

### Conversation rules

- Context must come from the selected conversation only.
- Include source material only if it belongs to the current user.
- Limit context by recent message count and/or token budget.
- Allow users to start a new conversation.
- Give conversations a default title based on the first user message.
- Do not mix context between conversations.

### Acceptance criteria

- Text questions receive answers.
- Messages are stored in the correct conversation.
- Follow-up questions use relevant earlier context.
- Unknown intent does not crash the request.
- Provider failures produce a useful error.

---

## 8. F-04 — Image upload and understanding

### Purpose

Understand educational images, including lecture slides, textbook pages, handwritten notes, equations, diagrams, tables, flowcharts, circuit diagrams, and scientific illustrations.

### MVP formats

- JPEG / JPG
- PNG
- WEBP, if supported by the selected vision provider

PDF and multi-document processing are later enhancements unless explicitly added to the MVP.

### Validation and storage

- Enforce a configurable maximum upload size.
- Verify actual file content/type; do not trust filename or client MIME type alone.
- Reject unsupported, empty, corrupted, or excessively large files.
- Apply image dimension limits or safely resize large images.
- Generate random storage names.
- Store uploads privately, outside the public web root or in private object storage.
- Do not expose private storage paths to clients.
- Check user quota before invoking the AI provider.

### Processing workflow

1. Receive and validate image.
2. Store privately and create an upload record.
3. Create a processing job.
4. Send image to a vision-capable model.
5. Request extracted text, concepts, equations, diagram/table descriptions, and uncertainty notes.
6. Detect topic and subtopics.
7. Validate structured output.
8. Save extracted content and metadata.
9. Mark job complete.
10. Display extracted context and actions: Summarize, Generate Quiz, Explain, Ask Follow-up.

### Extracted-content contract

```json
{
  "title": "Introduction to Neural Networks",
  "subject": "Computer Science",
  "topic": "Artificial Intelligence",
  "subtopics": ["Neural Networks", "Activation Functions"],
  "extracted_text": "A neural network consists of...",
  "key_concepts": [
    {
      "name": "Neuron",
      "description": "A computational unit that receives inputs and produces an output."
    }
  ],
  "equations": [],
  "visual_elements": [
    {
      "type": "diagram",
      "description": "A network with an input layer, hidden layer, and output layer."
    }
  ],
  "uncertainties": ["Text at the bottom-right corner is blurry."],
  "language": "en"
}
```

This is the baseline schema. It may be extended, but field meanings and types must remain consistent across providers.

### Image-understanding rules

- Distinguish visible extracted text from AI interpretation.
- Do not invent unreadable text.
- Report unclear regions.
- Preserve uncertainty in handwritten equations and symbols.
- Identify multiple topics if the image contains unrelated material.
- If no educational context is detected, say so rather than inventing a topic.
- OCR may support extraction, but a vision-language model must interpret diagrams and relationships.

### Acceptance criteria

- Website and Telegram can submit valid images.
- The system returns extracted context and topic metadata.
- Unclear content is reported.
- The upload and extracted content belong to the correct user.
- Summary and quiz generation can reuse extracted context without re-uploading.

---

## 9. F-05 — Topic and intent detection

### Output contract

```json
{
  "subject": "Mathematics",
  "topic": "Algebra",
  "subtopic": "Quadratic Equations",
  "difficulty": "intermediate",
  "input_type": "image",
  "intent": "math_solve",
  "confidence": 0.91,
  "needs_clarification": false,
  "clarification_question": null
}
```

### Rules

- Difficulty: `beginner`, `intermediate`, `advanced`, or `unknown`.
- Input type: use a controlled enum such as `text`, `image`, or `document`.
- Use `unknown` when a value cannot be identified reliably.
- Do not classify based on one keyword if the complete question suggests otherwise.
- Use conversation context only when relevant.
- Support multiple topics through a list or a primary topic plus related topics.
- Ask for clarification if intent is ambiguous.

### Acceptance criteria

- All providers map to the same internal schema.
- Low-confidence results are handled safely.
- Topic metadata is stored with the relevant source or conversation.

---

## 10. F-06 — Summarization

### User actions

- Summarize a text passage.
- Summarize an uploaded image's extracted content.
- Summarize saved source content.
- Select a summary style.

### Styles

| Style | Expected content |
|---|---|
| `short` | Main idea and essential points |
| `detailed` | Organized explanation of important material |
| `exam_notes` | Definitions, key points, formulas, and revision topics |

### Output contract

```json
{
  "title": "Binary Search Tree",
  "topic": "Data Structures",
  "style": "exam_notes",
  "overview": "A Binary Search Tree is a binary tree...",
  "sections": [
    {
      "heading": "Properties",
      "points": [
        "Values smaller than a node are placed in its left subtree.",
        "Values larger than a node are placed in its right subtree."
      ]
    }
  ],
  "key_terms": [
    {
      "term": "Root",
      "definition": "The topmost node of a tree."
    }
  ],
  "examples": [],
  "formulas": [],
  "revision_points": ["Understand the BST ordering property."]
}
```

### Quality rules

- Preserve facts and relationships from the source.
- Do not present unsupported facts as source material.
- Keep technical terms accurate.
- Explain difficult terms simply when appropriate.
- Preserve important equations and conditions.
- State when the source is incomplete.
- Render structured content as readable Markdown or UI sections.

### Persistence

Save the summary with its source-content ID when available. For plain chat text, associate it with the conversation/message. Store style and creation timestamp.

### Acceptance criteria

- All three styles work.
- Output follows the schema.
- Website renders headings, lists, terms, and formulas.
- Telegram receives readable formatting.
- Summaries appear in learning history.

---

## 11. F-07 — Quiz generation and attempts

### User controls

- Source: uploaded content, conversation context, or explicitly entered topic.
- Question type: MCQ for the initial MVP.
- Question count: configurable, default 5; enforce a server-side maximum.
- Difficulty: beginner, intermediate, advanced.

### Quiz-generation contract

```json
{
  "title": "Binary Search Tree Quiz",
  "topic": "Data Structures",
  "difficulty": "beginner",
  "question_type": "mcq",
  "questions": [
    {
      "id": "q1",
      "question": "Which property defines a Binary Search Tree?",
      "options": [
        {"id": "A", "text": "All nodes have two children"},
        {"id": "B", "text": "Left values are smaller and right values are larger"},
        {"id": "C", "text": "All leaves are at the same level"},
        {"id": "D", "text": "Nodes are stored in sorted arrays"}
      ],
      "correct_option_id": "B",
      "explanation": "The BST ordering property places smaller values in the left subtree and larger values in the right subtree."
    }
  ]
}
```

### Critical answer-key rule

The quiz delivery endpoint must never return `correct_option_id` or explanations before submission. Keep answer keys on the backend. Return a separate safe response DTO containing only question text and options.

### Attempt workflow

1. User opens a quiz.
2. Backend verifies ownership.
3. Client receives questions without answer keys.
4. User selects answers.
5. User submits.
6. Backend validates question and option IDs.
7. Backend calculates score using stored answer keys.
8. Backend saves the attempt.
9. Backend returns score, correct answers, and explanations.
10. Client displays results and review.

### Scoring

- Equal weight per question in the MVP.
- `score = number of correct answers`.
- `percentage = correct / total × 100`.
- Unanswered questions count as incorrect.
- Backend score is authoritative; never trust a frontend-supplied score.

### Validation

- Reject duplicate question IDs.
- Require at least two options per MCQ.
- Enforce a configured maximum option count.
- Ensure correct option ID exists.
- Reject empty question or option text.
- Validate requested question count.
- If AI output is invalid, attempt one controlled repair; if still invalid, fail the job.

Future question types may include True/False, short answer, fill-in-the-blank, and conceptual questions. Do not implement automatic free-text grading in the MVP unless requested.

### Acceptance criteria

- Quizzes can be generated from source content or a topic.
- Answer keys remain private until submission.
- Backend calculates scores.
- Explanations appear after submission.
- Attempts are saved.
- Users cannot access another user's quizzes or attempts.

---

## 12. F-08 — Mathematical problem solver

### MVP scope

- Arithmetic
- Algebra
- Linear equations
- Quadratic equations
- Basic functions
- Basic differentiation and integration where supported by the symbolic engine

### Workflow

1. Receive problem text or image-extracted equation.
2. Normalize the expression without changing its meaning.
3. Classify the mathematical task.
4. Use SymPy or deterministic Python operations where appropriate.
5. Ask an AI model to explain the steps in understandable language.
6. Compare AI result with deterministic output when available.
7. Return steps, final answer, and verification status.
8. Ask for clarification if the expression is ambiguous.

### Output contract

```json
{
  "problem": "Solve x^2 - 5x + 6 = 0",
  "category": "quadratic_equation",
  "status": "solved",
  "steps": [
    {
      "step": 1,
      "explanation": "Factor the quadratic expression.",
      "expression": "(x - 2)(x - 3) = 0"
    },
    {
      "step": 2,
      "explanation": "Set each factor equal to zero.",
      "expression": "x - 2 = 0 or x - 3 = 0"
    }
  ],
  "final_answer": "x = 2 or x = 3",
  "verification": {
    "performed": true,
    "status": "passed",
    "method": "sympy"
  }
}
```

Verification status: `passed`, `failed`, `not_available`, or `ambiguous`.

### Safety and correctness

- Never use Python `eval` on user input.
- Use safe, restricted mathematical parsing.
- Apply execution time and complexity limits.
- Do not claim SymPy supports every advanced problem.
- Preserve uncertainty in image-derived symbols.
- If verification fails, disclose it; do not label the result verified.

### Acceptance criteria

- Supported problems return steps and a final answer.
- Deterministic results include verification status.
- Ambiguous expressions trigger clarification.
- Unsupported expressions return a useful error.
- User input cannot execute arbitrary code.

---

## 13. F-09 — Logical reasoning solver

### MVP scope

- Deductive reasoning
- Simple propositional logic
- Truth-table questions
- Syllogisms
- Pattern and sequence questions
- Basic constraint puzzles
- Short logical word problems

### Output contract

```json
{
  "problem": "If all A are B and all B are C, are all A also C?",
  "category": "deductive_reasoning",
  "status": "solved",
  "reasoning_steps": [
    "Every A belongs to the set of B.",
    "Every B belongs to the set of C.",
    "Therefore, every A belongs to the set of C."
  ],
  "final_answer": "Yes.",
  "assumptions": [],
  "confidence": 0.98
}
```

### Rules

- State assumptions explicitly.
- Distinguish facts in the question from assumptions.
- Ask for clarification when multiple interpretations are possible.
- Use deterministic truth-table evaluation for propositional logic when practical.
- Provide a concise explanation or proof, not hidden internal chain-of-thought.
- Do not present a guess as a proof.

### Acceptance criteria

- Supported questions return a conclusion and explanation.
- Assumptions are identified.
- Ambiguity is handled explicitly.
- Truth-table results are deterministic where applicable.

---

## 14. F-10 — Follow-up questions and source context

### Description

Allow users to ask follow-up questions about previously uploaded or extracted material.

Example:
1. User uploads a neural-network slide.
2. System extracts and stores its content.
3. User requests a summary.
4. User asks, "Explain the activation function in simpler words."
5. System answers using the saved source context.

### Context selection rules

- A request may include a `source_content_id`.
- If omitted, use the active source in the current conversation only when unambiguous.
- If multiple sources could match, ask which source the user means.
- Never retrieve another user's source.
- Do not include every uploaded file in every prompt.
- Apply token limits and select relevant context.

### Acceptance criteria

- Follow-ups use the correct source.
- Users can switch sources.
- Ambiguous references trigger clarification.
- Context is isolated by user and conversation.

---

## 15. F-11 — Learning history

### Stored activity

- Conversations and messages
- Uploaded files
- Extracted content
- Summaries
- Quizzes
- Quiz attempts and scores
- Math solutions
- Logic solutions

### Behavior

- List recent activity in reverse chronological order.
- Show item type, title/topic, and creation date.
- Allow users to open items.
- Use pagination or cursor-based loading.
- Allow deletion of user-owned items.
- Define a consistent deletion policy for dependent summaries and quizzes when a source is deleted. Use confirmation before destructive actions.

### Acceptance criteria

- Users see only their own history.
- Telegram-created content appears on the website for linked accounts.
- Pagination works.
- Deleted content is no longer accessible through normal API endpoints.

---

## 16. F-12 — Telegram bot

### Commands

| Command | Behavior |
|---|---|
| `/start` | Welcome and account-linking instructions |
| `/help` | Usage instructions |
| `/summarize` | Explain/start summary workflow |
| `/quiz` | Explain/start quiz workflow |
| `/solve` | Start problem-solving workflow |
| `/history` | Show recent saved activity |
| `/website` | Send website URL |

The bot must also accept ordinary text messages without requiring commands.

### Text-message flow

1. Receive update through webhook.
2. Verify the webhook secret.
3. Identify Telegram user.
4. Find linked internal user account.
5. If unlinked, provide linking instructions unless an explicit guest policy exists.
6. Call the shared backend service.
7. Format and send the result.
8. Save activity under the internal user ID.

### Image flow

1. Receive image metadata.
2. Select a suitable image size within configured limits.
3. Retrieve the file using Telegram's file API.
4. Validate the downloaded file.
5. Submit it to the shared image-processing service.
6. Send a processing acknowledgement.
7. Send the result when the job completes.

### Inline actions

Provide buttons such as:
- Summarize
- Generate Quiz
- Explain Topic
- Ask Follow-up

Use short opaque callback identifiers. Do not place sensitive data or full prompts in callback data.

### Telegram-specific requirements

- Split long responses to comply with Telegram message limits.
- Escape Markdown/HTML for the selected parse mode.
- If formatting fails, retry as plain text.
- Deliver quizzes in manageable batches or with pagination.
- Keep handlers thin: no duplicated AI business logic.
- Show clear errors for unsupported files, unreadable images, provider outages, rate limits, and unlinked accounts.

### Acceptance criteria

- `/start` and `/help` work.
- Normal text and image messages work.
- Inline actions call shared backend services.
- Long responses are handled safely.
- Telegram does not contain a separate implementation of AI workflows.

---

## 17. F-13 — Website interfaces

### Dashboard

Display:
- Welcome message
- Ask/upload input
- Quick actions
- Recent conversations
- Recent summaries
- Recent quizzes and scores
- Usage information, if enabled

### AI chat

Support:
- Conversation list
- New conversation
- Message history
- Text input
- Image upload
- Processing indicators
- Follow-up questions
- Error and retry states

### Upload/analyze

Support:
- Drag-and-drop and file picker
- Upload progress
- Processing status
- Extracted text and topic
- Uncertainty warnings
- Summarize and Generate Quiz actions

### Summary workspace

Support:
- Structured summary rendering
- Style indicator
- Source link
- Copy action
- Regenerate action subject to usage limits

### Quiz workspace

Support:
- Question navigation
- Answer selection
- Progress indicator
- Submit confirmation
- Score and explanations
- Review of correct and incorrect answers

### Solver pages

Support:
- Text input
- Optional image input
- Step-by-step result
- Final answer
- Verification status where relevant
- Follow-up question

### General UI requirements

- Responsive desktop, tablet, and mobile layouts.
- Accessible labels and keyboard navigation.
- Clear loading, empty, success, and error states.
- Never display raw stack traces or provider errors.
- Consistent visual design.
- Preserve unsent input after recoverable failures.

---

## 18. F-14 — REST API contract

Use versioned endpoints under `/api/v1`. Keep response envelopes consistent.

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Sign in |
| POST | `/api/v1/auth/logout` | Sign out |
| GET | `/api/v1/auth/me` | Current user |

### Conversations and chat

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/conversations` | List conversations |
| POST | `/api/v1/conversations` | Create conversation |
| GET | `/api/v1/conversations/{id}` | Get conversation |
| DELETE | `/api/v1/conversations/{id}` | Delete conversation |
| POST | `/api/v1/chat/messages` | Send a message |

### Uploads and jobs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/uploads/images` | Upload image |
| GET | `/api/v1/jobs/{job_id}` | Get job status |
| GET | `/api/v1/contents/{content_id}` | Get extracted content |
| DELETE | `/api/v1/contents/{content_id}` | Delete source content |

Use multipart form data for image uploads.

### Summaries

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/summaries` | Generate summary |
| GET | `/api/v1/summaries` | List summaries |
| GET | `/api/v1/summaries/{id}` | Get summary |
| DELETE | `/api/v1/summaries/{id}` | Delete summary |

Example request:

```json
{
  "source_content_id": "content-id",
  "style": "exam_notes"
}
```

### Quizzes

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/quizzes/generate` | Generate quiz |
| GET | `/api/v1/quizzes` | List quizzes |
| GET | `/api/v1/quizzes/{id}` | Get quiz without answer keys |
| POST | `/api/v1/quizzes/{id}/attempts` | Submit answers |
| GET | `/api/v1/quizzes/{id}/attempts` | List attempts |

Example generation request:

```json
{
  "source_content_id": "content-id",
  "topic": null,
  "question_type": "mcq",
  "difficulty": "beginner",
  "question_count": 5
}
```

Example attempt request:

```json
{
  "answers": [
    {
      "question_id": "q1",
      "selected_option_id": "B"
    }
  ]
}
```

### Solvers

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/solve/math` | Solve math problem |
| POST | `/api/v1/solve/logic` | Solve logic problem |

### Telegram linking

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/telegram/link-token` | Create one-time token |
| POST | `/api/v1/telegram/complete-link` | Complete linking through bot |
| DELETE | `/api/v1/telegram/link` | Unlink account |

The completion endpoint must verify the Telegram identity through the trusted bot integration.

### Response format

Success:

```json
{
  "data": {},
  "request_id": "request-id"
}
```

Error:

```json
{
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "This file type is not supported."
  },
  "request_id": "request-id"
}
```

Never return stack traces, API keys, provider credentials, or private storage paths.

---

## 19. F-15 — Background jobs

### Job lifecycle

```text
queued -> processing -> completed
                     -> failed
```

### Job fields

- `id`
- `user_id`
- `job_type`
- `status`
- `progress_message` or percentage, if available
- `input_resource_id`
- `result_resource_id`
- `error_code`
- `created_at`
- `started_at`
- `completed_at`

### Requirements

- Return a job ID promptly for long-running tasks.
- A worker processes the job.
- Clients can retrieve status.
- Enforce job ownership.
- Make retries idempotent to prevent duplicate summaries or quizzes.
- Retry only transient errors, with a bounded retry count.
- Do not endlessly retry invalid input.
- Store safe error codes, not secrets or raw provider responses.
- Show users a useful failure message and retry option when appropriate.

### Acceptance criteria

- Long tasks do not block API requests until completion.
- Job status is visible to its owner.
- Worker restarts do not silently lose accepted jobs.
- Retries do not create duplicate result records.

---

## 20. F-16 — AI provider abstraction and routing

### Internal interface

```python
class AIProvider:
    async def generate_text(self, request):
        ...

    async def analyze_image(self, request):
        ...
```

Separate protocols/classes may be used for text and vision capabilities.

### Configuration

```env
AI_DEFAULT_PROVIDER=
AI_FALLBACK_PROVIDER=
AI_API_KEY=
AI_MODEL_TEXT=
AI_MODEL_VISION=
```

Use placeholders in `.env.example`. Never commit real credentials.

### Router responsibilities

- Select a provider based on task and capability.
- Ensure image requests go only to vision-capable providers.
- Apply timeouts.
- Normalize errors and output.
- Handle rate limits.
- Use fallback only if it supports the requested capability.
- Validate structured output.
- Record provider/model metadata and usage when available.

### Error handling

- Rate limit: respect retry instructions or use bounded backoff.
- Timeout: retry a limited number of times or use a compatible fallback.
- Authentication/configuration failure: do not repeatedly retry.
- Invalid model output: one controlled repair attempt, then fail safely.
- Provider outage: return a clear temporary-unavailable message.

### Acceptance criteria

- Application services use the internal interface.
- A provider can be replaced without rewriting summary or quiz services.
- Vision tasks never route to text-only models.
- Fallback behavior is bounded and observable.
- Credentials remain server-side.

---

## 21. F-17 — Usage limits and cost protection

Implement configurable controls:

- Maximum image size
- Requests per user per time window
- Concurrent jobs per user
- Maximum quiz question count
- Maximum input length
- Provider timeout
- Maximum retry count
- Daily usage counters
- Optional per-feature quotas

Rules:

- Check application quota before calling a provider.
- Apply limits to the internal user ID, so switching between Telegram and web does not bypass them.
- Track provider usage only to the extent the provider reports it.
- Do not invent token or cost figures.
- Cache only when the cache key includes all relevant input and privacy constraints.
- Do not place private user content in a globally shared cache.

---

## 22. F-18 — Security and privacy

Mandatory requirements:

1. Keep AI keys and Telegram tokens on the server.
2. Enforce authentication and ownership on every private resource.
3. Validate uploaded file content, not only filename.
4. Use random storage names and private storage.
5. Limit file size and dimensions.
6. Use HTTPS in production.
7. Apply rate limits.
8. Protect browser sessions against common web attacks.
9. Validate and sanitize user input.
10. Never use Python `eval` for mathematical input.
11. Do not expose quiz answer keys before submission.
12. Do not log secrets, session tokens, or unnecessary private content.
13. Define deletion behavior for user data.
14. Verify Telegram webhook requests.
15. Use secure, single-use account-linking tokens.

Privacy requirements:

- Explain what data is stored.
- Store only data needed for the features.
- Define file retention and deletion behavior.
- Send content to an AI provider only when required for the user's requested operation.
- Do not use uploads for model training.
- Disclose provider retention/training behavior accurately when relevant.

---

## 23. F-19 — Error handling

Use stable error codes.

| Code | Meaning | User-facing behavior |
|---|---|---|
| `UNAUTHENTICATED` | Sign-in required | Ask user to sign in |
| `FORBIDDEN` | Resource inaccessible | Show access error |
| `INVALID_INPUT` | Malformed request | Explain required input |
| `INVALID_FILE_TYPE` | Unsupported file | List supported formats |
| `FILE_TOO_LARGE` | Upload exceeds limit | Show maximum size |
| `IMAGE_UNREADABLE` | Image cannot be understood | Ask for clearer image |
| `LOW_CONFIDENCE` | Uncertain extraction/classification | Show uncertainty or clarify |
| `QUOTA_EXCEEDED` | User limit reached | Explain retry timing if known |
| `PROVIDER_RATE_LIMITED` | Provider rate limit | Ask user to retry later |
| `PROVIDER_UNAVAILABLE` | Provider outage | Offer retry |
| `INVALID_AI_OUTPUT` | Invalid structured response | Repair once, then fail |
| `JOB_NOT_FOUND` | Job missing or inaccessible | Show not found |
| `JOB_FAILED` | Background task failed | Show safe failure message |
| `AMBIGUOUS_PROBLEM` | Multiple interpretations | Ask for clarification |

Never expose stack traces or raw internal exception details. Include a request ID for support/debugging.

---

## 24. F-20 — Logging and monitoring

Log:
- Request ID
- Internal user ID where appropriate
- Endpoint and operation
- Job ID
- Provider and model
- Processing duration
- Safe error code
- Usage metadata returned by provider

Never log:
- API keys
- Telegram bot tokens
- Passwords
- Session cookies
- Account-linking tokens
- Unnecessary full user content
- Private file URLs or credentials

Basic metrics:
- Requests per feature
- Successful and failed AI calls
- Provider latency
- Queue length
- Job completion time
- Rate-limit events
- Upload failures
- Quiz-generation failures

---

## 25. Testing requirements

### Unit tests

Test:
- Intent and topic schema validation
- Summary schema validation
- Quiz schema validation
- Quiz scoring
- Math parsing and verification
- Ownership checks
- Usage-limit calculations
- Provider error normalization

### Integration tests

Test:
- Backend with PostgreSQL
- Backend with Redis and worker
- Provider adapters using mocks/test doubles
- Website upload flow
- Telegram webhook flow
- Account linking
- Job creation, retry, and completion

### End-to-end scenarios

1. Website user registers, uploads an image, and receives extracted content.
2. User generates a summary from the content.
3. User generates an MCQ quiz from the same content.
4. User submits answers and receives a backend-calculated score.
5. User asks a follow-up about the source.
6. User solves a supported math problem and receives verification status.
7. User sends a Telegram question and receives an answer.
8. User links Telegram and sees shared history.
9. User A cannot access User B's conversations, files, quizzes, or jobs.
10. Provider failure produces a safe error without corrupting saved data.

Use synthetic educational examples. Do not commit real credentials or private user uploads.

---

## 26. Definition of done

A feature is complete only when:

- Backend behavior is implemented.
- API contract is documented.
- Input validation exists.
- Authorization and ownership checks exist.
- Loading, success, empty, and error states are handled.
- AI output is validated where applicable.
- Required data is persisted correctly.
- Unit and relevant integration tests pass.
- Telegram and website behavior is consistent for shared features.
- No secrets are committed.
- README explains configuration and execution.

---

## 27. Implementation order for an AI coding agent

Do not generate the entire application in one pass. Work milestone by milestone.

### Milestone 0 — Inspect and plan

1. Inspect the repository.
2. Read `architecture.md` and `feature.md`.
3. Identify existing code, dependencies, and conventions.
4. Write a concise implementation plan.
5. List decisions requiring clarification.
6. Do not overwrite existing work without understanding it.

**Exit condition:** A repository-aware plan exists and major unknowns are identified.

### Milestone 1 — Backend foundation

1. Create FastAPI application.
2. Add configuration and `.env.example`.
3. Add PostgreSQL connection and migrations.
4. Add user/authentication models.
5. Add consistent API responses and errors.
6. Add health-check endpoint.
7. Add tests.

**Exit condition:** Backend starts, migrations run, health check works, and authentication tests pass.

### Milestone 2 — AI provider foundation

1. Define provider interfaces.
2. Implement one text provider adapter.
3. Implement vision capability if supported by the chosen provider.
4. Add timeout and error normalization.
5. Add structured output validation.
6. Add mocked provider tests.

**Exit condition:** A backend service calls the provider through the abstraction and validates its output.

### Milestone 3 — Text learning features

1. Implement conversations and messages.
2. Implement intent/topic detection.
3. Implement general question answering.
4. Implement summaries.
5. Implement quiz generation.
6. Implement safe quiz delivery without answer keys.
7. Implement backend scoring and attempt history.
8. Implement math and logic endpoints.

**Exit condition:** Core text workflows pass API tests.

### Milestone 4 — Image understanding and jobs

1. Implement secure image upload.
2. Implement private storage.
3. Add Redis and background worker.
4. Add job lifecycle and status endpoint.
5. Implement image analysis and extraction.
6. Save reusable extracted context.
7. Connect context to summary and quiz generation.
8. Test failures, retries, and ownership.

**Exit condition:** An image is processed asynchronously and reused for later learning tasks.

### Milestone 5 — Telegram

1. Configure bot.
2. Implement webhook handling and verification.
3. Implement `/start` and `/help`.
4. Implement text messages.
5. Implement image messages.
6. Implement inline actions.
7. Implement account linking.
8. Reuse backend services for all AI work.

**Exit condition:** Telegram uses the shared backend without duplicated AI logic.

### Milestone 6 — Website

1. Create Next.js application.
2. Implement authentication.
3. Build dashboard and navigation.
4. Build AI chat.
5. Build upload and processing UI.
6. Build summary workspace.
7. Build quiz attempt/review UI.
8. Build math and logic solver pages.
9. Build history and settings.
10. Add Telegram linking.

**Exit condition:** All MVP workflows work through the website.

### Milestone 7 — Hardening and deployment

1. Add quotas and rate limits.
2. Review file and account security.
3. Add monitoring and safe logging.
4. Add production Docker configuration.
5. Configure HTTPS, environment variables, and database backups.
6. Run full test suite.
7. Document deployment and recovery.

**Exit condition:** Application can be deployed without development-only settings.

---

## 28. Instructions specifically for coding agents

- Follow `architecture.md` and this specification.
- Use a modular monolith for the MVP.
- Do not duplicate business logic in Telegram and website code.
- Do not hardcode credentials, user IDs, or deployment secrets.
- Keep provider-specific formats inside provider adapters.
- Never expose quiz answers before submission.
- Never trust frontend-supplied scores or ownership identifiers.
- Never use unsafe evaluation for mathematical expressions.
- Do not silently discard uploads or accepted jobs.
- Do not fabricate output when a provider fails.
- Add tests with each feature.
- Keep modules and functions understandable and maintainable.
- Update API docs and `.env.example` when configuration changes.
- If a requirement cannot be implemented, explain the limitation and propose the smallest compatible alternative.
- After each milestone, report: files changed, behavior implemented, tests run, results, known limitations, and next milestone.

---

## 29. MVP acceptance checklist

### Core AI
- [ ] Text questions are accepted.
- [ ] Intent and topic are detected.
- [ ] General questions receive answers.
- [ ] Short, detailed, and exam-note summaries work.
- [ ] MCQ quizzes can be generated from source context.
- [ ] Answer keys remain private until submission.
- [ ] Backend calculates quiz scores.
- [ ] Supported math questions return steps and verification status.
- [ ] Supported logic questions return explanations and conclusions.

### Image understanding
- [ ] Website image upload works.
- [ ] Telegram image upload works.
- [ ] File validation and size limits work.
- [ ] Vision analysis extracts useful context.
- [ ] Uncertain content is identified.
- [ ] Extracted content is saved and reusable.

### Telegram
- [ ] `/start` and `/help` work.
- [ ] Normal text messages work.
- [ ] Image messages work.
- [ ] Inline actions work.
- [ ] Long responses are handled safely.
- [ ] Telegram uses shared backend services.

### Website
- [ ] Authentication works.
- [ ] Dashboard works.
- [ ] AI chat works.
- [ ] Upload/analyze works.
- [ ] Summary workspace works.
- [ ] Quiz workspace works.
- [ ] Math and logic pages work.
- [ ] Learning history works.
- [ ] Settings and Telegram linking work.

### Reliability and security
- [ ] User data is isolated.
- [ ] API keys remain server-side.
- [ ] Quotas and rate limits work.
- [ ] Background jobs report status.
- [ ] Provider failures are handled.
- [ ] Uploaded files are private.
- [ ] Core tests pass.
- [ ] Setup and deployment instructions exist.

---

## 30. Expected final product

A student must be able to:

1. Ask a question through Telegram or the website.
2. Upload an educational image and have its context understood.
3. See the detected subject and topic.
4. Generate a short, detailed, or exam-focused summary.
5. Generate an MCQ quiz from the same source.
6. Take the quiz and see a score with explanations.
7. Solve mathematical and logical questions with understandable steps.
8. Ask follow-up questions grounded in previously uploaded material.
9. Access saved learning activity from either interface after linking accounts.

**Final architectural outcome:** one secure, provider-independent learning backend serving two consistent interfaces: Telegram and the web application.
