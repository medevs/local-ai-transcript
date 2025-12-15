import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { TranscriptPanel } from "./components/transcript-panel"
import { ChatbotPanel } from "./components/chatbot-panel"
import { SiteHeader } from "@/components/site-header"
import { ErrorBoundary } from "@/components/error-boundary"
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-dialog"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { IconMessageCircle } from "@tabler/icons-react"
import { ExpandableChat } from "@/components/ui/expandable-chat"


export default function Page() {
  return (
    <ErrorBoundary>
    <KeyboardShortcutsProvider>
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col px-4 lg:px-6 py-4 md:py-6">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12">
              <TranscriptPanel />
            </div>
          </div>
        </div>

        {/* Expandable Chat – anchored near the floating button */}
        <ExpandableChat
          position="bottom-right"
          size="md"
          icon={<IconMessageCircle className="h-6 w-6" />}
        >
          <ChatbotPanel />
        </ExpandableChat>
      </SidebarInset>
    </SidebarProvider>
    </KeyboardShortcutsProvider>
    </ErrorBoundary>
  )
}
