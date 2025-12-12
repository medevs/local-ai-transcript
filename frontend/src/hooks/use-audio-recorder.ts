import * as React from "react";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isStarting: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  recordingTime: number;
  error: string | null;
  volume: number;
  waveformData: number[];
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [volume, setVolume] = React.useState(0);
  const [waveformData, setWaveformData] = React.useState<number[]>(
    Array(32).fill(0)
  );

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const isStartCancelledRef = React.useRef(false);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = React.useRef<number>(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup function to release all resources
  const cleanup = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    mediaRecorderRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
  }, []);

  // Initialize Audio Context for visualization
  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextCtor) throw new Error("Web Audio API not supported");
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 64;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAnalysis = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate volume (average)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Normalize volume 0-100
        setVolume(Math.min(100, (average / 255) * 100 * 2)); // * 2 to boost sensitivity

        // Update waveform data (subset of frequencies)
        // Map 32 bars
        const step = Math.floor(bufferLength / 32);
        const newWaveform = Array(32).fill(0).map((_, i) => {
          const value = dataArray[i * step] || 0;
          return value;
        });
        setWaveformData(newWaveform);
        
        animationFrameRef.current = requestAnimationFrame(updateAnalysis);
      };
      
      updateAnalysis();
    } catch (e) {
      console.error("Audio analysis setup failed", e);
    }
  };

  const startRecording = React.useCallback(async () => {
    if (isRecording || isStarting) return;
    
    setIsStarting(true);
    setError(null);
    isStartCancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (isStartCancelledRef.current) {
        stream.getTracks().forEach(t => t.stop());
        setIsStarting(false);
        return;
      }

      streamRef.current = stream;
      
      // Setup Visualizer
      setupAudioAnalysis(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect chunks every 100ms for safety
      
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError("Microphone access denied: " + msg);
      cleanup();
    } finally {
      setIsStarting(false);
    }
  }, [isRecording, isStarting, cleanup]);

  const stopRecording = React.useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        setIsRecording(false);
        setIsStarting(false);
        resolve(null);
        return;
      }

      // Handler for successful stop
      const handleStop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        cleanup();
        setIsRecording(false);
        setIsStarting(false);
        resolve(blob);
      };

      recorder.onstop = handleStop;
      
      try {
        recorder.stop();
        
        // Failsafe: If onstop doesn't fire within 1 second, force close
        setTimeout(() => {
          if (streamRef.current) {
            console.warn("Force stopping recording due to onstop timeout");
            handleStop();
          }
        }, 1000);
      } catch (e) {
        console.error("Error stopping recorder:", e);
        handleStop(); // Try to salvage what we have
      }
    });
  }, [cleanup]);

  const cancelRecording = React.useCallback(() => {
    if (isStarting) {
      isStartCancelledRef.current = true;
    }
    cleanup();
    setIsRecording(false);
    setIsStarting(false);
    setRecordingTime(0);
    setWaveformData(Array(32).fill(0));
    setVolume(0);
  }, [isStarting, cleanup]);

  // Cleanup on unmount
  React.useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isRecording,
    isStarting,
    startRecording,
    stopRecording,
    cancelRecording,
    recordingTime,
    error,
    volume,
    waveformData
  };
}
