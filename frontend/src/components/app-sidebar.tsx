"use client";

import * as React from "react";
import {
  IconFileText,
  IconMicrophone,
  IconMoon,
  IconSun,
  IconSettings,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { fetchSystemPrompt } from "@/lib/api-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getTranscripts, onTranscriptsChange } from "@/lib/history";
import { Toggle } from "@/components/ui/toggle";
import * as Dialog from "@radix-ui/react-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [docs, setDocs] = React.useState<
    { id: string; name: string; url: string; icon: typeof IconFileText }[]
  >([]);

  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    const v =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("theme")
        : null;
    return v === "dark" ? "dark" : "light";
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      void e;
    }
  }, [theme]);

  // Load transcripts on mount and when they change
  const loadDocs = React.useCallback(async () => {
    const transcripts = await getTranscripts();
    setDocs(
      transcripts.map((t) => ({
        id: t.id,
        name: t.title,
        url: `#t-${t.id}`,
        icon: IconFileText,
      }))
    );
  }, []);

  React.useEffect(() => {
    loadDocs();
    return onTranscriptsChange(() => {
      loadDocs();
    });
  }, [loadDocs]);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [enableAI, setEnableAI] = React.useState<boolean>(() => {
    try {
      const v = localStorage.getItem("settings.enableAI");
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });
  const [systemPrompt, setSystemPrompt] = React.useState<string>(() => {
    try {
      return localStorage.getItem("settings.systemPrompt") || "";
    } catch {
      return "";
    }
  });

  // Fetch default system prompt if not set in localStorage
  React.useEffect(() => {
    const loadDefaultPrompt = async () => {
      try {
        const stored = localStorage.getItem("settings.systemPrompt");
        if (!stored) {
          const defaultPrompt = await fetchSystemPrompt();
          setSystemPrompt(defaultPrompt);
          localStorage.setItem("settings.systemPrompt", defaultPrompt);
        }
      } catch {
        void 0;
      }
    };
    loadDefaultPrompt();
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("settings.enableAI", String(enableAI));
      localStorage.setItem("settings.systemPrompt", systemPrompt);
      window.dispatchEvent(
        new CustomEvent("settings:updated", {
          detail: { enableAI, systemPrompt },
        })
      );
    } catch {
      void 0;
    }
  }, [enableAI, systemPrompt]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconMicrophone className="!size-6" />
                <span className="text-lg font-semibold">
                  Local AI Transcript
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavDocuments items={docs} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-center w-full gap-2">
          <Toggle
            pressed={theme === "dark"}
            onPressedChange={(v) => setTheme(v ? "dark" : "light")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <IconMoon /> : <IconSun />}
            <span className="ml-2">{theme === "dark" ? "Dark" : "Light"}</span>
          </Toggle>
          <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Dialog.Trigger asChild>
              <Button variant="outline" size="sm" aria-label="Settings">
                <IconSettings />
                <span className="ml-2">Settings</span>
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/20" />
              <Dialog.Content className={cn("bg-background text-foreground fixed left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-4 shadow-lg focus:outline-hidden")}
              >
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-base font-semibold">Processing Settings</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="sm" aria-label="Close">×</Button>
                  </Dialog.Close>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="enable-ai"
                      checked={enableAI}
                      onCheckedChange={(v) => setEnableAI(!!v)}
                    />
                    <Label htmlFor="enable-ai">Enable AI processing</Label>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="prompt" className="text-xs text-muted-foreground">Prompt</Label>
                    <textarea
                      id="prompt"
                      className={cn("min-h-32 w-full rounded-md border bg-background p-3 text-sm leading-relaxed whitespace-pre-wrap", "focus:ring-2 focus:ring-primary/20 outline-none transition-all")}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Enter system prompt..."
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{systemPrompt.length} chars</span>
                      <span className={cn(systemPrompt.length > 4000 && "text-destructive")}>max 4000</span>
                    </div>
                    {systemPrompt.length > 4000 && (
                      <div className="text-destructive text-xs">Prompt too long. Please shorten.</div>
                    )}
                  </div>
                  <div className="flex items-end justify-end">
                    <Dialog.Close asChild>
                      <Button
                        variant="default"
                        disabled={systemPrompt.length > 4000}
                      >
                        Save
                      </Button>
                    </Dialog.Close>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
