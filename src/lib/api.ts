export type AgentStatus = "idle" | "working" | "complete" | "warning" | "error";
export type AppMode = "cockpit" | "research" | "agents" | "sources" | "library" | "timeline" | "settings";
export type ResearchDepth = "quick" | "deep" | "academic";
export type ResearchJobStatus = "queued" | "planning" | "searching" | "reading" | "extracting" | "verifying" | "writing" | "complete" | "error";
export type ResearchSourcePolicy = "latest_web_first" | "broad_web_academic" | "academic_first";
export type AgentCommandRisk = "safe_auto" | "safe_confirm" | "blocked";
export type AgentCommandOutcome = "success" | "failure" | "blocked" | "confirmation_required" | "planned";
export type AgentCommandTestStatus = "untested" | "passed" | "failed";
export type AutomationRunStatus = "queued" | "planning" | "running" | "waiting_for_login" | "confirmation_required" | "complete" | "error" | "cancelled";
export type AgentMemoryCategory = "course" | "project" | "goal" | "preference" | "general";
export type StudyArtifactType = "notes" | "flashcards" | "quiz" | "revision_plan" | "viva_questions";

export type Source = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  domain?: string;
  published_at?: string | null;
  fetched_chars?: number;
  quality_score?: number;
  extraction_status?: string;
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

export type AutomationEvent = {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  data: Record<string, unknown>;
};

export type AutomationRun = {
  id: string;
  prompt: string;
  status: AutomationRunStatus;
  current_url: string;
  events: AutomationEvent[];
  result: string;
  error: string;
  recipe_id: string | null;
  create_recipe: boolean;
  confirmation: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AutomationConfirmOptions = {
  confirmed_rights?: boolean;
  attestation?: string;
};

export type AutomationRecipe = {
  id: string;
  name: string;
  prompt: string;
  steps: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
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

export type MockTestDifficulty = "easy" | "medium" | "hard" | "mixed";
export type MockTestMode = "mcq";
export type MockTestSourceRequirement = "none" | "pyq_required" | "source_backed";
export type MockTestSourceMode = "uploaded_docs";
export type MockTestGenerationMode = "topic_practice" | "profile_based" | "syllabus_based" | "source_backed_pyq" | "pyq_style" | "llm_planned";
export type MockAttemptStatus = "active" | "submitted";

export type MockQuestionView = {
  id: string;
  prompt: string;
  options: string[];
  difficulty: MockTestDifficulty;
  tags: string[];
  source_refs: Source[];
};

export type MockQuestionReview = MockQuestionView & {
  correct_option_index: number;
  selected_option_index: number | null;
  is_correct: boolean;
  explanation: string;
};

export type MockTest = {
  id: string;
  topic: string;
  exam: string;
  subject: string;
  mode: MockTestMode;
  difficulty: MockTestDifficulty;
  question_count: number;
  duration_minutes: number;
  questions: MockQuestionView[];
  created_at: string;
  source: string;
  generation_mode: MockTestGenerationMode;
  blueprint_source: string;
  syllabus_units: string[];
  quality_score: number;
  quality_warnings: string[];
  source_requirement: MockTestSourceRequirement;
  source_mode: MockTestSourceMode;
  source_query: string;
  constraints: string[];
  sources: Source[];
  setup_required: string[];
};

export type MockAttempt = {
  id: string;
  test_id: string;
  status: MockAttemptStatus;
  started_at: string;
  submitted_at: string | null;
  elapsed_seconds: number;
  answers: Record<string, number>;
};

export type MockTestSubmitResponse = {
  test: MockTest;
  attempt: MockAttempt;
  score: number;
  total: number;
  percentage: number;
  correct_count: number;
  incorrect_count: number;
  elapsed_seconds: number;
  review: MockQuestionReview[];
};

export type HealthResponse = {
  status: string;
  app: string;
  model: string;
  models?: Record<string, string>;
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
  job_id?: string | null;
  status?: ResearchJobStatus | null;
  report?: ResearchReport | null;
};

export type ResearchReport = {
  id: string;
  title: string;
  created_at: string;
  markdown: string;
  download_url: string;
};

export type ResearchRequestPayload = {
  topic: string;
  depth?: ResearchDepth;
  source_mode?: "web" | "academic" | "mixed";
  source_policy?: ResearchSourcePolicy;
  max_candidates?: number;
  max_sources?: number;
  recency_days?: number | null;
  require_citations?: boolean;
};

export type ResearchJobResponse = {
  id: string;
  status: ResearchJobStatus;
  request: Required<Omit<ResearchRequestPayload, "recency_days">> & { recency_days: number | null };
  summary: string;
  detailed_answer: string;
  citations: Source[];
  confidence: number;
  critic_notes: string[];
  events: AgentEvent[];
  setup_required: string[];
  report: ResearchReport | null;
  error: string;
  created_at: string;
  updated_at: string;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

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

export async function startAutomationRun(prompt: string, recipeId?: string | null, createRecipe = false) {
  return parseResponse<AutomationRun>(
    await fetch(`${API_BASE_URL}/api/automations/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, recipe_id: recipeId ?? null, create_recipe: createRecipe }),
    }),
  );
}

export async function getAutomationRun(runId: string) {
  return parseResponse<AutomationRun>(await fetch(`${API_BASE_URL}/api/automations/runs/${runId}`, { cache: "no-store" }));
}

export function automationRunEventsUrl(runId: string) {
  return `${API_BASE_URL}/api/automations/runs/${runId}/events`;
}

export async function continueAutomationRun(runId: string, note = "") {
  return parseResponse<AutomationRun>(
    await fetch(`${API_BASE_URL}/api/automations/runs/${runId}/continue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }),
  );
}

export async function confirmAutomationRun(runId: string, approved: boolean, options: AutomationConfirmOptions = {}) {
  return parseResponse<AutomationRun>(
    await fetch(`${API_BASE_URL}/api/automations/runs/${runId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, confirmed_rights: Boolean(options.confirmed_rights), attestation: options.attestation ?? "" }),
    }),
  );
}

export async function cancelAutomationRun(runId: string, note = "Download cancelled by user.") {
  return parseResponse<AutomationRun>(
    await fetch(`${API_BASE_URL}/api/automations/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }),
  );
}

export async function openAutomationDownloadFolder(path: string) {
  return parseResponse<{ ok: boolean }>(
    await fetch(`${API_BASE_URL}/api/automations/open-download-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }),
  );
}

export async function listAutomationRecipes() {
  return parseResponse<AutomationRecipe[]>(await fetch(`${API_BASE_URL}/api/automations/recipes`, { cache: "no-store" }));
}

export async function createAutomationRecipe(name: string, prompt: string, steps: Array<Record<string, unknown>> = []) {
  return parseResponse<AutomationRecipe>(
    await fetch(`${API_BASE_URL}/api/automations/recipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, prompt, steps }),
    }),
  );
}

export async function deleteAutomationRecipe(recipeId: string) {
  return parseResponse<{ ok: boolean }>(
    await fetch(`${API_BASE_URL}/api/automations/recipes/${recipeId}`, {
      method: "DELETE",
    }),
  );
}

export async function sendChat(message: string, mode = "general", astraPro = false) {
  return parseResponse<ChatResponse>(
    await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, mode, astra_pro: astraPro }),
    }),
  );
}

export async function runResearch(topic: string, depth: ResearchDepth = "deep", sourceMode = "mixed") {
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

export async function startResearchJob(payload: ResearchRequestPayload) {
  return parseResponse<ResearchJobResponse>(
    await fetch(`${API_BASE_URL}/api/research/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        depth: "deep",
        source_mode: "mixed",
        source_policy: "latest_web_first",
        max_candidates: 60,
        max_sources: 20,
        recency_days: 365,
        require_citations: true,
        ...payload,
      }),
    }),
  );
}

export async function getResearchJob(jobId: string) {
  return parseResponse<ResearchJobResponse>(await fetch(`${API_BASE_URL}/api/research/jobs/${jobId}`, { cache: "no-store" }));
}

export function researchJobEventsUrl(jobId: string) {
  return `${API_BASE_URL}/api/research/jobs/${jobId}/events`;
}

export async function runCommand(
  text: string,
  mode: AppMode,
  inputSource: "typed" | "voice" | "quick_action" = "typed",
  depth?: "quick" | "deep" | "academic",
  astraPro = false,
) {
  return parseResponse<CommandResponse>(
    await fetch(`${API_BASE_URL}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        mode,
        input_source: inputSource,
        depth,
        astra_pro: astraPro,
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

export async function listMockTests() {
  return parseResponse<MockTest[]>(await fetch(`${API_BASE_URL}/api/mock-tests`, { cache: "no-store" }));
}

export async function getMockTest(testId: string) {
  return parseResponse<MockTest>(await fetch(`${API_BASE_URL}/api/mock-tests/${testId}`, { cache: "no-store" }));
}

export async function generateMockTest(
  topic: string,
  questionCount = 10,
  difficulty: MockTestDifficulty = "mixed",
  durationMinutes = 20,
  sourceRequirement: MockTestSourceRequirement = "none",
  sourceMode: MockTestSourceMode = "uploaded_docs",
  exam = "",
  subject = "",
) {
  return parseResponse<{ test: MockTest; setup_required: string[] }>(
    await fetch(`${API_BASE_URL}/api/mock-tests/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        exam,
        subject,
        question_count: questionCount,
        difficulty,
        mode: "mcq",
        duration_minutes: durationMinutes,
        source_requirement: sourceRequirement,
        source_mode: sourceMode,
      }),
    }),
  );
}

export async function startMockTest(testId: string) {
  return parseResponse<{ test: MockTest; attempt: MockAttempt }>(
    await fetch(`${API_BASE_URL}/api/mock-tests/${testId}/start`, {
      method: "POST",
    }),
  );
}

export async function submitMockTest(testId: string, attemptId: string, answers: Record<string, number>, elapsedSeconds: number) {
  return parseResponse<MockTestSubmitResponse>(
    await fetch(`${API_BASE_URL}/api/mock-tests/${testId}/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, elapsed_seconds: elapsedSeconds }),
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
