import * as React from "react";
import { Button } from "@/components/ui/button";
import { IconUpload, IconClipboard, IconTrash, IconChevronDown } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputMethodsProps {
  isProcessing: boolean;
  isRecording: boolean;
  onFileSelect: (file: File) => void;
  onTextSubmit: (text: string) => void;
}

export function InputMethods({
  isProcessing,
  isRecording,
  onFileSelect,
  onTextSubmit,
}: InputMethodsProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [textLen, setTextLen] = React.useState(0);
  const [selectedName, setSelectedName] = React.useState<string>("");

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-3 text-sm"
      >
        <span className="font-medium">Transcript Input</span>
        <IconChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
      </button>
      {isOpen && (
        <div className="border-t p-4">
          <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
            <div className="md:col-span-3">
              <div
                className={cn(
                  "rounded-xl border border-dashed p-4 text-center transition-colors",
                  isDragging ? "bg-muted border-primary" : "bg-card border-muted"
                )}
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
                  if (f && !isProcessing && !isRecording) onFileSelect(f);
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || isRecording}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconUpload className="mr-2 h-4 w-4" />
                    )}
                    {isProcessing ? "Processing..." : "Upload Audio"}
                  </Button>
                  {selectedName && (
                    <p className="text-xs text-muted-foreground">{selectedName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">drag & drop .wav, .mp3, .m4a, .webm</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSelectedName(`${f.name}`);
                      onFileSelect(f);
                    }
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="flex flex-col gap-2">
                <textarea
                  id="paste-text"
                  className="flex-1 min-h-[140px] w-full rounded-md border bg-background p-3 text-sm resize-y focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Paste text transcript..."
                  disabled={isProcessing}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void onTextSubmit((e.target as HTMLTextAreaElement).value);
                    }
                  }}
                  onInput={(e) => setTextLen((e.target as HTMLTextAreaElement).value.length)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{textLen} chars</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const v = await navigator.clipboard.readText();
                          const ta = document.getElementById("paste-text") as HTMLTextAreaElement | null;
                          if (ta) {
                            ta.value = v || "";
                            setTextLen(ta.value.length);
                          }
                        } catch {
                          void 0;
                        }
                      }}
                      disabled={isProcessing}
                    >
                      <IconClipboard className="mr-2 h-4 w-4" />
                      Paste
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const ta = document.getElementById("paste-text") as HTMLTextAreaElement | null;
                        if (ta) {
                          ta.value = "";
                          setTextLen(0);
                        }
                      }}
                      disabled={isProcessing}
                    >
                      <IconTrash className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const ta = document.getElementById("paste-text") as HTMLTextAreaElement | null;
                        if (ta && ta.value.trim()) void onTextSubmit(ta.value.trim());
                      }}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {isProcessing ? "Processing" : "Process Text"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
