"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadExport } from "@/lib/api-client";
import { IconDownload, IconFileText, IconFileTypePdf, IconMarkdown } from "@tabler/icons-react";

type ExportFormat = "md" | "txt" | "pdf";

interface ExportDialogProps {
  transcriptId: string;
  transcriptTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({
  transcriptId,
  transcriptTitle,
  open,
  onOpenChange,
}: ExportDialogProps) {
  const [loading, setLoading] = React.useState<ExportFormat | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setLoading(format);
    setError(null);

    try {
      await downloadExport(transcriptId, format, transcriptTitle);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(null);
    }
  };

  const formats: { format: ExportFormat; label: string; icon: typeof IconMarkdown; description: string }[] = [
    {
      format: "md",
      label: "Markdown",
      icon: IconMarkdown,
      description: "Best for documentation and notes",
    },
    {
      format: "txt",
      label: "Plain Text",
      icon: IconFileText,
      description: "Simple, universal format",
    },
    {
      format: "pdf",
      label: "PDF",
      icon: IconFileTypePdf,
      description: "Best for sharing and printing",
    },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 animate-in fade-in" />
        <Dialog.Content
          className={cn(
            "bg-background text-foreground fixed left-1/2 top-1/2 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border p-4 shadow-lg focus:outline-hidden animate-in fade-in zoom-in-95"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold flex items-center gap-2">
              <IconDownload className="size-5" />
              Export Transcript
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                ×
              </Button>
            </Dialog.Close>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Choose a format to export "{(transcriptTitle || "Untitled").slice(0, 30)}
            {(transcriptTitle || "").length > 30 ? "..." : ""}"
          </p>

          {error && (
            <div className="mb-4 p-2 rounded bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {formats.map(({ format, label, icon: Icon, description }) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={loading !== null}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  "hover:bg-accent hover:border-accent-foreground/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  loading === format && "bg-accent"
                )}
              >
                <Icon className="size-5 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </div>
                {loading === format && (
                  <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Export button component for easy integration
interface ExportButtonProps {
  transcriptId: string;
  transcriptTitle: string;
  className?: string;
}

export function ExportButton({ transcriptId, transcriptTitle, className }: ExportButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
        aria-label="Export transcript"
      >
        <IconDownload className="size-4 mr-1" />
        Export
      </Button>
      <ExportDialog
        transcriptId={transcriptId}
        transcriptTitle={transcriptTitle}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
