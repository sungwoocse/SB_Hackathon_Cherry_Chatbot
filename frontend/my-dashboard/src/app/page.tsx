"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import ChatWidget from "./components/ChatWidget";
import { API_BASE_URL, JSON_HEADERS } from "@/lib/api";
import type {
  BlueGreenPlan,
  DeployPreviewResponse,
  DeployTaskSummary,
  DeployTimelineEntry,
  HealthStatusResponse,
} from "@/types/deploy";

const CURRENT_TASK_STORAGE_KEY = "cherry.currentTaskId";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: JSON_HEADERS,
});

interface DashboardState {
  status?: string;
  timestamp?: string;
}

const PROGRESS_BY_STATUS: Record<string, number> = {
  pending: 12,
  running_clone: 32,
  running_build: 58,
  running_cutover: 78,
  running_observability: 92,
  completed: 100,
  failed: 100,
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08 } }),
};

type TaskSummaryData = {
  git_commit?: {
    author?: {
      name?: string | null;
      email?: string | null;
    } | null;
  } | null;
  actor?: string | null;
};

export default function Page() {
  const [state, setState] = useState<DashboardState>({ status: "READY" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const [taskId, setTaskId] = useState<string | null>(null);
  const [, setDeploying] = useState(false);
  const [rollbacking, setRollbacking] = useState(false);

  const [previewDetail, setPreviewDetail] = useState<DeployPreviewResponse | null>(null);
  const [healthInfo, setHealthInfo] = useState<HealthStatusResponse | null>(null);
  const [recentTasks, setRecentTasks] = useState<DeployTaskSummary[]>([]);
  const [failureInfo, setFailureInfo] = useState<Record<string, unknown> | null>(null);
  const [currentStages, setCurrentStages] = useState<Record<string, Record<string, unknown>>>({});

  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [preflightData, setPreflightData] = useState<DeployPreviewResponse | null>(null);
  const [startingDeploy, setStartingDeploy] = useState(false);

  const llmSummary = previewDetail?.llm_preview?.summary ?? null;
  const llmHighlights = previewDetail?.llm_preview?.highlights ?? [];
  const llmRisks = previewDetail?.llm_preview?.risks ?? [];
  const commandList = previewDetail?.commands ?? [];

  const warnings = previewDetail?.warnings ?? [];
  const previewTimeline = previewDetail?.timeline_preview ?? [];
  const liveStages = Object.entries(currentStages || {});

  const blueGreenInfo = useMemo<BlueGreenPlan | null>(() => {
    if (previewDetail?.blue_green_plan) return previewDetail.blue_green_plan;
    if (previewDetail?.task_context?.summary?.blue_green) {
      return previewDetail.task_context.summary.blue_green as BlueGreenPlan;
    }
    return healthInfo?.blue_green ?? null;
  }, [previewDetail, healthInfo]);

  const cardStatusColor =
    state.status === "completed"
      ? "text-green-400"
      : state.status === "failed"
      ? "text-red-400"
      : "text-yellow-400";

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
    } catch (err) {
      console.error(err);
      setHealthInfo(null);
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

  const persistTaskId = (value: string | null) => {
    if (typeof window === "undefined") return;
    if (value) {
      window.sessionStorage.setItem(CURRENT_TASK_STORAGE_KEY, value);
    } else {
      window.sessionStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }
  };

  const handleOpenPreflight = async () => {
    setPreflightOpen(true);
    setPreflightLoading(true);
    setPreflightError(null);
    try {
      const res = await api.get<DeployPreviewResponse>("/api/v1/preview", {
        params: { mode: "preflight" },
      });
      setPreflightData(res.data);
    } catch (err) {
      console.error(err);
      setPreflightError("프리뷰 정보를 불러오지 못했습니다.");
    } finally {
      setPreflightLoading(false);
    }
  };

  const closePreflight = () => {
    if (startingDeploy) return;
    setPreflightOpen(false);
    setPreflightData(null);
    setPreflightError(null);
  };

  const confirmDeploy = async () => {
    if (startingDeploy) return;
    setStartingDeploy(true);
    setDeploying(true);
    setError(null);
    setFailureInfo(null);
    try {
      const res = await api.post("/api/v1/deploy", { branch: "deploy" });
      setTaskId(res.data.task_id);
      persistTaskId(res.data.task_id);
      await fetchRecent();
      setPreflightOpen(false);
      setPreflightData(null);
    } catch (err) {
      console.error(err);
      setError("배포 요청 실패");
      setDeploying(false);
    } finally {
      setStartingDeploy(false);
    }
  };

  const handleRollback = async () => {
    if (rollbacking) return;
    if (!confirm("이전 버전으로 롤백하시겠습니까?")) return;
    setRollbacking(true);
    try {
      const res = await api.post("/api/v1/rollback", { branch: "deploy" });
      setTaskId(res.data.task_id);
      persistTaskId(res.data.task_id);
      await fetchRecent();
    } catch (err) {
      console.error(err);
      setError("롤백 실패");
    } finally {
      setRollbacking(false);
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
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(CURRENT_TASK_STORAGE_KEY);
    if (saved) {
      setTaskId(saved);
      setDeploying(true);
    }
  }, []);

  useEffect(() => {
    if (!taskId) return;
    fetchPreview(taskId);
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/v1/status/${taskId}`);
        const payload = res.data;
        setState({ status: payload.status, timestamp: new Date().toISOString() });
        setCurrentStages(payload.stages || {});
        setFailureInfo(payload.failure_context || null);
        setLastUpdate(new Date().toLocaleTimeString());
        if (["completed", "failed"].includes(payload.status)) {
          setDeploying(false);
          setTaskId(null);
          persistTaskId(null);
          fetchRecent();
          fetchPreview();
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
        setDeploying(false);
        setTaskId(null);
        persistTaskId(null);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  const heroProgress = PROGRESS_BY_STATUS[state.status || "pending"] ?? 8;
  const showReloadNotice = Boolean(taskId);

  const formatKST = (value?: string | null) => {
    if (!value) return "정보 없음";
    return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  };

  const resolveActor = (summary?: TaskSummaryData | null) => {
    if (!summary) return "알 수 없음";
    const authorName = summary.git_commit?.author?.name;
    const authorEmail = summary.git_commit?.author?.email;
    if (authorName) return authorName;
    if (authorEmail) return authorEmail;
    if (summary.actor) return summary.actor;
    return "알 수 없음";
  };

  const renderHero = () => {
    if (taskId) {
      return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-gray-400">현재 배포 Task</p>
              <p className="text-2xl font-semibold text-white">{taskId}</p>
            </div>
            <p className={`text-lg font-semibold ${cardStatusColor}`}>
              {(state.status || "진행 중").replace("running_", "RUNNING ").toUpperCase()}
            </p>
          </div>
          <div className="mt-4 h-3 bg-gray-900 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${heroProgress}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            pending → running_clone → running_build → running_cutover → running_observability → completed
          </p>
          {blueGreenInfo && (
            <p className="mt-4 text-sm text-gray-300">
              Active Slot: <span className="text-white font-semibold">{blueGreenInfo.active_slot}</span> · Next Target: {blueGreenInfo.next_cutover_target || "미정"}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-gray-400">Cherry Deploy</p>
            <p className="text-2xl font-semibold text-white">버튼 한 번으로 안전한 배포</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenPreflight}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold"
            >
              배포 준비
            </button>
            <button
              onClick={handleRollback}
              disabled={rollbacking}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold ${rollbacking ? "border-gray-600 text-gray-400" : "border-red-500 text-red-300 hover:bg-red-500/10"}`}
            >
              {rollbacking ? "롤백 중" : "롤백"}
            </button>
          </div>
        </div>
        <p className="mt-4 text-gray-200 whitespace-pre-line">
          {llmSummary || "최근 프리뷰 데이터를 불러오는 중입니다."}
        </p>
        {blueGreenInfo ? (
          <p className="mt-3 text-sm text-gray-400">
            Active Slot: <span className="text-white">{blueGreenInfo.active_slot}</span> · Standby: {blueGreenInfo.standby_slot || "N/A"}
          </p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Blue/Green 메타데이터를 수집하는 중입니다.</p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-gray-400">
        ⏳ 데이터를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <motion.div className="text-gray-200 p-6 md:p-8 min-h-screen bg-gray-900" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <motion.h2 className="text-3xl font-bold text-blue-400">Cherry Deploy Dashboard</motion.h2>
        <p className="text-sm text-gray-400">마지막 업데이트: {lastUpdate || "-"}</p>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-600 bg-red-900/30 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {showReloadNotice && (
        <div className="mb-4 rounded border border-yellow-600 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-200">
          dev 서버 재시작 중입니다. 화면이 자동으로 새로고침되어도 배포 작업은 계속 진행됩니다.
        </div>
      )}

      {renderHero()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div className="bg-gray-800 p-6 rounded-2xl border border-gray-800" variants={cardVariants} initial="hidden" animate="visible" custom={0}>
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">🛠 Preview Timeline</p>
            <button onClick={() => fetchPreview(taskId)} className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">
              새로고침
            </button>
          </div>
          {previewTimeline.length ? (
            <ul className="mt-4 space-y-2 text-sm">
              {previewTimeline.map((entry: DeployTimelineEntry) => (
                <li key={entry.stage} className="flex items-start gap-2">
                  <span className={entry.completed ? "text-green-400" : "text-gray-600"}>•</span>
                  <div>
                    <p className="text-gray-100">{entry.label}</p>
                    {entry.expected_seconds && <p className="text-xs text-gray-500">예상 {entry.expected_seconds}s</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-500">프리뷰 데이터를 불러오는 중입니다.</p>
          )}
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-2xl border border-gray-800" variants={cardVariants} initial="hidden" animate="visible" custom={1}>
          <p className="text-lg font-semibold">📡 실시간 Stage</p>
          {liveStages.length ? (
            <ul className="mt-4 space-y-2 text-sm">
              {liveStages.map(([stage, details]) => (
                <li key={stage} className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <div>
                    <p className="text-gray-100">{stage}</p>
                    {details?.timestamp && (
                      <p className="text-xs text-gray-500">{new Date(details.timestamp).toLocaleTimeString("ko-KR")}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-500">진행 중인 Stage 정보가 없습니다.</p>
          )}
          {failureInfo && (
            <div className="mt-4 text-xs text-red-200 bg-red-900/20 border border-red-700 rounded p-3 whitespace-pre-wrap">
              {JSON.stringify(failureInfo, null, 2)}
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <motion.div className="bg-gray-800 p-6 rounded-2xl border border-gray-800" variants={cardVariants} initial="hidden" animate="visible" custom={2}>
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">💡 Gemini Preview</p>
            <span className="text-xs text-gray-500">사전 점검</span>
          </div>
          <p className="mt-3 text-sm text-gray-200 whitespace-pre-line">{llmSummary || "LLM 요약이 아직 준비되지 않았습니다."}</p>
          {llmHighlights.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-1">하이라이트</p>
              <ul className="text-sm text-gray-100 list-disc list-inside space-y-1">
                {llmHighlights.map((item, idx) => (
                  <li key={`highlight-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {llmRisks.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-1">위험 요소</p>
              <ul className="text-sm text-yellow-100 list-disc list-inside space-y-1">
                {llmRisks.map((item, idx) => (
                  <li key={`risk-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {commandList.length > 0 && (
            <div className="mt-4 border-t border-gray-700 pt-3">
              <p className="text-xs text-gray-400 mb-1">실행 명령</p>
              <ol className="text-xs space-y-1 list-decimal list-inside max-h-32 overflow-auto text-gray-200">
                {commandList.map((cmd, idx) => (
                  <li key={`command-${idx}`}>{cmd}</li>
                ))}
              </ol>
            </div>
          )}
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-2xl border border-gray-800" variants={cardVariants} initial="hidden" animate="visible" custom={3}>
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">💠 Blue / Green 상태</p>
            <button onClick={fetchHealth} className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">
              healthz 갱신
            </button>
          </div>
          {blueGreenInfo ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>Active Slot: <span className="text-white font-semibold">{blueGreenInfo.active_slot}</span></p>
              <p>Standby Slot: <span className="text-white font-semibold">{blueGreenInfo.standby_slot || "N/A"}</span></p>
              <p>
                마지막 컷오버: {blueGreenInfo.last_cutover_at ? new Date(blueGreenInfo.last_cutover_at).toLocaleString("ko-KR") : "기록 없음"}
              </p>
              <p>다음 전환 예정: {blueGreenInfo.next_cutover_target || "미정"}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">Blue/Green 메타데이터가 아직 없습니다.</p>
          )}
        </motion.div>

        <motion.div className="bg-gray-800 p-6 rounded-2xl border border-gray-800" variants={cardVariants} initial="hidden" animate="visible" custom={4}>
          <p className="text-lg font-semibold">⚠ Preview Warnings</p>
          {warnings.length ? (
            <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-yellow-200">
              {warnings.map((warn, idx) => (
                <li key={`warn-${idx}`}>{warn}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">특이사항 없음</p>
          )}
        </motion.div>
      </div>

      <motion.div className="bg-gray-800 p-6 rounded-2xl border border-gray-800 mb-6" variants={cardVariants} initial="hidden" animate="visible" custom={5}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-lg font-semibold">📝 최근 작업</p>
          <button onClick={fetchRecent} className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">
            새로고침
          </button>
        </div>
        {recentTasks.length ? (
          <ul className="space-y-3 text-sm">
            {recentTasks.map((task) => (
              <li key={task.task_id} className="rounded border border-gray-700 p-3 bg-gray-900/30">
                <p className="text-white font-semibold">
                  {task.action.toUpperCase()} · {task.branch}
                </p>
                <p className="text-xs text-gray-400">
                  {formatKST(task.started_at)} → {task.completed_at ? formatKST(task.completed_at) : "진행 중"}
                </p>
                <p className="text-xs text-gray-300">status: {task.status} · actor: {resolveActor(task.summary as TaskSummaryData | undefined)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">최근 작업 내역이 없습니다.</p>
        )}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <motion.div className="bg-gray-800 p-6 rounded-2xl border border-gray-800" variants={cardVariants} initial="hidden" animate="visible" custom={6}>
          <details className="group" open={Boolean(taskLogs)}>
            <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold">
              🧾 Task Logs
              <span className="text-xs text-gray-500">펼치기</span>
            </summary>
            <div className="mt-3">
              <button
                onClick={() => taskId && fetchLogs(taskId)}
                disabled={!taskId || logLoading}
                className={`text-xs px-2 py-1 rounded ${!taskId || logLoading ? "bg-gray-700 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-600"}`}
              >
                새로고침
              </button>
              {taskLogs ? (
                <pre className="text-xs text-gray-200 bg-gray-900 rounded p-3 mt-3 max-h-64 overflow-auto">
                  {JSON.stringify(taskLogs.stages, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-gray-500 mt-3">활성 task 로그가 없습니다.</p>
              )}
            </div>
          </details>
        </motion.div>
      </div>

      <ChatWidget />

      {preflightOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl p-6 relative">
            <button
              onClick={closePreflight}
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
              aria-label="close"
              disabled={startingDeploy}
            >
              ✕
            </button>
            <h3 className="text-2xl font-semibold text-white mb-2">배포 사전 브리핑</h3>
            <p className="text-sm text-gray-400 mb-4">변경 요약과 위험 요소를 검토한 뒤 실제 배포를 진행하세요.</p>
            {preflightLoading ? (
              <p className="text-sm text-gray-400">Gemini 프리뷰를 불러오는 중...</p>
            ) : preflightError ? (
              <p className="text-sm text-red-400">{preflightError}</p>
            ) : preflightData ? (
              <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
                <section>
                  <p className="text-xs text-gray-500 mb-1">변경 요약</p>
                  <p className="text-gray-100 whitespace-pre-line">{preflightData.llm_preview?.summary || "LLM 요약이 없습니다."}</p>
                </section>
                {preflightData.llm_preview?.risks?.length ? (
                  <section>
                    <p className="text-xs text-gray-500 mb-1">위험 요소</p>
                    <ul className="list-disc list-inside text-sm text-yellow-200 space-y-1">
                      {preflightData.llm_preview.risks.map((item, idx) => (
                        <li key={`preflight-risk-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                <section>
                  <p className="text-xs text-gray-500 mb-1">실행 명령</p>
                  <ol className="list-decimal list-inside text-xs text-gray-100 space-y-1 bg-gray-950/60 p-3 rounded border border-gray-800">
                    {(preflightData.commands || []).map((cmd, idx) => (
                      <li key={`preflight-cmd-${idx}`}>{cmd}</li>
                    ))}
                  </ol>
                </section>
                <section>
                  <p className="text-xs text-gray-500 mb-1">Blue/Green 계획</p>
                  {preflightData.blue_green_plan ? (
                    <div className="text-sm text-gray-200 space-y-1">
                      <p>Active Slot: {preflightData.blue_green_plan.active_slot}</p>
                      <p>다음 전환: {preflightData.blue_green_plan.next_cutover_target || "미정"}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">계획 정보가 없습니다.</p>
                  )}
                </section>
                <section className="rounded bg-yellow-900/20 border border-yellow-700 p-3 text-sm text-yellow-100">
                  실제 배포 버튼을 누르면 dev 서버를 재기동하므로 화면이 잠시 리셋될 수 있습니다. 창을 닫아도 작업은 계속됩니다.
                </section>
              </div>
            ) : (
              <p className="text-sm text-gray-500">프리뷰 데이터를 가져오지 못했습니다.</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closePreflight} disabled={startingDeploy} className="px-4 py-2 rounded border border-gray-600 text-gray-200 hover:bg-gray-800">
                취소
              </button>
              <button
                onClick={confirmDeploy}
                disabled={preflightLoading || startingDeploy}
                className={`px-4 py-2 rounded text-white font-semibold ${
                  preflightLoading || startingDeploy ? "bg-blue-900 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {startingDeploy ? "배포 시작 중..." : "실제 배포"}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
