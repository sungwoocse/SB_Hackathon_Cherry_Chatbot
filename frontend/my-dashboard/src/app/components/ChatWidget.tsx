"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, JSON_HEADERS } from "@/lib/api";

interface ChatWidgetProps {
  onClose?: () => void;
}

export default function ChatWidget({ onClose }: ChatWidgetProps) {
  const POPUP_WIDTH_REM = 44; // 2.2x 기존 20rem 폭
  const POPUP_HEIGHT_REM = 24; // 기존 세로 크기 유지
  const IDEATION_WIDTH_REM = POPUP_WIDTH_REM; // 동일 폭으로 왼쪽 확장
  const HEADER_HEIGHT_REM = 3; // 1.2x 높이 확보
  const [messages, setMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([
    { sender: "bot", text: "안녕하세요! 무엇을 도와드릴까요?" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const primaryEndRef = useRef<HTMLDivElement | null>(null);
  const ideationEndRef = useRef<HTMLDivElement | null>(null);

  // ✅ 새 메시지마다 하단으로 스크롤
  useEffect(() => {
    primaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
    ideationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    // 사용자 메시지
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/chat`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        throw new Error("불러오기 실패");
      }
      const data = await res.json();
      const reply = data.reply || "응답이 비어있어요.";

      let i = 0;
      const botMsg = { sender: "bot" as const, text: "" };
      setMessages((prev) => [...prev, botMsg]);
      const interval = setInterval(() => {
        if (i < reply.length) {
          botMsg.text += reply[i];
          setMessages((prev) => [...prev.slice(0, -1), { ...botMsg }]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 25);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ 서버 연결에 실패했습니다." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  return (
    <>
      {/* ✅ 우측 하단 챗봇 팝업 + 좌측 아이디에이션 확장 */}
      <div className="fixed bottom-6 right-6 z-[9999] pointer-events-auto select-none flex justify-end gap-4">
        {/* Ideation side panel */}
        <div
          className="rounded-xl shadow-2xl border border-[#2c3d55] overflow-hidden animate-fade-in origin-bottom-right flex flex-col bg-[#0f1826]"
          style={{ width: `${IDEATION_WIDTH_REM}rem`, height: `${POPUP_HEIGHT_REM}rem` }}
        >
          <div className="flex flex-col items-center justify-center gap-3 bg-[#17243a] border-b border-[#2c3d55] p-5">
            <Image
              src="/images/idle.png"
              alt="Cherry assistant idle"
              width={160}
              height={160}
              className="select-none pointer-events-none"
              priority={false}
              unoptimized
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-blue-100 tracking-wide uppercase">Ideation</p>
              <p className="text-xs text-gray-400">아이디어 보드에서 대화 흐름을 살펴보세요.</p>
            </div>
          </div>
          <div className="flex-1 bg-[#141f30] text-white p-3 overflow-y-auto space-y-2">
            {messages.map((m, i) => (
              <div
                key={`ideation-${i}`}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"} w-full`}
              >
                <div
                  className={`px-3 py-2 text-sm rounded-2xl leading-5 shadow-sm break-words border
          ${
            m.sender === "user"
              ? "bg-[#1d2c44] border-[#2f4b7c] text-blue-100"
              : "bg-[#111a28] border-[#1f2b3c] text-gray-200"
          }
        `}
                  style={{
                    width: "fit-content",
                    maxWidth: "75%",
                    wordBreak: "break-word",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={ideationEndRef} />
          </div>
        </div>

        {/* 기존 챗봇 영역 */}
        <div
          className="rounded-xl shadow-2xl border border-[#2c3d55] overflow-hidden animate-fade-in origin-bottom-right flex flex-col"
          style={{ width: `${POPUP_WIDTH_REM}rem`, height: `${POPUP_HEIGHT_REM}rem` }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 bg-[#223145] text-blue-200 border-b border-[#2c3d55]"
            style={{ height: `${HEADER_HEIGHT_REM}rem` }}
          >
            <div className="font-semibold flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span>Chatbot</span>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-300 hover:text-white transition"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          {/* Body */}
          <div className="flex-1 bg-[#1e2a3a] text-white p-3 overflow-y-auto space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"} w-full`}
              >
                <div
                  className={`px-3 py-2 text-sm rounded-2xl leading-5 shadow-sm break-words 
          ${m.sender === "user" ? "bg-[#2563eb] text-white" : "bg-[#2b3b52] text-gray-200"}
        `}
                  style={{
                    width: "fit-content",
                    maxWidth: "75%",
                    wordBreak: "break-word",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={primaryEndRef} />
          </div>

          {/* Input */}
          <div className="bg-[#1b2736] border-t border-[#2c3d55] p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="메시지를 입력하세요..."
              className="flex-1 bg-[#111a26] text-sm text-gray-100 px-3 py-2 rounded-md outline-none ring-0 focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={sending}
              className={`px-3 py-2 text-sm rounded-md text-white transition shadow ${
                sending ? "bg-blue-900 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {sending ? "전송 중..." : "전송"}
            </button>
          </div>
        </div>
      </div>

      {/* fade-in 애니메이션 */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
