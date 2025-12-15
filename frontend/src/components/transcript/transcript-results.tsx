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
            <CardTitle className="text-sm font-medium">Original</CardTitle>
          </CardHeader>
          <CardContent>
            {isProcessing && !rawText ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Transcribing...
              </div>
            ) : (
              <div className="group relative">
                <p className="whitespace-pre-wrap text-sm leading-relaxed opacity-80">
                  {rawText}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => rawText && copyToClipboard(rawText, false)}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {isCopiedRaw ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    <IconCopy className="h-4 w-4" />
                  )}
                </Button>
              </div>
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
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-primary" />
              Cleaned
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isCleaningWithLLM ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Refining with AI...
              </div>
            ) : displayedCleanedText ? (
              <div className="group relative">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {displayedCleanedText}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => cleanedText && copyToClipboard(cleanedText, true)}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {isCopiedClean ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    <IconCopy className="h-4 w-4" />
                  )}
                </Button>
              </div>
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
