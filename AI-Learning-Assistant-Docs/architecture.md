# AI-Powered Learning Assistant --- Project Architecture

## 1. Project Overview

Build a multimodal AI learning assistant with two user interfaces:

1.  **Telegram Bot** --- users can send text questions, images, and
    (later) documents.
2.  **Web Application** --- users can upload learning materials, chat
    with the assistant, generate summaries and quizzes, solve problems,
    and review their learning history.

Both interfaces use the same backend and AI processing system. This
avoids implementing the same AI functionality twice.

### Core design principle

Keep the system **AI-provider independent**. The application should be
able to switch between AI providers or models without requiring changes
to the Telegram bot, website, or core business logic.

------------------------------------------------------------------------

## 2. High-Level System Architecture

``` mermaid
flowchart TD
    T[Telegram Bot] --> API[Backend API / Gateway]
    W[Next.js Web Application] --> API

    API --> AUTH[Authentication & User Management]
    API --> ROUTER[Request / Intent Router]

    ROUTER --> UNIFIED[Unified Solve Questions Service]
    ROUTER --> IMG[Image and Content Processing]
    ROUTER --> TOPIC[Topic Detection]
    ROUTER --> QUIZ[Quiz Generation Engine]

    UNIFIED --> MATH[Math Solver Engine]
    UNIFIED --> LOGIC[Logic Solver Engine]
    UNIFIED --> SUM[Summarization Engine]
    UNIFIED --> QA[Educational QA Engine]

    IMG --> AI[AI Provider Abstraction Layer]
    TOPIC --> AI
    SUM --> AI
    QUIZ --> AI
    MATH --> MATHLIB[SymPy / Deterministic Tools]
    MATH --> AI
    LOGIC --> AI

    AI --> VISION[Vision-capable Models]
    AI --> TEXT[Text / Reasoning Models]

    API --> DB[(PostgreSQL)]
    IMG --> STORAGE[(File Storage)]
    API --> QUEUE[Redis / Background Jobs]
    QUEUE --> WORKER[Background Worker]
    WORKER --> AI
    WORKER --> DB
```

The Telegram bot and website are clients. The backend owns
authentication, routing, AI orchestration, persistence, and business
logic.

------------------------------------------------------------------------

## 3. Main Functional Modules

  -----------------------------------------------------------------------
  Module                              Responsibility
  ----------------------------------- -----------------------------------
  Input Handler                       Receives text, images, and
                                      documents

  Image Processor                     Analyzes images and extracts
                                      relevant content

  Content Extractor                   Produces a reusable representation
                                      of source material

  Topic Detector                      Identifies subject, topic,
                                      subtopic, and difficulty

  Summarization Engine                Generates structured study
                                      summaries

  Quiz Engine                         Generates questions, options,
                                      answers, and explanations

  Math Solver                         Solves mathematical problems step
                                      by step

  Logic Solver                        Analyzes reasoning and logical
                                      questions

  AI Router                           Selects a suitable AI
                                      provider/model for each task

  User Manager                        Manages accounts and linked
                                      Telegram identities

  Learning History                    Stores conversations, source
                                      material, summaries, quizzes, and
                                      attempts

  Usage Manager                       Enforces rate limits and tracks
                                      provider usage
  -----------------------------------------------------------------------

### 3.1 Image and document understanding

Expected workflow:

1.  Receive an image or document.
2.  Validate file type, size, and safety.
3.  Store the file temporarily or in object storage.
4.  Send the image to a vision-capable model.
5.  Extract text, diagrams, equations, tables, and relevant
    relationships.
6.  Identify the topic and subtopic.
7.  Store the extracted context so later questions do not require
    reprocessing the same image.
8.  Make the extracted context available to summarization, quiz, and
    question-answering modules.

**Important:** Traditional OCR can extract text, but may not understand
diagrams, mathematical notation, tables, or relationships. A
vision-language model is more suitable for complete image understanding.
OCR can still be used as a supporting tool when useful.

### 3.2 Topic detection

The topic detector should return structured data rather than only a
prose answer.

Example:

``` json
{
  "subject": "Computer Science",
  "topic": "Data Structures",
  "subtopic": "Binary Tree",
  "difficulty": "beginner",
  "input_type": "question",
  "confidence": 0.96
}
```

The detected intent and topic help the backend choose the appropriate
processing workflow.

### 3.3 Summarization

A summary can contain:

-   Topic introduction
-   Important concepts
-   Key definitions
-   Important points
-   Examples
-   Formulas, where applicable
-   Quick revision notes

Offer different output styles:

-   Short summary
-   Detailed summary
-   Exam preparation notes

### 3.4 Quiz generation

Generate questions from the user's supplied material or extracted
context, not unrelated general knowledge.

Supported question types:

1.  Multiple-choice questions (MCQ)
2.  True/False
3.  Short-answer questions
4.  Fill in the blanks
5.  Conceptual questions

Example response schema:

``` json
{
  "topic": "Binary Tree",
  "questions": [
    {
      "question": "What is the maximum number of nodes at level 2?",
      "options": ["2", "4", "6", "8"],
      "correct_answer": "4",
      "explanation": "A binary tree can have 2^L nodes at level L, assuming the root is level 0."
    }
  ]
}
```

The website should render quizzes interactively. Users select answers,
submit the quiz, and receive scores and explanations. Telegram can use
inline keyboard buttons and send feedback after submission.

### 3.5 Mathematical and logical solver

Use AI reasoning together with deterministic tools where possible.

  -----------------------------------------------------------------------
  Problem type                        Suggested approach
  ----------------------------------- -----------------------------------
  Basic arithmetic                    Python arithmetic

  Algebra                             SymPy + AI explanation

  Calculus                            SymPy + AI explanation

  Equations                           SymPy + AI explanation

  Logical reasoning                   Reasoning-capable AI model

  Boolean algebra                     SymPy or Boolean logic tools

  Complex word problems               AI reasoning model, with
                                      verification where possible
  -----------------------------------------------------------------------

An LLM can make calculation mistakes. A mathematical engine can
independently verify many calculations, while the AI explains the result
in understandable steps.

------------------------------------------------------------------------

## 4. Recommended Technology Stack

  -----------------------------------------------------------------------
  Layer                   Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Frontend                Next.js + React +       Website and dashboard
                          TypeScript              

  UI styling              Tailwind CSS            Responsive, modern
                                                  interface

  Backend                 Python + FastAPI        API and application
                                                  logic

  Telegram                Telegram Bot API +      Telegram integration
                          aiogram                 

  Database                PostgreSQL              Users, messages,
                                                  content, quizzes,
                                                  results

  Cache / Queue           Redis                   Caching, temporary
                                                  state, job queue

  Background jobs         Celery, ARQ, or a       Long-running AI tasks
                          similar worker          

  File storage            S3-compatible object    Uploaded images and
                          storage or local        documents
                          storage during          
                          development             

  Math engine             SymPy                   Symbolic mathematics
                                                  and verification

  Deployment              Docker                  Reproducible
                                                  environments and
                                                  deployment
  -----------------------------------------------------------------------

### Why Python?

The project involves AI APIs, image processing, mathematical
computation, and potentially machine learning. Python has a strong
ecosystem for these areas. TypeScript can be used for the frontend.

------------------------------------------------------------------------

## 5. AI Model and Provider Architecture

Do not hardcode one AI provider into the application. Create an **AI
Provider Abstraction Layer**.

``` mermaid
flowchart TD
    TASK[Task Request] --> ROUTER[AI Router]
    ROUTER --> CHECK{Task Type?}
    CHECK -->|Image understanding| VISION[Vision Provider Adapter]
    CHECK -->|Text / summary / quiz| TEXT[Text Provider Adapter]
    CHECK -->|Reasoning| REASON[Reasoning Provider Adapter]
    VISION --> PROVIDERS[Provider APIs]
    TEXT --> PROVIDERS
    REASON --> PROVIDERS
    PROVIDERS --> NORMALIZE[Validate and Normalize Response]
    NORMALIZE --> RESULT[Application Service]
```

Possible providers to evaluate:

-   **Google Gemini API** --- investigate current vision capabilities,
    free-tier availability, and quotas.
-   **Groq API** --- investigate currently available vision and text
    models, supported inputs, and rate limits.
-   Other providers can be added through separate adapters.

Provider availability, free quotas, model access, and terms can change.
Check current documentation before choosing a provider.

### Provider adapter responsibilities

Each adapter should:

-   Accept a common internal request format.
-   Convert it to the provider's API format.
-   Call the provider securely from the backend.
-   Handle timeouts, errors, and rate limits.
-   Return a normalized response.
-   Record model and usage metadata where available.

### Recommended initial strategy

Start with one vision-capable provider. Add a fallback provider after
the core workflow works. Do not build a complicated multi-model routing
system in the first version.

Free API access is not unlimited. Apply per-user limits, request
throttling, caching, and upload-size restrictions.

------------------------------------------------------------------------

## 6. End-to-End Image-to-Learning Workflow

Example: a student sends an image of a lecture slide about neural
networks.

``` mermaid
sequenceDiagram
    actor User
    participant Client as Telegram / Website
    participant API as Backend API
    participant Worker as Background Worker
    participant Vision as Vision Model
    participant DB as PostgreSQL

    User->>Client: Upload lecture image
    Client->>API: Submit image
    API->>API: Validate file and create job
    API-->>Client: Return job ID / processing status
    API->>Worker: Queue image-processing job
    Worker->>Vision: Analyze image and extract context
    Vision-->>Worker: Text, concepts, equations, diagram context
    Worker->>Vision: Detect topic and classify intent
    Vision-->>Worker: Structured topic result
    Worker->>DB: Save extracted context and metadata
    Worker-->>API: Mark job complete
    API-->>Client: Display topic and available actions
    User->>Client: Select Generate Quiz
    Client->>API: Request quiz for extracted content
    API->>Worker: Queue quiz generation
    Worker->>Vision: Generate quiz from stored context
    Vision-->>Worker: Structured quiz
    Worker->>DB: Save quiz and questions
    API-->>Client: Return quiz
```

The backend should return a job ID for longer tasks and process them
asynchronously. The website can use polling or WebSockets for updates.
Telegram can send a processing message and then deliver the result when
the job finishes.

------------------------------------------------------------------------

## 7. Database Architecture

Use PostgreSQL as the primary database.

  -----------------------------------------------------------------------
  Table                               Important fields
  ----------------------------------- -----------------------------------
  `users`                             id, name, email, telegram_id,
                                      created_at

  `conversations`                     id, user_id, title, created_at

  `messages`                          id, conversation_id, role, content,
                                      created_at

  `uploaded_files`                    id, user_id, file_path, file_type,
                                      status

  `extracted_contents`                id, file_id, extracted_text,
                                      detected_topic, metadata

  `summaries`                         id, user_id, content_id, content,
                                      created_at

  `quizzes`                           id, user_id, content_id,
                                      difficulty, created_at

  `quiz_questions`                    id, quiz_id, question, options,
                                      answer, explanation

  `quiz_attempts`                     id, user_id, quiz_id, score,
                                      completed_at

  `ai_usage`                          id, user_id, provider, model,
                                      tokens_used, created_at
  -----------------------------------------------------------------------

### Database relationships

``` mermaid
erDiagram
    USERS ||--o{ CONVERSATIONS : owns
    CONVERSATIONS ||--o{ MESSAGES : contains
    USERS ||--o{ UPLOADED_FILES : uploads
    UPLOADED_FILES ||--o| EXTRACTED_CONTENTS : produces
    EXTRACTED_CONTENTS ||--o{ SUMMARIES : generates
    EXTRACTED_CONTENTS ||--o{ QUIZZES : generates
    QUIZZES ||--o{ QUIZ_QUESTIONS : contains
    USERS ||--o{ QUIZ_ATTEMPTS : takes
    QUIZZES ||--o{ QUIZ_ATTEMPTS : receives
    USERS ||--o{ AI_USAGE : consumes
```

### Account linking

Telegram and website users should be linkable to one account. A user who
generates a quiz in Telegram should be able to open the website and find
that quiz in their learning history.

Use a secure account-linking flow rather than assuming that a Telegram
username is a verified email address.

------------------------------------------------------------------------

## 8. Website UI Architecture

Design the website as an AI learning workspace rather than a traditional
chatbot.

### Main pages

1.  **Dashboard** --- recent activity, quick actions, and learning
    overview.
2.  **AI Chat** --- ask questions and follow up on previous context.
3.  **Image and Document Analyzer** --- upload and inspect learning
    materials.
4.  **Summary Workspace** --- view, edit, and save summaries.
5.  **Quiz Workspace** --- answer questions, track progress, and view
    scores.
6.  **Math and Logic Solver** --- step-by-step solutions.
7.  **Learning History** --- previous conversations, uploads, summaries,
    and quizzes.
8.  **User Settings** --- profile, account linking, and usage
    information.

### Dashboard concept

``` text
+------------------------------------------------------+
| LearnAI                                  Profile     |
+----------------------+-------------------------------+
| Dashboard            | What do you want to learn?    |
| AI Chat              |                               |
| Upload Material      | [ Ask a question / Upload ]   |
| Summaries            |                               |
| Quizzes              | [Summarize] [Generate Quiz]   |
| Math Solver          | [Math Solver] [Logic Solver]  |
| Learning History     |                               |
| Settings             | Recent Activity               |
|                      | - Neural Networks Summary     |
|                      | - Data Structures Quiz        |
+----------------------+-------------------------------+
```

The design should be responsive and work well on desktop and mobile.

------------------------------------------------------------------------

## 9. Telegram Bot Architecture

Suggested commands:

  Command        Function
  -------------- --------------------------
  `/start`       Start the bot
  `/help`        Show instructions
  `/summarize`   Generate a summary
  `/quiz`        Generate a quiz
  `/solve`       Solve a question
  `/history`     Show previous activity
  `/website`     Open the web application

The bot should also understand ordinary messages without requiring a
command.

Example interaction:

``` text
User: What is a binary search tree?

Bot:
Topic: Data Structures → Trees

A Binary Search Tree (BST) is a tree where:
- Left child contains smaller values.
- Right child contains larger values.
- Each subtree follows the same rule.

What would you like to do next?

[Summarize] [Generate Quiz]
[Explain Deeper] [Ask Follow-up]
```

Use Telegram webhooks in production. Keep bot handlers thin: they should
validate Telegram updates, call the shared backend services, and format
the response for Telegram.

------------------------------------------------------------------------

## 10. Recommended Project Folder Structure

Start with a **modular monolith**: one backend application separated
into independent modules. Avoid microservices until there is a concrete
scaling need.

``` text
ai-learning-assistant/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── public/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── upload.py
│   │   │   ├── quiz.py
│   │   │   └── solve.py
│   │   │
│   │   ├── bot/
│   │   │   ├── handlers.py
│   │   │   └── keyboards.py
│   │   │
│   │   ├── ai/
│   │   │   ├── router.py
│   │   │   ├── providers/
│   │   │   ├── prompts/
│   │   │   └── schemas/
│   │   │
│   │   ├── processors/
│   │   │   ├── image_processor.py
│   │   │   ├── topic_detector.py
│   │   │   └── content_extractor.py
│   │   │
│   │   ├── services/
│   │   │   ├── summarizer.py
│   │   │   ├── quiz_generator.py
│   │   │   ├── math_solver.py
│   │   │   └── logic_solver.py
│   │   │
│   │   ├── database/
│   │   ├── workers/
│   │   └── core/
│   │
│   └── requirements.txt
│
├── docker-compose.yml
├── .env.example
└── README.md
```

------------------------------------------------------------------------

## 11. Development Roadmap

Build the system in phases. Each phase should produce something
testable.

### Phase 1 --- Core AI functionality

-   Connect one AI API.
-   Accept text questions.
-   Generate summaries.
-   Generate quizzes.
-   Solve mathematical and logical questions.

**Milestone:** A working AI engine accessible through backend API
endpoints.

### Phase 2 --- Image understanding

-   Accept image uploads.
-   Understand image context.
-   Detect topics.
-   Generate summaries and quizzes from images.
-   Store extracted context for follow-up questions.

**Milestone:** A multimodal AI engine.

### Phase 3 --- Telegram integration

-   Connect Telegram Bot API.
-   Implement commands and inline buttons.
-   Handle images and normal messages.
-   Connect the bot to the existing backend.

**Milestone:** A functional Telegram assistant.

### Phase 4 --- Website development

-   Build the dashboard.
-   Implement authentication.
-   Build the AI chat interface.
-   Create summary and quiz interfaces.
-   Connect the frontend to the backend.

**Milestone:** A functional web application.

### Phase 5 --- Shared accounts and history

-   Link Telegram and website accounts.
-   Store user history.
-   Save quiz attempts.
-   Display previous summaries and uploads.

**Milestone:** A unified learning platform.

### Phase 6 --- Optimization and deployment

-   Add background processing.
-   Add API usage limits.
-   Add caching and provider fallback.
-   Implement security and monitoring.
-   Deploy the application.

**Milestone:** A publicly accessible application.

------------------------------------------------------------------------

## 12. Important Architectural Decisions

### 12.1 Route by intent

Do not send every question through the same AI workflow. Use an intent
classifier to distinguish between:

-   Summarization
-   Quiz generation
-   Mathematical problem solving
-   Logical reasoning
-   General question answering
-   Image or document analysis

### 12.2 Preserve extracted context

If a user uploads an image and then asks several questions about it, do
not process the image repeatedly. Store the extracted context and
associate it with the conversation or source material.

### 12.3 Use structured AI responses

Use predefined JSON schemas for topic detection, summaries, and quizzes.
Validate model output before saving or displaying it.

### 12.4 Protect API usage

Because the project initially relies on free API tiers:

-   Apply per-user limits.
-   Add request throttling.
-   Cache reusable results.
-   Set maximum upload sizes.
-   Track provider usage.
-   Handle rate limits and provider outages.

### 12.5 Verify answers

Use deterministic verification for mathematical calculations where
possible. Validate quiz structure and answers before displaying them.
Clearly communicate uncertainty when a problem cannot be verified
reliably.

### 12.6 Secure user data

-   Keep API keys on the backend.
-   Validate uploaded files.
-   Restrict access to user-owned files and records.
-   Use secure authentication and account linking.
-   Delete temporary files when no longer needed.
-   Avoid logging sensitive user content unnecessarily.

------------------------------------------------------------------------

## 13. Recommended MVP Scope

Keep the first release focused.

  Feature                                 MVP
  --------------------------------------- -------
  Text question understanding             Yes
  Image understanding                     Yes
  Topic detection                         Yes
  Summarization                           Yes
  MCQ generation                          Yes
  Math solving                            Yes
  Logical reasoning                       Yes
  Telegram bot                            Yes
  Website                                 Yes
  User accounts                           Yes
  Learning history                        Yes
  PDF and multiple-document analysis      Later
  Voice interaction                       Later
  Personalized learning recommendations   Later

------------------------------------------------------------------------

## 14. Final Recommendation

Build the project as **one modular AI backend serving two clients:
Telegram and a Next.js website**.

Recommended starting stack:

-   Next.js + TypeScript + Tailwind CSS
-   Python + FastAPI
-   Telegram Bot API + aiogram
-   PostgreSQL
-   Redis + background worker
-   SymPy
-   One vision-capable AI API, with a provider abstraction that allows
    additional models later
-   Docker

Start with the AI engine, then add image understanding, Telegram
integration, and finally the website. This keeps the project manageable,
inexpensive to develop, and expandable without requiring a complete
architectural rewrite.
