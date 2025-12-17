import { useEffect } from "react";

type ShortcutHandler = (event: KeyboardEvent) => void;

interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: ShortcutHandler;
  description: string;
  // If true, the shortcut works even when in input/textarea
  allowInInput?: boolean;
}

const shortcuts: Shortcut[] = [];

export function registerShortcut(shortcut: Shortcut) {
  shortcuts.push(shortcut);
  return () => {
    const index = shortcuts.indexOf(shortcut);
    if (index > -1) {
      shortcuts.splice(index, 1);
    }
  };
}

export function getShortcuts() {
  return shortcuts.map((s) => ({
    key: s.key,
    ctrlKey: s.ctrlKey,
    metaKey: s.metaKey,
    shiftKey: s.shiftKey,
    altKey: s.altKey,
    description: s.description,
  }));
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInInput = ["INPUT", "TEXTAREA"].includes(target.tagName);

      for (const shortcut of shortcuts) {
        if (!shortcut.allowInInput && isInInput) continue;

        const keyMatches =
          event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const metaMatches = shortcut.metaKey ? event.metaKey : !event.metaKey;
        const shiftMatches = shortcut.shiftKey
          ? event.shiftKey
          : !event.shiftKey;
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey;

        // Allow Ctrl OR Cmd for cross-platform shortcuts
        const modifierMatches =
          (shortcut.ctrlKey || shortcut.metaKey)
            ? event.ctrlKey || event.metaKey
            : ctrlMatches && metaMatches;

        if (
          keyMatches &&
          modifierMatches &&
          shiftMatches &&
          altMatches
        ) {
          event.preventDefault();
          shortcut.handler(event);
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

// Custom hook for registering a shortcut
export function useShortcut(
  key: string,
  handler: ShortcutHandler,
  description: string,
  options?: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    allowInInput?: boolean;
  }
) {
  useEffect(() => {
    return registerShortcut({
      key,
      handler,
      description,
      ...options,
    });
  }, [key, handler, description, options]);
}

// Format shortcut for display (e.g., "Ctrl+N" or "⌘N")
export function formatShortcut(shortcut: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): string {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");

  const parts: string[] = [];

  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (shortcut.altKey) {
    parts.push(isMac ? "⌥" : "Alt");
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? "⇧" : "Shift");
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? "" : "+");
}
