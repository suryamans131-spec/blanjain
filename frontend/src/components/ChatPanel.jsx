import React, { useEffect, useRef, useState } from "react";
import { api, formatTime } from "../api.js";

export default function ChatPanel({ orderId, self, otherName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.getChat(orderId);
        if (!cancelled) setMessages(data);
      } catch (e) {
        // ignore
      }
    }
    load();
    const t = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const value = text.trim();
    if (!value) return;
    setText("");
    const msg = await api.sendChat(orderId, self, value);
    setMessages((m) => [...m, msg]);
  }

  return (
    <div className="chat-screen">
      <div className="screen-header">
        <button className="icon-btn" onClick={onClose}>
          ←
        </button>
        <div>
          <div className="screen-title">{otherName}</div>
          <div className="screen-sub">Order {orderId ? "aktif" : ""}</div>
        </div>
      </div>
      <div className="chat-body">
        {messages.length === 0 && (
          <div className="chat-empty">Belum ada pesan. Mulai percakapan di bawah.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.sender === self ? "me" : "them"}`}>
            <div className="bubble">
              <span>{m.message}</span>
              <span className="bubble-time">{formatTime(m.createdAt)}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input">
        <input
          value={text}
          placeholder="Ketik pesan..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} aria-label="Kirim">
          ➤
        </button>
      </div>
    </div>
  );
}
