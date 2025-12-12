export type TranscriptItem = {
  id: string;
  title: string;
  rawText: string;
  cleanedText?: string | null;
  createdAt: string;
};

const STORAGE_KEY = "transcripts";

function read(): TranscriptItem[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? (JSON.parse(v) as TranscriptItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: TranscriptItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getTranscripts(): TranscriptItem[] {
  return read().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getTranscriptById(id: string): TranscriptItem | undefined {
  return read().find((t) => t.id === id);
}

export function addTranscript(input: Omit<TranscriptItem, "id" | "createdAt">) {
  const now = new Date().toISOString();
  const id = `${Date.now()}`;
  const item: TranscriptItem = { id, createdAt: now, ...input };
  const items = read();
  items.unshift(item);
  write(items.slice(0, 100));
  window.dispatchEvent(new CustomEvent("transcripts:update"));
}

export function onTranscriptsChange(cb: () => void) {
  const handler = () => cb();
  window.addEventListener("transcripts:update", handler);
  return () => window.removeEventListener("transcripts:update", handler);
}

export function deleteTranscript(id: string) {
  const items = read().filter((t) => t.id !== id);
  write(items);
  window.dispatchEvent(new CustomEvent("transcripts:update"));
  const m = window.location.hash.match(/^#t-(\d+)/);
  if (m && m[1] === id) {
    window.dispatchEvent(new CustomEvent("transcripts:new"));
  }
}
