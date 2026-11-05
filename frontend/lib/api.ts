/**
 * Safe frontend API client connecting to the shared backend.
 *
 * Rules:
 * - Never expose internal secrets or server paths.
 * - Handles standardized response envelopes: { data: T, request_id: string }
 * - Provides graceful error handling with user-facing messages.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

export interface ApiResponse<T> {
  data: T;
  request_id: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  telegram_id?: string;
  is_active: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string;
  subject?: string;
  topic?: string;
  created_at: string;
}

export interface TopicMetadata {
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  confidence: number;
}

export interface ChatResponseData {
  conversation_id: string;
  user_message: Message;
  assistant_message: Message;
  topic_metadata?: TopicMetadata;
}

export interface ExtractedContent {
  id: string;
  uploaded_file_id?: string;
  title: string;
  subject: string;
  topic: string;
  subtopics: string[];
  extracted_text: string;
  key_concepts: string[];
  equations: string[];
  visual_elements: string[];
  uncertainties: string[];
  language: string;
  created_at: string;
}

export interface BackgroundJob {
  id: string;
  job_type: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  result_id?: string;
  error_message?: string;
}

export interface Summary {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  style: "short" | "detailed" | "exam_notes";
  overview: string;
  content: {
    title: string;
    overview: string;
    key_points: string[];
    important_definitions: string[];
    formulas: string[];
    examples: string[];
  };
  created_at: string;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestionDelivery {
  id: string;
  question_order: number;
  question: string;
  options: QuizOption[];
}

export interface QuizDelivery {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  question_type: string;
  questions: QuizQuestionDelivery[];
}

export interface QuestionReview {
  question_id: string;
  question: string;
  selected_option_id?: string;
  correct_option_id: string;
  is_correct: boolean;
  explanation: string;
  options: QuizOption[];
}

export interface QuizAttemptResult {
  attempt_id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  created_at: string;
  reviews: QuestionReview[];
}

export type TaskType =
  | "mathematics"
  | "logical_reasoning"
  | "summarization"
  | "general_educational";

export interface EducationalSolution {
  subject: string;
  topic: string;
  steps: Array<{ step: number; title: string; explanation: string }>;
  key_concepts: Array<{ concept: string; explanation: string }>;
  conclusion: string;
  takeaways: string[];
}

export interface UnifiedSolveResponse {
  task_type: TaskType;
  task_label: string;
  title: string;
  summary_or_answer: string;
  confidence: number;
  conversation_id: string;
  source_content_id?: string;
  math_solution?: any;
  logic_solution?: any;
  summary_solution?: any;
  educational_solution?: EducationalSolution;
  clarification_needed: boolean;
  clarification_question?: string;
}

export interface UnifiedFollowUpResponse {
  conversation_id: string;
  user_message: string;
  assistant_message: string;
  topic_metadata?: any;
}

export interface MathSolution {
  original_expression: string;
  problem_type: string;
  steps: string[];
  final_answer: string;
  verification_status: "verified" | "failed" | "unsupported";
  verification_details?: string;
  is_ambiguous: boolean;
  clarification_needed?: string;
}

export interface LogicSolution {
  problem_type: string;
  premises: string[];
  conclusion?: string;
  is_valid?: boolean;
  reasoning_steps: string[];
  truth_table?: {
    variables: string[];
    rows: Array<{ assignments: Record<string, boolean>; result: boolean }>;
  };
  pattern_identified?: string;
  identified_assumptions?: string[];
  uncertainty_notes?: string;
}

export interface TelegramLinkToken {
  token: string;
  deep_link: string;
  expires_at: string;
  expires_in_seconds: number;
}

export interface TelegramStatus {
  is_linked: boolean;
  telegram_id?: string;
  user_id: string;
}

export interface AIProviderInfo {
  name: string;
  status: "active" | "configured" | "unconfigured" | "available";
  configured: boolean;
  model?: string;
  vision_model?: string;
  description: string;
}

export interface AIStatusResponse {
  active_provider: "mock" | "gemini" | "groq" | string;
  providers: Record<string, AIProviderInfo>;
}

// Token store helper for local development / testing
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("study_token", token);
    } else {
      localStorage.removeItem("study_token");
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== "undefined") {
    authToken = localStorage.getItem("study_token");
  }
  return authToken;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_BASE}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw { code: "BACKEND_UNREACHABLE", message: "Could not reach the StudyMate server. Please try again." } satisfies ApiError;
  }

  if (!response.ok) {
    let errorData: ApiError = {
      code: `HTTP_${response.status}`,
      message: "An unexpected error occurred.",
    };
    try {
      const body = await response.json();
      if (body.error) {
        errorData = body.error;
      }
    } catch {
      // ignore json parse errors on non-json body
    }
    throw errorData;
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

export const api = {
  // Auth
  register: (payload: { email: string; password: string; name?: string }) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: async (payload: { email: string; password: string }) => {
    const res = await request<{ access_token: string; user: User }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    setAuthToken(res.access_token);
    return res;
  },

  logout: async () => {
    try {
      await request<{ message: string }>("/auth/logout", { method: "POST" });
    } finally {
      setAuthToken(null);
    }
  },

  getMe: () => request<User>("/auth/me"),

  // Chat
  listConversations: () => request<Conversation[]>("/conversations"),

  getConversation: (id: string) =>
    request<Conversation>(`/conversations/${id}`),

  deleteConversation: (id: string) =>
    request<{ message: string }>(`/conversations/${id}`, { method: "DELETE" }),

  sendMessage: (payload: {
    message: string;
    conversation_id?: string;
    source_content_id?: string;
  }) =>
    request<ChatResponseData>("/chat/message", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Uploads & Jobs
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ file: { id: string }; job_id: string }>(
      "/uploads/image",
      {
        method: "POST",
        body: formData,
      }
    );
  },

  getJobStatus: (jobId: string) =>
    request<BackgroundJob>(`/jobs/${jobId}`),

  getExtractedContent: (uploadId: string) =>
    request<ExtractedContent>(`/uploads/${uploadId}/content`),

  // Summaries
  generateSummary: (payload: {
    source_text?: string;
    source_content_id?: string;
    conversation_id?: string;
    style?: "short" | "detailed" | "exam_notes";
  }) =>
    request<Summary>("/summaries/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSummary: (id: string) => request<Summary>(`/summaries/${id}`),

  // Quizzes
  generateQuiz: (payload: {
    topic?: string;
    source_text?: string;
    source_content_id?: string;
    question_count?: number;
    difficulty?: "beginner" | "intermediate" | "advanced";
  }) =>
    request<QuizDelivery>("/quizzes/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getQuizDelivery: (id: string) =>
    request<QuizDelivery>(`/quizzes/${id}`),

  submitQuizAttempt: (
    quizId: string,
    answers: Array<{ question_id: string; selected_option_id: string }>
  ) =>
    request<QuizAttemptResult>(`/quizzes/${quizId}/attempt`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  // Solvers (Unified & Legacy)
  solveQuestion: (payload: {
    input_text?: string;
    source_content_id?: string;
    conversation_id?: string;
    preferred_style?: string;
    domain?: string;
  }) =>
    request<UnifiedSolveResponse>("/solve", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  uploadAndSolveQuestion: (formData: FormData) =>
    request<UnifiedSolveResponse>("/solve/upload", {
      method: "POST",
      body: formData,
    }),

  askSolveFollowUp: (payload: {
    conversation_id: string;
    message: string;
    source_content_id?: string;
  }) =>
    request<UnifiedFollowUpResponse>("/solve/follow-up", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  solveMath: (payload: {
    expression: string;
    source_content_id?: string;
  }) =>
    request<MathSolution>("/solvers/math", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  solveLogic: (payload: {
    premises: string[];
    conclusion?: string;
    problem_type?: string;
  }) =>
    request<LogicSolution>("/solvers/logic", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Telegram Linking
  createLinkToken: () =>
    request<TelegramLinkToken>("/telegram/link-token", { method: "POST" }),

  getTelegramStatus: () => request<TelegramStatus>("/telegram/status"),

  unlinkTelegram: () =>
    request<{ message: string }>("/telegram/link", { method: "DELETE" }),

  // AI Provider & API Key Management
  getAIStatus: () => request<AIStatusResponse>("/ai/status"),

  configureAI: (payload: { provider: string; api_key?: string }) =>
    request<{ status: string; active_provider: string; message: string }>("/ai/configure", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

