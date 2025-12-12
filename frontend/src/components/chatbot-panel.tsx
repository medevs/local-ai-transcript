"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getTranscripts } from "@/lib/history"

type ChatMsg = { role: "user" | "assistant"; content: string }

export function ChatbotPanel() {
  const [messages, setMessages] = React.useState<ChatMsg[]>([])
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const context = React.useMemo(() => {
    const [latest] = getTranscripts()
    return latest ? (latest.cleanedText || latest.rawText) : ""
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { role: "user", content: text }])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context }),
      })
      if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`)
      const data = await res.json()
      const reply = typeof data === "string" ? data : (data.reply ?? JSON.stringify(data))
      setMessages((m) => [...m, { role: "assistant", content: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-3 pt-3">
        <div className="text-sm font-semibold">Chatbot</div>
        <div className="text-xs text-muted-foreground">Chat with your latest transcript</div>
      </div>
      <div className="flex-1 overflow-auto rounded-md border m-3 p-2">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ask a question about your transcript</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`mb-2 ${m.role === "user" ? "text-foreground" : "text-muted-foreground"}`}>
              <span className="font-medium">{m.role === "user" ? "You" : "Assistant"}:</span> {m.content}
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 p-3 border-t">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === "Enter") send() }} />
        <Button onClick={send} disabled={loading}>{loading ? "Sending..." : "Send"}</Button>
      </div>
    </div>
  )
}
