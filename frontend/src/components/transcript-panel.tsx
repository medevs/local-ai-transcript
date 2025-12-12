"use client";

import * as React from "react";
import { addTranscript, getTranscriptById } from "@/lib/history";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { VoiceRecorder } from "@/components/transcript/voice-recorder";
import { InputMethods } from "@/components/transcript/input-methods";
import { TranscriptResults } from "@/components/transcript/transcript-results";
 

type TranscriptionResponse = {
  success: boolean;
  text?: string;
  error?: string;
};
type CleanResponse = { success: boolean; text?: string };
type SystemPromptResponse = { default_prompt: string };

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

  const isKeyDownRef = React.useRef(false);

  // --- Hooks ---
  const {
    isRecording,
    isStarting,
    startRecording,
    stopRecording,
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
      } catch { void 0 }
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
          const res = await fetch("/api/system-prompt");
          const data = (await res.json()) as SystemPromptResponse;
          setSystemPrompt(data.default_prompt);
          localStorage.setItem("settings.systemPrompt", data.default_prompt);
        } catch { void 0 }
      }
    })();
    return () => window.removeEventListener("settings:updated", handler as EventListener);
  }, []);

  const uploadAudio = React.useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      setError(null);
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      
      try {
        const transcribeResponse = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        
        if (!transcribeResponse.ok)
          throw new Error(`Transcription failed: ${transcribeResponse.statusText}`);
          
        const transcribeData = (await transcribeResponse.json()) as TranscriptionResponse;
        
        if (!transcribeData.success)
          throw new Error(transcribeData.error || "Transcription failed");
          
        setRawText(transcribeData.text || "");
        setIsProcessing(false);

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
        
        // Save to history
        const titleSource = useLLM && cleanedText ? cleanedText : transcribeData.text || "";
        const title = titleSource.trim().split(/\s+/).slice(0, 8).join(" ");
        addTranscript({
          title: title || "Transcript",
          rawText: transcribeData.text || "",
          cleanedText: useLLM ? cleanedText : undefined,
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
      
      setRawText(null);
      setCleanedText(null);
      setDisplayedCleanedText(null);
      setError(null);
      
      await startRecording();
    }
  }, [isRecording, stopRecording, uploadAudio, isProcessing, isCleaningWithLLM, startRecording]);

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
        
        // Save to history
        const titleSource = useLLM && cleanedText ? cleanedText : text;
        const title = titleSource.trim().split(/\s+/).slice(0, 8).join(" ");
        addTranscript({
          title: title || "Transcript",
          rawText: text,
          cleanedText: useLLM ? cleanedText : undefined,
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

  // --- Global Events ---
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
    
    const onNew = () => {
      setIsProcessing(false);
      setIsCleaningWithLLM(false);
      setRawText(null);
      setCleanedText(null);
      setError(null);
      setDisplayedCleanedText(null);
      
      // Reset inputs
      const ta = document.getElementById("paste-text") as HTMLTextAreaElement | null;
      if (ta) ta.value = "";
      // Reset file input is handled in InputMethods via key or ref reset if needed, 
      // but since it's a sub-component, we might rely on re-mounting or just manual clear if exposed.
      // For now, simple state reset is enough.
    };
    
    window.addEventListener("hashchange", onHash);
    window.addEventListener("transcripts:new", onNew);
    onHash();
    
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("transcripts:new", onNew);
    };
  }, []);

  // --- Debug ---
  React.useEffect(() => {
    window.transcriptDebug = {
      isRecording,
      isStarting,
      isProcessing,
      startRecording,
      stopRecording
    };
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
      />
    </div>
  );
}
