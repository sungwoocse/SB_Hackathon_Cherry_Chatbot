"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ChatWidget from "./components/ChatWidget";
import axios from "axios";
import type { DeployPreviewResponse } from "@/types/deploy";

// ✅ FastAPI 기본 URL
const api = axios.create({
  baseURL: "https://delight.13-125-116-92.nip.io",
  headers: { "Content-Type": "application/json" },
});

interface DeployData {
  status?: string;
  cost?: number;
  risk?: string;
  timestamp?: string;
  greenBlue?: {
    active: "green" | "blue";
    blueVersion?: string;
    greenVersion?: string;
  };
  health?: {
    healthy: number;
    unhealthy: number;
  };
  traffic?: {
    green: number;
    blue: number;
  };
  rollbackLog?: {
    lastRollback?: string;
    reason?: string;
  };
}

export default function Page() {
  const [data, setData] = useState<DeployData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const [taskId, setTaskId] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [previewDetail, setPreviewDetail] = useState<DeployPreviewResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>("확인 중");
  const [healthCheckedAt, setHealthCheckedAt] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [rollbacking, setRollbacking] = useState(false);

  // ✅ API: 배포 프리뷰 불러오기
  const fetchPreview = async () => {
    try {
      const res = await api.get<DeployPreviewResponse>("/api/v1/preview");
      const preview = res.data;
      setPreviewDetail(preview);
      setData({
        status: "READY",
        cost: preview.cost_estimate?.hourly_cost ?? 0,
        risk: "low",
        greenBlue: { active: "green" },
        health: { healthy: 100, unhealthy: 0 },
        traffic: { green: 100, blue: 0 },
      });
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setError("⚠️ 프리뷰 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await api.get("/healthz");
      const status = (res.data?.status || "healthy").toUpperCase();
      setHealthStatus(status);
      setHealthCheckedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setHealthStatus("ERROR");
      setHealthCheckedAt(new Date().toLocaleTimeString());
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    setChatLoading(true);
    setChatError(null);
    setChatReply(null);
    try {
      const res = await api.post("/api/v1/chat", { message: chatInput.trim() });
      setChatReply(res.data.reply || "응답이 비어있어요.");
      setChatInput("");
    } catch (err) {
      console.error(err);
      setChatError("챗봇 호출 실패");
    } finally {
      setChatLoading(false);
    }
  };

  // ✅ API: 배포 시작
  const handleDeploy = async () => {
    if (deploying) return;
    setDeploying(true);
    try {
      const res = await api.post("/api/v1/deploy", { branch: "deploy" });
      setTaskId(res.data.task_id);
      setError(null);
    } catch (err: any) {
      setError("배포 요청 실패");
      setDeploying(false);
    }
  };

  // ✅ API: 롤백 실행
  const handleRollback = async () => {
    if (rollbacking) return;
    if (!confirm("이전 버전으로 롤백하시겠습니까?")) return;
    setRollbacking(true);
    try {
      await api.post("/api/v1/rollback", { branch: "deploy" });
      alert("롤백 요청 전송 완료");
    } catch {
      setError("롤백 실패");
    } finally {
      setRollbacking(false);
    }
  };

  // ✅ API: 상태 주기적 갱신
  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/v1/status/${taskId}`);
        const s = res.data.status;
        setData((prev) => ({
          ...prev,
          status: s,
          timestamp: new Date().toISOString(),
        }));
        setLastUpdate(new Date().toLocaleTimeString());
        if (["completed", "failed"].includes(s)) {
          setDeploying(false);
          setTaskId(null);
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
        setDeploying(false);
        setTaskId(null);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  useEffect(() => {
    fetchPreview();
    const interval = setInterval(fetchPreview, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // ✅ 색상
  const statusColor =
    data?.status === "completed"
      ? "text-green-400"
      : data?.status === "failed"
      ? "text-red-400"
      : "text-yellow-400";

  const riskColor =
    data?.risk === "low"
      ? "text-green-400"
      : data?.risk === "high"
      ? "text-red-400"
      : "text-yellow-400";

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15 },
    }),
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        ⏳ 데이터를 불러오는 중입니다...
      </div>
    );

  return (
    <motion.div
      className="text-gray-200 p-8 min-h-screen bg-gray-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <motion.h2
        className="text-3xl font-bold mb-4 text-blue-400"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        Cherry Deploy Dashboard
      </motion.h2>

      <motion.p
        className="text-gray-400 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        마지막 업데이트: <span className="text-gray-300">{lastUpdate}</span>
      </motion.p>

      {/* --- 주요 카드 섹션 --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <motion.div
          className="bg-gray-800 p-6 rounded-lg shadow-lg"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <p className="text-lg font-semibold">📦 배포 상태</p>
          <p className={`mt-2 text-xl font-bold ${statusColor}`}>
            {data?.status?.toUpperCase() || "N/A"}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className={`px-3 py-2 rounded text-sm ${
                deploying
                  ? "bg-green-700 cursor-not-allowed opacity-70"
                  : "bg-green-600 hover:bg-green-500"
              }`}
            >
              {deploying ? "배포 중..." : "배포 시작"}
            </button>
            <button
              onClick={handleRollback}
              disabled={rollbacking}
              className={`px-3 py-2 rounded text-sm ${
                rollbacking
                  ? "bg-red-800 cursor-not-allowed opacity-70"
                  : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {rollbacking ? "롤백 중..." : "롤백"}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            현재 작업: <span className="text-gray-200">{taskId || "없음"}</span>
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 p-6 rounded-lg shadow-lg"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <p className="text-lg font-semibold">💰 예상 비용</p>
          <p className="mt-2 text-xl text-blue-300 font-bold">
            {data?.cost ? `$${data.cost}/hr` : "N/A"}
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 p-6 rounded-lg shadow-lg"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={2}
        >
          <p className="text-lg font-semibold">⚙️ 리스크 수준</p>
          <p className={`mt-2 text-xl font-bold ${riskColor}`}>
            {data?.risk?.toUpperCase() || "N/A"}
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 p-6 rounded-lg shadow-lg"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">🩺 헬스 체크</p>
            <button
              onClick={fetchHealth}
              className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
            >
              새로고침
            </button>
          </div>
          <p
            className={`mt-2 text-xl font-bold ${
              healthStatus === "HEALTHY"
                ? "text-green-400"
                : healthStatus === "ERROR"
                ? "text-red-400"
                : "text-yellow-400"
            }`}
          >
            {healthStatus}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            마지막 점검: {healthCheckedAt || "-"}
          </p>
        </motion.div>
      </div>

      {/* --- 트래픽 및 상태 --- */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <motion.div
          className="bg-gray-800 p-6 rounded-lg shadow-lg"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={4}
        >
          <p className="text-lg font-semibold">🟢 Green / 🔵 Blue 배포 상태</p>
          <p className="mt-2 text-xl font-bold">
            Active:{" "}
            <span
              className={
                data?.greenBlue?.active === "green"
                  ? "text-green-400"
                  : "text-blue-400"
              }
            >
              {data?.greenBlue?.active?.toUpperCase()}
            </span>
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 p-6 rounded-lg shadow-lg"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={5}
        >
          <p className="text-lg font-semibold">📊 Traffic 분배</p>
          <div className="w-full bg-gray-700 h-2 rounded-full mt-3 flex">
            <div
              className="bg-green-500 h-2 rounded-l-full"
              style={{ width: `${data?.traffic?.green || 0}%` }}
            ></div>
            <div
              className="bg-blue-500 h-2 rounded-r-full"
              style={{ width: `${data?.traffic?.blue || 0}%` }}
            ></div>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Green {data?.traffic?.green ?? 0}% / Blue {data?.traffic?.blue ?? 0}%
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <motion.div
          className="bg-gray-800 p-6 rounded-lg shadow-lg"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={6}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-lg font-semibold">🧠 Deploy Preview</p>
            {previewDetail?.llm_preview?.status === "skipped" ? (
              <span className="text-xs text-yellow-400">LLM 준비 중</span>
            ) : (
              <span className="text-xs text-blue-300">Gemini 분석</span>
            )}
          </div>
          {previewDetail ? (
            <>
              <p className="text-sm text-gray-400 mb-2">실행 예정 커맨드</p>
              <ul className="list-decimal list-inside text-sm space-y-1 text-gray-200">
                {previewDetail.commands?.slice(0, 5).map((cmd, idx) => (
                  <li key={idx}>{cmd}</li>
                ))}
                {previewDetail.commands && previewDetail.commands.length > 5 && (
                  <li>...외 {previewDetail.commands.length - 5}건</li>
                )}
              </ul>
              <div className="mt-4 text-sm text-gray-300">
                <p>
                  Downtime:{" "}
                  <span className="text-white">
                    {previewDetail.risk_assessment?.downtime || "N/A"}
                  </span>
                </p>
                <p>
                  Rollback:{" "}
                  <span className="text-white">
                    {previewDetail.risk_assessment?.rollback || "N/A"}
                  </span>
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">프리뷰 데이터를 불러오는 중입니다.</p>
          )}
        </motion.div>

        <motion.div
          className="bg-gray-800 p-6 rounded-lg shadow-lg"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={7}
        >
          <p className="text-lg font-semibold mb-2">💬 Chat Ops</p>
          <p className="text-sm text-gray-400 mb-4">
            백엔드 챗봇 API에 직접 질문해 배포 상황을 요약받을 수 있어요.
          </p>
          <div className="space-y-3">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              rows={3}
              placeholder="배포 요약을 알려줘"
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleChatSend}
              disabled={chatLoading || !chatInput.trim()}
              className={`w-full py-2 rounded text-sm ${
                chatLoading || !chatInput.trim()
                  ? "bg-blue-900 text-blue-200 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {chatLoading ? "질문 중..." : "Gemini에게 물어보기"}
            </button>
            {chatError && <p className="text-xs text-red-400">{chatError}</p>}
            {chatReply && (
              <div className="p-3 rounded bg-gray-900 border border-gray-700 text-sm text-gray-100 whitespace-pre-wrap">
                {chatReply}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* --- 챗봇 위젯 --- */}
      <ChatWidget />
    </motion.div>
  );
}
