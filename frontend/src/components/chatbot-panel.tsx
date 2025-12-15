"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getTranscripts, type TranscriptItem } from "@/lib/history"
import { streamChatMessage, sendChatMessage, ApiError } from "@/lib/api-client"

type ChatMsg = { role: "user" | "assistant"; content: string }

export function ChatbotPanel() {
  const [messages, setMessages] = React.useState<ChatMsg[]>([])
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [streamingContent, setStreamingContent] = React.useState("")
  const [latestTranscript, setLatestTranscript] = React.useState<TranscriptItem | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const abortRef = React.useRef<(() => void) | null>(null)

  // Load latest transcript for context
  React.useEffect(() => {
    const loadLatest = async () => {
      const transcripts = await getTranscripts()
      setLatestTranscript(transcripts[0] || null)
    }
    loadLatest()

    // Re-load when transcripts change
    const handler = () => loadLatest()
    window.addEventListener("transcripts:update", handler)
    return () => window.removeEventListener("transcripts:update", handler)
  }, [])

  const context = React.useMemo(() => {
    return latestTranscript
      ? (latestTranscript.cleanedText || latestTranscript.rawText || "")
      : ""
  }, [latestTranscript])

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setMessages((m) => [...m, { role: "user", content: text }])
    setInput("")
    setLoading(true)
    setStreamingContent("")

    // Try streaming first, fall back to non-streaming
    try {
      let fullResponse = ""

      abortRef.current = streamChatMessage(
        text,
        // onChunk
        (chunk) => {
          fullResponse += chunk
          setStreamingContent(fullResponse)
        },
        // onDone
        () => {
          setMessages((m) => [...m, { role: "assistant", content: fullResponse }])
          setStreamingContent("")
          setLoading(false)
          abortRef.current = null
        },
        // onError - fall back to non-streaming
        async (error) => {
          console.warn("Streaming failed, falling back to non-streaming:", error)
          try {
            const reply = await sendChatMessage(text, context)
            setMessages((m) => [...m, { role: "assistant", content: reply }])
          } catch (err) {
            const msg = err instanceof ApiError ? err.message :
              err instanceof Error ? err.message : "Unknown error"
            setMessages((m) => [...m, { role: "assistant", content: `Error: ${msg}` }])
          } finally {
            setStreamingContent("")
            setLoading(false)
            abortRef.current = null
          }
        },
        context // optional context moved to end
      )
    } catch (err) {
      const msg = err instanceof ApiError ? err.message :
        err instanceof Error ? err.message : "Unknown error"
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${msg}` }])
      setStreamingContent("")
      setLoading(false)
    }
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current()
      }
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-3 pt-3">
        <div className="text-sm font-semibold">Chatbot</div>
        <div className="text-xs text-muted-foreground">
          {latestTranscript
            ? `Context: ${latestTranscript.title.slice(0, 30)}${latestTranscript.title.length > 30 ? "..." : ""}`
            : "No transcript loaded"}
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-md border m-3 p-2">
        {messages.length === 0 && !streamingContent ? (
          <p className="text-sm text-muted-foreground">Ask a question about your transcript</p>
        ) : (
          <>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`mb-2 ${m.role === "user" ? "text-foreground" : "text-muted-foreground"}`}
              >
                <span className="font-medium">{m.role === "user" ? "You" : "Assistant"}:</span>{" "}
                {m.content}
              </div>
            ))}
            {streamingContent && (
              <div className="mb-2 text-muted-foreground">
                <span className="font-medium">Assistant:</span> {streamingContent}
                <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <div className="flex gap-2 p-3 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={loading}
        />
        <Button onClick={send} disabled={loading || !input.trim()}>
          {loading ? "..." : "Send"}
        </Button>
      </div>
    </div>
  )
}
