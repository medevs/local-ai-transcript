import * as React from "react";
import { Button } from "@/components/ui/button";
import { IconUpload } from "@tabler/icons-react";

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* File Upload */}
      <div
        className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
          isDragging ? "bg-muted border-primary" : "bg-card border-muted"
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
          if (f && !isProcessing && !isRecording) onFileSelect(f);
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || isRecording}
          >
            <IconUpload className="mr-2 h-4 w-4" />
            Upload Audio File
          </Button>
          <p className="text-xs text-muted-foreground">
            or drag and drop audio file here
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelect(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {/* Text Paste */}
      <div className="flex flex-col gap-2">
        <textarea
          id="paste-text"
          className="flex-1 min-h-[80px] w-full rounded-md border bg-background p-3 text-sm resize-none focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          placeholder="Or paste text transcript here..."
          disabled={isProcessing}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void onTextSubmit((e.target as HTMLTextAreaElement).value);
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="self-end"
          onClick={() => {
            const ta = document.getElementById(
              "paste-text"
            ) as HTMLTextAreaElement | null;
            if (ta && ta.value.trim()) void onTextSubmit(ta.value.trim());
          }}
          disabled={isProcessing}
        >
          Process Text
        </Button>
      </div>
    </div>
  );
}
