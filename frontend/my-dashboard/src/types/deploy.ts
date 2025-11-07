// src/types/deploy.ts

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
}

export interface DeployRequest {
  branch?: string; // default: deploy
}

export type DeployStatusEnum =
  | 'pending'
  | 'running_clone'
  | 'running_build'
  | 'running_cutover'
  | 'running_observability'
  | 'completed'
  | 'failed';

export interface DeployResponse {
  task_id: string;
  status: DeployStatusEnum;
  branch: string;
  action: "deploy" | "rollback";
  queued_at: string;
  estimated_duration_minutes: number;
  context: Record<string, any>;
  dev_server_restart_planned: boolean;
}

export interface DeployStatusResponse {
  task_id: string;
  status: DeployStatusEnum;
  metadata: Record<string, any>;
  stages: Record<string, Record<string, any>>;
  started_at: string;
  completed_at?: string | null;
  error_log?: string | null;
  failure_context?: Record<string, any> | null;
}

export interface DeployPreviewResponse {
  current_branch: string;
  target_repo: string;
  frontend_project_path?: string | null;
  frontend_output_path?: string | null;
  commands: string[];
  risk_assessment: Record<string, any>;
  cost_estimate: Record<string, any>;
  llm_preview?: Record<string, any> | null;
  timeline_preview: DeployTimelineEntry[];
  warnings: string[];
  task_context?: DeployTaskSummary | null;
}

export interface RollbackRequest {
  branch?: string;
}

export interface ErrorResponse {
  detail: string;
}

export interface DeployTimelineEntry {
  stage: DeployStatusEnum;
  label: string;
  expected_seconds?: number | null;
  completed: boolean;
  metadata?: Record<string, any> | null;
}

export interface DeployTaskSummary {
  task_id: string;
  status: DeployStatusEnum;
  branch: string;
  action: "deploy" | "rollback";
  started_at: string;
  completed_at?: string | null;
  summary?: Record<string, any> | null;
  failure_context?: Record<string, any> | null;
}

export interface DeployTaskLogResponse {
  task_id: string;
  status: DeployStatusEnum;
  stages: Record<string, Record<string, any>>;
  metadata: Record<string, any>;
  error_log?: string | null;
  failure_context?: Record<string, any> | null;
}

export interface HealthStatusResponse {
  status: string;
  pm2_processes: Record<string, string>;
  mongo: string;
  last_task_id?: string | null;
  last_task_status?: DeployStatusEnum | null;
  issues: string[];
}
