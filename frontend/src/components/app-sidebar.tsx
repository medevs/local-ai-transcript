"use client";

import * as React from "react";
import {
  IconFileText,
  IconMicrophone,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
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
import { PlusCircleIcon } from "lucide-react";

// no-op

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [docs, setDocs] = React.useState(
    getTranscripts().map((t) => ({
      id: t.id,
      name: t.title,
      url: `#t-${t.id}`,
      icon: IconFileText,
    }))
  );

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

  React.useEffect(() => {
    return onTranscriptsChange(() => {
      setDocs(
        getTranscripts().map((t) => ({
          id: t.id,
          name: t.title,
          url: `#t-${t.id}`,
          icon: IconFileText,
        }))
      );
    });
  }, []);

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
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                onClick={() => {
                  window.location.hash = "";
                  window.dispatchEvent(new CustomEvent("transcripts:new"));
                }}
              >
                <PlusCircleIcon className="!size-5" />
                <span className="text-base">New Transcript</span>
              </button>
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
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
