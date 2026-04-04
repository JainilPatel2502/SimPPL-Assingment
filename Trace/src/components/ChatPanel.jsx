import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendChatMessage } from "../lib/api";
import {
  X,
  Send,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Database,
} from "lucide-react";

const WELCOME = {
  role: "model",
  text: 'I have full access to the Epstein Reddit dataset.\n\nAsk me anything:\n- *"Which subreddits post the most?"*\n- *"Who are the top 10 authors?"*\n- *"How many posts mention Maxwell?"*\n\nOr just chat — I\'m context-aware.',
  code: null,
};

// Markdown components styled to match the glass theme
const mdComponents = {
  p: ({ children }) => (
    <p className="text-[13px] text-white/70 leading-relaxed mb-1.5 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="text-white/90 font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-violet-300/80 not-italic">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="list-none space-y-1 my-1.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 my-1.5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-[13px] text-white/65 leading-relaxed flex gap-2 items-start">
      <span className="text-violet-400/60 shrink-0 mt-1">·</span>
      <span>{children}</span>
    </li>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code
        className="px-1.5 py-0.5 rounded bg-white/[0.08] text-violet-300 text-[12px]"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        {children}
      </code>
    ) : (
      <pre
        className="mt-2 p-3 rounded-lg bg-black/60 border border-white/[0.07] text-[11px] text-violet-300/80 overflow-x-auto whitespace-pre-wrap"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        <code>{children}</code>
      </pre>
    ),
  h1: ({ children }) => (
    <h1 className="text-[14px] font-semibold text-white/90 mb-2 mt-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[13px] font-semibold text-white/80 mb-1.5 mt-1">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[12px] font-medium text-white/70 mb-1 mt-1">
      {children}
    </h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-violet-400/40 pl-3 my-2 text-white/50">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-white/[0.07] my-3" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-[12px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-1.5 text-white/40 text-[11px] uppercase tracking-wider border-b border-white/[0.08] font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-white/60 border-b border-white/[0.05]">
      {children}
    </td>
  ),
};

function CodeAccordion({ code }) {
  const [open, setOpen] = useState(false);
  if (!code) return null;
  return (
    <div className="mt-2 border-t border-white/[0.05] pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-violet-300/60 transition-colors"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        <Database size={10} />
        {open ? "hide query" : "show query"}
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <pre
          className="mt-2 p-3 rounded-lg border border-white/[0.06] bg-black/60 text-[11px] text-violet-300/70 overflow-x-auto whitespace-pre-wrap leading-relaxed"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {code}
        </pre>
      )}
    </div>
  );
}

function Bubble({ msg, onSuggestionClick }) {
  const isUser = msg.role === "user";

  let displayText = msg.text || "";
  let suggestions = [];

  if (!isUser) {
    const match = displayText.match(/<suggestions>([\s\S]*?)<\/suggestions>/i);
    if (match) {
      const rawSuggestions = match[1];
      displayText = displayText.replace(match[0], "").trim();
      suggestions = rawSuggestions
        .split("\n")
        .map((s) => s.replace(/^\s*\*\s*/, "").trim())
        .filter((s) => s.length > 0);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"} items-start`}
    >
      <div
        className={`w-6 h-6 rounded-md shrink-0 flex items-center justify-center border mt-0.5 ${
          isUser
            ? "bg-violet-500/10 border-violet-400/20"
            : "bg-white/[0.05] border-white/[0.08]"
        }`}
      >
        {isUser ? (
          <User size={11} className="text-violet-300" />
        ) : (
          <Bot size={11} className="text-white/40" />
        )}
      </div>

      <div
        className={`flex-1 min-w-0 flex flex-col ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`w-full px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed ${
            isUser
              ? "bg-violet-500/[0.10] border border-violet-400/[0.17] text-white/80 rounded-tr-sm"
              : "bg-white/[0.04] border border-white/[0.07] rounded-tl-sm"
          }`}
        >
          {isUser ? (
            <p className="text-[13px] text-white/80">{displayText}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={mdComponents}
            >
              {displayText}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && <CodeAccordion code={msg.code} />}

        {/* Render Extracted Suggestions as Pills */}
        {!isUser && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick(sug)}
                className="text-left bg-violet-500/10 hover:bg-violet-500/20 border border-violet-400/20 text-violet-300 transition-colors rounded-full px-3 py-1.5 text-[11px] leading-tight max-w-full"
              >
                {sug}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center border bg-white/[0.05] border-white/[0.08]">
        <Bot size={11} className="text-white/40" />
      </div>
      <div className="px-3.5 py-3 rounded-xl rounded-tl-sm bg-white/[0.04] border border-white/[0.07] flex items-center gap-1.5">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="w-1 h-1 rounded-full bg-white/25 animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel({ onClose }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const send = async (textOverride = null) => {
    const text =
      typeof textOverride === "string" ? textOverride.trim() : input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", text, code: null };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!textOverride) setInput("");
    setLoading(true);

    const history = newMessages
      .filter((m) => m !== WELCOME)
      .slice(0, -1)
      .map((m) => ({ role: m.role, text: m.text }));

    try {
      const res = await sendChatMessage(text, history);
      setMessages((prev) => [
        ...prev,
        { role: "model", text: res.answer, code: res.code },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "**Error** — check that the backend is running.",
          code: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-400/20 flex items-center justify-center">
            <Sparkles size={13} className="text-violet-300" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white/80 leading-none">
              Explore with AI
            </p>
            <p className="text-[10px] text-white/25 mt-0.5">
              OpenAI · Tool Calling
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-all"
        >
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} onSuggestionClick={(sug) => send(sug)} />
        ))}
        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.06] shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about the dataset…"
            disabled={loading}
            className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3.5 py-2.5 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 focus:bg-white/[0.06] resize-none transition-all leading-relaxed min-w-0"
            style={{
              minHeight: 40,
              maxHeight: 100,
              fontFamily: "Inter, sans-serif",
            }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 100) + "px";
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-lg bg-violet-600/80 hover:bg-violet-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {loading ? (
              <Loader2 size={14} className="text-white animate-spin" />
            ) : (
              <Send size={13} className="text-white" />
            )}
          </button>
        </div>
        <p className="text-[9px] text-white/15 mt-1.5 text-center tracking-wide">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
