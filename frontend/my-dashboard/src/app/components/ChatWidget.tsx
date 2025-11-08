"use client";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, JSON_HEADERS } from "@/lib/api";

interface ChatWidgetProps {
  onClose?: () => void;
  stages?: Array<[string, Record<string, unknown>]>;
  stageTimezone?: string;
}

const STAGE_DISPLAY_SEQUENCE = [
  "running_clone",
  "running_build",
  "running_cutover",
  "running_observability",
  "running_post_checks",
  "completed",
  "failed",
] as const;

type StageName = (typeof STAGE_DISPLAY_SEQUENCE)[number] | string;

export default function ChatWidget({ onClose, stages = [], stageTimezone = "Asia/Seoul" }: ChatWidgetProps) {
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
  const orderedStages = useMemo(() => {
    const sequenceSet = new Set<string>(STAGE_DISPLAY_SEQUENCE);
    const stageMap = new Map<string, Record<string, unknown>>();
    stages.forEach(([name, details]) => {
      stageMap.set(name, details || {});
    });
    const ordered: Array<[StageName, Record<string, unknown>]> = [];
    STAGE_DISPLAY_SEQUENCE.forEach((stage) => {
      if (stageMap.has(stage)) {
        ordered.push([stage, stageMap.get(stage)!]);
      }
    });
    stages.forEach(([stage, details]) => {
      if (!sequenceSet.has(stage)) {
        ordered.push([stage as StageName, details || {}]);
      }
    });
    return ordered;
  }, [stages]);

  const formatStageLabel = (stage: StageName) => stage.replace(/_/g, " ");

  const resolveStageTimestamp = (details: Record<string, unknown>) => {
    const value = details?.["timestamp"];
    return typeof value === "string" ? value : null;
  };

  const formatStageTime = (value: unknown) => {
    if (typeof value !== "string" || !value) return null;
    try {
      const formatter = new Intl.DateTimeFormat("ko-KR", {
        timeZone: stageTimezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return formatter.format(new Date(value));
    } catch {
      return null;
    }
  };
  const resolveStageStatus = (details: Record<string, unknown>) => {
    const status = details?.["status"];
    if (typeof status === "string" && status.trim()) return status;
    const completed = details?.["completed"];
    if (completed === true) return "completed";
    return "pending";
  };

  const resolveStageNote = (details: Record<string, unknown>) => {
    const note = details?.["message"] ?? details?.["note"] ?? details?.["summary"];
    return typeof note === "string" && note.trim().length ? note : null;
  };

  const stageTimezoneLabel = stageTimezone === "Asia/Seoul" ? "KST" : stageTimezone;

  // ✅ 새 메시지마다 하단으로 스크롤
  useEffect(() => {
    primaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
          <div className="relative bg-[#17243a] border-b border-[#2c3d55] p-5 overflow-hidden flex flex-col justify-end min-h-[13rem]">
            <Image
              src="/images/idle.png"
              alt="Cherry assistant idle"
              width={160}
              height={160}
              className="select-none pointer-events-none absolute top-4 right-4"
              priority={false}
              unoptimized
            />
            <Image
              src="/images/success.png"
              alt="Cherry assistant success"
              width={140}
              height={140}
              className="select-none pointer-events-none absolute bottom-4 left-4"
              priority={false}
              unoptimized
            />
            <div className="relative z-10 pr-28 space-y-2">
              <p className="text-sm font-semibold tracking-wide uppercase text-blue-50">Deploy Status</p>
              <p className="text-xs text-gray-300 leading-relaxed">
                진행 중인 Stage를 순차적으로 추적하며 이상 징후를 빠르게 포착하세요.
              </p>
            </div>
          </div>
          <div className="flex-1 bg-[#101a2b] text-white p-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">📡 Live Stages</p>
              <p className="text-[10px] text-gray-500">Timezone: {stageTimezoneLabel}</p>
            </div>
            {orderedStages.length ? (
              <ol className="mt-3 space-y-3">
                {orderedStages.map(([stageName, details], index) => {
                  const timestamp = formatStageTime(resolveStageTimestamp(details));
                  const status = resolveStageStatus(details);
                  const note = resolveStageNote(details);
                  const isCompleted = status === "completed";
                  const isActive = !isCompleted && Boolean(timestamp);
                  return (
                    <li
                      key={`stage-${stageName}`}
                      className="flex items-start gap-3 rounded-lg border border-[#1c2940] bg-[#0c1524]/60 p-3"
                    >
                      <div
                        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isCompleted ? "bg-green-500/20 text-green-300" : isActive ? "bg-blue-500/20 text-blue-200" : "bg-gray-600/30 text-gray-300"}`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold capitalize text-blue-50">
                              {formatStageLabel(stageName)}
                            </p>
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">{status}</p>
                          </div>
                          {timestamp ? (
                            <p className="text-xs text-blue-200">{timestamp}</p>
                          ) : (
                            <p className="text-xs text-gray-500">대기 중</p>
                          )}
                        </div>
                        {note && <p className="text-xs text-gray-300 leading-relaxed">{note}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-6 text-sm text-gray-400">Stage 데이터가 없습니다.</p>
            )}
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
