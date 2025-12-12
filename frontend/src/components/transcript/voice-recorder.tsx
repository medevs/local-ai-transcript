import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2, Volume2, VolumeX, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  velocity: { x: number; y: number };
}

interface VoiceRecorderProps {
  isRecording: boolean;
  isStarting: boolean;
  isProcessing: boolean;
  volume: number;
  waveformData: number[];
  duration: number;
  onToggle: () => void;
}

export function VoiceRecorder({
  isRecording,
  isStarting,
  isProcessing,
  volume,
  waveformData,
  duration,
  onToggle,
}: VoiceRecorderProps) {
  const [particles, setParticles] = React.useState<Particle[]>([]);
  const animationRef = React.useRef<number>(0);

  // Particle System
  React.useEffect(() => {
    const generateParticles = () => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < 20; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 400,
          y: Math.random() * 400,
          size: Math.random() * 3 + 1,
          opacity: Math.random() * 0.3 + 0.1,
          velocity: {
            x: (Math.random() - 0.5) * 0.5,
            y: (Math.random() - 0.5) * 0.5,
          },
        });
      }
      setParticles(newParticles);
    };

    generateParticles();
  }, []);

  React.useEffect(() => {
    const animateParticles = () => {
      setParticles((prev) =>
        prev.map((particle) => ({
          ...particle,
          x: (particle.x + particle.velocity.x + 400) % 400,
          y: (particle.y + particle.velocity.y + 400) % 400,
          opacity: particle.opacity + (Math.random() - 0.5) * 0.02,
        }))
      );
      animationRef.current = requestAnimationFrame(animateParticles);
    };

    animationRef.current = requestAnimationFrame(animateParticles);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    if (isStarting) return "Starting...";
    if (isRecording) return "Listening...";
    if (isProcessing) return "Processing...";
    return "Tap to speak";
  };

  const getStatusColor = () => {
    if (isRecording) return "text-blue-400";
    if (isProcessing) return "text-yellow-400";
    return "text-muted-foreground";
  };

  return (
    <div className="text-card-foreground flex flex-col gap-6 rounded-xl border py-4 shadow-sm relative overflow-hidden bg-background/50 backdrop-blur-sm border-muted">
      <div className="relative z-10 flex flex-col items-center justify-center p-4 space-y-6 min-h-[200px]">
        {/* Ambient particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-1 h-1 bg-primary/20 rounded-full"
              style={{
                left: particle.x,
                top: particle.y,
                opacity: particle.opacity,
              }}
              animate={{
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Background glow effects */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-64 h-64 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl"
            animate={{
              scale: isRecording ? [1, 1.2, 1] : [1, 1.1, 1],
              opacity: isRecording ? [0.3, 0.6, 0.3] : [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Main voice button */}
        <motion.div
          className="relative"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.button
            onClick={onToggle}
            className={cn(
              "relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
              "bg-gradient-to-br from-primary/20 to-primary/10 border-2",
              isRecording
                ? "border-blue-500 shadow-lg shadow-blue-500/25"
                : isProcessing
                ? "border-yellow-500 shadow-lg shadow-yellow-500/25"
                : "border-border hover:border-primary/50"
            )}
            animate={{
              boxShadow: isRecording
                ? [
                    "0 0 0 0 rgba(59, 130, 246, 0.4)",
                    "0 0 0 20px rgba(59, 130, 246, 0)",
                  ]
                : undefined,
            }}
            transition={{
              duration: 1.5,
              repeat: isRecording ? Infinity : 0,
            }}
          >
            <AnimatePresence mode="wait">
              {isProcessing || isStarting ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
                </motion.div>
              ) : isRecording ? (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Mic className="w-12 h-12 text-blue-500" />
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Mic className="w-12 h-12 text-muted-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Pulse rings */}
          <AnimatePresence>
            {isRecording && (
              <>
                <motion.div
                  key="pulse-1"
                  className="absolute inset-0 rounded-full border-2 border-blue-500/30 pointer-events-none"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
                <motion.div
                  key="pulse-2"
                  className="absolute inset-0 rounded-full border-2 border-blue-500/20 pointer-events-none"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeOut",
                    delay: 0.5,
                  }}
                />
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Waveform visualizer */}
        <div className="flex items-center justify-center space-x-1 h-12">
          {waveformData.map((height, index) => (
            <motion.div
              key={index}
              className={cn(
                "w-1 rounded-full transition-colors duration-300",
                isRecording
                  ? "bg-blue-500"
                  : isProcessing
                  ? "bg-yellow-500"
                  : "bg-muted/30"
              )}
              animate={{
                height: `${Math.max(4, height * 0.4)}px`,
                opacity: isRecording ? 1 : 0.3,
              }}
              transition={{
                duration: 0.1,
                ease: "easeOut",
              }}
            />
          ))}
        </div>

        {/* Status and timer */}
        <div className="text-center space-y-2">
          <motion.p
            className={cn(
              "text-lg font-medium transition-colors",
              getStatusColor()
            )}
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{
              duration: 2,
              repeat: isRecording || isProcessing ? Infinity : 0,
            }}
          >
            {getStatusText()}
          </motion.p>

          <p className="text-sm text-muted-foreground font-mono">
            {formatTime(duration)}
          </p>

          {isRecording && volume > 0 && (
            <motion.div
              className="flex items-center justify-center space-x-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  animate={{ width: `${volume}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          )}
        </div>

        {/* AI indicator */}
        <motion.div
          className="flex items-center space-x-2 text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Powered</span>
        </motion.div>
      </div>
    </div>
  );
}
