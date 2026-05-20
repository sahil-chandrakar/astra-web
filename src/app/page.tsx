"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Database,
  Download,
  ExternalLink,
  FileText,
  Filter,
  FileUp,
  FolderOpen,
  Globe2,
  History,
  Library,
  Loader2,
  Lock,
  Mic,
  MicOff,
  Network,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Terminal,
  TestTube2,
  Timer,
  Trash2,
  Trophy,
  Upload,
  User,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  AgentAbility,
  AgentAuditEntry,
  AgentCommandResponse,
  AgentDescriptor,
  AgentEvent,
  AgentMemoryCategory,
  AgentMemoryItem,
  AppMode,
  AutomationEvent,
  AutomationRecipe,
  AutomationRun,
  automationRunEventsUrl,
  askDocument,
  cancelAutomationRun,
  CommandResponse,
  confirmAutomationRun,
  continueAutomationRun,
  DocumentQuestionResponse,
  DocumentRecord,
  executeAgentCommand,
  generateMockTest,
  getAgentAbilities,
  getAgentAudit,
  getAgents,
  getAutomationRun,
  getHealth,
  getMemory,
  getMockTest,
  getResearchJob,
  getReports,
  HealthResponse,
  listAutomationRecipes,
  listDocuments,
  listMockTests,
  listStudyArtifacts,
  MockAttempt,
  MockTest,
  MockTestDifficulty,
  MockTestSourceRequirement,
  MockTestSubmitResponse,
  openAutomationDownloadFolder,
  researchJobEventsUrl,
  ResearchDepth,
  ResearchJobResponse,
  ResearchReport,
  runCommand,
  Source,
  startAutomationRun,
  startResearchJob,
  startMockTest,
  StudyArtifact,
  StudyArtifactType,
  submitMockTest,
  synthesizeSpeech,
  testAgentCommands,
  updateMemory,
  uploadDocument,
  warmVoice,
} from "@/lib/api";

type Message = {
  role: "user" | "astra" | "agent" | "system";
  content: string;
  label?: string;
  time: string;
  mode?: AppMode;
  downloadUrl?: string;
  confirmationId?: string;
  action?: TranscriptAction;
  actions?: TranscriptAction[];
};

type TranscriptAction =
  | {
      type: "start_mock_test";
      label: string;
      mockTestId: string;
    }
  | {
      type: "run_agent_command";
      label: string;
      commandId: string;
      params: Record<string, unknown>;
      inputText: string;
      resolution?: Record<string, unknown>;
    }
  | {
      type: "open_agent_tool";
      label: string;
      panel: AgentToolPanel;
    };

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "unsupported" | "error";
type TranscriptTone = "emerald" | "cyan" | "amber";
type MockTestCreateInput = {
  topic: string;
  questionCount: number;
  difficulty: MockTestDifficulty;
  durationMinutes: number;
  sourceRequirement: MockTestSourceRequirement;
  exam: string;
  subject: string;
};
type TranscriptDialogContent = {
  speaker: string;
  text: string;
  time: string;
  tone: TranscriptTone;
  downloadUrl?: string;
};
type IconType = React.ElementType<{ className?: string }>;
type SpeechCue = {
  text: string;
  startedAt: number;
  currentChar: number;
  currentWord: string;
  boundaryAt: number;
  boundaryType: string;
  estimatedDuration: number;
  hasBoundary: boolean;
};

type TimelineItem = {
  label: string;
  detail: string;
  status: AgentEvent["status"];
  timestamp: string;
};

type ResearchFlowItem = TimelineItem & {
  complete: boolean;
  current: boolean;
  pending: boolean;
};

type FlowBlueprintStep = {
  label: string;
  detail: string;
  matches: string[];
};

type ConfirmationState = {
  id: string;
  commandId: string;
  label: string;
  message: string;
  params: Record<string, unknown>;
  inputText: string;
  resolution: Record<string, unknown>;
};

type AgentNotice = {
  tone: "success" | "warning" | "error";
  message: string;
};

type AgentToolPanel = "catalog" | "audit" | "memory" | "documents" | "study" | "mock_test";

const navItems: Array<{ id: AppMode; label: string; icon: IconType }> = [
  { id: "cockpit", label: "Cockpit", icon: Activity },
  { id: "research", label: "Research", icon: Search },
  { id: "agents", label: "Agents", icon: Network },
  { id: "sources", label: "Automation", icon: Wand2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const quickActions = [
  { label: "New Research", icon: Plus, prompt: "Research AI agents for college productivity", mode: "research" as AppMode, depth: "quick" as const },
  { label: "Deep Research", icon: Globe2, prompt: "Research recent advances in multi-agent LLM systems for academic research", mode: "research" as AppMode, depth: "deep" as const },
  { label: "Literature Review", icon: BookOpen, prompt: "Create a literature review plan for AI study assistants", mode: "research" as AppMode, depth: "deep" as const },
  { label: "Analyze Paper", icon: FileText, prompt: "Explain how RAG improves document question answering", mode: "research" as AppMode, depth: "quick" as const },
  { label: "Write", icon: SquarePen, prompt: "Write a concise project overview for Astra AI agent", mode: "agents" as AppMode, depth: undefined },
];

const agentToolButtons: Array<{ label: string; icon: IconType; panel: AgentToolPanel }> = [
  { label: "Catalog", icon: ShieldCheck, panel: "catalog" },
  { label: "Audit", icon: History, panel: "audit" },
  { label: "Memory", icon: Database, panel: "memory" },
  { label: "Docs", icon: FileUp, panel: "documents" },
  { label: "Study", icon: Brain, panel: "study" },
  { label: "Mock Test", icon: TestTube2, panel: "mock_test" },
];

const modeCopy: Record<AppMode, { title: string; label: string; placeholder: string; empty: string }> = {
  cockpit: {
    title: "Cockpit",
    label: "Short Chat",
    placeholder: "Ask Astra, or say switch to research mode...",
    empty: "Short chat is ready. Ask naturally, or request a mode switch.",
  },
  research: {
    title: "Research",
    label: "Research Mode",
    placeholder: "Enter a research topic...",
    empty: "Research mode will search sources, save a Markdown report, and only show a short completion note.",
  },
  agents: {
    title: "Agents",
    label: "Agent Mode",
    placeholder: "Give Astra a task, like open YouTube or plan a workflow...",
    empty: "Agent mode can execute safe allowlisted desktop actions and plan the rest.",
  },
  sources: {
    title: "Automation",
    label: "Automation",
    placeholder: "Ask Astra to plan or run an automation...",
    empty: "Automation mode is ready for repeatable agent workflows.",
  },
  library: {
    title: "Library",
    label: "Reports",
    placeholder: "Ask Astra to summarize a saved report...",
    empty: "Saved research reports are generated as Markdown after each research run.",
  },
  timeline: {
    title: "Timeline",
    label: "Mission Flow",
    placeholder: "Ask for a research run to populate the mission flow...",
    empty: "The timeline only shows real steps from the active run.",
  },
  settings: {
    title: "Settings",
    label: "Setup",
    placeholder: "Ask about provider or voice setup...",
    empty: "Provider status is shown in the left rail.",
  },
};

const providerLabels: Record<string, string> = {
  cerebras: "Cerebras",
  tavily: "Tavily",
  openalex: "OpenAlex",
  semantic_scholar: "Semantic Scholar",
  duckduckgo_fallback: "DuckDuckGo",
  piper_local: "Piper Voice",
};

function getSpeechRecognitionErrorMessage(error: string) {
  switch (error) {
    case "audio-capture":
      return "No microphone was found. Check your input device, then start listening again.";
    case "network":
      return "The browser speech service is unreachable. Check your connection and try again.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission is blocked. Allow the mic for this site, then start listening again.";
    case "language-not-supported":
      return "Speech recognition does not support the selected language.";
    case "bad-grammar":
      return "Speech recognition rejected its grammar setup. Restart listening and try again.";
    default:
      return `Speech recognition stopped: ${error}.`;
  }
}

const researchFlowBlueprint: FlowBlueprintStep[] = [
  { label: "Query", detail: "Topic captured", matches: ["Query"] },
  { label: "Planning", detail: "Research plan ready", matches: ["Planning", "Routing", "Supervisor"] },
  { label: "Searching", detail: "Scanning sources", matches: ["Searching", "Search Agents"] },
  { label: "Reading", detail: "Reading and extracting", matches: ["Reading", "Reader Agents", "Citations"] },
  { label: "Analyzing", detail: "Critic review", matches: ["Analyzing", "Final Boss"] },
  { label: "Synthesizing", detail: "Drafting answer", matches: ["Writing", "Writer Agent"] },
  { label: "Complete", detail: "Report ready", matches: ["Complete"] },
];

const agentFlowBlueprint: FlowBlueprintStep[] = [
  { label: "Request", detail: "Intent captured", matches: ["Query", "Routing", "Command Router"] },
  { label: "Validate", detail: "Registry check", matches: ["Safety Validator", "Planning"] },
  { label: "Confirm", detail: "User approval gate", matches: ["Confirmation", "Desktop"] },
  { label: "Execute", detail: "Safe command run", matches: ["Agent Command", "Searching"] },
  { label: "Audit", detail: "Local log written", matches: ["Citations", "Analyzing"] },
  { label: "Respond", detail: "Result summarized", matches: ["Writing", "Writer Agent"] },
  { label: "Complete", detail: "Done", matches: ["Complete"] },
];

const automationFlowBlueprint: FlowBlueprintStep[] = [
  { label: "Prompt", detail: "User goal captured", matches: ["Query", "Routing", "Command Router"] },
  { label: "Choose Tools", detail: "Browser, computer, or Python selected", matches: ["Planning", "Supervisor"] },
  { label: "Permission", detail: "Risky steps ask first", matches: ["Confirmation", "Desktop"] },
  { label: "Execute", detail: "Automation steps running", matches: ["Agent Command", "Searching"] },
  { label: "Record", detail: "Reusable workflow saved", matches: ["Citations", "Analyzing", "Audit"] },
  { label: "Complete", detail: "Result ready", matches: ["Complete", "Writing", "Writer Agent"] },
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";
const PREFERRED_PIPER_VOICE = "en_US-lessac-high";
const SPEECH_FIRST_CHUNK_MAX_LENGTH = 180;
const SPEECH_CHUNK_MAX_LENGTH = 360;
const SPEECH_BLOB_CACHE_LIMIT = 24;
const ASTRA_PRO_MODE_KEY = "astra:pro-mode";
const ASTRA_VOICE_OUTPUT_MUTED_KEY = "astra:voice-output-muted";

function readAstraProPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ASTRA_PRO_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeAstraProPreference(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASTRA_PRO_MODE_KEY, enabled ? "true" : "false");
  } catch {
    // Local storage can be blocked; the in-memory toggle still works.
  }
}

function readVoiceOutputMutedPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ASTRA_VOICE_OUTPUT_MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeVoiceOutputMutedPreference(muted: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASTRA_VOICE_OUTPUT_MUTED_KEY, muted ? "true" : "false");
  } catch {
    // Local storage can be blocked; the in-memory toggle still works.
  }
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [agentAbilities, setAgentAbilities] = useState<AgentAbility[]>([]);
  const [agentAudit, setAgentAudit] = useState<AgentAuditEntry[]>([]);
  const [memoryItems, setMemoryItems] = useState<AgentMemoryItem[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [studyArtifacts, setStudyArtifacts] = useState<StudyArtifact[]>([]);
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [activeMockTest, setActiveMockTest] = useState<MockTest | null>(null);
  const [activeMockAttempt, setActiveMockAttempt] = useState<MockAttempt | null>(null);
  const [mockTestResult, setMockTestResult] = useState<MockTestSubmitResponse | null>(null);
  const [mockAnswers, setMockAnswers] = useState<Record<string, number>>({});
  const [mockReviewMarks, setMockReviewMarks] = useState<Record<string, boolean>>({});
  const [mockQuestionIndex, setMockQuestionIndex] = useState(0);
  const [mockStartedAt, setMockStartedAt] = useState<number | null>(null);
  const [mockRemainingSeconds, setMockRemainingSeconds] = useState(0);
  const [mockSubmitting, setMockSubmitting] = useState(false);
  const [mockTestFullscreen, setMockTestFullscreen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [agentToolPanel, setAgentToolPanel] = useState<AgentToolPanel | null>(null);
  const [agentNotice, setAgentNotice] = useState<AgentNotice | null>(null);
  const [agentBusyId, setAgentBusyId] = useState<string | null>(null);
  const [automationRun, setAutomationRun] = useState<AutomationRun | null>(null);
  const [automationEvents, setAutomationEvents] = useState<AutomationEvent[]>([]);
  const [automationRecipes, setAutomationRecipes] = useState<AutomationRecipe[]>([]);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationCancelBusy, setAutomationCancelBusy] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState<AgentMemoryCategory>("general");
  const [memoryEdit, setMemoryEdit] = useState<AgentMemoryItem | null>(null);
  const [documentQuestion, setDocumentQuestion] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [documentAnswer, setDocumentAnswer] = useState<DocumentQuestionResponse | null>(null);
  const [studyTopic, setStudyTopic] = useState("");
  const [studyType, setStudyType] = useState<StudyArtifactType>("notes");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "astra",
      content: "Astra is online. Cockpit chat is ready, and research or agent mode can take over when you switch.",
      label: "Astra",
      time: "Ready",
      mode: "cockpit",
    },
  ]);
  const [transcriptDialog, setTranscriptDialog] = useState<TranscriptDialogContent | null>(null);
  const [researchTopic] = useState("latest advancements in multi-agent LLM systems for academic research");
  const [, setActiveResearchJob] = useState<ResearchJobResponse | null>(null);
  const [, setSources] = useState<Source[]>([]);
  const [, setCriticNotes] = useState<string[]>([]);
  const [setupRequired, setSetupRequired] = useState<string[]>([]);
  const [, setResearchReport] = useState<ResearchReport | null>(null);
  const [, setReports] = useState<ResearchReport[]>([]);
  const [commandDraft, setCommandDraft] = useState("");
  const [commandInFlight, setCommandInFlight] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [handsFree, setHandsFree] = useState(false);
  const [astraPro, setAstraPro] = useState(false);
  const [voiceOutputMuted, setVoiceOutputMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [activePanel, setActivePanel] = useState<AppMode>("cockpit");
  const [researchConfidence, setResearchConfidence] = useState<number | null>(null);
  const [listenStartedAt, setListenStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [speechAnalyser, setSpeechAnalyser] = useState<AnalyserNode | null>(null);
  const [speechCue, setSpeechCue] = useState<SpeechCue | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionActiveRef = useRef(false);
  const recognitionRestartTimerRef = useRef<number | null>(null);
  const handsFreeRef = useRef(false);
  const speakingRef = useRef(false);
  const voiceOutputMutedRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const speechIdRef = useRef(0);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioContextRef = useRef<AudioContext | null>(null);
  const speechAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const speechAnalyserRef = useRef<AnalyserNode | null>(null);
  const speechBlobCacheRef = useRef<Map<string, Blob>>(new Map());
  const speechObjectUrlsRef = useRef<string[]>([]);
  const researchEventSourceRef = useRef<EventSource | null>(null);
  const commandBusyRef = useRef(false);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);
  const transcriptFeedRef = useRef<HTMLDivElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptAutoScrollRef = useRef(true);
  const transcriptScrollFrameRef = useRef<number | null>(null);

  const scrollTranscriptToBottom = useCallback((force = false) => {
    const list = transcriptListRef.current;
    if (!list || (!force && !transcriptAutoScrollRef.current)) return;
    if (transcriptScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(transcriptScrollFrameRef.current);
    }
    transcriptScrollFrameRef.current = window.requestAnimationFrame(() => {
      const currentList = transcriptListRef.current;
      if (!currentList) return;
      currentList.scrollTop = currentList.scrollHeight;
      transcriptScrollFrameRef.current = null;
    });
  }, []);

  const syncTranscriptScrollIntent = useCallback(() => {
    const list = transcriptListRef.current;
    if (!list) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    transcriptAutoScrollRef.current = distanceFromBottom < 96;
  }, []);

  useEffect(() => {
    setMounted(true);
    (window as Window & { __astraHydrationGuard?: () => void }).__astraHydrationGuard?.();
    setAstraPro(readAstraProPreference());
    const muted = readVoiceOutputMutedPreference();
    voiceOutputMutedRef.current = muted;
    setVoiceOutputMuted(muted);
    if (!muted) {
      void warmVoice(PREFERRED_PIPER_VOICE).catch(() => undefined);
    }
  }, []);

  useLayoutEffect(() => {
    scrollTranscriptToBottom(true);
  }, [messages, liveTranscript, commandInFlight, scrollTranscriptToBottom]);

  useLayoutEffect(() => {
    scrollTranscriptToBottom(false);
  }, [agentBusyId, confirmation, scrollTranscriptToBottom]);

  useEffect(() => {
    const feed = transcriptFeedRef.current;
    if (!feed || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => scrollTranscriptToBottom(false));
    observer.observe(feed);
    return () => observer.disconnect();
  }, [scrollTranscriptToBottom]);

  useEffect(() => {
    return () => {
      if (transcriptScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(transcriptScrollFrameRef.current);
      }
      researchEventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!transcriptDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTranscriptDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [transcriptDialog]);

  const providerRows = useMemo(() => {
    const loadedRows = health
      ? Object.entries(health.providers).map(([name, enabled]) => ({
          name,
          label: providerLabels[name] ?? name.replaceAll("_", " "),
          enabled,
        }))
      : [];

    const preferred = ["cerebras", "tavily", "openalex", "semantic_scholar", "piper_local"];
    return preferred.map((name) => loadedRows.find((row) => row.name === name) ?? { name, label: providerLabels[name], enabled: false });
  }, [health]);

  const timelineItems = useMemo(() => buildTimelineItems(events), [events]);
  const currentTimelineItem = [...timelineItems].reverse().find((item) => item.status === "working") ?? timelineItems.at(-1);
  const researchFlowItems = useMemo(() => buildDashboardTimelineItems(timelineItems, activePanel), [activePanel, timelineItems]);

  const confidenceScore = researchConfidence ?? 92;
  const currentMode = modeCopy[activePanel];
  const astraProLocked = activePanel === "agents";
  const astraProEffective = astraPro || astraProLocked;
  const visibleVoiceState =
    voiceOutputMuted && voiceState === "speaking"
      ? handsFree
        ? "listening"
        : "idle"
      : voiceState === "idle" && handsFree
        ? "listening"
        : voiceState;
  const voiceHeadline =
    voiceOutputMuted && visibleVoiceState !== "listening" && visibleVoiceState !== "thinking"
      ? "Output Muted"
      : visibleVoiceState === "speaking"
      ? "Talking"
      : visibleVoiceState === "thinking"
        ? activePanel === "research"
          ? "Researching"
          : "Thinking"
        : visibleVoiceState === "unsupported"
          ? "Voice Unsupported"
          : visibleVoiceState === "error"
            ? "Needs Attention"
            : handsFree
              ? "Listening"
              : "Standby";

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getHealth(),
      getAgents(),
      getReports().catch(() => []),
      getAgentAbilities().catch(() => []),
      getAgentAudit().catch(() => []),
      getMemory().catch(() => []),
      listDocuments().catch(() => []),
      listStudyArtifacts().catch(() => []),
      listAutomationRecipes().catch(() => []),
    ])
      .then(([healthResponse, agentResponse, reportResponse, abilityResponse, auditResponse, memoryResponse, documentResponse, studyResponse, automationRecipeResponse]) => {
        if (cancelled) return;
        setHealth(healthResponse);
        setAgents(agentResponse);
        setReports(reportResponse);
        setAgentAbilities(abilityResponse);
        setAgentAudit(auditResponse);
        setMemoryItems(memoryResponse);
        setDocuments(documentResponse);
        setStudyArtifacts(studyResponse);
        setAutomationRecipes(automationRecipeResponse);
        setSelectedDocumentId((current) => current || documentResponse[0]?.id || "");
      })
      .catch(() => {
        if (cancelled) return;
        setVoiceState((current) => (current === "listening" ? current : "error"));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAgentData = useCallback(async () => {
    const [abilityResponse, auditResponse, memoryResponse, documentResponse, studyResponse, mockTestResponse] = await Promise.all([
      getAgentAbilities(),
      getAgentAudit(),
      getMemory(),
      listDocuments(),
      listStudyArtifacts(),
      listMockTests(),
    ]);
    setAgentAbilities(abilityResponse);
    setAgentAudit(auditResponse);
    setMemoryItems(memoryResponse);
    setDocuments(documentResponse);
    setStudyArtifacts(studyResponse);
    setMockTests(mockTestResponse);
    setSelectedDocumentId((current) => current || documentResponse[0]?.id || "");
    setActiveMockTest((current) => current ?? mockTestResponse[0] ?? null);
  }, []);

  useEffect(() => {
    if (!handsFree || listenStartedAt === null) {
      setElapsedSeconds(0);
      return;
    }

    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - listenStartedAt) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [handsFree, listenStartedAt]);

  const stopMicrophoneStream = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    setMicStream(null);
  }, []);

  const requestMicrophoneStream = useCallback(async () => {
    if (micStreamRef.current) return micStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) return null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;
      setMicStream(stream);
      return stream;
    } catch {
      return null;
    }
  }, []);

  const clearRecognitionRestart = useCallback(() => {
    if (recognitionRestartTimerRef.current !== null) {
      window.clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
  }, []);

  const startRecognitionSafely = useCallback((recognition: SpeechRecognition) => {
    if (!handsFreeRef.current || commandBusyRef.current || speakingRef.current) return;
    if (recognitionActiveRef.current) {
      setVoiceState("listening");
      return;
    }
    try {
      recognition.start();
      recognitionActiveRef.current = true;
      setVoiceState("listening");
    } catch (error) {
      const alreadyStarted = error instanceof DOMException && error.name === "InvalidStateError";
      if (alreadyStarted) {
        recognitionActiveRef.current = true;
        setVoiceState("listening");
        return;
      }
      recognitionActiveRef.current = false;
      setVoiceState("error");
      setLiveTranscript("Speech recognition could not start. Try Start Listening again.");
    }
  }, []);

  const scheduleRecognitionRestart = useCallback(
    (recognition: SpeechRecognition, delay = 260) => {
      clearRecognitionRestart();
      if (!handsFreeRef.current || commandBusyRef.current || speakingRef.current) return;
      recognitionRestartTimerRef.current = window.setTimeout(() => {
        recognitionRestartTimerRef.current = null;
        startRecognitionSafely(recognition);
      }, delay);
    },
    [clearRecognitionRestart, startRecognitionSafely],
  );

  const stopRecognition = useCallback(() => {
    clearRecognitionRestart();
    recognitionActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Stopping an inactive recognizer throws in some Chromium builds.
    }
  }, [clearRecognitionRestart]);

  const releaseSpeechObjectUrls = useCallback(() => {
    for (const url of speechObjectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    speechObjectUrlsRef.current = [];
  }, []);

  const ensureSpeechAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!speechAudioRef.current) {
      speechAudioRef.current = new Audio();
      speechAudioRef.current.preload = "auto";
    }

    if (!speechAudioContextRef.current) {
      speechAudioContextRef.current = new AudioContextClass();
    }

    if (!speechAnalyserRef.current) {
      const analyser = speechAudioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.58;
      speechAnalyserRef.current = analyser;
      setSpeechAnalyser(analyser);
    }

    if (!speechAudioSourceRef.current) {
      speechAudioSourceRef.current = speechAudioContextRef.current.createMediaElementSource(speechAudioRef.current);
      speechAudioSourceRef.current.connect(speechAnalyserRef.current);
      speechAnalyserRef.current.connect(speechAudioContextRef.current.destination);
    }

    return {
      audio: speechAudioRef.current,
      audioContext: speechAudioContextRef.current,
      analyser: speechAnalyserRef.current,
    };
  }, []);

  const stopSpeechPlayback = useCallback(() => {
    speechIdRef.current += 1;
    speakingRef.current = false;
    speechAudioRef.current?.pause();
    if (speechAudioRef.current) {
      speechAudioRef.current.removeAttribute("src");
      speechAudioRef.current.load();
    }
    window.speechSynthesis?.cancel();
    setSpeechCue(null);
    releaseSpeechObjectUrls();
  }, [releaseSpeechObjectUrls]);

  const finishMutedSpeech = useCallback(() => {
    speakingRef.current = false;
    setSpeechCue(null);
    setVoiceState(handsFreeRef.current ? "listening" : "idle");
  }, []);

  const toggleVoiceOutputMuted = useCallback(() => {
    const next = !voiceOutputMutedRef.current;
    voiceOutputMutedRef.current = next;
    setVoiceOutputMuted(next);
    writeVoiceOutputMutedPreference(next);

    if (next) {
      stopSpeechPlayback();
      setVoiceState((current) => (current === "speaking" ? (handsFreeRef.current ? "listening" : "idle") : current));
      const recognition = recognitionRef.current;
      if (recognition && handsFreeRef.current && !commandBusyRef.current) {
        scheduleRecognitionRestart(recognition, 120);
      }
      return;
    }

    void warmVoice(PREFERRED_PIPER_VOICE).catch(() => undefined);
  }, [scheduleRecognitionRestart, stopSpeechPlayback]);

  const toggleAstraPro = useCallback(() => {
    if (activePanel === "agents") return;
    setAstraPro((current) => {
      const next = !current;
      writeAstraProPreference(next);
      return next;
    });
  }, [activePanel]);

  useEffect(() => {
    return () => {
      if (recognitionRestartTimerRef.current !== null) {
        window.clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      speechIdRef.current += 1;
      recognitionActiveRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition can already be closed during unmount.
      }
      window.speechSynthesis?.cancel();
      speechAudioRef.current?.pause();
      releaseSpeechObjectUrls();
      void speechAudioContextRef.current?.close();
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    };
  }, [releaseSpeechObjectUrls]);

  const speakWithBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
    const spokenText = normalizeSpeechText(text).slice(0, 420);
    if (!spokenText) return Promise.resolve();
    if (voiceOutputMutedRef.current) {
      stopSpeechPlayback();
      finishMutedSpeech();
      return Promise.resolve();
    }

    stopSpeechPlayback();
    const speechId = speechIdRef.current;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = 1;
    utterance.pitch = 1.05;
    const createCue = (startedAt: number): SpeechCue => ({
      text: spokenText,
      startedAt,
      currentChar: 0,
      currentWord: getWordAt(spokenText, 0),
      boundaryAt: startedAt,
      boundaryType: "start",
      estimatedDuration: estimateSpeechDurationMs(spokenText, utterance.rate),
      hasBoundary: false,
    });

    setSpeechCue(createCue(performance.now()));
    return new Promise<void>((resolve) => {
      utterance.onstart = () => {
        if (speechIdRef.current !== speechId) return;
        speakingRef.current = true;
        setVoiceState("speaking");
        setSpeechCue(createCue(performance.now()));
      };
      utterance.onboundary = (event) => {
        if (speechIdRef.current !== speechId) return;
        const currentChar = Math.max(0, Math.min(spokenText.length, event.charIndex ?? 0));
        setSpeechCue((current) =>
          current?.text === spokenText
            ? {
                ...current,
                currentChar,
                currentWord: getWordAt(spokenText, currentChar),
                boundaryAt: performance.now(),
                boundaryType: event.name || "word",
                hasBoundary: true,
              }
            : current,
        );
      };
      const settle = () => {
        if (speechIdRef.current === speechId) {
          speakingRef.current = false;
          setSpeechCue(null);
          setVoiceState(handsFreeRef.current ? "listening" : "idle");
        }
        resolve();
      };
      utterance.onend = settle;
      utterance.onerror = settle;
      window.speechSynthesis.speak(utterance);
    });
  }, [finishMutedSpeech, stopSpeechPlayback]);

  const playSpeechBlob = useCallback(
    async (blob: Blob, speechId: number) => {
      if (voiceOutputMutedRef.current) return;
      const speechAudio = ensureSpeechAudio();
      if (!speechAudio) throw new Error("Web Audio is not available.");
      if (voiceOutputMutedRef.current || speechIdRef.current !== speechId) return;

      const url = URL.createObjectURL(blob);
      speechObjectUrlsRef.current.push(url);
      const { audio, audioContext } = speechAudio;
      audio.src = url;
      audio.currentTime = 0;
      speakingRef.current = true;
      setSpeechCue(null);
      setVoiceState("speaking");

      await audioContext.resume();
      if (voiceOutputMutedRef.current || speechIdRef.current !== speechId) {
        URL.revokeObjectURL(url);
        speechObjectUrlsRef.current = speechObjectUrlsRef.current.filter((item) => item !== url);
        return;
      }
      const ended = new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Piper audio playback failed."));
      });
      await audio.play();
      await ended;
      URL.revokeObjectURL(url);
      speechObjectUrlsRef.current = speechObjectUrlsRef.current.filter((item) => item !== url);
    },
    [ensureSpeechAudio],
  );

  const getSpeechBlob = useCallback(async (text: string) => {
    const cacheKey = `${PREFERRED_PIPER_VOICE}\n${text}`;
    const cached = speechBlobCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const blob = await synthesizeSpeech(text, PREFERRED_PIPER_VOICE);
    const cache = speechBlobCacheRef.current;
    if (cache.size >= SPEECH_BLOB_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(cacheKey, blob);
    return blob;
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const spokenText = normalizeSpeechText(text);
      if (!spokenText) return;
      if (voiceOutputMutedRef.current) {
        stopSpeechPlayback();
        finishMutedSpeech();
        return;
      }

      stopRecognition();
      stopSpeechPlayback();
      const speechId = speechIdRef.current;
      const chunks = chunkSpeechText(spokenText, SPEECH_FIRST_CHUNK_MAX_LENGTH, SPEECH_CHUNK_MAX_LENGTH);
      let playedAnyPiperAudio = false;
      const restartRecognitionAfterSpeech = () => {
        const recognition = recognitionRef.current;
        if (recognition && handsFreeRef.current && !commandBusyRef.current && !speakingRef.current) {
          scheduleRecognitionRestart(recognition, 120);
        }
      };

      try {
        let pendingSpeech = getSpeechBlob(chunks[0]);
        for (let index = 0; index < chunks.length; index += 1) {
          if (voiceOutputMutedRef.current || speechIdRef.current !== speechId) {
            if (voiceOutputMutedRef.current) finishMutedSpeech();
            return;
          }
          const blob = await pendingSpeech;
          if (voiceOutputMutedRef.current || speechIdRef.current !== speechId) {
            if (voiceOutputMutedRef.current) finishMutedSpeech();
            return;
          }
          const nextChunk = chunks[index + 1];
          const nextSpeech = nextChunk ? getSpeechBlob(nextChunk) : null;
          nextSpeech?.catch(() => undefined);
          await playSpeechBlob(blob, speechId);
          pendingSpeech = nextSpeech ?? Promise.resolve(new Blob());
          playedAnyPiperAudio = true;
        }
        if (speechIdRef.current !== speechId) return;
        speakingRef.current = false;
        setVoiceState(handsFreeRef.current ? "listening" : "idle");
        restartRecognitionAfterSpeech();
      } catch {
        if (!playedAnyPiperAudio && speechIdRef.current === speechId) {
          await speakWithBrowser(spokenText);
          restartRecognitionAfterSpeech();
          return;
        }
        if (speechIdRef.current === speechId) {
          speakingRef.current = false;
          setVoiceState(handsFreeRef.current ? "listening" : "idle");
          restartRecognitionAfterSpeech();
        }
      }
    },
    [finishMutedSpeech, getSpeechBlob, playSpeechBlob, scheduleRecognitionRestart, speakWithBrowser, stopRecognition, stopSpeechPlayback],
  );

  const handleAgentCommandResult = useCallback(
    async (response: AgentCommandResponse) => {
      const tone: AgentNotice["tone"] =
        response.outcome === "success" ? "success" : response.outcome === "failure" ? "error" : "warning";
      const isMockCommand = ["generate_mock_test", "open_latest_mock_test", "list_mock_tests"].includes(response.command_id);
      const returnedTests = Array.isArray(response.data.mock_tests) ? (response.data.mock_tests as MockTest[]) : [];
      const returnedMockTest = response.data.mock_test as MockTest | null | undefined;
      const transcriptActions = buildAgentTranscriptActions(response, returnedMockTest);
      const pendingConfirmation: ConfirmationState | null = response.confirmation_required
        ? {
            id: response.audit?.id || `${response.command_id}-${Date.now()}`,
            commandId: response.command_id,
            label: response.label,
            message: response.message,
            params: response.params,
            inputText: response.audit?.input_text || response.label,
            resolution: response.resolution,
          }
        : null;
      setAgentNotice({ tone, message: response.message });
      setEvents(response.events ?? []);
      setMessages((current) => [
        ...current,
        {
          role: "agent",
          label: response.outcome === "confirmation_required" ? "Safety Gate" : "Agent Command",
          content: response.message,
          time: formatClock(),
          mode: "agents",
          action: transcriptActions[0],
          actions: transcriptActions,
          confirmationId: pendingConfirmation?.id,
        },
      ]);
      setConfirmation(pendingConfirmation);
      if (isMockCommand && response.outcome === "success") {
        if (returnedTests.length > 0) {
          setMockTests((current) => {
            const merged = [...returnedTests, ...current];
            return merged.filter((item, index, all) => item?.id && all.findIndex((candidate) => candidate.id === item.id) === index);
          });
        }
        if (returnedMockTest?.id) {
          setActiveMockTest(returnedMockTest);
          setMockTests((current) => [returnedMockTest, ...current.filter((item) => item.id !== returnedMockTest.id)]);
          setActiveMockAttempt(null);
          setMockTestResult(null);
          setMockAnswers({});
          setMockReviewMarks({});
          setMockQuestionIndex(0);
          setMockStartedAt(null);
          setMockRemainingSeconds(returnedMockTest.duration_minutes * 60);
          setMockTestFullscreen(false);
          setAgentToolPanel("mock_test");
        } else if (response.data.open_panel === "mock_test" || response.command_id === "list_mock_tests") {
          setMockTestFullscreen(false);
          setAgentToolPanel("mock_test");
        }
      }
      await refreshAgentData();
      await speak(response.message);
    },
    [refreshAgentData, speak],
  );

  const runAgentRegistryCommand = useCallback(
    async (commandId: string, params: Record<string, unknown> = {}, inputText = "", confirmed = false, resolution: Record<string, unknown> = {}) => {
      setActivePanel("agents");
      setAgentBusyId(commandId);
      setAgentNotice(null);
      try {
        const response = await executeAgentCommand(commandId, params, inputText, confirmed, resolution);
        await handleAgentCommandResult(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Agent command failed.";
        setAgentNotice({ tone: "error", message });
        setEvents([makeClientEvent("Safety Validator", "error", message)]);
      } finally {
        setAgentBusyId(null);
      }
    },
    [handleAgentCommandResult],
  );

  const confirmAgentCommand = useCallback(async () => {
    if (!confirmation) return;
    await runAgentRegistryCommand(confirmation.commandId, confirmation.params, confirmation.inputText, true, confirmation.resolution);
  }, [confirmation, runAgentRegistryCommand]);

  const updateConfirmationParam = useCallback((key: string, value: unknown) => {
    setConfirmation((current) => {
      if (!current) return current;
      return { ...current, params: { ...current.params, [key]: value } };
    });
  }, []);

  const cancelAgentConfirmation = useCallback(() => {
    setConfirmation(null);
    setAgentNotice({ tone: "warning", message: "Confirmation cancelled." });
  }, []);

  const runAgentSelfTests = useCallback(async () => {
    setAgentBusyId("test_all");
    setAgentNotice(null);
    try {
      const response = await testAgentCommands();
      setAgentAbilities(response.abilities);
      setEvents(response.events);
      setAgentNotice({ tone: "success", message: "Agent command self-tests completed." });
      await refreshAgentData();
    } catch (error) {
      setAgentNotice({ tone: "error", message: error instanceof Error ? error.message : "Command tests failed." });
    } finally {
      setAgentBusyId(null);
    }
  }, [refreshAgentData]);

  const saveMemoryFromPanel = useCallback(async () => {
    const text = newMemoryText.trim();
    if (!text) return;
    await runAgentRegistryCommand("save_memory", { category: newMemoryCategory, text }, `Remember ${text}`);
    setNewMemoryText("");
  }, [newMemoryCategory, newMemoryText, runAgentRegistryCommand]);

  const saveMemoryEdit = useCallback(async () => {
    if (!memoryEdit) return;
    try {
      const updated = await updateMemory(memoryEdit.id, memoryEdit.category, memoryEdit.text);
      setMemoryItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMemoryEdit(null);
      setAgentNotice({ tone: "success", message: "Memory updated." });
      await refreshAgentData();
    } catch (error) {
      setAgentNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not update memory." });
    }
  }, [memoryEdit, refreshAgentData]);

  const handleDocumentUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setAgentBusyId("upload_document");
      setAgentNotice(null);
      try {
        const document = await uploadDocument(file);
        setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
        setSelectedDocumentId(document.id);
        setAgentNotice({ tone: "success", message: `Uploaded ${document.title}.` });
        await refreshAgentData();
      } catch (error) {
        setAgentNotice({ tone: "error", message: error instanceof Error ? error.message : "PDF upload failed." });
      } finally {
        setAgentBusyId(null);
      }
    },
    [refreshAgentData],
  );

  const askSelectedDocument = useCallback(async () => {
    const question = documentQuestion.trim();
    if (!selectedDocumentId || !question) return;
    setAgentBusyId("ask_document");
    setAgentNotice(null);
    try {
      const answer = await askDocument(selectedDocumentId, question);
      setDocumentAnswer(answer);
      setAgentNotice({ tone: "success", message: `Answered from ${answer.document.title}.` });
      setMessages((current) => [
        ...current,
        { role: "agent", label: "Document Agent", content: answer.answer, time: formatClock(), mode: "agents" },
      ]);
      setSetupRequired(answer.setup_required ?? []);
    } catch (error) {
      setAgentNotice({ tone: "error", message: error instanceof Error ? error.message : "Document question failed." });
    } finally {
      setAgentBusyId(null);
    }
  }, [documentQuestion, selectedDocumentId]);

  const generateStudyFromPanel = useCallback(async () => {
    const topic = studyTopic.trim();
    if (!topic) return;
    await runAgentRegistryCommand("generate_study_artifact", { artifact_type: studyType, topic }, `Generate ${studyType} for ${topic}`);
  }, [runAgentRegistryCommand, studyTopic, studyType]);

  const createMockTestFromPanel = useCallback(async (input: MockTestCreateInput) => {
    const topic = input.topic.trim();
    if (!topic) return false;
    setAgentBusyId("generate_mock_test");
    setAgentNotice(null);
    try {
      const response = await generateMockTest(
        topic,
        input.questionCount,
        input.difficulty,
        input.durationMinutes,
        input.sourceRequirement,
        "uploaded_docs",
        input.exam.trim(),
        input.subject.trim(),
      );
      setMockTests((current) => [response.test, ...current.filter((item) => item.id !== response.test.id)]);
      setActiveMockTest(response.test);
      setActiveMockAttempt(null);
      setMockTestResult(null);
      setMockAnswers({});
      setMockReviewMarks({});
      setMockQuestionIndex(0);
      setMockStartedAt(null);
      setMockRemainingSeconds(response.test.duration_minutes * 60);
      setMockTestFullscreen(false);
      setAgentToolPanel("mock_test");
      setSetupRequired(response.setup_required ?? []);
      setMessages((current) => [
        ...current,
        {
          role: "agent",
          label: "Mock Test Agent",
          content: `Created a ${response.test.question_count}-question mock test on ${response.test.topic}.`,
          time: formatClock(),
          mode: "agents",
          actions: [{ type: "start_mock_test", label: "Start Test", mockTestId: response.test.id }],
        },
      ]);
      setAgentNotice({ tone: "success", message: `Created mock test on ${response.test.topic}.` });
      return true;
    } catch (error) {
      setAgentNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not create mock test." });
      return false;
    } finally {
      setAgentBusyId(null);
    }
  }, []);

  const startActiveMockTest = useCallback(async (selectedTest?: MockTest) => {
    const testToStart = selectedTest ?? activeMockTest;
    if (!testToStart) return;
    setAgentBusyId("start_mock_test");
    setAgentNotice(null);
    try {
      const response = await startMockTest(testToStart.id);
      setActiveMockTest(response.test);
      setMockTests((current) => [response.test, ...current.filter((item) => item.id !== response.test.id)]);
      setActiveMockAttempt(response.attempt);
      setMockTestResult(null);
      setMockAnswers({});
      setMockReviewMarks({});
      setMockQuestionIndex(0);
      setMockStartedAt(Date.now());
      setMockRemainingSeconds(response.test.duration_minutes * 60);
      setAgentToolPanel(null);
      setMockTestFullscreen(true);
      setAgentNotice({ tone: "success", message: `Started mock test on ${response.test.topic}.` });
    } catch (error) {
      setAgentNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not start mock test." });
    } finally {
      setAgentBusyId(null);
    }
  }, [activeMockTest]);

  const startMockTestFromTranscript = useCallback(
    async (testId: string) => {
      setActivePanel("agents");
      setAgentToolPanel("mock_test");
      setAgentBusyId(`start_mock_test:${testId}`);
      setAgentNotice(null);
      try {
        const selected = mockTests.find((item) => item.id === testId) ?? (await getMockTest(testId));
        setActiveMockTest(selected);
        setMockTests((current) => [selected, ...current.filter((item) => item.id !== selected.id)]);
        const response = await startMockTest(testId);
        setActiveMockTest(response.test);
        setActiveMockAttempt(response.attempt);
        setMockTestResult(null);
        setMockAnswers({});
        setMockReviewMarks({});
        setMockQuestionIndex(0);
        setMockStartedAt(Date.now());
        setMockRemainingSeconds(response.test.duration_minutes * 60);
        setAgentToolPanel(null);
        setMockTestFullscreen(true);
        setAgentNotice({ tone: "success", message: `Started mock test on ${response.test.topic}.` });
      } catch (error) {
        setAgentNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not start mock test." });
      } finally {
        setAgentBusyId(null);
      }
    },
    [mockTests],
  );

  const submitActiveMockTest = useCallback(
    async (auto = false) => {
      if (!activeMockTest || !activeMockAttempt || activeMockAttempt.status !== "active" || mockSubmitting) return;
      setMockSubmitting(true);
      setAgentBusyId("submit_mock_test");
      setAgentNotice(null);
      const elapsed = mockStartedAt === null ? activeMockAttempt.elapsed_seconds : Math.max(0, Math.floor((Date.now() - mockStartedAt) / 1000));
      try {
        const result = await submitMockTest(activeMockTest.id, activeMockAttempt.id, mockAnswers, elapsed);
        setMockTestResult(result);
        setActiveMockTest(result.test);
        setActiveMockAttempt(result.attempt);
        setMockStartedAt(null);
        setMockRemainingSeconds(0);
        setMockTestFullscreen(true);
        setAgentNotice({ tone: "success", message: auto ? "Time is up. Mock test submitted." : "Mock test submitted." });
        await refreshAgentData();
      } catch (error) {
        setAgentNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not submit mock test." });
      } finally {
        setMockSubmitting(false);
        setAgentBusyId(null);
      }
    },
    [activeMockAttempt, activeMockTest, mockAnswers, mockStartedAt, mockSubmitting, refreshAgentData],
  );

  useEffect(() => {
    if (!activeMockTest || !activeMockAttempt || activeMockAttempt.status !== "active" || mockStartedAt === null) return;
    const totalSeconds = activeMockTest.duration_minutes * 60;
    let submitted = false;
    const timer = window.setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - mockStartedAt) / 1000));
      const remaining = Math.max(0, totalSeconds - elapsed);
      setMockRemainingSeconds(remaining);
      if (remaining <= 0 && !submitted) {
        submitted = true;
        void submitActiveMockTest(true);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [activeMockAttempt, activeMockTest, mockStartedAt, submitActiveMockTest]);

  const absorbCommandResponse = useCallback(
    async (response: CommandResponse) => {
      if (response.agent_command) {
        await handleAgentCommandResult(response.agent_command);
        return;
      }
      const reportDownloadUrl = response.report ? backendHref(response.report.download_url) : undefined;
      const displayText =
        response.intent === "research" && response.report
          ? buildResearchTranscriptNote(response)
          : response.display_text || response.spoken_text;
      setMessages((current) => [
        ...current,
        {
          role: response.intent === "desktop_action" ? "agent" : "astra",
          label: response.intent === "desktop_action" ? "Desktop Agent" : "Astra",
          content: displayText,
          time: formatClock(),
          mode: response.mode,
          downloadUrl: response.intent === "research" ? reportDownloadUrl : undefined,
        },
      ]);
      setEvents(response.events ?? []);
      setSetupRequired(response.setup_required ?? []);

      if (response.suggested_mode) {
        setActivePanel(response.suggested_mode);
      } else if (response.mode !== activePanel && response.intent === "research") {
        setActivePanel("research");
      }

      if (response.intent === "research") {
        setSources(response.citations ?? []);
        setCriticNotes(response.critic_notes ?? []);
        setResearchConfidence(response.confidence === null ? null : Math.round(response.confidence * 100));
        if (response.report) {
          setResearchReport(response.report);
          setReports((current) => [response.report as ResearchReport, ...current.filter((report) => report.id !== response.report?.id)]);
        }
      }

      await speak(response.spoken_text || displayText);
    },
    [activePanel, handleAgentCommandResult, speak],
  );

  const absorbResearchJobResponse = useCallback(
    async (job: ResearchJobResponse) => {
      const reportDownloadUrl = job.report ? backendHref(job.report.download_url) : undefined;
      const displayText = buildResearchJobTranscriptNote(job);
      setActiveResearchJob(job);
      setMessages((current) => [
        ...current,
        {
          role: "astra",
          label: "Astra",
          content: displayText,
          time: formatClock(),
          mode: "research",
          downloadUrl: reportDownloadUrl,
        },
      ]);
      setEvents(job.events ?? []);
      setSetupRequired(job.setup_required ?? []);
      setSources(job.citations ?? []);
      setCriticNotes(job.critic_notes ?? []);
      setResearchConfidence(Math.round((job.confidence ?? 0) * 100));
      if (job.report) {
        setResearchReport(job.report);
        setReports((current) => [job.report as ResearchReport, ...current.filter((report) => report.id !== job.report?.id)]);
      }
      await speak(`Research complete. I generated the report with ${job.citations.length} sources and ${Math.round((job.confidence ?? 0) * 100)}% confidence.`);
    },
    [speak],
  );

  const submitResearchJob = useCallback(
    async (rawTopic: string, inputSource: "typed" | "voice" | "quick_action" = "typed", depth: ResearchDepth = "deep") => {
      const topic = cleanResearchTopic(rawTopic);
      if (!topic) return;
      void inputSource;

      researchEventSourceRef.current?.close();
      researchEventSourceRef.current = null;
      commandBusyRef.current = true;
      setCommandInFlight(true);
      stopRecognition();
      setActivePanel("research");
      setMessages((current) => [...current, { role: "user", content: topic, label: "You", time: formatClock(), mode: "research" }]);
      setLiveTranscript("");
      setEvents([makeClientEvent("Query", "working", topic)]);
      setVoiceState("thinking");

      const finish = async (job: ResearchJobResponse) => {
        if (job.status === "error") {
          const message = job.error || "Research job failed.";
          setMessages((current) => [...current, { role: "astra", label: "Astra", content: message, time: formatClock(), mode: "research" }]);
          setEvents(job.events.length ? job.events : [makeClientEvent("Complete", "error", message)]);
          setVoiceState("error");
        } else {
          await absorbResearchJobResponse(job);
        }
        commandBusyRef.current = false;
        setCommandInFlight(false);
        if (handsFreeRef.current && !speakingRef.current) {
          const recognition = recognitionRef.current;
          window.setTimeout(() => {
            if (!handsFreeRef.current || commandBusyRef.current || speakingRef.current) return;
            if (recognition) startRecognitionSafely(recognition);
          }, 120);
        }
      };

      try {
        const job = await startResearchJob({
          topic,
          depth,
          source_policy: "latest_web_first",
          source_mode: "mixed",
          max_candidates: depth === "quick" ? 30 : 60,
          max_sources: depth === "quick" ? 10 : 20,
          recency_days: 365,
          require_citations: true,
        });
        setActiveResearchJob(job);
        setEvents(job.events ?? []);

        let finalized = false;
        const finalizeFromServer = async () => {
          if (finalized) return;
          finalized = true;
          researchEventSourceRef.current?.close();
          researchEventSourceRef.current = null;
          const finalJob = await getResearchJob(job.id);
          await finish(finalJob);
        };
        const pollUntilDone = async () => {
          if (finalized) return;
          researchEventSourceRef.current?.close();
          researchEventSourceRef.current = null;
          for (let attempt = 0; attempt < 120; attempt += 1) {
            const currentJob = await getResearchJob(job.id);
            setActiveResearchJob(currentJob);
            setEvents(currentJob.events ?? []);
            if (currentJob.status === "complete" || currentJob.status === "error") {
              await finish(currentJob);
              finalized = true;
              return;
            }
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
          }
          throw new Error("Research job is still running. Check the backend job status and try again.");
        };

        const eventSource = new EventSource(researchJobEventsUrl(job.id));
        researchEventSourceRef.current = eventSource;
        eventSource.onmessage = (event) => {
          try {
            const agentEvent = JSON.parse(event.data) as AgentEvent;
            if (agentEvent.agent) {
              setEvents((current) => appendUniqueEvent(current, agentEvent));
            }
          } catch {
            // Ignore malformed event chunks and keep the stream alive.
          }
        };
        eventSource.addEventListener("done", () => {
          void finalizeFromServer();
        });
        eventSource.onerror = () => {
          void pollUntilDone().catch(async (error) => {
            if (finalized) return;
            finalized = true;
            const message = error instanceof Error ? error.message : "Research stream failed.";
            commandBusyRef.current = false;
            setCommandInFlight(false);
            setVoiceState("error");
            setMessages((current) => [...current, { role: "astra", label: "Astra", content: message, time: formatClock(), mode: "research" }]);
            setEvents((current) => appendUniqueEvent(current, makeClientEvent("Complete", "error", message)));
          });
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Astra backend is not reachable yet.";
        commandBusyRef.current = false;
        setCommandInFlight(false);
        setMessages((current) => [...current, { role: "astra", label: "Astra", content: message, time: formatClock(), mode: "research" }]);
        setEvents([makeClientEvent("Complete", "error", message)]);
        setVoiceState("error");
      }
    },
    [absorbResearchJobResponse, startRecognitionSafely, stopRecognition],
  );

  const submitCommand = useCallback(
    async (rawCommand: string, inputSource: "typed" | "voice" | "quick_action" = "typed", modeOverride?: AppMode, depth?: "quick" | "deep" | "academic") => {
      const command = rawCommand.trim();
      if (!command) return;

      const commandMode = modeOverride ?? (activePanel === "sources" ? "agents" : activePanel);
      commandBusyRef.current = true;
      setCommandInFlight(true);
      stopRecognition();
      setMessages((current) => [...current, { role: "user", content: command, label: "You", time: formatClock(), mode: commandMode }]);
      setLiveTranscript("");
      setEvents([makeClientEvent(commandMode === "research" ? "Query" : "Command Router", "working", command)]);
      setVoiceState("thinking");

      try {
        const response = await runCommand(command, commandMode, inputSource, depth, astraPro || commandMode === "agents");
        await absorbCommandResponse(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Astra backend is not reachable yet.";
        setMessages((current) => [...current, { role: "astra", label: "Astra", content: message, time: formatClock(), mode: commandMode }]);
        setEvents([makeClientEvent("Command Router", "error", message)]);
        setVoiceState("error");
      } finally {
        commandBusyRef.current = false;
        setCommandInFlight(false);
        if (handsFreeRef.current && !speakingRef.current) {
          const recognition = recognitionRef.current;
          window.setTimeout(() => {
            if (!handsFreeRef.current || commandBusyRef.current || speakingRef.current) return;
            if (recognition) startRecognitionSafely(recognition);
          }, 120);
        }
      }
    },
    [absorbCommandResponse, activePanel, astraPro, startRecognitionSafely, stopRecognition],
  );

  const refreshAutomationRecipes = useCallback(async () => {
    const recipes = await listAutomationRecipes();
    setAutomationRecipes(recipes);
  }, []);

  const runAutomationPrompt = useCallback(
    async (prompt: string, createRecipe = false, recipeId?: string | null) => {
      const cleanPrompt = prompt.trim();
      if (!cleanPrompt) return;
      setAutomationBusy(true);
      setActivePanel("sources");
      try {
        const run = await startAutomationRun(cleanPrompt, recipeId, createRecipe);
        setAutomationRun(run);
        setAutomationEvents(run.events);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Automation could not start.";
        const failure: AutomationEvent = {
          id: `local-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "error",
          message,
          data: {},
        };
        setAutomationEvents((current) => [...current, failure]);
        setAutomationBusy(false);
      }
    },
    [],
  );

  const continueActiveAutomation = useCallback(async () => {
    if (!automationRun) return;
    setAutomationBusy(true);
    const run = await continueAutomationRun(automationRun.id, "User is ready to continue.");
    setAutomationRun(run);
    setAutomationEvents(run.events);
  }, [automationRun]);

  const confirmActiveAutomation = useCallback(
    async (approved: boolean, options: { confirmedRights?: boolean; attestation?: string } = {}) => {
      if (!automationRun) return;
      setAutomationBusy(approved);
      const run = await confirmAutomationRun(automationRun.id, approved, {
        confirmed_rights: Boolean(options.confirmedRights),
        attestation: options.attestation,
      });
      setAutomationRun(run);
      setAutomationEvents(run.events);
      if (!approved) setAutomationBusy(false);
    },
    [automationRun],
  );

  const cancelActiveAutomation = useCallback(async () => {
    if (!automationRun || automationCancelBusy) return;
    setAutomationCancelBusy(true);
    try {
      const run = await cancelAutomationRun(automationRun.id, "Download cancelled by user.");
      setAutomationRun(run);
      setAutomationEvents(run.events);
      setAutomationBusy(false);
    } finally {
      setAutomationCancelBusy(false);
    }
  }, [automationCancelBusy, automationRun]);

  useEffect(() => {
    if (!automationRun?.id) return;
    const runId = automationRun.id;
    const source = new EventSource(automationRunEventsUrl(runId));
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as AutomationEvent;
        setAutomationEvents((current) => appendUniqueAutomationEvent(current, payload));
        void getAutomationRun(runId)
          .then((run) => {
            setAutomationRun(run);
            setAutomationEvents(run.events);
            if (["complete", "error", "cancelled", "waiting_for_login", "waiting_for_user", "confirmation_required"].includes(run.status)) {
              setAutomationBusy(false);
              setAutomationCancelBusy(false);
            }
            if (run.status === "complete" || payload.type === "recipe_saved") {
              void refreshAutomationRecipes();
            }
          })
          .catch(() => undefined);
      } catch {
        // Ignore malformed event payloads.
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [automationRun?.id, refreshAutomationRecipes]);

  const startListening = useCallback(async () => {
    if (commandBusyRef.current || speakingRef.current) return;
    if (!window.isSecureContext) {
      setHandsFree(false);
      handsFreeRef.current = false;
      setListenStartedAt(null);
      setVoiceState("error");
      setLiveTranscript("Voice needs a secure local page. Open Astra on http://127.0.0.1:3000 or localhost.");
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setHandsFree(false);
      handsFreeRef.current = false;
      setListenStartedAt(null);
      setVoiceState("unsupported");
      setLiveTranscript("This browser does not expose speech recognition. Use Chrome or Edge for voice input.");
      return;
    }

    setVoiceState("listening");
    setLiveTranscript("Checking microphone access...");
    const stream = await requestMicrophoneStream();
    if (!handsFreeRef.current) return;
    if (!stream) {
      setHandsFree(false);
      handsFreeRef.current = false;
      setListenStartedAt(null);
      setVoiceState("error");
      setLiveTranscript("Microphone access is blocked. Allow the mic for this site, then start listening again.");
      stopMicrophoneStream();
      return;
    }

    clearRecognitionRestart();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      setVoiceState("listening");
      setLiveTranscript("");
    };
    recognition.onaudiostart = () => {
      setVoiceState("listening");
    };
    recognition.onspeechstart = () => {
      setVoiceState("listening");
      setLiveTranscript("");
    };
    recognition.onspeechend = () => {
      if (handsFreeRef.current && !commandBusyRef.current) {
        setLiveTranscript((current) => current || "Processing speech...");
      }
    };
    recognition.onresult = (event) => {
      if (speakingRef.current || commandBusyRef.current) return;

      setVoiceState("listening");
      let interim = "";
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      setLiveTranscript(interim || finalText);
      if (finalText.trim()) {
        if (activePanel === "research") {
          void submitResearchJob(finalText, "voice", "deep");
        } else {
          void submitCommand(finalText, "voice");
        }
      }
    };

    recognition.onnomatch = () => {
      if (!handsFreeRef.current || commandBusyRef.current) return;
      setVoiceState("listening");
      setLiveTranscript("I heard audio, but could not turn it into text.");
    };
    recognition.onerror = (event) => {
      recognitionActiveRef.current = false;
      if (!handsFreeRef.current) return;
      if (event.error === "aborted") return;
      if (event.error === "no-speech") {
        setVoiceState("listening");
        setLiveTranscript("Still listening...");
        return;
      }

      const fatalError =
        event.error === "not-allowed" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture" ||
        event.error === "network" ||
        event.error === "language-not-supported";
      setVoiceState("error");
      setLiveTranscript(getSpeechRecognitionErrorMessage(event.error));
      if (fatalError) {
        setHandsFree(false);
        handsFreeRef.current = false;
        setListenStartedAt(null);
        stopMicrophoneStream();
      }
    };
    recognition.onend = () => {
      recognitionActiveRef.current = false;
      if (handsFreeRef.current && !commandBusyRef.current && !speakingRef.current) {
        scheduleRecognitionRestart(recognition);
      }
    };

    recognitionRef.current = recognition;
    startRecognitionSafely(recognition);
  }, [activePanel, clearRecognitionRestart, requestMicrophoneStream, scheduleRecognitionRestart, startRecognitionSafely, stopMicrophoneStream, submitCommand, submitResearchJob]);

  const toggleHandsFree = useCallback(() => {
    const next = !handsFree;
    setHandsFree(next);
    handsFreeRef.current = next;
    if (next) {
      setListenStartedAt(Date.now());
      void startListening();
    } else {
      stopRecognition();
      stopSpeechPlayback();
      stopMicrophoneStream();
      setListenStartedAt(null);
      setVoiceState("idle");
      setLiveTranscript("");
    }
  }, [handsFree, startListening, stopMicrophoneStream, stopRecognition, stopSpeechPlayback]);

  const executeResearch = async () => {
    setActivePanel("research");
    await submitResearchJob(researchTopic, "quick_action", "deep");
  };

  if (!mounted) {
    return <main className="mission-shell min-h-screen text-zinc-50" suppressHydrationWarning />;
  }

  return (
    <main className="mission-shell min-h-screen text-zinc-50">
      <div className="mission-frame">
        <aside className="nav-rail hud-panel">
          <div className="brand-lockup">
            <div className="brand-star">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <h1>Astra</h1>
              <p>Voice-First AI Assistant</p>
            </div>
          </div>

          <nav className="nav-list" aria-label="Astra sections">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activePanel === item.id}
                onClick={() => setActivePanel(item.id)}
              />
            ))}
          </nav>

          <section className="rail-widget handsfree-widget">
            <div className="widget-label">Hands-Free</div>
            <div className="voice-chip">
              {voiceOutputMuted ? (
                <VolumeX className="h-8 w-8 text-amber-200" />
              ) : handsFree ? (
                <Mic className="h-8 w-8 text-emerald-300" />
              ) : (
                <MicOff className="h-8 w-8 text-zinc-500" />
              )}
              <MiniWave tone={visibleVoiceState === "speaking" ? "talking" : "listening"} active={handsFree || visibleVoiceState === "speaking"} />
            </div>
            <span>{voiceOutputMuted ? "Output Muted" : handsFree ? "Voice Active" : voiceHeadline}</span>
          </section>

          <section className="rail-widget">
            <div className="widget-label">API Setup</div>
            <div className="provider-list">
              {providerRows.map((provider) => (
                <div key={provider.name} className="provider-row">
                  <span>{provider.label}</span>
                  <span className={provider.enabled ? "status-dot ready" : "status-dot pending"} />
                </div>
              ))}
              {setupRequired.length > 0 && <p className="setup-note">Add {setupRequired.join(", ")}</p>}
            </div>
          </section>

          <section className="user-strip">
            <div className="brand-star small">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <strong>Astra User</strong>
              <span>Pro Plan</span>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-zinc-500" />
          </section>
        </aside>

        <section className={`dashboard-grid ${activePanel === "sources" ? "automation-dashboard" : ""}`}>
          <section className="cockpit-panel hud-panel">
            <div className="cockpit-title-row">
              <div>
                <div className="surface-title">{currentMode.title}</div>
                <p>{currentMode.empty}</p>
              </div>
              <span className="mode-pill">{currentMode.label}</span>
            </div>

            {activePanel === "sources" ? (
              <AutomationWorkspace
                draft={commandDraft}
                busy={automationBusy}
                run={automationRun}
                events={automationEvents}
                recipes={automationRecipes}
                onDraftChange={setCommandDraft}
                onRun={(prompt, createRecipe, recipeId) => {
                  setCommandDraft("");
                  void runAutomationPrompt(prompt, createRecipe, recipeId);
                }}
                onContinue={() => void continueActiveAutomation()}
                onConfirm={(approved, options) => void confirmActiveAutomation(approved, options)}
                onCancelDownload={() => void cancelActiveAutomation()}
                cancelBusy={automationCancelBusy}
              />
            ) : (
              <div className={`voice-stage ${activePanel === "agents" ? "agent-voice-stage" : ""}`}>
                <VoiceWaveformCanvas mode={visibleVoiceState} stream={micStream} speechCue={speechCue} speechAnalyser={speechAnalyser} />

                <div className="voice-mode-card">
                  {activePanel === "agents" ? <ShieldCheck className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  <div>
                    <span>{currentMode.label}</span>
                    <strong>{activePanel === "agents" ? "Safe Agent" : handsFree ? "Hands-Free" : "Manual"}</strong>
                  </div>
                </div>

                <div className="confidence-card">
                  <span>{activePanel === "agents" ? "Commands" : "Confidence"}</span>
                  <strong>{activePanel === "agents" ? agentAbilities.length : `${confidenceScore}%`}</strong>
                  <MiniWave tone="listening" active />
                </div>

                {activePanel === "agents" && agentNotice && <div className={`agent-voice-notice ${agentNotice.tone}`}>{agentNotice.message}</div>}

                <div className={`voice-radar voice-${visibleVoiceState}`}>
                  <div className="radar-ring ring-one" />
                  <div className="radar-ring ring-two" />
                  <div className="radar-ring ring-three" />
                  <div className="radar-ring ring-four" />
                  <div className="radar-core">
                    {visibleVoiceState === "thinking" ? (
                      <Loader2 className="h-9 w-9 animate-spin text-cyan-200" />
                    ) : visibleVoiceState === "speaking" ? (
                      <Volume2 className="h-9 w-9 text-amber-200" />
                    ) : handsFree ? (
                      <Mic className="h-9 w-9 text-emerald-200" />
                    ) : (
                      <MicOff className="h-9 w-9 text-zinc-500" />
                    )}
                  </div>
                  <div className="voice-label">
                    <strong>{voiceHeadline}</strong>
                    <span>{formatTimer(elapsedSeconds)}</span>
                    <div className="voice-control-row">
                      <button type="button" onClick={toggleHandsFree} className="listen-toggle">
                        <span />
                        {handsFree ? "Stop Listening" : "Start Listening"}
                      </button>
                      <button
                        type="button"
                        onClick={toggleVoiceOutputMuted}
                        className={`voice-output-toggle ${voiceOutputMuted ? "muted" : ""}`}
                        aria-label={voiceOutputMuted ? "Unmute Astra voice output" : "Mute Astra voice output"}
                        aria-pressed={voiceOutputMuted}
                        title={voiceOutputMuted ? "Unmute Astra voice output" : "Mute Astra voice output"}
                      >
                        {voiceOutputMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="action-row">
                  {activePanel === "agents"
                    ? agentToolButtons.map((action) => (
                        <button key={action.panel} type="button" onClick={() => setAgentToolPanel(action.panel)} className="tool-button" disabled={commandInFlight}>
                          <action.icon className="h-4 w-4" />
                          {action.label}
                        </button>
                      ))
                    : quickActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => {
                            setActivePanel(action.mode);
                            if (action.mode === "research") {
                              void submitResearchJob(action.prompt, "quick_action", action.depth ?? "deep");
                            } else {
                              void submitCommand(action.prompt, "quick_action", action.mode, action.depth);
                            }
                          }}
                          className="tool-button"
                          disabled={commandInFlight}
                        >
                          <action.icon className="h-4 w-4" />
                          {action.label}
                        </button>
                      ))}
                </div>
              </div>
            )}

          </section>

          {activePanel !== "sources" && (
          <aside className="transcript-panel transcript-rail hud-panel">
            <div className="transcript-head">
              <div>
                <span className="surface-title">Transcript</span>
                <small>{currentMode.label} console</small>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setTranscriptDialog(null);
                }}
              >
                Clear
              </button>
            </div>
            <div ref={transcriptListRef} className="transcript-list" onScroll={syncTranscriptScrollIntent}>
              <div ref={transcriptFeedRef} className="transcript-feed">
                {messages.length === 0 && (
                  <TranscriptRow icon={Sparkles} speaker="Astra" text={currentMode.empty} tone="cyan" active={false} time="Ready" />
                )}
                {messages.slice(-14).map((message, index) => {
                  const speaker = message.label ?? (message.role === "user" ? "You" : "Astra");
                  const tone: TranscriptTone = message.role === "user" ? "emerald" : message.role === "agent" ? "amber" : "cyan";
                  const shouldOpenFull = message.role !== "user" && isLongTranscriptText(message.content);
                  const messageActions = message.actions ?? (message.action ? [message.action] : []);
                  const transcriptActions = messageActions.map((action) => ({
                    label: action.label,
                    busy:
                      (action.type === "start_mock_test" && agentBusyId === `start_mock_test:${action.mockTestId}`) ||
                      (action.type === "run_agent_command" && agentBusyId === action.commandId),
                    onClick: () => {
                      if (action.type === "start_mock_test") {
                        void startMockTestFromTranscript(action.mockTestId);
                      } else if (action.type === "run_agent_command") {
                        void runAgentRegistryCommand(action.commandId, action.params, action.inputText, false, action.resolution ?? {});
                      } else if (action.type === "open_agent_tool") {
                        setAgentToolPanel(action.panel);
                      }
                    },
                  }));
                  return (
                    <TranscriptRow
                      key={`${message.role}-${message.time}-${index}`}
                      icon={message.role === "user" ? User : message.role === "agent" ? ShieldCheck : Sparkles}
                      speaker={speaker}
                      text={message.content}
                      downloadUrl={message.downloadUrl}
                      tone={tone}
                      active={(message.role === "astra" && visibleVoiceState === "speaking") || (message.role === "user" && visibleVoiceState === "listening")}
                      time={message.time}
                      confirmation={message.confirmationId && confirmation?.id === message.confirmationId ? confirmation : null}
                      confirmationBusy={Boolean(confirmation && message.confirmationId === confirmation.id && agentBusyId === confirmation.commandId)}
                      onConfirmationParamChange={updateConfirmationParam}
                      onConfirm={confirmAgentCommand}
                      onCancelConfirm={cancelAgentConfirmation}
                      actions={transcriptActions}
                      onViewFull={
                        shouldOpenFull
                          ? () =>
                              setTranscriptDialog({
                                speaker,
                                text: message.content,
                                time: message.time,
                                tone,
                                downloadUrl: message.downloadUrl,
                              })
                          : undefined
                      }
                    />
                  );
                })}
                {liveTranscript && (
                  <TranscriptRow
                    icon={voiceState === "error" || voiceState === "unsupported" ? AlertTriangle : Mic}
                    speaker={voiceState === "error" || voiceState === "unsupported" ? "Voice" : "Listening"}
                    text={liveTranscript}
                    tone={voiceState === "error" || voiceState === "unsupported" ? "amber" : "emerald"}
                    active={voiceState !== "error" && voiceState !== "unsupported"}
                    time="Live"
                  />
                )}
                <div ref={transcriptEndRef} className="transcript-end-marker" aria-hidden="true" />
              </div>
            </div>
            {commandInFlight && (
              <div className="transcript-status-strip" aria-live="polite">
                <div className="row-icon">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="transcript-copy">
                  <div className="speaker-line">
                    <strong>{currentTimelineItem?.label ?? "Astra"}</strong>
                    <span>Now</span>
                  </div>
                  <p>{currentTimelineItem?.detail ?? "Working on the command..."}</p>
                </div>
                {!voiceOutputMuted && <MiniWave active tone="talking" />}
              </div>
            )}
            <form
              className="command-form"
              onSubmit={(event) => {
                event.preventDefault();
                const text = commandDraft.trim();
                setCommandDraft("");
                if (activePanel === "research") {
                  void submitResearchJob(text, "typed", "deep");
                } else {
                  void submitCommand(text, "typed");
                }
              }}
            >
              <button
                type="button"
                className={`astra-pro-toggle ${astraProEffective ? "active" : ""} ${astraProLocked ? "locked" : ""}`}
                onClick={toggleAstraPro}
                aria-pressed={astraProEffective}
                title={astraProLocked ? "Astra Pro is always on in agent mode" : astraPro ? "Disable Astra Pro" : "Enable Astra Pro"}
                disabled={commandInFlight || astraProLocked}
              >
                <span className="astra-pro-mark" aria-hidden="true">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                Astra Pro
              </button>
              <input
                value={commandDraft}
                onChange={(event) => setCommandDraft(event.target.value)}
                placeholder={currentMode.placeholder}
                disabled={commandInFlight}
              />
              <button type="submit" disabled={commandInFlight || !commandDraft.trim()}>
                {commandInFlight ? "Working" : "Send"}
              </button>
            </form>
          </aside>
          )}

          {activePanel !== "sources" && (
          <div className="timeline-panel timeline-strip timeline-fullwidth">
            <div className="timeline-head">
              <div>
                <span className="surface-title">{activePanel === "agents" ? "Agent Timeline" : "Research Timeline"}</span>
                <small>{activePanel === "agents" ? "Safe execution flow" : "Mission flow"}</small>
              </div>
              <div className="timeline-actions">
                <div className="timeline-view-toggle" aria-label="Timeline display mode">
                  <button type="button" className="active">
                    Timeline View
                  </button>
                  <button type="button">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Graph View
                  </button>
                </div>
                <button type="button" className="timeline-filter" aria-label="Filter timeline">
                  <Filter className="h-4 w-4" />
                  Filter
                </button>
                {activePanel === "agents" ? (
                  <button type="button" onClick={() => setAgentToolPanel("catalog")} className="run-button timeline-run">
                    <ShieldCheck className="h-4 w-4" />
                    Catalog
                  </button>
                ) : (
                  <button type="button" onClick={executeResearch} className="run-button timeline-run">
                    <Play className="h-4 w-4" />
                    Run
                  </button>
                )}
              </div>
            </div>

            <div className="research-flow-track">
              {researchFlowItems.map((step, index) => (
                <ResearchFlowStep key={`${step.label}-${index}`} step={step} isLast={index === researchFlowItems.length - 1} />
              ))}
            </div>
          </div>
          )}
        </section>
      </div>
      <AgentCommandCenter
        activePanel={agentToolPanel}
        agents={agents}
        abilities={agentAbilities}
        audit={agentAudit}
        memoryItems={memoryItems}
        documents={documents}
        studyArtifacts={studyArtifacts}
        mockTests={mockTests}
        activeMockTest={activeMockTest}
        activeMockAttempt={activeMockAttempt}
        mockTestResult={mockTestResult}
        mockAnswers={mockAnswers}
        mockRemainingSeconds={mockRemainingSeconds}
        mockSubmitting={mockSubmitting}
        notice={agentNotice}
        busyId={agentBusyId}
        newMemoryText={newMemoryText}
        newMemoryCategory={newMemoryCategory}
        memoryEdit={memoryEdit}
        documentQuestion={documentQuestion}
        selectedDocumentId={selectedDocumentId}
        documentAnswer={documentAnswer}
        studyTopic={studyTopic}
        studyType={studyType}
        onClose={() => setAgentToolPanel(null)}
        onRunCommand={runAgentRegistryCommand}
        onRunTests={runAgentSelfTests}
        onRefresh={refreshAgentData}
        onNewMemoryText={setNewMemoryText}
        onNewMemoryCategory={setNewMemoryCategory}
        onSaveMemory={saveMemoryFromPanel}
        onEditMemory={setMemoryEdit}
        onSaveMemoryEdit={saveMemoryEdit}
        onMemoryEditChange={setMemoryEdit}
        onDeleteMemory={(item) => void runAgentRegistryCommand("delete_memory", { memory_id: item.id }, `Delete memory ${item.id}`)}
        onUploadDocument={handleDocumentUpload}
        onDocumentQuestion={setDocumentQuestion}
        onSelectedDocument={setSelectedDocumentId}
        onAskDocument={askSelectedDocument}
        onStudyTopic={setStudyTopic}
        onStudyType={setStudyType}
        onGenerateStudy={generateStudyFromPanel}
        onCreateMockTest={createMockTestFromPanel}
        onSelectMockTest={(test) => {
          setActiveMockTest(test);
          setActiveMockAttempt(null);
          setMockTestResult(null);
          setMockAnswers({});
          setMockReviewMarks({});
          setMockQuestionIndex(0);
          setMockStartedAt(null);
          setMockRemainingSeconds(test.duration_minutes * 60);
          setMockTestFullscreen(false);
        }}
        onStartMockTest={startActiveMockTest}
        onResumeMockTest={() => {
          setAgentToolPanel(null);
          setMockTestFullscreen(true);
        }}
        onMockQuestionIndex={setMockQuestionIndex}
        onRetryMockTest={() => {
          setActiveMockAttempt(null);
          setMockTestResult(null);
          setMockAnswers({});
          setMockReviewMarks({});
          setMockQuestionIndex(0);
          setMockStartedAt(null);
          setMockRemainingSeconds((activeMockTest?.duration_minutes ?? 20) * 60);
          setMockTestFullscreen(false);
          setAgentToolPanel("mock_test");
        }}
      />
      {mockTestFullscreen && activeMockTest && (activeMockAttempt || mockTestResult) && (
        <MockTestFullscreen
          test={activeMockTest}
          attempt={activeMockAttempt}
          result={mockTestResult}
          answers={mockAnswers}
          reviewMarks={mockReviewMarks}
          questionIndex={mockQuestionIndex}
          remainingSeconds={mockRemainingSeconds}
          busy={agentBusyId === "submit_mock_test" || mockSubmitting}
          onAnswer={(questionId, optionIndex) => setMockAnswers((current) => ({ ...current, [questionId]: optionIndex }))}
          onToggleReview={(questionId) => setMockReviewMarks((current) => ({ ...current, [questionId]: !current[questionId] }))}
          onQuestionIndex={setMockQuestionIndex}
          onSubmit={submitActiveMockTest}
          onRetry={() => {
            setActiveMockAttempt(null);
            setMockTestResult(null);
            setMockAnswers({});
            setMockReviewMarks({});
            setMockQuestionIndex(0);
            setMockStartedAt(null);
            setMockRemainingSeconds((activeMockTest?.duration_minutes ?? 20) * 60);
            setMockTestFullscreen(false);
            setAgentToolPanel("mock_test");
          }}
          onClose={() => setMockTestFullscreen(false)}
        />
      )}
      {transcriptDialog && <TranscriptDialog content={transcriptDialog} onClose={() => setTranscriptDialog(null)} />}
    </main>
  );
}

function AutomationWorkspace({
  draft,
  busy,
  run,
  events,
  recipes,
  onDraftChange,
  onRun,
  onContinue,
  onConfirm,
  onCancelDownload,
  cancelBusy,
}: {
  draft: string;
  busy: boolean;
  run: AutomationRun | null;
  events: AutomationEvent[];
  recipes: AutomationRecipe[];
  onDraftChange: (value: string) => void;
  onRun: (prompt: string, createRecipe?: boolean, recipeId?: string | null) => void;
  onContinue: () => void;
  onConfirm: (approved: boolean, options?: { confirmedRights?: boolean; attestation?: string }) => void;
  onCancelDownload: () => void;
  cancelBusy: boolean;
}) {
  const trimmedDraft = draft.trim();
  const visibleItems = useMemo(() => buildAutomationTimeline(events).slice(-14), [events]);
  const isWaiting = run?.status === "waiting_for_login" || run?.status === "waiting_for_user";
  const needsConfirmation = run?.status === "confirmation_required";
  const isTerminal = run ? ["complete", "error", "cancelled"].includes(run.status) : false;
  const statusLabel = run?.status.replaceAll("_", " ") ?? "Ready";
  const confirmationMessage = typeof run?.confirmation?.message === "string" ? run.confirmation.message : "Astra needs approval to continue.";
  const isVideoDownloadConfirmation = run?.confirmation?.kind === "video_download_permission";
  const videoUrl = typeof run?.confirmation?.video_url === "string" ? run.confirmation.video_url : "";
  const videoTitle = typeof run?.confirmation?.video_title === "string" ? run.confirmation.video_title : "";
  const videoChannel = typeof run?.confirmation?.channel === "string" ? run.confirmation.channel : "";
  const rightsStatement = typeof run?.confirmation?.rights_statement === "string" ? run.confirmation.rights_statement : "I own this video or have permission/license to download it.";
  const maxSizeMb = typeof run?.confirmation?.max_size_mb === "number" ? run.confirmation.max_size_mb : 500;
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  useEffect(() => {
    setRightsConfirmed(false);
  }, [run?.id, run?.confirmation?.kind, videoUrl]);

  return (
    <section className="automation-workspace" aria-label="Automation workspace">
      <section className="automation-chat-panel">
        <div className="automation-chat-head">
          <div>
            <span className="surface-title">Automation Chat</span>
            <strong>Prompt the agent</strong>
          </div>
          <span className={`automation-working-pill ${isTerminal ? "done" : ""}`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {statusLabel}
          </span>
        </div>
        <div className="automation-chat-feed" aria-live="polite">
          {!run && visibleItems.length === 0 ? (
            <div className="automation-chat-empty">
              <Wand2 className="h-5 w-5" />
              <strong>Start with a task you want Astra to repeat.</strong>
              <span>Ask it to use browser access, computer access, Python, or saved steps. It will confirm risky actions first.</span>
            </div>
          ) : (
            <>
              {run && (
                <article className="automation-chat-message user">
                  <span>You</span>
                  <p>{run.prompt}</p>
                </article>
              )}
              {visibleItems.map((item) =>
                item.kind === "download" ? (
                  <AutomationDownloadCard key={item.key} item={item} canCancel={run?.status === "running"} cancelBusy={cancelBusy} onCancel={onCancelDownload} />
                ) : (
                  <article key={item.event.id} className={`automation-chat-message astra ${item.event.type}`}>
                    <span>{item.event.type.replaceAll("_", " ")}</span>
                    <p>{item.event.message}</p>
                    <AutomationDownloadProgress event={item.event} />
                    <AutomationEventLinks event={item.event} />
                  </article>
                ),
              )}
            </>
          )}
          {isWaiting && (
            <article className="automation-action-card">
              <span>{run?.status === "waiting_for_user" ? "Waiting for desktop step" : "Waiting for you"}</span>
              <p>{run?.status === "waiting_for_user" ? "Finish the Windows step, then continue." : "Finish the login or manual step in the Automation Browser, then continue."}</p>
              <button type="button" onClick={onContinue}>
                <Play className="h-4 w-4" />
                Continue
              </button>
            </article>
          )}
          {needsConfirmation && (
            <article className="automation-action-card confirm">
              <span>Approval required</span>
              <p>{confirmationMessage}</p>
              {isVideoDownloadConfirmation && (
                <div className="automation-rights-confirm">
                  {(videoTitle || videoChannel) && (
                    <p>
                      {videoTitle ? <strong>{videoTitle}</strong> : null}
                      {videoChannel ? <small>{videoChannel}</small> : null}
                    </p>
                  )}
                  {videoUrl && (
                    <a href={videoUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {videoUrl}
                    </a>
                  )}
                  <small>Maximum download size: {maxSizeMb} MB</small>
                  <label>
                    <input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />
                    {rightsStatement}
                  </label>
                </div>
              )}
              <div>
                <button type="button" onClick={() => onConfirm(false)}>
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm(true, { confirmedRights: rightsConfirmed, attestation: rightsConfirmed ? rightsStatement : "" })}
                  disabled={isVideoDownloadConfirmation && !rightsConfirmed}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </button>
              </div>
            </article>
          )}
        </div>
        <form
          className="automation-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmedDraft) onRun(trimmedDraft);
          }}
        >
          <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Tell Astra what automation to run or create..." disabled={busy} />
          <button type="submit" className="automation-primary-action" disabled={!trimmedDraft || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Send
          </button>
        </form>
      </section>

      <section className="automation-new-panel">
        <div className="automation-panel-eyebrow">
          <Plus className="h-4 w-4" />
          <span>New Automation</span>
        </div>
        <h2>Create a reusable workflow</h2>
        <p>Describe what should happen, when Astra should ask permission, and what result should be saved for next time.</p>
        <button
          type="button"
          onClick={() =>
            onDraftChange(
              "Create a new reusable automation. Goal: . Tools allowed: browser, computer access, and Python. Ask before risky actions. Save the final steps so I can run it again.",
            )
          }
          disabled={busy}
        >
          <Wand2 className="h-4 w-4" />
          Draft New Automation
        </button>
        <button type="button" onClick={() => onRun(trimmedDraft || "Create a new reusable automation.", true)} disabled={busy}>
          <Save className="h-4 w-4" />
          Create From Prompt
        </button>
        {recipes.length > 0 && (
          <div className="automation-recipe-list">
            {recipes.slice(0, 5).map((recipe) => (
              <button key={recipe.id} type="button" onClick={() => onRun(recipe.prompt, false, recipe.id)} disabled={busy}>
                <strong>{recipe.name}</strong>
                <small>{recipe.prompt}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

type AutomationTimelineItem =
  | { kind: "event"; event: AutomationEvent }
  | { kind: "download"; key: string; events: AutomationEvent[] };

const DOWNLOAD_LIFECYCLE_EVENTS = new Set(["download_start", "download_progress", "download_retry", "download_complete", "download_error", "download_cancelled"]);

function buildAutomationTimeline(events: AutomationEvent[]): AutomationTimelineItem[] {
  const items: AutomationTimelineItem[] = [];
  const downloadIndexes = new Map<string, number>();

  events.forEach((event) => {
    if (!DOWNLOAD_LIFECYCLE_EVENTS.has(event.type)) {
      items.push({ kind: "event", event });
      return;
    }

    const key = automationDownloadKey(event);
    const existingIndex = downloadIndexes.get(key);
    if (existingIndex === undefined) {
      downloadIndexes.set(key, items.length);
      items.push({ kind: "download", key, events: [event] });
      return;
    }

    const existing = items[existingIndex];
    if (existing.kind === "download") {
      items[existingIndex] = { ...existing, events: [...existing.events, event] };
    }
  });

  return items;
}

function automationDownloadKey(event: AutomationEvent) {
  const folderPath = typeof event.data.folder_path === "string" ? event.data.folder_path : "";
  const sourceUrl = typeof event.data.source_url === "string" ? event.data.source_url : "";
  return folderPath || sourceUrl || "download";
}

function AutomationDownloadCard({
  item,
  canCancel,
  cancelBusy,
  onCancel,
}: {
  item: Extract<AutomationTimelineItem, { kind: "download" }>;
  canCancel: boolean;
  cancelBusy: boolean;
  onCancel: () => void;
}) {
  const latestEvent = item.events[item.events.length - 1];
  const startEvent = item.events.find((event) => event.type === "download_start");
  const progressEvent = [...item.events].reverse().find((event) => typeof event.data.progress_percent === "number") ?? latestEvent;
  const mergedEvent = mergeAutomationDownloadEvents(item.events, latestEvent);
  const isRunning = !["download_complete", "download_error", "download_cancelled"].includes(latestEvent.type);
  const title = latestEvent.type === "download_progress" ? "download progress" : latestEvent.type.replaceAll("_", " ");
  const message = shortAutomationText(latestEvent.type === "download_progress" ? startEvent?.message || latestEvent.message : latestEvent.message, 96);

  return (
    <article className={`automation-chat-message astra automation-download-card ${latestEvent.type}`}>
      <span>{title}</span>
      <p>{message}</p>
      <AutomationDownloadProgress event={{ ...progressEvent, data: { ...mergedEvent.data, ...progressEvent.data } }} running={isRunning} />
      <AutomationEventLinks event={mergedEvent} />
      {isRunning && canCancel && (
        <button type="button" className="automation-download-cancel" onClick={onCancel} disabled={cancelBusy}>
          {cancelBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Cancel download
        </button>
      )}
    </article>
  );
}

function mergeAutomationDownloadEvents(events: AutomationEvent[], latestEvent: AutomationEvent): AutomationEvent {
  const data = events.reduce<Record<string, unknown>>((merged, event) => ({ ...merged, ...event.data }), {});
  return {
    ...latestEvent,
    data,
  };
}

function AutomationEventLinks({ event }: { event: AutomationEvent }) {
  const url =
    typeof event.data.url === "string"
      ? event.data.url
      : typeof event.data.copyable_url === "string"
        ? event.data.copyable_url
        : typeof event.data.source_url === "string"
          ? event.data.source_url
          : "";
  const filename = typeof event.data.filename === "string" ? event.data.filename : "";
  const filePath = typeof event.data.path === "string" ? event.data.path : "";
  const folderPath = typeof event.data.folder_path === "string" ? event.data.folder_path : "";
  if (!url && !filename && !filePath && !folderPath) return null;

  return (
    <div className="automation-event-links">
      {(filename || filePath) && (
        <span className="automation-event-file">
          {shortAutomationText(filename || "Downloaded file", 86)}
        </span>
      )}
      {url && (
        <>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Open link
          </a>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(url)}>
            <ClipboardCheck className="h-3.5 w-3.5" />
            Copy link
          </button>
        </>
      )}
      {folderPath && (
        <button type="button" onClick={() => void openAutomationDownloadFolder(folderPath)}>
          <FolderOpen className="h-3.5 w-3.5" />
          Open folder
        </button>
      )}
    </div>
  );
}

function shortAutomationText(text: string, maxLength: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function AutomationDownloadProgress({ event, running = false }: { event: AutomationEvent; running?: boolean }) {
  const rawPercent = event.data.progress_percent;
  if (typeof rawPercent !== "number") return null;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
  const downloadedBytes = typeof event.data.downloaded_bytes === "number" ? event.data.downloaded_bytes : null;
  const totalBytes = typeof event.data.total_bytes === "number" ? event.data.total_bytes : null;

  return (
    <div className="automation-progress">
      <div>
        <strong>{percent}%</strong>
        <span>{formatBytes(downloadedBytes)}{totalBytes ? ` / ${formatBytes(totalBytes)}` : ""}</span>
      </div>
      <div className={`automation-progress-track ${running ? "running" : ""}`} aria-label={`Download progress ${percent}%`}>
        <div style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "Downloading";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatClock(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function makeClientEvent(agent: string, status: AgentEvent["status"], message: string): AgentEvent {
  return {
    agent,
    status,
    message,
    timestamp: new Date().toISOString(),
    sources: [],
  };
}

function appendUniqueEvent(events: AgentEvent[], event: AgentEvent) {
  const key = `${event.agent}-${event.status}-${event.message}-${event.timestamp}`;
  if (events.some((item) => `${item.agent}-${item.status}-${item.message}-${item.timestamp}` === key)) return events;
  return [...events, event];
}

function appendUniqueAutomationEvent(events: AutomationEvent[], event: AutomationEvent) {
  if (events.some((item) => item.id === event.id)) return events;
  return [...events, event];
}

function cleanResearchTopic(text: string) {
  return text
    .replace(/^\s*(please\s+)?(do\s+)?(a\s+)?(deep\s+)?(research|search|web search|find|look up|literature review)\s+(on|about|for)?\s*/i, "")
    .trim()
    .replace(/[. ]+$/g, "");
}

function labelForEvent(agent: string) {
  if (agent === "Query") return "Query";
  if (agent === "Command Router") return "Routing";
  if (agent === "Desktop Agent") return "Desktop";
  if (agent === "Supervisor") return "Planning";
  if (agent === "Search Agents") return "Searching";
  if (agent === "Reader Agents") return "Reading";
  if (agent === "Citation Agent") return "Citations";
  if (agent === "Final Boss") return "Analyzing";
  if (agent === "Writer Agent") return "Writing";
  if (agent === "Complete") return "Complete";
  return agent;
}

function buildTimelineItems(events: AgentEvent[]): TimelineItem[] {
  const orderedLabels = ["Query", "Routing", "Desktop", "Planning", "Searching", "Reading", "Citations", "Analyzing", "Writing", "Complete"];
  const byLabel = new Map<string, TimelineItem>();

  for (const event of events) {
    const label = labelForEvent(event.agent);
    byLabel.set(label, {
      label,
      detail: event.message,
      status: event.status,
      timestamp: event.timestamp,
    });
  }

  return [...byLabel.values()].sort((a, b) => {
    const orderA = orderedLabels.indexOf(a.label);
    const orderB = orderedLabels.indexOf(b.label);
    if (orderA !== orderB) return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

function buildDashboardTimelineItems(items: TimelineItem[], activePanel: AppMode): ResearchFlowItem[] {
  const blueprint = activePanel === "agents" ? agentFlowBlueprint : activePanel === "sources" ? automationFlowBlueprint : researchFlowBlueprint;
  const normalizedItems = items.map((item) => ({
    ...item,
    matchKey: normalizeMatchKey(item.label),
  }));

  const hydrated = blueprint.map((step) => {
    const matchKeys = step.matches.map(normalizeMatchKey);
    const match = normalizedItems.find((item) => matchKeys.includes(item.matchKey));
    return {
      label: step.label,
      detail: match?.detail ?? step.detail,
      status: match?.status ?? ("idle" as AgentEvent["status"]),
      timestamp: match?.timestamp ?? "",
      complete: false,
      current: false,
      pending: true,
    };
  });

  const workingIndex = hydrated.findIndex((item) => item.status === "working");
  const lastActiveIndex = hydrated.reduce((latest, item, index) => (item.status !== "idle" ? index : latest), -1);
  const currentIndex = workingIndex >= 0 ? workingIndex : lastActiveIndex;

  return hydrated.map((item, index) => {
    const inferredComplete = currentIndex >= 0 && index < currentIndex && item.status !== "error";
    const complete = item.status === "complete" || inferredComplete;
    const current = index === currentIndex || item.status === "working";
    const status = complete && item.status === "idle" ? ("complete" as AgentEvent["status"]) : item.status;
    return {
      ...item,
      status,
      complete,
      current,
      pending: currentIndex === -1 || index > currentIndex,
    };
  });
}

function normalizeMatchKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatEventTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Now";
  return formatClock(date);
}

function backendHref(path: string) {
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function buildResearchTranscriptNote(response: CommandResponse) {
  const title = response.report?.title ?? "Research report";
  const sourceCount = response.citations?.length ?? 0;
  const percent = response.confidence === null ? null : Math.round(response.confidence * 100);
  const confidenceLine = percent === null ? `${sourceCount} sources collected.` : `${sourceCount} sources collected with ${percent}% confidence.`;
  return [`Research complete: ${title}.`, confidenceLine, "Detailed report is ready."].join("\n");
}

function buildResearchJobTranscriptNote(job: ResearchJobResponse) {
  const title = job.report?.title ?? job.request.topic;
  const sourceCount = job.citations?.length ?? 0;
  const percent = Math.round((job.confidence ?? 0) * 100);
  const setup = job.setup_required.length > 0 ? `Setup needed: ${job.setup_required.join(", ")}.` : "Detailed Markdown report is ready.";
  return [`Research complete: ${title}.`, `${sourceCount} sources collected with ${percent}% confidence.`, setup].join("\n");
}

function buildAgentTranscriptActions(response: AgentCommandResponse, returnedMockTest?: MockTest | null): TranscriptAction[] {
  const actions: TranscriptAction[] = [];
  if (["generate_mock_test", "open_latest_mock_test", "list_mock_tests"].includes(response.command_id) && response.outcome === "success" && returnedMockTest?.id) {
    actions.push({ type: "start_mock_test", label: "Start Test", mockTestId: returnedMockTest.id });
  }

  const sourceActions = Array.isArray(response.data.source_actions)
    ? response.data.source_actions
    : Array.isArray(response.data.actions)
      ? response.data.actions
      : [];
  if (sourceActions.length > 0) {
    const params = { ...response.params };
    const actionSet = new Set(sourceActions.map((item) => String(item).toLowerCase()));
    if (actionSet.has("use uploaded pdf")) {
      actions.push({ type: "open_agent_tool", label: "Upload PDF", panel: "documents" });
    }
    if (actionSet.has("generate pyq-style practice")) {
      actions.push({
        type: "run_agent_command",
        label: "PYQ-Style",
        commandId: "generate_mock_test",
        params: { ...params, source_requirement: "none", source_mode: "uploaded_docs", constraints: ["PYQ-style practice"] },
        inputText: response.audit?.input_text || response.label,
        resolution: response.resolution,
      });
    }
  }
  return actions;
}

function AgentCommandCenter({
  activePanel,
  agents,
  abilities,
  audit,
  memoryItems,
  documents,
  studyArtifacts,
  mockTests,
  activeMockTest,
  activeMockAttempt,
  mockTestResult,
  mockAnswers,
  mockRemainingSeconds,
  mockSubmitting,
  notice,
  busyId,
  newMemoryText,
  newMemoryCategory,
  memoryEdit,
  documentQuestion,
  selectedDocumentId,
  documentAnswer,
  studyTopic,
  studyType,
  onClose,
  onRunCommand,
  onRunTests,
  onRefresh,
  onNewMemoryText,
  onNewMemoryCategory,
  onSaveMemory,
  onEditMemory,
  onSaveMemoryEdit,
  onMemoryEditChange,
  onDeleteMemory,
  onUploadDocument,
  onDocumentQuestion,
  onSelectedDocument,
  onAskDocument,
  onStudyTopic,
  onStudyType,
  onGenerateStudy,
  onCreateMockTest,
  onSelectMockTest,
  onStartMockTest,
  onResumeMockTest,
  onMockQuestionIndex,
  onRetryMockTest,
}: {
  activePanel: AgentToolPanel | null;
  agents: AgentDescriptor[];
  abilities: AgentAbility[];
  audit: AgentAuditEntry[];
  memoryItems: AgentMemoryItem[];
  documents: DocumentRecord[];
  studyArtifacts: StudyArtifact[];
  mockTests: MockTest[];
  activeMockTest: MockTest | null;
  activeMockAttempt: MockAttempt | null;
  mockTestResult: MockTestSubmitResponse | null;
  mockAnswers: Record<string, number>;
  mockRemainingSeconds: number;
  mockSubmitting: boolean;
  notice: AgentNotice | null;
  busyId: string | null;
  newMemoryText: string;
  newMemoryCategory: AgentMemoryCategory;
  memoryEdit: AgentMemoryItem | null;
  documentQuestion: string;
  selectedDocumentId: string;
  documentAnswer: DocumentQuestionResponse | null;
  studyTopic: string;
  studyType: StudyArtifactType;
  onClose: () => void;
  onRunCommand: (commandId: string, params?: Record<string, unknown>, inputText?: string, confirmed?: boolean) => Promise<void>;
  onRunTests: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onNewMemoryText: (value: string) => void;
  onNewMemoryCategory: (value: AgentMemoryCategory) => void;
  onSaveMemory: () => Promise<void>;
  onEditMemory: (item: AgentMemoryItem | null) => void;
  onSaveMemoryEdit: () => Promise<void>;
  onMemoryEditChange: React.Dispatch<React.SetStateAction<AgentMemoryItem | null>>;
  onDeleteMemory: (item: AgentMemoryItem) => void;
  onUploadDocument: (file: File | null) => Promise<void>;
  onDocumentQuestion: (value: string) => void;
  onSelectedDocument: (value: string) => void;
  onAskDocument: () => Promise<void>;
  onStudyTopic: (value: string) => void;
  onStudyType: (value: StudyArtifactType) => void;
  onGenerateStudy: () => Promise<void>;
  onCreateMockTest: (input: MockTestCreateInput) => Promise<boolean>;
  onSelectMockTest: (test: MockTest) => void;
  onStartMockTest: (test?: MockTest) => Promise<void>;
  onResumeMockTest: () => void;
  onMockQuestionIndex: (index: number) => void;
  onRetryMockTest: () => void;
}) {
  const passed = abilities.filter((ability) => ability.test_status === "passed").length;
  const failed = abilities.filter((ability) => ability.test_status === "failed").length;
  const quickCommands = [
    { id: "check_backend_health", label: "Health", icon: Server },
    { id: "check_provider_setup", label: "Providers", icon: Shield },
    { id: "list_reports", label: "Reports", icon: Library },
    { id: "open_latest_report", label: "Latest", icon: ExternalLink },
    { id: "run_frontend_lint", label: "Lint", icon: Terminal },
    { id: "run_backend_tests", label: "Tests", icon: TestTube2 },
    { id: "start_frontend_dev_server", label: "Dev Server", icon: Play },
  ];
  const approvedTargets = [
    ["youtube", "YouTube"],
    ["google", "Google"],
    ["gmail", "Gmail"],
    ["google_docs", "Docs"],
    ["google_drive", "Drive"],
    ["calendar", "Calendar"],
    ["notepad", "Notepad"],
    ["calculator", "Calculator"],
    ["file_explorer", "Files"],
  ] as const;
  const categories: AgentMemoryCategory[] = ["general", "course", "project", "goal", "preference"];
  const studyTypes: StudyArtifactType[] = ["notes", "flashcards", "quiz", "revision_plan", "viva_questions"];
  const [selectedStudyArtifactId, setSelectedStudyArtifactId] = useState<string | null>(null);
  const selectedStudyArtifact = studyArtifacts.find((artifact) => artifact.id === selectedStudyArtifactId) ?? null;
  const panelTitle =
    activePanel === "catalog"
      ? "Command Catalog"
      : activePanel === "audit"
        ? "Audit Log"
        : activePanel === "memory"
          ? "Memory"
          : activePanel === "documents"
            ? "Documents"
            : activePanel === "study"
              ? "Study Tools"
              : "Mock Test";

  if (!activePanel) return null;

  return (
    <>
      {activePanel && (
        <div className="agent-tools-backdrop" onMouseDown={onClose}>
          <section className="agent-command-center" role="dialog" aria-modal="true" aria-labelledby="agent-tools-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="agent-tools-head">
              <div>
                <span className="surface-title">Agent Tools</span>
                <strong id="agent-tools-title">{panelTitle}</strong>
              </div>
              <div className="agent-tools-actions">
                <button type="button" onClick={() => void onRefresh()} aria-label="Refresh agent data">
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button type="button" onClick={onClose} aria-label="Close agent tools">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="agent-tools-body">
            {notice && <div className={`agent-notice ${notice.tone}`}>{notice.message}</div>}

            {activePanel === "catalog" && (
              <>
                <div className="agent-summary-strip">
                  <div>
                    <span className="surface-title">Safety Core</span>
                    <strong>Registry-controlled execution</strong>
                  </div>
                  <div className="agent-stat-grid">
                    <Metric label="Commands" value={abilities.length} />
                    <Metric label="Passed" value={passed} />
                    <Metric label="Failed" value={failed} />
                    <Metric label="Agents" value={agents.length} />
                  </div>
                </div>

                <section className="agent-panel">
                  <div className="agent-panel-head">
                    <div>
                      <span className="surface-subtitle">Safe Actions</span>
                      <small>Run low-risk commands directly; risky actions ask first.</small>
                    </div>
                    <button type="button" onClick={() => void onRunTests()} disabled={busyId === "test_all"} className="icon-action wide-action">
                      {busyId === "test_all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                      Test All
                    </button>
                  </div>
                  <div className="agent-command-row">
                    {quickCommands.map((command) => {
                      const Icon = command.icon;
                      return (
                        <button key={command.id} type="button" onClick={() => void onRunCommand(command.id)} disabled={busyId === command.id}>
                          {busyId === command.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                          {command.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="agent-target-row">
                    {approvedTargets.map(([target, label]) => (
                      <button key={target} type="button" onClick={() => void onRunCommand("open_allowlisted_target", { target }, `Open ${label}`)} disabled={busyId === "open_allowlisted_target"}>
                        <Lock className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="agent-panel">
                  <div className="agent-panel-head">
                    <div>
                      <span className="surface-subtitle">Current Abilities</span>
                      <small>{abilities.length} registered commands</small>
                    </div>
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="agent-ability-list">
                    {abilities.map((ability) => (
                      <div key={ability.id} className={`ability-row ${ability.risk} ${ability.test_status}`}>
                        <div>
                          <strong>{ability.label}</strong>
                          <span>{ability.category}</span>
                        </div>
                        <b>{ability.risk.replace("_", " ")}</b>
                        <small>{ability.test_status}</small>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activePanel === "memory" && (
              <section className="agent-panel">
                <div className="agent-panel-head">
                  <div>
                    <span className="surface-subtitle">Explicit Memory</span>
                    <small>Saved only when you ask Astra to remember something.</small>
                  </div>
                  <Database className="h-4 w-4" />
                </div>
                <div className="agent-form compact-form">
                  <select value={newMemoryCategory} onChange={(event) => onNewMemoryCategory(event.target.value as AgentMemoryCategory)}>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <input value={newMemoryText} onChange={(event) => onNewMemoryText(event.target.value)} placeholder="Memory text" />
                  <button type="button" onClick={() => void onSaveMemory()} disabled={!newMemoryText.trim() || busyId === "save_memory"}>
                    <Save className="h-4 w-4" />
                  </button>
                </div>
                {memoryEdit && (
                  <div className="agent-edit-row">
                    <select value={memoryEdit.category} onChange={(event) => onMemoryEditChange((item) => (item ? { ...item, category: event.target.value as AgentMemoryCategory } : item))}>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <input value={memoryEdit.text} onChange={(event) => onMemoryEditChange((item) => (item ? { ...item, text: event.target.value } : item))} />
                    <button type="button" onClick={() => void onSaveMemoryEdit()}>
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {memoryItems.length > 0 ? (
                  <div className="agent-list tall-list">
                    {memoryItems.map((item) => (
                    <div key={item.id} className="agent-list-row">
                      <div>
                        <strong>{item.category}</strong>
                        <span>{item.text}</span>
                      </div>
                      <button type="button" onClick={() => onEditMemory(item)} aria-label="Edit memory">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => onDeleteMemory(item)} aria-label="Delete memory">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    ))}
                  </div>
                ) : (
                  <AgentEmptyState icon={Database} title="No memories yet" text="Ask Astra to remember a course, project, goal, or preference." />
                )}
              </section>
            )}

            {activePanel === "documents" && (
              <section className="agent-panel">
                <div className="agent-panel-head">
                  <div>
                    <span className="surface-subtitle">PDF Documents</span>
                    <small>Upload text PDFs, then ask page-grounded questions.</small>
                  </div>
                  <FileUp className="h-4 w-4" />
                </div>
                <label className="file-upload-button">
                  <Upload className="h-4 w-4" />
                  Upload PDF
                  <input type="file" accept="application/pdf" onChange={(event) => void onUploadDocument(event.target.files?.[0] ?? null)} />
                </label>
                <div className="agent-form">
                  <select value={selectedDocumentId} onChange={(event) => onSelectedDocument(event.target.value)}>
                    <option value="">No document</option>
                    {documents.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title}
                      </option>
                    ))}
                  </select>
                  <input value={documentQuestion} onChange={(event) => onDocumentQuestion(event.target.value)} placeholder="Ask the PDF" />
                  <button type="button" onClick={() => void onAskDocument()} disabled={!selectedDocumentId || !documentQuestion.trim() || busyId === "ask_document"}>
                    <Search className="h-4 w-4" />
                  </button>
                </div>
                {documentAnswer && (
                  <div className="agent-answer">
                    <strong>{documentAnswer.document.title}</strong>
                    <span>Pages {documentAnswer.page_refs.join(", ") || "n/a"}</span>
                    <p>{documentAnswer.answer}</p>
                  </div>
                )}
                {documents.length > 0 ? (
                  <div className="agent-list tall-list">
                    {documents.map((document) => (
                    <div key={document.id} className="agent-list-row document-row">
                      <div>
                        <strong>{document.title}</strong>
                        <span>{document.page_count} pages</span>
                      </div>
                    </div>
                    ))}
                  </div>
                ) : (
                  <AgentEmptyState icon={FileUp} title="No PDFs uploaded" text="Upload a selectable-text PDF to unlock document Q&A." />
                )}
              </section>
            )}

            {activePanel === "study" && (
              <section className="agent-panel">
                <div className="agent-panel-head">
                  <div>
                    <span className="surface-subtitle">Study Tools</span>
                    <small>Create notes, flashcards, quizzes, and revision plans.</small>
                  </div>
                  <Brain className="h-4 w-4" />
                </div>
                <div className="agent-form">
                  <select value={studyType} onChange={(event) => onStudyType(event.target.value as StudyArtifactType)}>
                    {studyTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <input value={studyTopic} onChange={(event) => onStudyTopic(event.target.value)} placeholder="Topic" />
                  <button type="button" onClick={() => void onGenerateStudy()} disabled={!studyTopic.trim() || busyId === "generate_study_artifact"}>
                    <Wand2 className="h-4 w-4" />
                  </button>
                </div>
                {studyArtifacts.length > 0 ? (
                  <div className="agent-list tall-list">
                    {studyArtifacts.map((artifact) => (
                    <div key={artifact.id} className={`agent-list-row artifact-row ${artifact.id === selectedStudyArtifactId ? "active" : ""}`}>
                      <div>
                        <strong>{artifact.title}</strong>
                        <span>{artifact.artifact_type.replace("_", " ")}</span>
                      </div>
                      <button type="button" onClick={() => setSelectedStudyArtifactId(artifact.id)}>
                        {artifact.artifact_type === "quiz" ? <TestTube2 className="h-4 w-4" /> : artifact.artifact_type === "flashcards" ? <ClipboardCheck className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                        {studyArtifactActionLabel(artifact)}
                      </button>
                    </div>
                    ))}
                  </div>
                ) : (
                  <AgentEmptyState icon={Brain} title="No study artifacts" text="Generate your first study artifact from any topic." />
                )}
                {selectedStudyArtifact ? (
                  <StudyArtifactWorkspace artifact={selectedStudyArtifact} onClose={() => setSelectedStudyArtifactId(null)} />
                ) : studyArtifacts.length > 0 ? (
                  <div className="study-artifact-hint">
                    <BookOpen className="h-4 w-4" />
                    <span>Select a study artifact to read, practice, copy, or download it.</span>
                  </div>
                ) : null}
              </section>
            )}

            {activePanel === "mock_test" && (
              <MockTestPanel
                tests={mockTests}
                activeTest={activeMockTest}
                activeAttempt={activeMockAttempt}
                result={mockTestResult}
                answers={mockAnswers}
                remainingSeconds={mockRemainingSeconds}
                busy={busyId === "start_mock_test" || busyId === "submit_mock_test" || mockSubmitting}
                creating={busyId === "generate_mock_test"}
                onCreate={onCreateMockTest}
                onSelectTest={onSelectMockTest}
                onStart={onStartMockTest}
                onResume={onResumeMockTest}
                onQuestionIndex={onMockQuestionIndex}
                onRetry={onRetryMockTest}
              />
            )}

            {activePanel === "audit" && (
              <section className="agent-panel audit-panel">
                <div className="agent-panel-head">
                  <div>
                    <span className="surface-subtitle">Recent Executions</span>
                    <small>Every executed, blocked, and confirmation-required action is logged.</small>
                  </div>
                  <History className="h-4 w-4" />
                </div>
                {audit.length > 0 ? (
                  <div className="agent-list tall-list">
                    {audit.map((entry) => {
                      const resolutionSummary = formatAuditResolution(entry.resolution);
                      return (
                        <div key={entry.id} className={`agent-list-row audit-row ${entry.outcome}`}>
                          <div>
                            <strong>{entry.label || entry.command_id}</strong>
                            <span>{entry.message}</span>
                            {resolutionSummary && <small className="agent-audit-meta">{resolutionSummary}</small>}
                          </div>
                          <b>{entry.outcome.replace("_", " ")}</b>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <AgentEmptyState icon={History} title="No audit entries" text="Run an agent command to create the first log entry." />
                )}
              </section>
            )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

type StudyPracticeMode = "read" | "quiz" | "flashcards";

type StudyQuizQuestion = {
  id: string;
  number: number;
  prompt: string;
  options: string[];
  answerIndex: number | null;
  explanation: string;
};

type StudyFlashcard = {
  id: string;
  front: string;
  back: string;
};

function StudyArtifactWorkspace({ artifact, onClose }: { artifact: StudyArtifact; onClose: () => void }) {
  const quizQuestions = useMemo(() => parseStudyQuiz(artifact.markdown), [artifact.markdown]);
  const flashcards = useMemo(() => parseStudyFlashcards(artifact.markdown), [artifact.markdown]);
  const defaultMode: StudyPracticeMode =
    artifact.artifact_type === "quiz" && quizQuestions.length > 0
      ? "quiz"
      : artifact.artifact_type === "flashcards" && flashcards.length > 0
        ? "flashcards"
        : "read";
  const [mode, setMode] = useState<StudyPracticeMode>(defaultMode);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMode(defaultMode);
    setCopied(false);
  }, [artifact.id, defaultMode]);

  const copyArtifact = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(artifact.markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }, [artifact.markdown]);

  return (
    <section className="study-workspace">
      <header className="study-workspace-head">
        <div>
          <span className="surface-title">{artifact.artifact_type.replace("_", " ")}</span>
          <strong>{artifact.title}</strong>
          <small>{artifact.source || "topic"} / {new Date(artifact.created_at).toLocaleString()}</small>
        </div>
        <div className="study-workspace-actions">
          <button type="button" onClick={() => void copyArtifact()}>
            <ClipboardCheck className="h-4 w-4" />
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={() => downloadStudyArtifact(artifact)}>
            <Download className="h-4 w-4" />
            Markdown
          </button>
          <button type="button" onClick={onClose} aria-label="Close study artifact">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="study-mode-tabs">
        <button type="button" className={mode === "read" ? "active" : ""} onClick={() => setMode("read")}>
          <BookOpen className="h-4 w-4" />
          Read
        </button>
        {quizQuestions.length > 0 && (
          <button type="button" className={mode === "quiz" ? "active" : ""} onClick={() => setMode("quiz")}>
            <TestTube2 className="h-4 w-4" />
            Quiz
          </button>
        )}
        {flashcards.length > 0 && (
          <button type="button" className={mode === "flashcards" ? "active" : ""} onClick={() => setMode("flashcards")}>
            <ClipboardCheck className="h-4 w-4" />
            Flashcards
          </button>
        )}
      </div>

      {mode === "quiz" && quizQuestions.length > 0 ? (
        <StudyQuizPractice artifactId={artifact.id} questions={quizQuestions} />
      ) : mode === "flashcards" && flashcards.length > 0 ? (
        <StudyFlashcardPractice artifactId={artifact.id} cards={flashcards} />
      ) : (
        <StudyMarkdown markdown={artifact.markdown} />
      )}
    </section>
  );
}

function StudyQuizPractice({ artifactId, questions }: { artifactId: string; questions: StudyQuizQuestion[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const activeQuestion = questions[Math.min(activeIndex, questions.length - 1)];
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;
  const score = questions.reduce((total, question) => total + (question.answerIndex !== null && answers[question.id] === question.answerIndex ? 1 : 0), 0);

  useEffect(() => {
    setActiveIndex(0);
    setAnswers({});
    setSubmitted(false);
  }, [artifactId]);

  const reset = () => {
    setActiveIndex(0);
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="study-practice">
      <div className="study-practice-bar">
        <Metric label="Questions" value={questions.length} icon={TestTube2} />
        <Metric label="Answered" value={answeredCount} icon={CheckCircle2} />
        <Metric label="Score" value={submitted ? `${score}/${questions.length}` : "--"} icon={Trophy} />
      </div>

      <article className="study-quiz-card">
        <div className="study-quiz-head">
          <span>Question {activeIndex + 1} of {questions.length}</span>
          {submitted && activeQuestion.answerIndex !== null && (
            <b>{answers[activeQuestion.id] === activeQuestion.answerIndex ? "Correct" : "Review"}</b>
          )}
        </div>
        <strong>{activeQuestion.prompt}</strong>
        <div className="study-quiz-options">
          {activeQuestion.options.map((option, optionIndex) => {
            const selected = answers[activeQuestion.id] === optionIndex;
            const correct = submitted && activeQuestion.answerIndex === optionIndex;
            const wrong = submitted && selected && activeQuestion.answerIndex !== optionIndex;
            return (
              <button
                key={`${activeQuestion.id}-${optionIndex}`}
                type="button"
                className={`${selected ? "selected" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`}
                onClick={() => {
                  if (!submitted) setAnswers((current) => ({ ...current, [activeQuestion.id]: optionIndex }));
                }}
              >
                <span>{String.fromCharCode(65 + optionIndex)}</span>
                <b>{option}</b>
              </button>
            );
          })}
        </div>
        {submitted && activeQuestion.explanation && <p className="study-explanation">{activeQuestion.explanation}</p>}
      </article>

      <footer className="study-practice-actions">
        <button type="button" onClick={() => setActiveIndex((current) => Math.max(0, current - 1))} disabled={activeIndex === 0}>
          Previous
        </button>
        <button type="button" onClick={() => setActiveIndex((current) => Math.min(questions.length - 1, current + 1))} disabled={activeIndex === questions.length - 1}>
          Next
        </button>
        {submitted ? (
          <button type="button" className="primary-action" onClick={reset}>
            Retry
          </button>
        ) : (
          <button type="button" className="primary-action" onClick={() => setSubmitted(true)} disabled={answeredCount === 0}>
            Submit
          </button>
        )}
      </footer>

      {submitted && (
        <div className="study-review-list">
          {questions.map((question, index) => (
            <button key={question.id} type="button" className={answers[question.id] === question.answerIndex ? "correct" : "wrong"} onClick={() => setActiveIndex(index)}>
              <span>Q{index + 1}</span>
              <strong>{question.answerIndex === null ? "No key" : String.fromCharCode(65 + question.answerIndex)}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StudyFlashcardPractice({ artifactId, cards }: { artifactId: string; cards: StudyFlashcard[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<Record<string, "again" | "known">>({});
  const activeCard = cards[Math.min(activeIndex, cards.length - 1)];
  const knownCount = Object.values(ratings).filter((rating) => rating === "known").length;
  const reviewCount = Object.values(ratings).filter((rating) => rating === "again").length;

  useEffect(() => {
    setActiveIndex(0);
    setRevealed(false);
    setRatings({});
  }, [artifactId]);

  const moveCard = (nextIndex: number) => {
    setActiveIndex(Math.max(0, Math.min(cards.length - 1, nextIndex)));
    setRevealed(false);
  };

  const rateCard = (rating: "again" | "known") => {
    setRatings((current) => ({ ...current, [activeCard.id]: rating }));
    if (activeIndex < cards.length - 1) {
      moveCard(activeIndex + 1);
    } else {
      setRevealed(true);
    }
  };

  return (
    <div className="study-practice">
      <div className="study-practice-bar">
        <Metric label="Cards" value={cards.length} icon={ClipboardCheck} />
        <Metric label="Known" value={knownCount} icon={CheckCircle2} />
        <Metric label="Review" value={reviewCount} icon={RotateCcw} />
      </div>

      <article className={`study-flashcard ${revealed ? "revealed" : ""}`}>
        <div className="study-quiz-head">
          <span>Card {activeIndex + 1} of {cards.length}</span>
          {ratings[activeCard.id] && <b>{ratings[activeCard.id] === "known" ? "Known" : "Review"}</b>}
        </div>
        <div>
          <small>Front</small>
          <strong>{activeCard.front}</strong>
        </div>
        {revealed ? (
          <div>
            <small>Back</small>
            <p>{activeCard.back}</p>
          </div>
        ) : (
          <button type="button" className="primary-action reveal-action" onClick={() => setRevealed(true)}>
            Reveal Answer
          </button>
        )}
      </article>

      <footer className="study-practice-actions">
        <button type="button" onClick={() => moveCard(activeIndex - 1)} disabled={activeIndex === 0}>
          Previous
        </button>
        <button type="button" onClick={() => moveCard(activeIndex + 1)} disabled={activeIndex === cards.length - 1}>
          Next
        </button>
        <button type="button" onClick={() => rateCard("again")} disabled={!revealed}>
          Review
        </button>
        <button type="button" className="primary-action" onClick={() => rateCard("known")} disabled={!revealed}>
          Got It
        </button>
      </footer>
    </div>
  );
}

function StudyMarkdown({ markdown }: { markdown: string }) {
  const nodes: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    nodes.push(<p key={`p-${nodes.length}`}>{paragraph.join(" ")}</p>);
    paragraph = [];
  };

  markdown.split(/\r?\n/).forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        nodes.push(<pre key={`code-${nodes.length}`}>{code.join("\n")}</pre>);
        code = [];
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
      }
      return;
    }
    if (inCode) {
      code.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      return;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 4);
      const text = stripMarkdown(heading[2]);
      if (level === 1) nodes.push(<h2 key={`h-${nodes.length}`}>{text}</h2>);
      if (level === 2) nodes.push(<h3 key={`h-${nodes.length}`}>{text}</h3>);
      if (level === 3) nodes.push(<h4 key={`h-${nodes.length}`}>{text}</h4>);
      if (level >= 4) nodes.push(<h5 key={`h-${nodes.length}`}>{text}</h5>);
      return;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      nodes.push(<div key={`b-${nodes.length}`} className="study-markdown-bullet">{stripMarkdown(bullet[1])}</div>);
      return;
    }
    paragraph.push(stripMarkdown(trimmed));
  });
  flushParagraph();
  if (code.length > 0) nodes.push(<pre key={`code-${nodes.length}`}>{code.join("\n")}</pre>);

  return <div className="study-markdown">{nodes.length > 0 ? nodes : <p>No study content was generated.</p>}</div>;
}

function studyArtifactActionLabel(artifact: StudyArtifact) {
  if (artifact.artifact_type === "quiz") return "Start";
  if (artifact.artifact_type === "flashcards") return "Practice";
  return "Open";
}

function parseStudyQuiz(markdown: string): StudyQuizQuestion[] {
  const [body, answerSection = ""] = markdown.split(/#+\s*Answer Key/i);
  const answerMap = new Map<number, { index: number; explanation: string }>();
  for (const line of answerSection.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)[.)]\s+\**([A-D])\**\s*(?:[-:)]\s*)?(.*)$/i);
    if (match) {
      answerMap.set(Number(match[1]), {
        index: match[2].toUpperCase().charCodeAt(0) - 65,
        explanation: stripMarkdown(match[3] || ""),
      });
    }
  }

  const questions: Array<StudyQuizQuestion & { promptLines: string[] }> = [];
  let current: (StudyQuizQuestion & { promptLines: string[] }) | null = null;

  const commit = () => {
    if (!current || current.options.length < 2) return;
    const answer = answerMap.get(current.number);
    questions.push({
      ...current,
      prompt: current.promptLines.join("\n").trim(),
      answerIndex: answer?.index ?? null,
      explanation: answer?.explanation ?? "",
    });
  };

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^---+$/.test(line) || /^#{1,4}\s+/.test(line)) continue;

    const questionMatch = line.match(/^\**\s*(\d+)[.)]\s*(.+?)\**\s*$/);
    if (questionMatch && !/part\s+\d+|overview|format|level/i.test(questionMatch[2])) {
      commit();
      current = {
        id: `q-${questionMatch[1]}`,
        number: Number(questionMatch[1]),
        prompt: "",
        promptLines: [stripMarkdown(questionMatch[2])],
        options: [],
        answerIndex: null,
        explanation: "",
      };
      continue;
    }

    if (!current) continue;
    const optionMatch = line.match(/^([A-D])[.)]\s+(.+)$/i);
    if (optionMatch) {
      current.options[optionMatch[1].toUpperCase().charCodeAt(0) - 65] = stripMarkdown(optionMatch[2]);
    } else if (!/^```/.test(line)) {
      current.promptLines.push(stripMarkdown(line));
    }
  }
  commit();

  return questions.map((question) => ({
    id: question.id,
    number: question.number,
    prompt: question.prompt,
    options: question.options.filter(Boolean),
    answerIndex: question.answerIndex,
    explanation: question.explanation,
  }));
}

function parseStudyFlashcards(markdown: string): StudyFlashcard[] {
  const cards: StudyFlashcard[] = [];
  let front: string[] = [];
  let back: string[] = [];
  let side: "front" | "back" | null = null;

  const pushCard = () => {
    const cleanFront = front.join("\n").trim();
    const cleanBack = back.join("\n").trim();
    if (cleanFront && cleanBack) {
      cards.push({ id: `card-${cards.length + 1}`, front: stripMarkdown(cleanFront), back: stripMarkdown(cleanBack) });
    }
    front = [];
    back = [];
    side = null;
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^#{1,4}\s+/.test(line) || /^---+$/.test(line)) continue;
    const labelMatch = line.match(/^(?:[-*]\s*)?(?:\*\*)?(front|back|question|answer|q|a)(?:\s*\d+)?(?:\*\*)?\s*[:.-]\s*(.*)$/i);
    if (labelMatch) {
      const label = labelMatch[1].toLowerCase();
      const value = labelMatch[2].trim();
      if (["front", "question", "q"].includes(label)) {
        if (front.length > 0 && back.length > 0) pushCard();
        side = "front";
        if (value) front.push(value);
      } else {
        side = "back";
        if (value) back.push(value);
      }
      continue;
    }
    if (side === "front") front.push(line);
    if (side === "back") back.push(line);
  }
  pushCard();

  if (cards.length > 0) return cards;

  return markdown
    .split(/\n(?=#{2,3}\s+)/)
    .map((block, index) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const heading = lines[0]?.replace(/^#{2,3}\s+/, "");
      const body = lines.slice(1).join("\n");
      if (!heading || !body) return null;
      return { id: `card-${index + 1}`, front: stripMarkdown(heading), back: stripMarkdown(body) };
    })
    .filter((card): card is StudyFlashcard => Boolean(card));
}

function stripMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/, "")
    .trim();
}

function downloadStudyArtifact(artifact: StudyArtifact) {
  const blob = new Blob([artifact.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "study-artifact"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MockTestPanel({
  tests,
  activeTest,
  activeAttempt,
  result,
  answers,
  remainingSeconds,
  busy,
  creating,
  onCreate,
  onSelectTest,
  onStart,
  onResume,
  onQuestionIndex,
  onRetry,
}: {
  tests: MockTest[];
  activeTest: MockTest | null;
  activeAttempt: MockAttempt | null;
  result: MockTestSubmitResponse | null;
  answers: Record<string, number>;
  remainingSeconds: number;
  busy: boolean;
  creating: boolean;
  onCreate: (input: MockTestCreateInput) => Promise<boolean>;
  onSelectTest: (test: MockTest) => void;
  onStart: (test?: MockTest) => Promise<void>;
  onResume: () => void;
  onQuestionIndex: (index: number) => void;
  onRetry: () => void;
}) {
  const test = activeTest ?? tests[0] ?? null;
  const isActive = Boolean(test && activeAttempt?.status === "active" && !result);
  const answeredCount = test ? test.questions.filter((item) => answers[item.id] !== undefined).length : 0;
  const totalSeconds = (test?.duration_minutes ?? 20) * 60;
  const displaySeconds = isActive ? remainingSeconds : totalSeconds;
  const [showCreate, setShowCreate] = useState(tests.length === 0);
  const [topic, setTopic] = useState("");
  const [exam, setExam] = useState("");
  const [subject, setSubject] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [difficulty, setDifficulty] = useState<MockTestDifficulty>("mixed");
  const [sourceRequirement, setSourceRequirement] = useState<MockTestSourceRequirement>("none");
  const canCreate = topic.trim().length > 0 && !creating;

  useEffect(() => {
    if (tests.length === 0) setShowCreate(true);
  }, [tests.length]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;
    const created = await onCreate({
      topic,
      questionCount,
      difficulty,
      durationMinutes,
      sourceRequirement,
      exam,
      subject,
    });
    if (created) {
      setTopic("");
      setExam("");
      setSubject("");
      setShowCreate(false);
    }
  };

  return (
    <section className="agent-panel mock-test-panel">
      <div className="agent-panel-head">
        <div>
          <span className="surface-subtitle">Mock Test</span>
          <small>Agent-generated MCQ practice with timer and review.</small>
        </div>
        <TestTube2 className="h-4 w-4" />
      </div>

      <div className="mock-test-toolbar">
        <div>
          <span className="surface-title">Saved Tests</span>
          <small>{tests.length} available</small>
        </div>
        <button type="button" onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? "Close" : "Create New"}
        </button>
      </div>

      {showCreate && (
        <form className="mock-create-form" onSubmit={(event) => void handleCreate(event)}>
          <div className="mock-create-primary">
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic, chapter, or exam area" />
            <button type="submit" className="mock-primary-action" disabled={!canCreate}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Create
            </button>
          </div>
          <div className="mock-create-grid">
            <label>
              <span>Questions</span>
              <input type="number" min={1} max={50} value={questionCount} onChange={(event) => setQuestionCount(Math.round(clampNumber(event.target.valueAsNumber, 1, 50, 10)))} />
            </label>
            <label>
              <span>Duration</span>
              <input type="number" min={1} max={180} value={durationMinutes} onChange={(event) => setDurationMinutes(Math.round(clampNumber(event.target.valueAsNumber, 1, 180, 20)))} />
            </label>
            <label>
              <span>Difficulty</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as MockTestDifficulty)}>
                <option value="mixed">mixed</option>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </label>
            <label>
              <span>Source</span>
              <select value={sourceRequirement} onChange={(event) => setSourceRequirement(event.target.value as MockTestSourceRequirement)}>
                <option value="none">topic practice</option>
                <option value="source_backed">uploaded docs</option>
                <option value="pyq_required">PYQ required</option>
              </select>
            </label>
            <label>
              <span>Exam</span>
              <input value={exam} onChange={(event) => setExam(event.target.value)} placeholder="Optional" />
            </label>
            <label>
              <span>Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Optional" />
            </label>
          </div>
        </form>
      )}

      {test ? (
        <>
          <div className="mock-test-shell">
            <div className="mock-test-hero">
              <div>
                <span className="surface-title">{result ? "Results" : isActive ? "Active Test" : "Preview"}</span>
                <strong>{test.topic}</strong>
                <small>{mockTestSourceLabel(test)}</small>
              </div>
              <div className="mock-test-timer">
                <Timer className="h-4 w-4" />
                <strong>{formatTimer(displaySeconds)}</strong>
                <span>{isActive ? "remaining" : "duration"}</span>
              </div>
            </div>

            <div className="mock-test-metrics">
              <Metric label="Mode" value="MCQ" />
              <Metric label="Difficulty" value={test.difficulty} />
              <Metric label="Questions" value={test.question_count} />
              <Metric label="Answered" value={answeredCount} />
            </div>

            <div className="mock-test-blueprint">
              {(test.exam || test.subject) && <span>{[test.exam, test.subject].filter(Boolean).join(" / ")}</span>}
              {test.syllabus_units?.slice(0, 4).map((unit) => (
                <span key={unit}>{unit}</span>
              ))}
              {test.quality_score > 0 && <span>{Math.round(test.quality_score * 100)}% quality gate</span>}
            </div>

            {!isActive && !result && (
              <div className="mock-test-preview">
                <div className="mock-test-list compact">
                  {test.questions.slice(0, 5).map((item, index) => (
                    <button key={item.id} type="button" onClick={() => onQuestionIndex(index)}>
                      <span>Q{index + 1}</span>
                      <strong>{item.prompt}</strong>
                      <small>{item.difficulty}</small>
                    </button>
                  ))}
                </div>
                <button type="button" className="mock-primary-action" onClick={() => void onStart(test)} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Start Test
                </button>
              </div>
            )}

            {isActive && (
              <div className="mock-test-resume-card">
                <div>
                  <span className="surface-title">Test In Progress</span>
                  <strong>{answeredCount}/{test.questions.length} answered</strong>
                  <small>Continue in the dedicated full-screen test workspace.</small>
                </div>
                <button type="button" className="mock-primary-action" onClick={onResume}>
                  <Play className="h-4 w-4" />
                  Resume Full Screen
                </button>
              </div>
            )}

            {result && (
              <div className="mock-test-resume-card result">
                <div className="mock-score-card">
                  <Trophy className="h-5 w-5" />
                  <strong>{result.score}/{result.total}</strong>
                  <span>{Math.round(result.percentage)}% score</span>
                  <small>{formatTimer(result.elapsed_seconds)} taken</small>
                </div>
                <div>
                  <span className="surface-title">Review Ready</span>
                  <strong>Open the full-screen review</strong>
                  <small>See answers, correct options, and explanations in the exam workspace.</small>
                  <div className="mock-test-actions">
                    <button type="button" className="mock-primary-action" onClick={onResume}>
                      <Trophy className="h-4 w-4" />
                      Open Review
                    </button>
                    <button type="button" onClick={onRetry}>
                      <RotateCcw className="h-4 w-4" />
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {tests.length > 0 && (
            <div className="mock-test-history">
              <div className="mock-test-history-head">
                <span className="surface-title">Old Mock Tests</span>
                <small>Open any saved mock and start it from here.</small>
              </div>
              {tests.slice(0, 6).map((item) => (
                <div key={item.id} className={`mock-test-history-row ${item.id === test.id ? "active" : ""}`}>
                  <button type="button" className="mock-test-history-main" onClick={() => onSelectTest(item)}>
                    <span>{item.question_count}Q</span>
                    <div>
                      <strong>{item.topic}</strong>
                      <small>{item.difficulty} / {item.duration_minutes} min / {formatShortDate(item.created_at)}</small>
                    </div>
                  </button>
                  <button type="button" className="mock-test-history-start" onClick={() => void onStart(item)} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Start
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <AgentEmptyState icon={TestTube2} title="No mock tests yet" text="Create a new mock test from the form above." />
      )}
    </section>
  );
}

function mockTestSourceLabel(test: MockTest) {
  if (test.generation_mode === "pyq_style") {
    return "PYQ-style · exam-pattern";
  }
  if (test.generation_mode === "profile_based") {
    return "Profile-based syllabus";
  }
  if (test.generation_mode === "syllabus_based") {
    return "Syllabus-based";
  }
  if (test.generation_mode === "llm_planned") {
    return "AI-planned syllabus";
  }
  if (test.generation_mode === "source_backed_pyq") {
    return "Source-backed PYQ";
  }
  if (test.source_requirement === "pyq_required") {
    return (test.sources?.length ?? 0) > 0 ? "PYQ required - source-backed" : "PYQ required";
  }
  if (test.source_requirement === "source_backed" || test.source === "source_backed") {
    return "Source-backed question set";
  }
  return "Generated by Agent";
}

function MockTestFullscreen({
  test,
  attempt,
  result,
  answers,
  reviewMarks,
  questionIndex,
  remainingSeconds,
  busy,
  onAnswer,
  onToggleReview,
  onQuestionIndex,
  onSubmit,
  onRetry,
  onClose,
}: {
  test: MockTest;
  attempt: MockAttempt | null;
  result: MockTestSubmitResponse | null;
  answers: Record<string, number>;
  reviewMarks: Record<string, boolean>;
  questionIndex: number;
  remainingSeconds: number;
  busy: boolean;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onToggleReview: (questionId: string) => void;
  onQuestionIndex: (index: number) => void;
  onSubmit: (auto?: boolean) => Promise<void>;
  onRetry: () => void;
  onClose: () => void;
}) {
  const activeQuestionIndex = Math.min(Math.max(questionIndex, 0), Math.max(0, test.questions.length - 1));
  const question = test.questions[activeQuestionIndex];
  const answeredCount = test.questions.filter((item) => answers[item.id] !== undefined).length;
  const markedCount = test.questions.filter((item) => reviewMarks[item.id]).length;
  const isSubmitted = Boolean(result || attempt?.status === "submitted");
  const progress = test.questions.length ? Math.round((answeredCount / test.questions.length) * 100) : 0;

  return (
    <div className="mock-exam-screen" role="dialog" aria-modal="true" aria-label="Mock test exam">
      <header className="mock-exam-topbar">
        <div>
          <span>Astra Mock Test</span>
          <strong>{test.topic}</strong>
          <small>{mockTestSourceLabel(test)}</small>
        </div>
        <div className="mock-exam-top-actions">
          <div className={`mock-exam-clock ${remainingSeconds <= 120 && !isSubmitted ? "urgent" : ""}`}>
            <Timer className="h-4 w-4" />
            <strong>{formatTimer(isSubmitted ? result?.elapsed_seconds ?? 0 : remainingSeconds)}</strong>
            <span>{isSubmitted ? "taken" : "remaining"}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={isSubmitted ? "Close mock test" : "Minimize mock test"}>
            <X className="h-4 w-4" />
            {isSubmitted ? "Close" : "Minimize"}
          </button>
        </div>
      </header>

      <main className="mock-exam-body">
        <aside className="mock-exam-sidebar">
          <div className="mock-exam-status">
            <span>Progress</span>
            <strong>{progress}%</strong>
            <div className="mock-exam-progress" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="mock-exam-stats">
            <Metric label="Questions" value={test.question_count} />
            <Metric label="Answered" value={answeredCount} />
            <Metric label="Review" value={markedCount} />
            <Metric label="Mode" value="MCQ" />
          </div>
          <div className="mock-exam-palette" aria-label="Question palette">
            {test.questions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`${index === activeQuestionIndex ? "active" : ""} ${answers[item.id] !== undefined ? "answered" : ""} ${reviewMarks[item.id] ? "review" : ""}`}
                onClick={() => onQuestionIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </aside>

        {result ? (
          <section className="mock-exam-results">
            <div className="mock-exam-result-hero">
              <Trophy className="h-6 w-6" />
              <span>Score</span>
              <strong>{result.score}/{result.total}</strong>
              <p>{Math.round(result.percentage)}% accuracy in {formatTimer(result.elapsed_seconds)}</p>
              <button type="button" onClick={onRetry}>
                <RotateCcw className="h-4 w-4" />
                Retry Test
              </button>
            </div>
            <div className="mock-exam-review">
              {result.review.map((item, index) => (
                <article key={item.id} className={`mock-exam-review-card ${item.is_correct ? "correct" : "wrong"}`}>
                  <div>
                    <span>Q{index + 1}</span>
                    <strong>{item.prompt}</strong>
                    <p>Your answer: {item.selected_option_index === null ? "Not answered" : `${String.fromCharCode(65 + item.selected_option_index)}. ${item.options[item.selected_option_index]}`}</p>
                    <p>Correct: {String.fromCharCode(65 + item.correct_option_index)}. {item.options[item.correct_option_index]}</p>
                    <small>{item.explanation}</small>
                  </div>
                  {item.is_correct ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="mock-exam-question-area">
            <div className="mock-exam-question-card">
              <div className="mock-exam-question-head">
                <span>Question {activeQuestionIndex + 1} of {test.questions.length}</span>
                <b>{question.difficulty}</b>
              </div>
              <strong>{question.prompt}</strong>
              <div className="mock-exam-options">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={`${question.id}-${optionIndex}`}
                    type="button"
                    className={answers[question.id] === optionIndex ? "selected" : ""}
                    onClick={() => onAnswer(question.id, optionIndex)}
                  >
                    <span>{String.fromCharCode(65 + optionIndex)}</span>
                    <b>{option}</b>
                  </button>
                ))}
              </div>
            </div>
            <footer className="mock-exam-footer">
              <button type="button" onClick={() => onQuestionIndex(Math.max(0, activeQuestionIndex - 1))} disabled={activeQuestionIndex === 0}>
                Previous
              </button>
              <button type="button" className={reviewMarks[question.id] ? "marked" : ""} onClick={() => onToggleReview(question.id)}>
                Mark Review
              </button>
              <button type="button" onClick={() => onQuestionIndex(Math.min(test.questions.length - 1, activeQuestionIndex + 1))} disabled={activeQuestionIndex === test.questions.length - 1}>
                Next
              </button>
              <button type="button" className="mock-exam-submit" onClick={() => void onSubmit(false)} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Submit Test
              </button>
            </footer>
          </section>
        )}
      </main>
    </div>
  );
}

function formatAuditResolution(resolution: Record<string, unknown>) {
  const source = typeof resolution.source === "string" ? resolution.source : "";
  if (!source) return "";
  const matchedAlias = typeof resolution.matched_alias === "string" ? resolution.matched_alias : "";
  const confidence = typeof resolution.confidence === "number" ? `${Math.round(resolution.confidence * 100)}%` : "";
  const secondBest = typeof resolution.second_best === "number" ? `second ${Math.round(resolution.second_best * 100)}%` : "";
  return [source, matchedAlias, confidence, secondBest].filter(Boolean).join(" · ");
}

function AgentEmptyState({ icon, title, text }: { icon: IconType; title: string; text: string }) {
  const Icon = icon;
  return (
    <div className="agent-empty-state">
      <div className="row-icon">
        <Icon className="h-4 w-4" />
      </div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function isLongTranscriptText(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).length;
  return lines > 5 || text.length > 360;
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "saved";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function clampNumber(value: number, min: number, max: number, fallback?: number) {
  const safeValue = Number.isFinite(value) ? value : fallback ?? min;
  return Math.min(max, Math.max(min, safeValue));
}

function normalizeSpeechText(text: string) {
  return text.replace(/\s+/g, " ").replace(/\*\*/g, "").trim();
}

function splitSpeechPiece(piece: string, maxLength: number) {
  if (piece.length <= maxLength) return [piece];
  const segments: string[] = [];
  let current = "";

  for (const word of piece.split(/\s+/)) {
    if (!word) continue;
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxLength) {
      segments.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) segments.push(current);
  return segments.length ? segments : [piece];
}

function chunkSpeechText(text: string, firstMaxLength = 180, maxLength = 360) {
  const cleanText = normalizeSpeechText(text);
  if (!cleanText) return [""];
  const phrases = cleanText.match(/[^.!?;:]+[.!?;:]?/g) ?? [cleanText];
  const chunks: string[] = [];
  let current = "";
  const pushCurrent = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };
  const appendPiece = (piece: string) => {
    const trimmed = piece.trim();
    if (!trimmed) return;
    const limit = chunks.length === 0 ? firstMaxLength : maxLength;
    const smallerPieces = splitSpeechPiece(trimmed, limit);
    if (smallerPieces.length > 1) {
      smallerPieces.forEach(appendPiece);
      return;
    }

    if (current && `${current} ${trimmed}`.length > limit) {
      pushCurrent();
    }
    if (!current && trimmed.length > limit) {
      chunks.push(trimmed);
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  };

  phrases.forEach(appendPiece);
  pushCurrent();
  return chunks.length ? chunks : [cleanText];
}

function isSpeechWordChar(char: string) {
  return /[a-zA-Z0-9']/.test(char);
}

function getWordAt(text: string, charIndex: number) {
  if (!text) return "";
  const boundedIndex = Math.max(0, Math.min(text.length - 1, charIndex));
  let start = boundedIndex;
  let end = boundedIndex;

  while (start > 0 && isSpeechWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isSpeechWordChar(text[end])) end += 1;

  const word = text.slice(start, end).trim();
  if (word) return word;
  return text.slice(boundedIndex).match(/[a-zA-Z0-9']+/)?.[0] ?? text.match(/[a-zA-Z0-9']+/)?.[0] ?? "";
}

function estimateSpeechDurationMs(text: string, rate: number) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const phrasePauses = (text.match(/[,;:]/g)?.length ?? 0) * 120;
  const sentencePauses = (text.match(/[.!?]/g)?.length ?? 0) * 270;
  const baseDuration = (words / 2.65) * 1000;
  return Math.max(900, (baseDuration + phrasePauses + sentencePauses) / Math.max(0.5, rate));
}

function estimateWordEnergy(word: string) {
  const clean = word.replace(/[^a-zA-Z0-9]/g, "");
  if (!clean) return 0.18;
  const vowels = clean.match(/[aeiou]/gi)?.length ?? 0;
  const plosives = clean.match(/[bdfgkpt]/gi)?.length ?? 0;
  const emphasized = /[A-Z]{2,}/.test(word) ? 0.16 : 0;
  return clampNumber(0.46 + Math.min(0.34, clean.length * 0.035) + Math.min(0.22, vowels * 0.04) + Math.min(0.16, plosives * 0.032) + emphasized, 0.26, 1.22);
}

function estimateWordPitch(word: string, text: string, charIndex: number) {
  const clean = word.replace(/[^a-zA-Z]/g, "");
  const vowelRatio = clean ? (clean.match(/[aeiou]/gi)?.length ?? 0) / clean.length : 0.25;
  const nearbyText = text.slice(charIndex, charIndex + 50);
  const questionLift = nearbyText.includes("?") ? 0.12 : 0;
  const finalFall = /[.!]/.test(text[Math.max(0, charIndex - 1)] ?? "") ? -0.1 : 0;
  const wordTexture = ((word.length % 5) - 2) * 0.018;
  return clampNumber(0.9 + vowelRatio * 0.3 + questionLift + finalFall + wordTexture, 0.78, 1.28);
}

function previousNonSpaceChar(text: string, charIndex: number) {
  for (let index = Math.max(0, charIndex - 1); index >= 0; index -= 1) {
    if (text[index].trim()) return text[index];
  }
  return "";
}

function getSpeechFrame(cue: SpeechCue | null, now: number) {
  if (!cue) {
    return { energy: 0.72, pitch: 1, wordAge: now % 420 };
  }

  const elapsed = Math.max(0, now - cue.startedAt);
  const fallbackProgress = clampNumber(elapsed / cue.estimatedDuration, 0, 1);
  const fallbackChar = Math.floor(fallbackProgress * cue.text.length);
  const currentChar = cue.hasBoundary ? cue.currentChar : fallbackChar;
  const currentWord = cue.hasBoundary ? cue.currentWord : getWordAt(cue.text, currentChar);
  const wordAge = cue.hasBoundary ? now - cue.boundaryAt : elapsed % Math.max(220, currentWord.length * 58);
  const previousChar = previousNonSpaceChar(cue.text, currentChar);
  const nextChar = cue.text[currentChar] ?? "";
  const pauseMs =
    cue.boundaryType === "sentence" || /[.!?]/.test(previousChar)
      ? 380
      : /[,;:]/.test(previousChar)
        ? 190
        : /\s/.test(nextChar)
          ? 70
          : 0;
  const pauseFactor = pauseMs > 0 && wordAge < pauseMs ? clampNumber(wordAge / pauseMs, 0.12, 1) : 1;
  const attack = clampNumber(wordAge / 120, 0.2, 1);
  const mouthPulse = 0.86 + Math.sin(wordAge * 0.036) * 0.14;
  const endFade = clampNumber((cue.estimatedDuration - elapsed) / 360, 0.24, 1);
  const energy = estimateWordEnergy(currentWord) * pauseFactor * attack * mouthPulse * endFade;

  return {
    energy: clampNumber(energy, 0.05, 1.35),
    pitch: estimateWordPitch(currentWord, cue.text, currentChar),
    wordAge,
  };
}

function NavButton({ icon, label, active, onClick }: { icon: IconType; label: string; active: boolean; onClick: () => void }) {
  const Icon = icon;
  return (
    <button type="button" onClick={onClick} className={`nav-button ${active ? "active" : ""}`}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function MiniWave({ active, tone }: { active: boolean; tone: "listening" | "talking" }) {
  return (
    <div className={`mini-wave ${active ? "active" : ""} ${tone}`}>
      {Array.from({ length: 18 }).map((_, index) => (
        <span key={index} style={{ ["--i" as string]: index }} />
      ))}
    </div>
  );
}

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function VoiceWaveformCanvas({
  mode,
  stream,
  speechCue,
  speechAnalyser,
}: {
  mode: VoiceState;
  stream: MediaStream | null;
  speechCue: SpeechCue | null;
  speechAnalyser: AnalyserNode | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speechCueRef = useRef<SpeechCue | null>(speechCue);
  const speechAnalyserRef = useRef<AnalyserNode | null>(speechAnalyser);

  useEffect(() => {
    speechCueRef.current = speechCue;
  }, [speechCue]);

  useEffect(() => {
    speechAnalyserRef.current = speechAnalyser;
  }, [speechAnalyser]);

  useEffect(() => {
    if (!stream) {
      analyserRef.current = null;
      return;
    }

    const AudioContextCtor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.68;
    source.connect(analyser);
    analyserRef.current = analyser;

    return () => {
      analyserRef.current = null;
      source.disconnect();
      void audioContext.close();
    };
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let animationFrame = 0;
    const waveform = new Uint8Array(2048);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const burst = (x: number, center: number, width: number) => Math.exp(-Math.pow((x - center) / width, 2));

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const centerY = height * 0.5;
      const analyser = analyserRef.current;
      const isListening = mode === "listening";
      const isSpeaking = mode === "speaking";
      const isThinking = mode === "thinking";
      const isActive = isListening || isSpeaking || isThinking;
      const activeSpeechAnalyser = isSpeaking ? speechAnalyserRef.current : null;
      const speechFrame = isSpeaking && !activeSpeechAnalyser ? getSpeechFrame(speechCueRef.current, time) : null;
      const color = isSpeaking ? "255, 178, 46" : isThinking ? "91, 223, 242" : "87, 242, 146";
      const stroke = `rgb(${color})`;

      if (analyser && isListening) {
        analyser.getByteTimeDomainData(waveform);
      } else if (activeSpeechAnalyser) {
        activeSpeechAnalyser.getByteTimeDomainData(waveform);
      }

      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(width * 0.5, centerY, 12, width * 0.5, centerY, Math.min(width, height) * 0.72);
      glow.addColorStop(0, `rgba(${color}, ${isActive ? 0.12 : 0.04})`);
      glow.addColorStop(0.48, `rgba(${color}, ${isActive ? 0.05 : 0.02})`);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.save();
      context.globalAlpha = isActive ? 0.36 : 0.14;
      context.strokeStyle = `rgba(${color}, 0.8)`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, centerY);
      context.lineTo(width, centerY);
      context.stroke();
      context.restore();

      const points: Array<{ x: number; y: number; power: number }> = [];
      const step = 3;
      const pitch = speechFrame?.pitch ?? 1;
      const speechEnergy = speechFrame?.energy ?? 1;
      const motion = time * (isSpeaking ? 0.014 * pitch : isThinking ? 0.011 : 0.008);

      for (let x = 0; x <= width; x += step) {
        const ratio = x / Math.max(width, 1);
        const lobes =
          0.12 +
          burst(ratio, 0.14, 0.045) * 0.88 +
          burst(ratio, 0.32, 0.05) * 0.78 +
          burst(ratio, 0.62, 0.036) * 0.62 +
          burst(ratio, 0.78, 0.052) * 0.9 +
          burst(ratio, 0.92, 0.033) * 0.7;
        const speechMouth = isSpeaking ? 0.78 + Math.sin((speechFrame?.wordAge ?? time) * 0.045 + ratio * 19) * 0.22 : 1;
        const carrier =
          Math.sin(x * 0.045 * pitch + motion) * 0.58 +
          Math.sin(x * 0.118 * pitch - motion * 1.6) * 0.32 +
          Math.sin(x * 0.021 + motion * 2.2) * 0.22;
        const micIndex = Math.min(waveform.length - 1, Math.floor(ratio * waveform.length));
        const micSignal = analyser && isListening ? (waveform[micIndex] - 128) / 128 : 0;
        const speechSignal = activeSpeechAnalyser ? (waveform[micIndex] - 128) / 128 : 0;
        const modeBoost = activeSpeechAnalyser ? 1.15 : isSpeaking ? 1.12 * speechEnergy : isThinking ? 0.52 : isListening ? 1 : 0.18;
        const signal = analyser && isListening ? micSignal * 1.9 + carrier * 0.14 : activeSpeechAnalyser ? speechSignal * 2.15 + carrier * 0.08 : carrier * speechMouth;
        const power = Math.min(1, Math.abs(signal) * lobes * modeBoost);
        const y = centerY + signal * lobes * modeBoost * height * 0.24;
        points.push({ x, y, power });
      }

      context.save();
      context.shadowColor = stroke;
      context.shadowBlur = isActive ? 22 : 8;
      context.strokeStyle = `rgba(${color}, ${isActive ? 0.95 : 0.32})`;
      context.lineWidth = isActive ? 1.5 : 1;
      context.beginPath();
      points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
      context.restore();

      context.save();
      context.globalCompositeOperation = "screen";
      for (let index = 0; index < points.length; index += 3) {
        const point = points[index];
        const barHeight = Math.max(2, point.power * height * 0.32);
        context.fillStyle = `rgba(${color}, ${isActive ? 0.16 + point.power * 0.72 : 0.08})`;
        context.fillRect(point.x, centerY - barHeight * 0.5, 1.4, barHeight);
      }
      context.restore();

      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [mode]);

  return <canvas ref={canvasRef} className={`voice-wave-canvas voice-wave-${mode}`} aria-hidden="true" />;
}

function TranscriptRow({
  icon,
  speaker,
  text,
  downloadUrl,
  tone,
  active,
  time,
  confirmation,
  confirmationBusy,
  onConfirmationParamChange,
  onConfirm,
  onCancelConfirm,
  actions,
  onViewFull,
}: {
  icon: IconType;
  speaker: string;
  text: string;
  downloadUrl?: string;
  tone: TranscriptTone;
  active: boolean;
  time: string;
  confirmation?: ConfirmationState | null;
  confirmationBusy?: boolean;
  onConfirmationParamChange?: (key: string, value: unknown) => void;
  onConfirm?: () => Promise<void>;
  onCancelConfirm?: () => void;
  actions?: Array<{ label: string; busy?: boolean; onClick: () => void }>;
  onViewFull?: () => void;
}) {
  const Icon = icon;
  const lines = text.split("\n").filter(Boolean);
  return (
    <div className={`transcript-row ${tone} ${active ? "active" : ""}`}>
      <div className="row-icon">
        <Icon className="h-4 w-4" />
      </div>
      <div className="transcript-copy">
        <div className="speaker-line">
          <strong>{speaker}</strong>
          <span>{time}</span>
        </div>
        <p className={onViewFull ? "compact" : undefined}>
          {lines.map((line, index) => (
            <span key={`${line}-${index}`}>{line}</span>
          ))}
          {downloadUrl && (
            <a className="transcript-download" href={downloadUrl} download>
              Download the file for the detailed report.
            </a>
          )}
        </p>
        {onViewFull && (
          <button type="button" className="transcript-view-full" onClick={onViewFull}>
            View full
          </button>
        )}
        {actions && actions.length > 0 && (
          <div className="transcript-actions">
            {actions.map((action) => (
              <button key={action.label} type="button" className="transcript-action" onClick={action.onClick} disabled={action.busy}>
                {action.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {action.label}
              </button>
            ))}
          </div>
        )}
        {confirmation && onConfirmationParamChange && onConfirm && onCancelConfirm && (
          <InlineConfirmationCard
            confirmation={confirmation}
            busy={Boolean(confirmationBusy)}
            onParamChange={onConfirmationParamChange}
            onConfirm={onConfirm}
            onCancel={onCancelConfirm}
          />
        )}
      </div>
      <MiniWave active={active} tone={tone === "amber" ? "talking" : "listening"} />
    </div>
  );
}

function InlineConfirmationCard({
  confirmation,
  busy,
  onParamChange,
  onConfirm,
  onCancel,
}: {
  confirmation: ConfirmationState;
  busy: boolean;
  onParamChange: (key: string, value: unknown) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const entries = orderedConfirmationParams(confirmation.params);

  return (
    <div className="inline-confirm-card">
      <div className="inline-confirm-head">
        <div className="row-icon">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <strong>{confirmation.label}</strong>
          <span>Edit values, then confirm.</span>
        </div>
      </div>
      <div className="inline-confirm-fields">
        {entries.map(([key, value]) => (
          <label key={key}>
            <span>{formatParamLabel(key)}</span>
            {renderConfirmationInput(key, value, onParamChange)}
          </label>
        ))}
      </div>
      <div className="inline-confirm-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="primary-action" onClick={() => void onConfirm()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Confirm
        </button>
      </div>
    </div>
  );
}

function orderedConfirmationParams(params: Record<string, unknown>) {
  const preferred = ["exam", "subject", "topic", "question_count", "difficulty", "duration_minutes", "mode", "source_requirement", "source_mode", "constraints"];
  const entries = Object.entries(params);
  return entries.sort(([left], [right]) => {
    const leftIndex = preferred.indexOf(left);
    const rightIndex = preferred.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }
    return left.localeCompare(right);
  });
}

function renderConfirmationInput(key: string, value: unknown, onChange: (key: string, value: unknown) => void) {
  if (key === "difficulty") {
    return (
      <select value={String(value ?? "mixed")} onChange={(event) => onChange(key, event.target.value)}>
        {["mixed", "easy", "medium", "hard"].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (key === "mode") {
    return (
      <select value={String(value ?? "mcq")} onChange={(event) => onChange(key, event.target.value)}>
        <option value="mcq">mcq</option>
      </select>
    );
  }

  if (key === "source_requirement") {
    return (
      <select value={String(value ?? "none")} onChange={(event) => onChange(key, event.target.value)}>
        <option value="none">none</option>
        <option value="pyq_required">PYQ required</option>
        <option value="source_backed">source backed</option>
      </select>
    );
  }

  if (key === "source_mode") {
    return (
      <select value="uploaded_docs" onChange={(event) => onChange(key, event.target.value)}>
        <option value="uploaded_docs">uploaded PDFs</option>
      </select>
    );
  }

  if (key === "constraints" && Array.isArray(value)) {
    return <input value={value.join(", ")} onChange={(event) => onChange(key, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />;
  }

  if (typeof value === "number" || key === "question_count" || key === "duration_minutes") {
    const min = key === "duration_minutes" ? 1 : 1;
    const max = key === "duration_minutes" ? 180 : key === "question_count" ? 50 : undefined;
    return (
      <input
        type="number"
        min={min}
        max={max}
        value={Number(value ?? min)}
        onChange={(event) => onChange(key, Number.parseInt(event.target.value || `${min}`, 10))}
      />
    );
  }

  if (typeof value === "boolean") {
    return <input type="checkbox" checked={value} onChange={(event) => onChange(key, event.target.checked)} />;
  }

  return <input value={String(value ?? "")} onChange={(event) => onChange(key, event.target.value)} />;
}

function formatParamLabel(key: string) {
  return key.replaceAll("_", " ");
}

function TranscriptDialog({ content, onClose }: { content: TranscriptDialogContent; onClose: () => void }) {
  return (
    <div className="transcript-dialog-backdrop" onMouseDown={onClose}>
      <section
        className={`transcript-dialog ${content.tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="transcript-dialog-head">
          <div>
            <strong id="transcript-dialog-title">{content.speaker}</strong>
            <span>{content.time}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close full transcript">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="transcript-dialog-body">
          <div className="transcript-dialog-text">{content.text}</div>
          {content.downloadUrl && (
            <a className="transcript-download" href={content.downloadUrl} download>
              Download the file for the detailed report.
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function ResearchFlowStep({ step, isLast }: { step: ResearchFlowItem; isLast: boolean }) {
  const marker =
    step.status === "working" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : step.complete ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : step.status === "error" ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <Circle className="h-4 w-4" />
    );
  const timeLabel = step.timestamp ? formatEventTime(step.timestamp) : step.complete ? "Done" : step.current ? "Now" : "Pending";

  return (
    <div className={`research-flow-step ${step.complete ? "complete" : ""} ${step.current ? "current" : ""} ${step.status} ${isLast ? "last" : ""}`}>
      <div className="flow-marker">{marker}</div>
      {!isLast && <div className="flow-connector" />}
      <div className="flow-copy">
        <strong>{step.label}</strong>
        <span>{timeLabel}</span>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon = FileText }: { label: string; value: number | string; icon?: IconType }) {
  return (
    <div className="metric-row">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
