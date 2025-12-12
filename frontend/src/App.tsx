import { AppSidebar } from "@/components/app-sidebar"
import { TranscriptPanel } from "./components/transcript-panel"
import { ChatbotPanel } from "./components/chatbot-panel"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"


export default function Page() {
  return (
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
            <div className="col-span-12 lg:col-span-8">
              <TranscriptPanel />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <ChatbotPanel />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
