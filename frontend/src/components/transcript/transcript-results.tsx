import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportButton } from "./export-dialog";

interface TranscriptResultsProps {
  isProcessing: boolean;
  isCleaningWithLLM: boolean;
  rawText: string | null;
  cleanedText: string | null;
  displayedCleanedText: string | null;
  transcriptId: string | null;
  transcriptTitle: string;
}

export function TranscriptResults({
  isProcessing,
  isCleaningWithLLM,
  rawText,
  cleanedText,
  displayedCleanedText,
  transcriptId,
  transcriptTitle,
}: TranscriptResultsProps) {
  const [isCopiedRaw, setIsCopiedRaw] = React.useState(false);
  const [isCopiedClean, setIsCopiedClean] = React.useState(false);

  const copyToClipboard = (text: string, isClean: boolean) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (isClean) {
          setIsCopiedClean(true);
          setTimeout(() => setIsCopiedClean(false), 2000);
        } else {
          setIsCopiedRaw(true);
          setTimeout(() => setIsCopiedRaw(false), 2000);
        }
      })
      .catch((err) => console.error("Copy failed", err));
  };

  if (!isProcessing && !rawText) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Export Button */}
      {transcriptId && !isProcessing && !isCleaningWithLLM && (
        <div className="flex justify-end">
          <ExportButton
            transcriptId={transcriptId}
            transcriptTitle={transcriptTitle}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Original</CardTitle>
              {rawText && !isProcessing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(rawText, false)}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  {isCopiedRaw ? (
                    <IconCheck className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <IconCopy className="h-3.5 w-3.5 mr-1" />
                  )}
                  <span className="text-xs">{isCopiedRaw ? "Copied" : "Copy"}</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isProcessing && !rawText ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Transcribing...
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed opacity-80">
                {rawText}
              </p>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(
            isCleaningWithLLM &&
              "border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary" />
                Cleaned
              </CardTitle>
              {cleanedText && !isCleaningWithLLM && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(cleanedText, true)}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  {isCopiedClean ? (
                    <IconCheck className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <IconCopy className="h-3.5 w-3.5 mr-1" />
                  )}
                  <span className="text-xs">{isCopiedClean ? "Copied" : "Copy"}</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isCleaningWithLLM ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Refining with AI...
              </div>
            ) : displayedCleanedText ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {displayedCleanedText}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Waiting for cleaned output...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
