"use client";

import * as React from "react";
import { addTranscript, getTranscriptById } from "@/lib/history";
import {
  transcribeAudio,
  cleanText,
  fetchSystemPrompt,
  generateTitle,
  ApiError,
} from "@/lib/api-client";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { VoiceRecorder } from "@/components/transcript/voice-recorder";
import { InputMethods } from "@/components/transcript/input-methods";
import { TranscriptResults } from "@/components/transcript/transcript-results";

declare global {
  interface Window {
    transcriptDebug: {
      isRecording: boolean;
      isStarting: boolean;
      isProcessing: boolean;
      startRecording: () => Promise<void>;
      stopRecording: () => Promise<Blob | null>;
    };
  }
}

export function TranscriptPanel() {
  // --- State ---
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [rawText, setRawText] = React.useState<string | null>(null);
  const [cleanedText, setCleanedText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [useLLM, setUseLLM] = React.useState(true);
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [isCleaningWithLLM, setIsCleaningWithLLM] = React.useState(false);
  const [displayedCleanedText, setDisplayedCleanedText] = React.useState<string | null>(null);
  const [currentTranscriptId, setCurrentTranscriptId] = React.useState<string | null>(null);
  const [currentTranscriptTitle, setCurrentTranscriptTitle] = React.useState<string>("Transcript");

  const isKeyDownRef = React.useRef(false);
  const currentTranscriptIdRef = React.useRef<string | null>(null);

  // Keep ref in sync with state
  React.useEffect(() => {
    currentTranscriptIdRef.current = currentTranscriptId;
  }, [currentTranscriptId]);

  // --- Hooks ---
  const {
    isRecording,
    isStarting,
    startRecording,
    stopRecording,
    resetTimer,
    recordingTime,
    error: recorderError,
    volume,
    waveformData,
  } = useAudioRecorder();

  // Sync recorder error to local error state
  React.useEffect(() => {
    if (recorderError) setError(recorderError);
  }, [recorderError]);

  // --- Typewriter Effect ---
  React.useEffect(() => {
    if (!cleanedText) {
      setDisplayedCleanedText(null);
      return;
    }

    if (cleanedText.length < 50) {
      setDisplayedCleanedText(cleanedText);
      return;
    }

    let currentIndex = 0;
    const intervalId = setInterval(() => {
      currentIndex += 3;
      if (currentIndex >= cleanedText.length) {
        setDisplayedCleanedText(cleanedText);
        clearInterval(intervalId);
      } else {
        setDisplayedCleanedText(cleanedText.slice(0, currentIndex));
      }
    }, 10);

    return () => clearInterval(intervalId);
  }, [cleanedText]);

  // --- Settings Integration ---
  React.useEffect(() => {
    const apply = (detail?: unknown) => {
      try {
        const d = detail as { enableAI?: boolean | string; systemPrompt?: string } | null;
        const v = d?.enableAI ?? localStorage.getItem("settings.enableAI");
        const p = d?.systemPrompt ?? localStorage.getItem("settings.systemPrompt");
        if (v !== null) setUseLLM(v === true || v === "true");
        if (typeof p === "string") setSystemPrompt(p);
      } catch (err) {
        console.error("Failed to apply settings:", err);
      }
    };
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      apply(ce.detail);
    };
    window.addEventListener("settings:updated", handler as EventListener);
    apply();
    (async () => {
      if (!localStorage.getItem("settings.systemPrompt")) {
        try {
          const defaultPrompt = await fetchSystemPrompt();
          setSystemPrompt(defaultPrompt);
          localStorage.setItem("settings.systemPrompt", defaultPrompt);
        } catch (err) {
          console.error("Failed to fetch default system prompt:", err);
        }
      }
    })();
    return () => window.removeEventListener("settings:updated", handler as EventListener);
  }, []);

  const uploadAudio = React.useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Transcribe audio using API client
        const rawResult = await transcribeAudio(audioBlob, "recording.webm");
        setRawText(rawResult);
        setIsProcessing(false);

        let cleaned: string | undefined;
        if (useLLM && rawResult) {
          setIsCleaningWithLLM(true);
          cleaned = await cleanText(rawResult, systemPrompt || undefined);
          setCleanedText(cleaned);
          setIsCleaningWithLLM(false);
        }

        // Generate AI title and save to history
        const titleSource = cleaned ?? rawResult;
        let title: string;
        try {
          title = await generateTitle(titleSource);
        } catch {
          // Fallback to first 3 words if AI fails
          title = titleSource.trim().split(/\s+/).slice(0, 3).join(" ") || "Transcript";
        }
        const newTranscript = await addTranscript({
          title,
          rawText: rawResult,
          cleanedText: cleaned,
        });
        setCurrentTranscriptId(newTranscript.id);
        setCurrentTranscriptTitle(title);
        // Update URL to point to new transcript (without triggering hashchange reset)
        window.history.replaceState(null, "", `#t-${newTranscript.id}`);

      } catch (err) {
        const msg = err instanceof ApiError ? err.message :
          err instanceof Error ? err.message : "Unknown error";
        setError("Processing failed: " + msg);
        setIsProcessing(false);
        setIsCleaningWithLLM(false);
      }
    },
    [useLLM, systemPrompt]
  );

  const handleToggleListening = React.useCallback(async () => {
    if (isRecording) {
      // STOP
      const blob = await stopRecording();
      if (blob) {
        await uploadAudio(blob);
      }
    } else {
      // START
      if (isProcessing || isCleaningWithLLM) return;

      // Reset all state for new recording
      setRawText(null);
      setCleanedText(null);
      setDisplayedCleanedText(null);
      setError(null);
      setCurrentTranscriptId(null);
      setCurrentTranscriptTitle("Transcript");
      resetTimer(); // Reset timer before starting new recording

      await startRecording();
    }
  }, [isRecording, stopRecording, uploadAudio, isProcessing, isCleaningWithLLM, startRecording, resetTimer]);

  const processAudioFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file");
      return;
    }
    setError(null);
    setRawText(null);
    setCleanedText(null);
    setDisplayedCleanedText(null);
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
        setRawText(text);
        setCleanedText(null);
        setDisplayedCleanedText(null);
        setIsProcessing(false);

        let cleaned: string | undefined;
        if (useLLM) {
          setIsCleaningWithLLM(true);
          cleaned = await cleanText(text, systemPrompt || undefined);
          setCleanedText(cleaned);
          setIsCleaningWithLLM(false);
        }

        // Generate AI title and save to history
        const titleSource = cleaned ?? text;
        let title: string;
        try {
          title = await generateTitle(titleSource);
        } catch {
          // Fallback to first 3 words if AI fails
          title = titleSource.trim().split(/\s+/).slice(0, 3).join(" ") || "Transcript";
        }
        const newTranscript = await addTranscript({
          title,
          rawText: text,
          cleanedText: cleaned,
        });
        setCurrentTranscriptId(newTranscript.id);
        setCurrentTranscriptTitle(title);
        // Update URL to point to new transcript (without triggering hashchange reset)
        window.history.replaceState(null, "", `#t-${newTranscript.id}`);

      } catch (err) {
        const msg = err instanceof ApiError ? err.message :
          err instanceof Error ? err.message : "Unknown error";
        setError("Processing failed: " + msg);
        setIsProcessing(false);
        setIsCleaningWithLLM(false);
      }
    },
    [useLLM, systemPrompt]
  );

  // --- Keyboard Shortcuts ---
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
        if (!isRecording) void handleToggleListening();
      }
    };
    const up = async (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "v") {
        isKeyDownRef.current = false;
        if (isRecording) {
           const blob = await stopRecording();
           if (blob) void uploadAudio(blob);
        }
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [isRecording, isProcessing, handleToggleListening, stopRecording, uploadAudio]);

  // Helper to clear/reset the panel
  const resetPanel = React.useCallback(() => {
    setIsProcessing(false);
    setIsCleaningWithLLM(false);
    setRawText(null);
    setCleanedText(null);
    setError(null);
    setDisplayedCleanedText(null);
    setCurrentTranscriptId(null);
    setCurrentTranscriptTitle("Transcript");

    // Reset inputs
    const ta = document.getElementById("paste-text") as HTMLTextAreaElement | null;
    if (ta) ta.value = "";
  }, []);

  // --- Global Events ---
  React.useEffect(() => {
    // Handle hash changes - load transcript when URL has #t-{id}
    const onHash = async () => {
      const m = window.location.hash.match(/^#t-(.+)/);
      if (m) {
        const item = await getTranscriptById(m[1]);
        if (item) {
          // Reset all processing state when switching transcripts
          setIsProcessing(false);
          setIsCleaningWithLLM(false);
          setDisplayedCleanedText(null);
          setError(null);
          resetTimer();

          // Load the transcript data
          setRawText(item.rawText);
          setCleanedText(item.cleanedText || null);
          setCurrentTranscriptId(item.id);
          setCurrentTranscriptTitle(item.title);
        } else {
          // Transcript not found (was deleted), reset panel and clear URL
          window.location.hash = "";
          resetPanel();
        }
      }
      // NOTE: Don't reset when hash is empty - user might be creating a new transcript
    };

    // Explicit "new transcript" request - reset everything
    const onNew = () => {
      resetPanel();
      resetTimer();
    };

    // Check if currently viewed transcript was deleted
    const onTranscriptsUpdate = async () => {
      const currentId = currentTranscriptIdRef.current;
      if (currentId) {
        const item = await getTranscriptById(currentId);
        if (!item) {
          // Current transcript was deleted
          window.location.hash = "";
          resetPanel();
        }
      }
    };

    window.addEventListener("hashchange", onHash);
    window.addEventListener("transcripts:new", onNew);
    window.addEventListener("transcripts:update", onTranscriptsUpdate);

    // Only load from hash on mount if there's a transcript ID in URL
    if (window.location.hash.match(/^#t-.+/)) {
      onHash();
    }

    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("transcripts:new", onNew);
      window.removeEventListener("transcripts:update", onTranscriptsUpdate);
    };
  }, [resetPanel, resetTimer]);

  // --- Debug (development only) ---
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      window.transcriptDebug = {
        isRecording,
        isStarting,
        isProcessing,
        startRecording,
        stopRecording
      };
    }
  }, [isRecording, isStarting, isProcessing, startRecording, stopRecording]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Voice Recorder UI */}
      <VoiceRecorder
        isRecording={isRecording}
        isStarting={isStarting}
        isProcessing={isProcessing || isCleaningWithLLM}
        volume={volume}
        waveformData={waveformData}
        duration={recordingTime}
        onToggle={handleToggleListening}
      />

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      

      {/* Input Methods (Upload / Paste) */}
      <InputMethods
        isProcessing={isProcessing || isCleaningWithLLM}
        isRecording={isRecording}
        onFileSelect={processAudioFile}
        onTextSubmit={handleTextSubmit}
      />

      {/* Results */}
      <TranscriptResults
        isProcessing={isProcessing}
        isCleaningWithLLM={isCleaningWithLLM}
        rawText={rawText}
        cleanedText={cleanedText}
        displayedCleanedText={displayedCleanedText}
        transcriptId={currentTranscriptId}
        transcriptTitle={currentTranscriptTitle}
      />
    </div>
  );
}
