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
  ExternalLink,
  FileText,
  Filter,
  FileUp,
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
  Trash2,
  Upload,
  User,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AgentAbility,
  AgentAuditEntry,
  AgentCommandResponse,
  AgentDescriptor,
  AgentEvent,
  AgentMemoryCategory,
  AgentMemoryItem,
  AppMode,
  askDocument,
  CommandResponse,
  DocumentQuestionResponse,
  DocumentRecord,
  executeAgentCommand,
  getAgentAbilities,
  getAgentAudit,
  getAgents,
  getHealth,
  getMemory,
  getReports,
  HealthResponse,
  listDocuments,
  listStudyArtifacts,
  ResearchReport,
  runCommand,
  Source,
  StudyArtifact,
  StudyArtifactType,
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
};

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "unsupported" | "error";
type TranscriptTone = "emerald" | "cyan" | "amber";
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

type AgentToolPanel = "catalog" | "audit" | "memory" | "documents" | "study";

const navItems: Array<{ id: AppMode; label: string; icon: IconType }> = [
  { id: "cockpit", label: "Cockpit", icon: Activity },
  { id: "research", label: "Research", icon: Search },
  { id: "agents", label: "Agents", icon: Network },
  { id: "sources", label: "Sources", icon: FileText },
  { id: "library", label: "Library", icon: Library },
  { id: "timeline", label: "Timeline", icon: ClipboardCheck },
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
    empty: "Research mode will search sources, write the report here, and only speak a short completion note.",
  },
  agents: {
    title: "Agents",
    label: "Agent Mode",
    placeholder: "Give Astra a task, like open YouTube or plan a workflow...",
    empty: "Agent mode can execute safe allowlisted desktop actions and plan the rest.",
  },
  sources: {
    title: "Sources",
    label: "Source Review",
    placeholder: "Ask about sources or switch to research mode...",
    empty: "Sources from your latest research run will appear in the right rail.",
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const PREFERRED_PIPER_VOICE = "en_US-lessac-high";
const SPEECH_FIRST_CHUNK_MAX_LENGTH = 180;
const SPEECH_CHUNK_MAX_LENGTH = 360;
const SPEECH_BLOB_CACHE_LIMIT = 24;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [agentAbilities, setAgentAbilities] = useState<AgentAbility[]>([]);
  const [agentAudit, setAgentAudit] = useState<AgentAuditEntry[]>([]);
  const [memoryItems, setMemoryItems] = useState<AgentMemoryItem[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [studyArtifacts, setStudyArtifacts] = useState<StudyArtifact[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [agentToolPanel, setAgentToolPanel] = useState<AgentToolPanel | null>(null);
  const [agentNotice, setAgentNotice] = useState<AgentNotice | null>(null);
  const [agentBusyId, setAgentBusyId] = useState<string | null>(null);
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
  const [, setSources] = useState<Source[]>([]);
  const [, setCriticNotes] = useState<string[]>([]);
  const [setupRequired, setSetupRequired] = useState<string[]>([]);
  const [, setResearchReport] = useState<ResearchReport | null>(null);
  const [, setReports] = useState<ResearchReport[]>([]);
  const [commandDraft, setCommandDraft] = useState("");
  const [commandInFlight, setCommandInFlight] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [handsFree, setHandsFree] = useState(false);
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
  const micStreamRef = useRef<MediaStream | null>(null);
  const speechIdRef = useRef(0);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioContextRef = useRef<AudioContext | null>(null);
  const speechAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const speechAnalyserRef = useRef<AnalyserNode | null>(null);
  const speechBlobCacheRef = useRef<Map<string, Blob>>(new Map());
  const speechObjectUrlsRef = useRef<string[]>([]);
  const commandBusyRef = useRef(false);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    (window as Window & { __astraHydrationGuard?: () => void }).__astraHydrationGuard?.();
    void warmVoice(PREFERRED_PIPER_VOICE).catch(() => undefined);
  }, []);

  useEffect(() => {
    const list = transcriptListRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, liveTranscript, commandInFlight]);

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
  const visibleVoiceState = voiceState === "idle" && handsFree ? "listening" : voiceState;
  const voiceHeadline =
    visibleVoiceState === "speaking"
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
    ])
      .then(([healthResponse, agentResponse, reportResponse, abilityResponse, auditResponse, memoryResponse, documentResponse, studyResponse]) => {
        if (cancelled) return;
        setHealth(healthResponse);
        setAgents(agentResponse);
        setReports(reportResponse);
        setAgentAbilities(abilityResponse);
        setAgentAudit(auditResponse);
        setMemoryItems(memoryResponse);
        setDocuments(documentResponse);
        setStudyArtifacts(studyResponse);
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
    const [abilityResponse, auditResponse, memoryResponse, documentResponse, studyResponse] = await Promise.all([
      getAgentAbilities(),
      getAgentAudit(),
      getMemory(),
      listDocuments(),
      listStudyArtifacts(),
    ]);
    setAgentAbilities(abilityResponse);
    setAgentAudit(auditResponse);
    setMemoryItems(memoryResponse);
    setDocuments(documentResponse);
    setStudyArtifacts(studyResponse);
    setSelectedDocumentId((current) => current || documentResponse[0]?.id || "");
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
  }, [stopSpeechPlayback]);

  const playSpeechBlob = useCallback(
    async (blob: Blob, speechId: number) => {
      const speechAudio = ensureSpeechAudio();
      if (!speechAudio) throw new Error("Web Audio is not available.");
      if (speechIdRef.current !== speechId) return;

      const url = URL.createObjectURL(blob);
      speechObjectUrlsRef.current.push(url);
      const { audio, audioContext } = speechAudio;
      audio.src = url;
      audio.currentTime = 0;
      speakingRef.current = true;
      setSpeechCue(null);
      setVoiceState("speaking");

      await audioContext.resume();
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
          if (speechIdRef.current !== speechId) return;
          const blob = await pendingSpeech;
          if (speechIdRef.current !== speechId) return;
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
    [getSpeechBlob, playSpeechBlob, scheduleRecognitionRestart, speakWithBrowser, stopRecognition, stopSpeechPlayback],
  );

  const handleAgentCommandResult = useCallback(
    async (response: AgentCommandResponse) => {
      const tone: AgentNotice["tone"] =
        response.outcome === "success" ? "success" : response.outcome === "failure" ? "error" : "warning";
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
        },
      ]);
      if (response.confirmation_required) {
        setConfirmation({
          commandId: response.command_id,
          label: response.label,
          message: response.message,
          params: response.params,
          inputText: response.audit?.input_text || response.label,
          resolution: response.resolution,
        });
      } else {
        setConfirmation(null);
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

  const submitCommand = useCallback(
    async (rawCommand: string, inputSource: "typed" | "voice" | "quick_action" = "typed", modeOverride?: AppMode, depth?: "quick" | "deep" | "academic") => {
      const command = rawCommand.trim();
      if (!command) return;

      const commandMode = modeOverride ?? activePanel;
      commandBusyRef.current = true;
      setCommandInFlight(true);
      stopRecognition();
      setMessages((current) => [...current, { role: "user", content: command, label: "You", time: formatClock(), mode: commandMode }]);
      setLiveTranscript("");
      setEvents([makeClientEvent(commandMode === "research" ? "Query" : "Command Router", "working", command)]);
      setVoiceState("thinking");

      try {
        const response = await runCommand(command, commandMode, inputSource, depth);
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
    [absorbCommandResponse, activePanel, startRecognitionSafely, stopRecognition],
  );

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
        void submitCommand(finalText, "voice");
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
  }, [clearRecognitionRestart, requestMicrophoneStream, scheduleRecognitionRestart, startRecognitionSafely, stopMicrophoneStream, submitCommand]);

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
    await submitCommand(`Research ${researchTopic}`, "quick_action", "research", "deep");
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
              {handsFree ? <Mic className="h-8 w-8 text-emerald-300" /> : <MicOff className="h-8 w-8 text-zinc-500" />}
              <MiniWave tone={voiceState === "speaking" ? "talking" : "listening"} active={handsFree || voiceState === "speaking"} />
            </div>
            <span>{handsFree ? "Voice Active" : voiceHeadline}</span>
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

        <section className="dashboard-grid">
          <section className="cockpit-panel hud-panel">
            <div className="cockpit-title-row">
              <div>
                <div className="surface-title">{currentMode.title}</div>
                <p>{currentMode.empty}</p>
              </div>
              <span className="mode-pill">{currentMode.label}</span>
            </div>

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
                    <button type="button" onClick={toggleHandsFree} className="listen-toggle">
                      <span />
                      {handsFree ? "Stop Listening" : "Start Listening"}
                    </button>
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
                            void submitCommand(action.prompt, "quick_action", action.mode, action.depth);
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

          </section>

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
            <div ref={transcriptListRef} className="transcript-list">
              {messages.length === 0 && (
                <TranscriptRow icon={Sparkles} speaker="Astra" text={currentMode.empty} tone="cyan" active={false} time="Ready" />
              )}
              {messages.slice(-14).map((message, index) => {
                const speaker = message.label ?? (message.role === "user" ? "You" : "Astra");
                const tone: TranscriptTone = message.role === "user" ? "emerald" : message.role === "agent" ? "amber" : "cyan";
                const shouldOpenFull = message.role !== "user" && isLongTranscriptText(message.content);
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
                <MiniWave active tone="talking" />
              </div>
            )}
            <form
              className="command-form"
              onSubmit={(event) => {
                event.preventDefault();
                const text = commandDraft.trim();
                setCommandDraft("");
                void submitCommand(text, "typed");
              }}
            >
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
        notice={agentNotice}
        busyId={agentBusyId}
        confirmation={confirmation}
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
        onConfirm={confirmAgentCommand}
        onCancelConfirm={() => setConfirmation(null)}
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
      />
      {transcriptDialog && <TranscriptDialog content={transcriptDialog} onClose={() => setTranscriptDialog(null)} />}
    </main>
  );
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
  const blueprint = activePanel === "agents" ? agentFlowBlueprint : researchFlowBlueprint;
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

function AgentCommandCenter({
  activePanel,
  agents,
  abilities,
  audit,
  memoryItems,
  documents,
  studyArtifacts,
  notice,
  busyId,
  confirmation,
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
  onConfirm,
  onCancelConfirm,
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
}: {
  activePanel: AgentToolPanel | null;
  agents: AgentDescriptor[];
  abilities: AgentAbility[];
  audit: AgentAuditEntry[];
  memoryItems: AgentMemoryItem[];
  documents: DocumentRecord[];
  studyArtifacts: StudyArtifact[];
  notice: AgentNotice | null;
  busyId: string | null;
  confirmation: ConfirmationState | null;
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
  onConfirm: () => Promise<void>;
  onCancelConfirm: () => void;
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
  const panelTitle =
    activePanel === "catalog"
      ? "Command Catalog"
      : activePanel === "audit"
        ? "Audit Log"
        : activePanel === "memory"
          ? "Memory"
          : activePanel === "documents"
            ? "Documents"
            : "Study Tools";

  if (!activePanel && !confirmation) return null;

  return (
    <>
      {confirmation && (
        <div className="agent-confirm-backdrop">
          <section className="agent-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="agent-confirm-title">
            <div className="row-icon">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <strong id="agent-confirm-title">{confirmation.label}</strong>
              <p>{confirmation.message}</p>
              <code>{JSON.stringify(confirmation.params)}</code>
            </div>
            <div className="agent-confirm-actions">
              <button type="button" onClick={onCancelConfirm}>
                Cancel
              </button>
              <button type="button" onClick={() => void onConfirm()} className="primary-action">
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}

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
                    <div key={artifact.id} className="agent-list-row artifact-row">
                      <div>
                        <strong>{artifact.title}</strong>
                        <span>{artifact.artifact_type.replace("_", " ")}</span>
                      </div>
                    </div>
                    ))}
                  </div>
                ) : (
                  <AgentEmptyState icon={Brain} title="No study artifacts" text="Generate your first study artifact from any topic." />
                )}
              </section>
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
          </section>
        </div>
      )}
    </>
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  onViewFull,
}: {
  icon: IconType;
  speaker: string;
  text: string;
  downloadUrl?: string;
  tone: TranscriptTone;
  active: boolean;
  time: string;
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
      </div>
      <MiniWave active={active} tone={tone === "amber" ? "talking" : "listening"} />
    </div>
  );
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

function Metric({ label, value, icon: Icon = FileText }: { label: string; value: number; icon?: IconType }) {
  return (
    <div className="metric-row">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
