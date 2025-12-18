"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { getTranscripts, getTranscriptById, type TranscriptItem } from "@/lib/history"
import { streamChatMessage, sendChatMessage, ApiError, type ChatOptions } from "@/lib/api-client"
import { IconSend, IconTrash, IconUser, IconRobot, IconLoader2 } from "@tabler/icons-react"

type ChatMsg = { role: "user" | "assistant"; content: string }

export function ChatbotPanel() {
  const [messages, setMessages] = React.useState<ChatMsg[]>([])
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [streamingContent, setStreamingContent] = React.useState("")
  const [currentTranscript, setCurrentTranscript] = React.useState<TranscriptItem | null>(null)
  const currentTranscriptIdRef = React.useRef<string | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const abortRef = React.useRef<(() => void) | null>(null)

  // Load transcript based on URL hash and clear messages when transcript changes
  React.useEffect(() => {
    const loadTranscript = async () => {
      const match = window.location.hash.match(/^#t-(.+)/)
      const newId = match ? match[1] : null

      // If transcript changed, clear messages
      if (newId !== currentTranscriptIdRef.current) {
        setMessages([])
        setStreamingContent("")
        currentTranscriptIdRef.current = newId
      }

      if (newId) {
        // Load specific transcript from hash
        const transcript = await getTranscriptById(newId)
        setCurrentTranscript(transcript ?? null)
      } else {
        // No transcript selected, get latest for new transcripts
        const transcripts = await getTranscripts()
        setCurrentTranscript(transcripts[0] || null)
      }
    }

    loadTranscript()

    // Listen for hash changes (transcript selection)
    const handleHashChange = () => loadTranscript()
    window.addEventListener("hashchange", handleHashChange)

    // Listen for transcript updates (new/edit/delete)
    const handleUpdate = () => loadTranscript()
    window.addEventListener("transcripts:update", handleUpdate)

    // Listen for new transcript request (clear everything)
    const handleNew = () => {
      setMessages([])
      setStreamingContent("")
      currentTranscriptIdRef.current = null
      loadTranscript()
    }
    window.addEventListener("transcripts:new", handleNew)

    return () => {
      window.removeEventListener("hashchange", handleHashChange)
      window.removeEventListener("transcripts:update", handleUpdate)
      window.removeEventListener("transcripts:new", handleNew)
    }
  }, [])

  // Build chat options for RAG
  const chatOptions = React.useMemo((): ChatOptions => {
    if (!currentTranscript) {
      return {}
    }
    return {
      transcriptId: currentTranscript.id,
      context: currentTranscript.cleanedText || currentTranscript.rawText || "",
      includeHistory: true,
    }
  }, [currentTranscript])

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Reset height to auto to get the correct scrollHeight
    e.target.style.height = "auto"
    // Set height to scrollHeight, max 120px
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setMessages((m) => [...m, { role: "user", content: text }])
    setInput("")
    setLoading(true)
    setStreamingContent("")

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    // Try streaming first, fall back to non-streaming
    try {
      let fullResponse = ""

      abortRef.current = streamChatMessage(
        text,
        (chunk) => {
          fullResponse += chunk
          setStreamingContent(fullResponse)
        },
        () => {
          setMessages((m) => [...m, { role: "assistant", content: fullResponse }])
          setStreamingContent("")
          setLoading(false)
          abortRef.current = null
        },
        async (error) => {
          console.warn("Streaming failed, falling back to non-streaming:", error)
          try {
            const reply = await sendChatMessage(text, chatOptions)
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
        chatOptions
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

  const clearConversation = () => {
    setMessages([])
    setStreamingContent("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <IconRobot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI Assistant</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
              {currentTranscript
                ? currentTranscript.title
                : "No transcript loaded"}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearConversation}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Clear conversation"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
              <IconRobot className="h-6 w-6 text-primary" />
            </div>
            <h4 className="text-sm font-medium mb-1">Ask about your transcript</h4>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              I can help you understand, summarize, or find information in your transcript.
            </p>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {streamingContent && (
              <MessageBubble
                message={{ role: "assistant", content: streamingContent }}
                isStreaming
              />
            )}
            {loading && !streamingContent && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <IconRobot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-muted">
                  <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4 bg-muted/30">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={loading}
              rows={1}
              className="w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />
            <Button
              onClick={send}
              disabled={loading || !input.trim()}
              size="icon"
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
            >
              <IconSend className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

// Message bubble component
function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: ChatMsg
  isStreaming?: boolean
}) {
  const isUser = message.role === "user"

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary" : "bg-primary/10"
        }`}
      >
        {isUser ? (
          <IconUser className="h-4 w-4 text-primary-foreground" />
        ) : (
          <IconRobot className="h-4 w-4 text-primary" />
        )}
      </div>
      <div
        className={`max-w-[85%] px-4 py-3 text-sm ${
          isUser
            ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-2xl rounded-tl-sm bg-muted"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-headings:my-2 prose-headings:font-semibold">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />
        )}
      </div>
    </div>
  )
}
