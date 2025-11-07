"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import ChatWidget from "./components/ChatWidget";
import type {
  DeployPreviewResponse,
  DeployTaskSummary,
  DeployTaskLogResponse,
  HealthStatusResponse,
  DeployTimelineEntry,
} from "@/types/deploy";

const api = axios.create({
  baseURL: "https://delight.13-125-116-92.nip.io",
  headers: { "Content-Type": "application/json" },
});

interface DashboardState {
  status?: string;
  timestamp?: string;
}

export default function Page() {
  const [state, setState] = useState<DashboardState>({ status: "READY" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const [taskId, setTaskId] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [rollbacking, setRollbacking] = useState(false);

  const [previewDetail, setPreviewDetail] = useState<DeployPreviewResponse | null>(null);
  const [healthInfo, setHealthInfo] = useState<HealthStatusResponse | null>(null);
  const [healthCheckedAt, setHealthCheckedAt] = useState<string>("");
  const [recentTasks, setRecentTasks] = useState<DeployTaskSummary[]>([]);
  const [taskLogs, setTaskLogs] = useState<DeployTaskLogResponse | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [failureInfo, setFailureInfo] = useState<Record<string, any> | null>(null);
  const [currentStages, setCurrentStages] = useState<Record<string, Record<string, any>>>({});

  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const costDisplay = useMemo(() => {
    if (!previewDetail?.cost_estimate) return null;
    return (
      previewDetail.cost_estimate.hourly_cost ??
      previewDetail.cost_estimate.total ??
      previewDetail.cost_estimate.estimate ??
      null
    );
  }, [previewDetail]);

  const riskLabel = useMemo(() => {
    return (
      (previewDetail?.risk_assessment?.overall as string | undefined) ||
      (previewDetail?.risk_assessment?.level as string | undefined) ||
      "low"
    );
  }, [previewDetail]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1 },
    }),
  };

  const fetchPreview = async (task?: string | null) => {
    try {
      const res = await api.get<DeployPreviewResponse>("/api/v1/preview", {
        params: task ? { task_id: task } : undefined,
      });
      setPreviewDetail(res.data);
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
      const res = await api.get<HealthStatusResponse>("/healthz");
      setHealthInfo(res.data);
      setHealthCheckedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setHealthInfo(null);
      setHealthCheckedAt(new Date().toLocaleTimeString());
    }
  };

  const fetchRecent = async () => {
    try {
      const res = await api.get<DeployTaskSummary[]>("/api/v1/tasks/recent", {
        params: { limit: 5 },
      });
      setRecentTasks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async (id: string) => {
    try {
      setLogLoading(true);
      const res = await api.get<DeployTaskLogResponse>(`/api/v1/tasks/${id}/logs`);
      setTaskLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLogLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (deploying) return;
    setDeploying(true);
    setFailureInfo(null);
    try {
      const res = await api.post("/api/v1/deploy", { branch: "deploy" });
      setTaskId(res.data.task_id);
      await fetchPreview(res.data.task_id);
      await fetchRecent();
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("배포 요청 실패");
      setDeploying(false);
    }
  };

  const handleRollback = async () => {
    if (rollbacking) return;
    if (!confirm("이전 버전으로 롤백하시겠습니까?")) return;
    setRollbacking(true);
    try {
      const res = await api.post("/api/v1/rollback", { branch: "deploy" });
      setTaskId(res.data.task_id);
      await fetchRecent();
    } catch (err) {
      console.error(err);
      setError("롤백 실패");
    } finally {
      setRollbacking(false);
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

  useEffect(() => {
    fetchPreview();
    fetchHealth();
    fetchRecent();
    const previewTimer = setInterval(fetchPreview, 30000);
    const healthTimer = setInterval(fetchHealth, 20000);
    const recentTimer = setInterval(fetchRecent, 45000);
    return () => {
      clearInterval(previewTimer);
      clearInterval(healthTimer);
      clearInterval(recentTimer);
    };
  }, []);

  useEffect(() => {
    if (!taskId) return;
    fetchPreview(taskId);
    fetchLogs(taskId);
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get("/api/v1/status/" + taskId);
        const payload = res.data;
        setState((prev) => ({ ...prev, status: payload.status, timestamp: new Date().toISOString() }));
        setCurrentStages(payload.stages || {});
        setFailureInfo(payload.failure_context || null);
        setLastUpdate(new Date().toLocaleTimeString());
        if (["completed", "failed"].includes(payload.status)) {
          setDeploying(false);
          setTaskId(null);
          fetchRecent();
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

  const healthStatus = (healthInfo?.status || "확인 중").toUpperCase();
  const warnings = previewDetail?.warnings ?? [];
  const previewTimeline = previewDetail?.timeline_preview ?? [];
  const liveStages = Object.entries(currentStages || {});

  const statusColor =
    state.status === "completed"
      ? "text-green-400"
      : state.status === "failed"
      ? "text-red-400"
      : "text-yellow-400";

  const riskColor =
    riskLabel === "low"
      ? "text-green-400"
      : riskLabel === "high"
      ? "text-red-400"
      : "text-yellow-400";

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
      <motion.h2 className="text-3xl font-bold mb-2 text-blue-400">Cherry Deploy Dashboard</motion.h2>
      <p className="text-gray-400 mb-6">마지막 업데이트: {lastUpdate}</p>

      {error && (
        <div className="mb-6 rounded border border-red-600 bg-red-900/30 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={0}>
          <p className="text-lg font-semibold">📦 배포 상태</p>
          <p className={`mt-2 text-xl font-bold ${statusColor}`}>{state.status?.toUpperCase() || "N/A"}</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className={`px-3 py-2 rounded text-sm ${deploying ? "bg-green-700 cursor-not-allowed opacity-60" : "bg-green-600 hover:bg-green-500"}`}
            >
              {deploying ? "배포 중..." : "배포 시작"}
            </button>
            <button
              onClick={handleRollback}
              disabled={rollbacking}
              className={`px-3 py-2 rounded text-sm ${rollbacking ? "bg-red-800 cursor-not-allowed opacity-60" : "bg-red-600 hover:bg-red-500"}`}
            >
              {rollbacking ? "롤백 중..." : "롤백"}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400">현재 task: {taskId ?? "없음"}</p>
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={1}>
          <p className="text-lg font-semibold">💰 예상 비용</p>
          <p className="mt-2 text-xl text-blue-300 font-bold">
            {costDisplay !== null ? `$${costDisplay.toLocaleString()}` : "N/A"}
          </p>
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={2}>
          <p className="text-lg font-semibold">⚙️ 리스크 수준</p>
          <p className={`mt-2 text-xl font-bold ${riskColor}`}>{riskLabel?.toUpperCase()}</p>
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={3}>
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">🩺 헬스 체크</p>
            <button onClick={fetchHealth} className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">
              새로고침
            </button>
          </div>
          <p className={`mt-2 text-xl font-bold ${healthStatus === "HEALTHY" ? "text-green-400" : "text-yellow-400"}`}>
            {healthStatus}
          </p>
          <p className="text-xs text-gray-400">마지막 점검: {healthCheckedAt || "-"}</p>
          <div className="mt-3 text-xs space-y-1 text-gray-300">
            {healthInfo?.pm2_processes &&
              Object.entries(healthInfo.pm2_processes).map(([name, status]) => (
                <p key={name}>
                  {name}: <span className="text-white">{status}</span>
                </p>
              ))}
            {healthInfo?.issues?.length ? (
              <p className="text-red-300">⚠ {healthInfo.issues.join(", ")}</p>
            ) : (
              <p className="text-green-300">문제 없음</p>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={4}>
          <p className="text-lg font-semibold mb-3">🛠 Preview Timeline</p>
          {previewTimeline.length ? (
            <ul className="space-y-2 text-sm">
              {previewTimeline.map((entry: DeployTimelineEntry) => (
                <li key={entry.stage} className="flex items-start gap-2">
                  <span className={entry.completed ? "text-green-400" : "text-gray-500"}>•</span>
                  <div>
                    <p className="text-gray-100">{entry.label}</p>
                    {entry.expected_seconds && (
                      <p className="text-gray-400 text-xs">예상 {entry.expected_seconds}s</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">프리뷰 데이터를 불러오는 중입니다.</p>
          )}
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={5}>
          <p className="text-lg font-semibold mb-3">📡 실시간 Stage</p>
          {liveStages.length ? (
            <ul className="space-y-2 text-sm">
              {liveStages.map(([stage, details]) => (
                <li key={stage} className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <div>
                    <p className="text-gray-100">{stage}</p>
                    {details?.timestamp && (
                      <p className="text-gray-400 text-xs">{new Date(details.timestamp).toLocaleTimeString()}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">진행 중인 Stage 정보가 없습니다.</p>
          )}
          {failureInfo && (
            <div className="mt-4 rounded border border-red-600 bg-red-900/20 p-3 text-xs text-red-200">
              <p className="font-semibold mb-2">Failure Context</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(failureInfo, null, 2)}</pre>
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={6}>
          <p className="text-lg font-semibold mb-3">⚠ Preview Warnings</p>
          {warnings.length ? (
            <ul className="list-disc list-inside text-sm text-yellow-200 space-y-1">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">특이사항 없음</p>
          )}
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={7}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-lg font-semibold">📝 최근 작업</p>
            <button onClick={fetchRecent} className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">
              새로고침
            </button>
          </div>
          {recentTasks.length ? (
            <ul className="space-y-2 text-sm">
              {recentTasks.map((task) => (
                <li key={task.task_id} className="rounded border border-gray-700 p-2">
                  <p className="text-white">
                    {task.action.toUpperCase()} · {task.branch}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {new Date(task.started_at).toLocaleString()} → {task.completed_at ? new Date(task.completed_at).toLocaleString() : "진행 중"}
                  </p>
                  <p className="text-gray-300 text-xs">status: {task.status}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">최근 작업 내역이 없습니다.</p>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={8}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-lg font-semibold">🧾 Task Logs</p>
            <button
              onClick={() => taskId && fetchLogs(taskId)}
              disabled={!taskId || logLoading}
              className={`text-xs px-2 py-1 rounded ${
                !taskId || logLoading ? "bg-gray-700 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              새로고침
            </button>
          </div>
          {taskLogs ? (
            <pre className="text-xs text-gray-200 bg-gray-900 rounded p-3 max-h-64 overflow-auto">
              {JSON.stringify(taskLogs.stages, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-400 text-sm">활성 task 로그가 없습니다.</p>
          )}
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-lg shadow" variants={cardVariants} initial="hidden" animate="visible" custom={9}>
          <p className="text-lg font-semibold mb-2">💬 Chat Ops</p>
          <p className="text-sm text-gray-400 mb-4">백엔드 챗봇 API에 직접 질문해 배포 상황을 설명받을 수 있어요.</p>
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
            className={`mt-3 w-full py-2 rounded text-sm ${
              chatLoading || !chatInput.trim()
                ? "bg-blue-900 text-blue-200 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {chatLoading ? "질문 중..." : "Gemini에게 물어보기"}
          </button>
          {chatError && <p className="text-xs text-red-400 mt-2">{chatError}</p>}
          {chatReply && (
            <div className="mt-3 p-3 rounded bg-gray-900 border border-gray-700 text-sm text-gray-100 whitespace-pre-wrap">
              {chatReply}
            </div>
          )}
        </motion.div>
      </div>

      <ChatWidget />
    </motion.div>
  );
}
