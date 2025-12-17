import { z } from "zod";

// ============================================================================
// Error Types
// ============================================================================

export class ApiError extends Error {
  code: string;
  details?: string;
  status?: number;

  constructor(
    code: string,
    message: string,
    details?: string,
    status?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const TranscriptSchema = z.object({
  id: z.string(),
  title: z.string(),
  rawText: z.string().nullable(),
  cleanedText: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const TranscriptsResponseSchema = z.object({
  transcripts: z.array(TranscriptSchema),
});

export const SearchResponseSchema = z.object({
  transcripts: z.array(TranscriptSchema),
  query: z.string(),
});

export const ChatMessageSchema = z.object({
  id: z.number(),
  transcriptId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string().nullable(),
});

export const MessagesResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
});

export const TranscribeResponseSchema = z.object({
  success: z.boolean(),
  text: z.string().optional(),
});

export const CleanResponseSchema = z.object({
  success: z.boolean(),
  text: z.string().optional(),
});

export const ChatResponseSchema = z.object({
  reply: z.string(),
  used_rag: z.boolean().optional(),
});

export const SystemPromptResponseSchema = z.object({
  default_prompt: z.string(),
});

export const StatusResponseSchema = z.object({
  status: z.string(),
  whisper_model: z.string().nullable(),
  llm_model: z.string().nullable(),
  llm_base_url: z.string().nullable(),
});

// ============================================================================
// Types
// ============================================================================

export type Transcript = z.infer<typeof TranscriptSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ============================================================================
// API Client
// ============================================================================

const API_BASE = "/api";

async function handleResponse<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
  if (!response.ok) {
    let error: ApiError;
    try {
      const data = await response.json();
      // Check if it's a structured error from our API
      const parsed = ErrorResponseSchema.safeParse(data.detail || data);
      if (parsed.success) {
        error = new ApiError(
          parsed.data.code,
          parsed.data.message,
          parsed.data.details,
          response.status
        );
      } else {
        error = new ApiError(
          "UNKNOWN_ERROR",
          data.detail || data.message || "Request failed",
          undefined,
          response.status
        );
      }
    } catch {
      error = new ApiError(
        "NETWORK_ERROR",
        `Request failed: ${response.statusText}`,
        undefined,
        response.status
      );
    }
    throw error;
  }

  const data = await response.json();
  const result = schema.safeParse(data);

  if (!result.success) {
    console.error("API response validation failed:", result.error);
    throw new ApiError(
      "VALIDATION_ERROR",
      "Invalid response from server",
      result.error.message
    );
  }

  return result.data;
}

// ============================================================================
// Transcript API
// ============================================================================

export async function fetchTranscripts(limit = 100): Promise<Transcript[]> {
  const response = await fetch(`${API_BASE}/transcripts?limit=${limit}`);
  const data = await handleResponse(response, TranscriptsResponseSchema);
  return data.transcripts;
}

export async function searchTranscripts(query: string, limit = 50): Promise<Transcript[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetch(`${API_BASE}/transcripts/search?${params}`);
  const data = await handleResponse(response, SearchResponseSchema);
  return data.transcripts;
}

export async function fetchTranscript(id: string): Promise<Transcript> {
  const response = await fetch(`${API_BASE}/transcripts/${id}`);
  return handleResponse(response, TranscriptSchema);
}

export async function createTranscript(input: {
  title: string;
  rawText?: string | null;
  cleanedText?: string | null;
}): Promise<Transcript> {
  const response = await fetch(`${API_BASE}/transcripts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse(response, TranscriptSchema);
}

export async function updateTranscript(
  id: string,
  input: {
    title?: string;
    rawText?: string | null;
    cleanedText?: string | null;
  }
): Promise<Transcript> {
  const response = await fetch(`${API_BASE}/transcripts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse(response, TranscriptSchema);
}

export async function deleteTranscript(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/transcripts/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new ApiError(
      "DELETE_FAILED",
      "Failed to delete transcript",
      undefined,
      response.status
    );
  }
}

// ============================================================================
// Chat Messages API
// ============================================================================

export async function fetchMessages(transcriptId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE}/transcripts/${transcriptId}/messages`);
  const data = await handleResponse(response, MessagesResponseSchema);
  return data.messages;
}

export async function addMessage(
  transcriptId: string,
  role: "user" | "assistant",
  content: string
): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE}/transcripts/${transcriptId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content }),
  });
  return handleResponse(response, ChatMessageSchema);
}

// ============================================================================
// Transcription API
// ============================================================================

export async function transcribeAudio(
  audioBlob: Blob,
  filename = "audio.webm"
): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, filename);

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: "POST",
    body: formData,
  });

  const data = await handleResponse(response, TranscribeResponseSchema);
  return data.text || "";
}

export async function cleanText(
  text: string,
  systemPrompt?: string
): Promise<string> {
  const response = await fetch(`${API_BASE}/clean`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, system_prompt: systemPrompt }),
  });

  const data = await handleResponse(response, CleanResponseSchema);
  return data.text || "";
}

const GenerateTitleResponseSchema = z.object({
  success: z.boolean().optional(),
  title: z.string(),
});

export async function generateTitle(text: string): Promise<string> {
  const response = await fetch(`${API_BASE}/generate-title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    // Don't throw - just return fallback for title generation failures
    console.warn("Title generation failed, using fallback");
    return "Untitled";
  }

  try {
    const data = await response.json();
    const result = GenerateTitleResponseSchema.safeParse(data);
    if (result.success) {
      return result.data.title || "Untitled";
    }
    return data.title || "Untitled";
  } catch {
    return "Untitled";
  }
}

// ============================================================================
// Chat API
// ============================================================================

export interface ChatOptions {
  transcriptId?: string;
  context?: string;
  includeHistory?: boolean;
  historyLimit?: number;
}

export async function sendChatMessage(
  message: string,
  options: ChatOptions = {}
): Promise<string> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      transcript_id: options.transcriptId,
      context: options.context,
      include_history: options.includeHistory ?? true,
      history_limit: options.historyLimit ?? 10,
    }),
  });

  const data = await handleResponse(response, ChatResponseSchema);
  return data.reply;
}

export function streamChatMessage(
  message: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  options: ChatOptions = {}
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          transcript_id: options.transcriptId,
          context: options.context,
          include_history: options.includeHistory ?? true,
          history_limit: options.historyLimit ?? 10,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            if (currentEvent === "done") {
              onDone();
              return;
            }
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (currentEvent === "error") {
              onError(data || "Unknown error");
              return;
            } else if (data) {
              onChunk(data);
            }
          }
        }
      }

      onDone();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      onError(error instanceof Error ? error.message : "Stream failed");
    }
  })();

  return () => controller.abort();
}

// ============================================================================
// System API
// ============================================================================

export async function fetchSystemPrompt(): Promise<string> {
  const response = await fetch(`${API_BASE}/system-prompt`);
  const data = await handleResponse(response, SystemPromptResponseSchema);
  return data.default_prompt;
}

export async function fetchStatus(): Promise<z.infer<typeof StatusResponseSchema>> {
  const response = await fetch(`${API_BASE}/status`);
  return handleResponse(response, StatusResponseSchema);
}

// ============================================================================
// Export API
// ============================================================================

export function getExportUrl(transcriptId: string, format: "md" | "txt" | "pdf"): string {
  return `${API_BASE}/transcripts/${transcriptId}/export?format=${format}`;
}

export async function downloadExport(
  transcriptId: string,
  format: "md" | "txt" | "pdf",
  filename: string
): Promise<void> {
  const response = await fetch(getExportUrl(transcriptId, format));

  if (!response.ok) {
    throw new ApiError(
      "EXPORT_FAILED",
      "Failed to export transcript",
      undefined,
      response.status
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// RAG / Embeddings API
// ============================================================================

export const EmbeddingsStatusSchema = z.object({
  enabled: z.boolean(),
  available: z.boolean(),
  reason: z.string().optional(),
  embedding_service: z.object({
    available: z.boolean(),
    model: z.string(),
    base_url: z.string(),
  }).optional(),
  vector_store: z.object({
    available: z.boolean(),
  }).optional(),
});

export type EmbeddingsStatus = z.infer<typeof EmbeddingsStatusSchema>;

export async function fetchEmbeddingsStatus(): Promise<EmbeddingsStatus> {
  const response = await fetch(`${API_BASE}/embeddings/status`);
  return handleResponse(response, EmbeddingsStatusSchema);
}

export async function reindexTranscript(transcriptId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/transcripts/${transcriptId}/reindex`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new ApiError(
      "REINDEX_FAILED",
      "Failed to reindex transcript",
      undefined,
      response.status
    );
  }
}
