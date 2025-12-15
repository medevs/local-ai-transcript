"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconKeyboard } from "@tabler/icons-react";

interface ShortcutItem {
  keys: string;
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: "V", description: "Hold to record, release to stop" },
  { keys: "Ctrl/⌘ + N", description: "New transcript" },
  { keys: "Ctrl/⌘ + E", description: "Export current transcript" },
  { keys: "Ctrl/⌘ + Enter", description: "Submit text input" },
  { keys: "Escape", description: "Close dialogs" },
  { keys: "?", description: "Show keyboard shortcuts" },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 animate-in fade-in" />
        <Dialog.Content
          className={cn(
            "bg-background text-foreground fixed left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border p-4 shadow-lg focus:outline-hidden animate-in fade-in zoom-in-95"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold flex items-center gap-2">
              <IconKeyboard className="size-5" />
              Keyboard Shortcuts
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                ×
              </Button>
            </Dialog.Close>
          </div>

          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <span className="text-sm text-muted-foreground">
                  {shortcut.description}
                </span>
                <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Global keyboard shortcuts provider
export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput = ["INPUT", "TEXTAREA"].includes(target.tagName);

      // ? key shows shortcuts (when not in input)
      if (e.key === "?" && !isInInput) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Ctrl/Cmd + N for new transcript
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        window.location.hash = "";
        window.dispatchEvent(new CustomEvent("transcripts:new"));
        return;
      }

      // Escape to close any open dialogs
      if (e.key === "Escape") {
        setShortcutsOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {children}
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </>
  );
}
