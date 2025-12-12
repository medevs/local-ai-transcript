"use client";

import * as React from "react";
import {
  IconMicrophone,
  IconSquare,
  IconUpload,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { addTranscript, getTranscriptById } from "@/lib/history";

type TranscriptionResponse = {
  success: boolean;
  text?: string;
  error?: string;
};
type CleanResponse = { success: boolean; text?: string };
type SystemPromptResponse = { default_prompt: string };

export function TranscriptPanel() {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [rawText, setRawText] = React.useState<string | null>(null);
  const [cleanedText, setCleanedText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [useLLM, setUseLLM] = React.useState(true);
  const [isCopied, setIsCopied] = React.useState(false);
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [isLoadingPrompt, setIsLoadingPrompt] = React.useState(true);
  const [isCleaningWithLLM, setIsCleaningWithLLM] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const isKeyDownRef = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const loadPrompt = async () => {
      try {
        const res = await fetch("/api/system-prompt");
        const data = (await res.json()) as SystemPromptResponse;
        setSystemPrompt(data.default_prompt);
      } catch {
        setError("Failed to load system prompt");
      } finally {
        setIsLoadingPrompt(false);
      }
    };
    void loadPrompt();
  }, []);

  const uploadAudio = React.useCallback(
    async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      try {
        const transcribeResponse = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        if (!transcribeResponse.ok)
          throw new Error(
            `Transcription failed: ${transcribeResponse.statusText}`
          );
        const transcribeData =
          (await transcribeResponse.json()) as TranscriptionResponse;
        if (!transcribeData.success)
          throw new Error(transcribeData.error || "Transcription failed");
        setRawText(transcribeData.text || "");
        setIsProcessing(false);
        setError(null);

        if (useLLM && transcribeData.text) {
          setIsCleaningWithLLM(true);
          const cleanResponse = await fetch("/api/clean", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: transcribeData.text,
              ...(systemPrompt && { system_prompt: systemPrompt }),
            }),
          });
          if (!cleanResponse.ok)
            throw new Error(`Cleaning failed: ${cleanResponse.statusText}`);
          const cleanData = (await cleanResponse.json()) as CleanResponse;
          if (cleanData.success && cleanData.text)
            setCleanedText(cleanData.text);
          setIsCleaningWithLLM(false);
        }
        const titleSource =
          useLLM && cleanedText ? cleanedText : transcribeData.text || "";
        const title = titleSource.trim().split(/\s+/).slice(0, 8).join(" ");
        addTranscript({
          title: title || "Transcript",
          rawText: transcribeData.text || "",
          cleanedText,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError("Processing failed: " + msg);
        setIsProcessing(false);
        setIsCleaningWithLLM(false);
      }
    },
    [useLLM, systemPrompt, cleanedText]
  );

  const startRecording = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e: BlobEvent) => {
        chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadAudio(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError(null);
      setRawText(null);
      setCleanedText(null);
      setIsCleaningWithLLM(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError("Microphone access denied: " + msg);
    }
  }, [uploadAudio]);

  const stopRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  }, [isRecording]);

  const processAudioFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file");
      return;
    }
    setError(null);
    setRawText(null);
    setCleanedText(null);
    setIsProcessing(true);
    setIsCleaningWithLLM(false);
    const blob = new Blob([file], { type: file.type });
    void uploadAudio(blob);
  };

  const handleTextSubmit = React.useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      try {
        setError(null);
        setRawText(null);
        setCleanedText(null);
        setIsProcessing(true);
        setIsCleaningWithLLM(false);
        setRawText(text);
        setIsProcessing(false);
        if (useLLM) {
          setIsCleaningWithLLM(true);
          const cleanResponse = await fetch("/api/clean", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              ...(systemPrompt && { system_prompt: systemPrompt }),
            }),
          });
          if (!cleanResponse.ok)
            throw new Error(`Cleaning failed: ${cleanResponse.statusText}`);
          const cleanData = (await cleanResponse.json()) as CleanResponse;
          if (cleanData.success && cleanData.text)
            setCleanedText(cleanData.text);
          setIsCleaningWithLLM(false);
        }
        const titleSource = useLLM && cleanedText ? cleanedText : text;
        const title = titleSource.trim().split(/\s+/).slice(0, 8).join(" ");
        addTranscript({
          title: title || "Transcript",
          rawText: text,
          cleanedText,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError("Processing failed: " + msg);
        setIsProcessing(false);
        setIsCleaningWithLLM(false);
      }
    },
    [useLLM, systemPrompt, cleanedText]
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((err: Error) => setError("Copy failed: " + err.message));
  };

  React.useEffect(() => {
    const onHash = () => {
      const m = window.location.hash.match(/^#t-(\d+)/);
      if (m) {
        const item = getTranscriptById(m[1]);
        if (item) {
          setRawText(item.rawText);
          setCleanedText(item.cleanedText || null);
          setError(null);
        }
      }
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    const onNew = () => {
      setIsRecording(false);
      setIsProcessing(false);
      setIsCleaningWithLLM(false);
      setRawText(null);
      setCleanedText(null);
      setError(null);
      const ta = document.getElementById(
        "paste-text"
      ) as HTMLTextAreaElement | null;
      if (ta) ta.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    window.addEventListener("transcripts:new", onNew);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("transcripts:new", onNew);
    };
  }, []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isProcessing || e.repeat || isKeyDownRef.current) return;
      const target = e.target as HTMLElement;
      if (
        e.key.toLowerCase() === "v" &&
        !["INPUT", "TEXTAREA"].includes(target.tagName)
      ) {
        e.preventDefault();
        isKeyDownRef.current = true;
        if (!isRecording) void startRecording();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "v") {
        isKeyDownRef.current = false;
        if (isRecording) stopRecording();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [isRecording, isProcessing, startRecording, stopRecording]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Transcript Workflow</CardTitle>
          <CardDescription>
            Record, upload, or paste text, then optionally clean with LLM
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button
              disabled={isProcessing}
              onClick={() => (isRecording ? stopRecording() : startRecording())}
            >
              {isProcessing ? (
                <IconSquare />
              ) : isRecording ? (
                <IconSquare />
              ) : (
                <IconMicrophone />
              )}
              <span className="ml-2">
                {isProcessing
                  ? "Processing..."
                  : isRecording
                  ? "Stop Recording"
                  : "Start Recording"}
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <IconUpload />
              <span className="ml-2">Upload Audio</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processAudioFile(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          <div
            className={`rounded-xl border border-dashed p-6 text-center ${
              isDragging ? "bg-muted" : "bg-transparent"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f && !isProcessing && !isRecording) processAudioFile(f);
            }}
          >
            <p className="text-sm text-muted-foreground">
              Drag & drop an audio file here
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="paste-text">Paste Text Transcript</Label>
            <textarea
              id="paste-text"
              className="h-24 w-full rounded-md border bg-background p-2"
              placeholder="Paste your transcript here..."
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleTextSubmit(
                    (e.target as HTMLTextAreaElement).value
                  );
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  const ta = document.getElementById(
                    "paste-text"
                  ) as HTMLTextAreaElement | null;
                  if (ta && ta.value.trim())
                    void handleTextSubmit(ta.value.trim());
                }}
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Process Text"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="use-llm"
              checked={useLLM}
              onCheckedChange={(v) => setUseLLM(!!v)}
            />
            <Label htmlFor="use-llm">Clean transcription with LLM</Label>
          </div>

          {useLLM && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="system-prompt">System Prompt</Label>
              <textarea
                id="system-prompt"
                className="h-48 w-full rounded-md border bg-background p-2"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                disabled={isLoadingPrompt}
                placeholder="Enter system prompt for LLM..."
              />
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive p-2 text-destructive">
              {error}
            </div>
          )}

          {(isProcessing || rawText) && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Original Transcription</CardTitle>
                </CardHeader>
                <CardContent>
                  {isProcessing && !rawText ? (
                    <p className="text-sm text-muted-foreground">
                      Processing...
                    </p>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap">{rawText}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rawText && copyToClipboard(rawText)}
                        className="shrink-0"
                      >
                        {isCopied ? <IconCheck /> : <IconCopy />}
                        <span className="ml-1">
                          {isCopied ? "Copied!" : "Copy"}
                        </span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cleaned Transcription</CardTitle>
                </CardHeader>
                <CardContent>
                  {isCleaningWithLLM ? (
                    <p className="text-sm text-muted-foreground">
                      Cleaning with LLM...
                    </p>
                  ) : cleanedText ? (
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap">{cleanedText}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          cleanedText && copyToClipboard(cleanedText)
                        }
                        className="shrink-0"
                      >
                        {isCopied ? <IconCheck /> : <IconCopy />}
                        <span className="ml-1">
                          {isCopied ? "Copied!" : "Copy"}
                        </span>
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No cleaned transcription yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
