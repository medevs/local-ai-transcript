import {
  createTranscript as apiCreateTranscript,
  deleteTranscript as apiDeleteTranscript,
  fetchTranscript,
  fetchTranscripts,
  searchTranscripts as apiSearchTranscripts,
  type Transcript,
} from "./api-client";

// Re-export the Transcript type for backwards compatibility
export type TranscriptItem = Transcript;

// Event for notifying components of transcript changes
export function dispatchTranscriptsUpdate() {
  window.dispatchEvent(new CustomEvent("transcripts:update"));
}

export function dispatchTranscriptsNew() {
  window.dispatchEvent(new CustomEvent("transcripts:new"));
}

export async function getTranscripts(): Promise<TranscriptItem[]> {
  try {
    return await fetchTranscripts(100);
  } catch (error) {
    console.error("Failed to fetch transcripts:", error);
    return [];
  }
}

export async function searchTranscripts(query: string): Promise<TranscriptItem[]> {
  try {
    return await apiSearchTranscripts(query);
  } catch (error) {
    console.error("Failed to search transcripts:", error);
    return [];
  }
}

export async function getTranscriptById(
  id: string
): Promise<TranscriptItem | undefined> {
  try {
    return await fetchTranscript(id);
  } catch {
    return undefined;
  }
}

export async function addTranscript(input: {
  title: string;
  rawText: string;
  cleanedText?: string | null;
}): Promise<TranscriptItem> {
  const transcript = await apiCreateTranscript({
    title: input.title,
    rawText: input.rawText,
    cleanedText: input.cleanedText,
  });
  dispatchTranscriptsUpdate();
  return transcript;
}

export async function deleteTranscript(id: string): Promise<void> {
  await apiDeleteTranscript(id);
  dispatchTranscriptsUpdate();

  // If we're viewing this transcript, clear URL and reset panel
  const m = window.location.hash.match(/^#t-(.+)/);
  if (m && m[1] === id) {
    window.location.hash = "";
    dispatchTranscriptsNew();
  }
}

export function onTranscriptsChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("transcripts:update", handler);
  return () => window.removeEventListener("transcripts:update", handler);
}
