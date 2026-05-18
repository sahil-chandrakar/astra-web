export type AgentStatus = "idle" | "working" | "complete" | "warning" | "error";
export type AppMode = "cockpit" | "research" | "agents" | "sources" | "library" | "timeline" | "settings";
export type AgentCommandRisk = "safe_auto" | "safe_confirm" | "blocked";
export type AgentCommandOutcome = "success" | "failure" | "blocked" | "confirmation_required" | "planned";
export type AgentCommandTestStatus = "untested" | "passed" | "failed";
export type AgentMemoryCategory = "course" | "project" | "goal" | "preference" | "general";
export type StudyArtifactType = "notes" | "flashcards" | "quiz" | "revision_plan" | "viva_questions";

export type Source = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
};

export type AgentEvent = {
  agent: string;
  status: AgentStatus;
  message: string;
  timestamp: string;
  sources: Source[];
};

export type AgentDescriptor = {
  name: string;
  role: string;
  status: AgentStatus;
};

export type AgentAbility = {
  id: string;
  label: string;
  description: string;
  category: string;
  risk: AgentCommandRisk;
  params_schema: Record<string, unknown>;
  test_status: AgentCommandTestStatus;
  last_tested_at: string | null;
  test_message: string;
};

export type AgentAuditEntry = {
  id: string;
  timestamp: string;
  command_id: string;
  label: string;
  input_text: string;
  params: Record<string, unknown>;
  outcome: AgentCommandOutcome;
  safety_decision: string;
  message: string;
  resolution: Record<string, unknown>;
};

export type AgentCommandResponse = {
  command_id: string;
  label: string;
  risk: AgentCommandRisk;
  outcome: AgentCommandOutcome;
  message: string;
  confirmation_required: boolean;
  params: Record<string, unknown>;
  data: Record<string, unknown>;
  events: AgentEvent[];
  audit: AgentAuditEntry | null;
  resolution: Record<string, unknown>;
};

export type AgentCommandTestResponse = {
  abilities: AgentAbility[];
  events: AgentEvent[];
};

export type AgentMemoryItem = {
  id: string;
  category: AgentMemoryCategory;
  text: string;
  created_at: string;
  updated_at: string;
};

export type DocumentRecord = {
  id: string;
  title: string;
  filename: string;
  created_at: string;
  page_count: number;
  text_preview: string;
};

export type DocumentQuestionResponse = {
  document: DocumentRecord;
  answer: string;
  page_refs: number[];
  setup_required: string[];
};

export type StudyArtifact = {
  id: string;
  artifact_type: StudyArtifactType;
  title: string;
  source: string;
  markdown: string;
  created_at: string;
};

export type HealthResponse = {
  status: string;
  app: string;
  model: string;
  providers: Record<string, boolean>;
};

export type ChatResponse = {
  answer: string;
  events: AgentEvent[];
  setup_required: string[];
};

export type ResearchResponse = {
  summary: string;
  detailed_answer: string;
  citations: Source[];
  confidence: number;
  critic_notes: string[];
  events: AgentEvent[];
  setup_required: string[];
};

export type ResearchReport = {
  id: string;
  title: string;
  created_at: string;
  markdown: string;
  download_url: string;
};

export type ActionResult = {
  ok: boolean;
  action: string;
  target: string;
  message: string;
};

export type CommandResponse = {
  mode: AppMode;
  intent: "chat" | "research" | "desktop_action" | "mode_switch" | "agent_plan" | "agent_command";
  spoken_text: string;
  display_text: string;
  events: AgentEvent[];
  citations: Source[];
  confidence: number | null;
  critic_notes: string[];
  setup_required: string[];
  report: ResearchReport | null;
  action_result: ActionResult | null;
  suggested_mode: AppMode | null;
  agent_command: AgentCommandResponse | null;
};

export type VoiceStatusResponse = {
  enabled: boolean;
  provider: string;
  voice: string;
  cached: boolean;
  loaded: boolean;
  setup_required: string[];
  message: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    try {
      const payload = JSON.parse(text) as { detail?: unknown };
      if (typeof payload.detail === "string") {
        throw new Error(payload.detail);
      }
      if (payload.detail && response.status === 404) {
        throw new Error("Backend route not found. Restart the FastAPI server so the latest API is loaded.");
      }
    } catch (error) {
      if (error instanceof Error && !error.message.startsWith("Unexpected")) {
        throw error;
      }
    }
    throw new Error(text || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getHealth() {
  return parseResponse<HealthResponse>(await fetch(`${API_BASE_URL}/health`, { cache: "no-store" }));
}

export async function getAgents() {
  return parseResponse<AgentDescriptor[]>(await fetch(`${API_BASE_URL}/api/agents`, { cache: "no-store" }));
}

export async function getAgentAbilities() {
  return parseResponse<AgentAbility[]>(await fetch(`${API_BASE_URL}/api/agent/abilities`, { cache: "no-store" }));
}

export async function executeAgentCommand(commandId: string, params: Record<string, unknown> = {}, inputText = "", confirmed = false, resolution: Record<string, unknown> = {}) {
  return parseResponse<AgentCommandResponse>(
    await fetch(`${API_BASE_URL}/api/agent/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command_id: commandId,
        params,
        input_text: inputText,
        confirmed,
        resolution,
      }),
    }),
  );
}

export async function testAgentCommands(commandId?: string) {
  return parseResponse<AgentCommandTestResponse>(
    await fetch(`${API_BASE_URL}/api/agent/commands/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command_id: commandId ?? null }),
    }),
  );
}

export async function getAgentAudit() {
  return parseResponse<AgentAuditEntry[]>(await fetch(`${API_BASE_URL}/api/agent/audit`, { cache: "no-store" }));
}

export async function sendChat(message: string, mode = "general") {
  return parseResponse<ChatResponse>(
    await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, mode }),
    }),
  );
}

export async function runResearch(topic: string, depth = "quick", sourceMode = "mixed") {
  return parseResponse<ResearchResponse>(
    await fetch(`${API_BASE_URL}/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        depth,
        source_mode: sourceMode,
        require_citations: true,
      }),
    }),
  );
}

export async function runCommand(text: string, mode: AppMode, inputSource: "typed" | "voice" | "quick_action" = "typed", depth?: "quick" | "deep" | "academic") {
  return parseResponse<CommandResponse>(
    await fetch(`${API_BASE_URL}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        mode,
        input_source: inputSource,
        depth,
      }),
    }),
  );
}

export async function getReports() {
  return parseResponse<ResearchReport[]>(await fetch(`${API_BASE_URL}/api/reports`, { cache: "no-store" }));
}

export async function getMemory() {
  return parseResponse<AgentMemoryItem[]>(await fetch(`${API_BASE_URL}/api/memory`, { cache: "no-store" }));
}

export async function createMemory(category: AgentMemoryCategory, text: string) {
  return parseResponse<AgentMemoryItem>(
    await fetch(`${API_BASE_URL}/api/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, text }),
    }),
  );
}

export async function updateMemory(id: string, category: AgentMemoryCategory, text: string) {
  return parseResponse<AgentMemoryItem>(
    await fetch(`${API_BASE_URL}/api/memory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, text }),
    }),
  );
}

export async function deleteMemory(id: string) {
  return parseResponse<{ ok: boolean }>(
    await fetch(`${API_BASE_URL}/api/memory/${id}`, {
      method: "DELETE",
    }),
  );
}

export async function listDocuments() {
  return parseResponse<DocumentRecord[]>(await fetch(`${API_BASE_URL}/api/documents`, { cache: "no-store" }));
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return parseResponse<DocumentRecord>(
    await fetch(`${API_BASE_URL}/api/documents/upload`, {
      method: "POST",
      body: formData,
    }),
  );
}

export async function askDocument(documentId: string, question: string) {
  return parseResponse<DocumentQuestionResponse>(
    await fetch(`${API_BASE_URL}/api/documents/${documentId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  );
}

export async function listStudyArtifacts() {
  return parseResponse<StudyArtifact[]>(await fetch(`${API_BASE_URL}/api/study/artifacts`, { cache: "no-store" }));
}

export async function generateStudyArtifact(artifactType: StudyArtifactType, topic: string, sourceText = "", reportId?: string, documentId?: string) {
  return parseResponse<{ artifact: StudyArtifact; setup_required: string[] }>(
    await fetch(`${API_BASE_URL}/api/study/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact_type: artifactType,
        topic,
        source_text: sourceText,
        report_id: reportId ?? null,
        document_id: documentId ?? null,
      }),
    }),
  );
}

export async function getVoiceStatus() {
  return parseResponse<VoiceStatusResponse>(await fetch(`${API_BASE_URL}/api/voice/status`, { cache: "no-store" }));
}

export async function warmVoice(voice?: string) {
  return parseResponse<VoiceStatusResponse>(
    await fetch(`${API_BASE_URL}/api/voice/warmup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice }),
    }),
  );
}

export async function synthesizeSpeech(text: string, voice?: string) {
  const response = await fetch(`${API_BASE_URL}/api/voice/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Speech synthesis failed with ${response.status}`);
  }
  return response.blob();
}
