"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { toast } from "@/lib/toast";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CardSkeleton } from "@/components/ui/Skeleton";

const DashboardTab = dynamic(() => import("@/components/tabs/DashboardTab").then(m => m.DashboardTab), {
    ssr: false,
    loading: () => <div className="space-y-8"><div className="h-10 w-64 bg-surface-glass rounded-lg animate-shimmer" /><CardSkeleton /></div>
});
const SignalsTab = dynamic(() => import("@/components/tabs/SignalsTab").then(m => m.SignalsTab), {
    loading: () => <CardSkeleton />
});
const GovernanceTab = dynamic(() => import("@/components/tabs/GovernanceTab").then(m => m.GovernanceTab), {
    loading: () => <CardSkeleton />
});
const ResearchTab = dynamic(() => import("@/components/tabs/ResearchTab").then(m => m.ResearchTab), {
    loading: () => <CardSkeleton />
});
const DebateSection = dynamic(() => import("@/components/DebateSection").then(m => m.DebateSection), {
    loading: () => <CardSkeleton />
});
const ResearchGraph = dynamic(() => import("@/components/ResearchGraph").then(m => m.ResearchGraph), {
    loading: () => <CardSkeleton />
});
const FinancialSimulation = dynamic(() => import("@/components/FinancialSimulation").then(m => m.FinancialSimulation), {
    loading: () => <CardSkeleton />
});

import {
    Send,
    ChevronRight,
    ChevronLeft,
    MessageSquare,
    Layout,
    Activity,
    ShieldCheck,
    Search,
    Zap,
    Gavel,
    Share2,
    Loader2,
    FolderOpen,
    MoreHorizontal,
    ChevronUp,
    X,
    User
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/lib/utils";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const spotlightBg = useMotionTemplate`
        radial-gradient(
            650px circle at ${mouseX}px ${mouseY}px,
            rgba(59, 130, 246, 0.12),
            transparent 80%
        )
    `;

    const handleMouseMove = useCallback(({ currentTarget, clientX, clientY }: React.MouseEvent) => {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }, [mouseX, mouseY]);

    return (
        <div
            onMouseMove={handleMouseMove}
            className={cn("glass-card group/card relative", className)}
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-inherit opacity-0 transition duration-300 group-hover/card:opacity-100 z-0"
                style={{ background: spotlightBg }}
            />
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
};

interface IngestionArtifact {
    file_name: string;
    priority: 'high' | 'medium' | 'low';
    summary: string;
    anomalies_detected: string[];
    red_flags: string[];
}

interface IngestionResult {
    competitor_simulation?: {
        simulated_competitor: string;
        attack_vector: string;
        impact_on_cac: string;
        impact_on_ltv: string;
    };
    artifacts: IngestionArtifact[];
}

export default function CanvasPage() {
    const { data: session, isPending } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (!isPending && !session) {
            router.push("/login");
        }
    }, [session, isPending, router]);

    const [activeArtifact, setActiveArtifact] = useState<string | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [ingestionResult, setIngestionResult] = useState<IngestionResult | null>(null);
    const [ingestionError, setIngestionError] = useState<string | null>(null);
    const [isIngesting, setIsIngesting] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [input, setInput] = useState("");

    const isMobile = useMediaQuery("(max-width: 768px)");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const tabs = useMemo(() => [
        { id: "dashboard", label: "Dashboard", icon: Layout, artifact: null },
        { id: "research", label: "Research", icon: Search, artifact: "brief" },
        { id: "debate", label: "Debate Swarm", icon: Gavel, artifact: "debate" },
        { id: "graph", label: "Visual Graph", icon: Share2, artifact: "graph" },
        { id: "simulation", label: "Monte Carlo", icon: Zap, artifact: "simulation" },
        { id: "signals", label: "Signals", icon: Activity, artifact: "signals" },
        { id: "dataroom", label: "Data Room", icon: FolderOpen, artifact: "dataroom" },
        { id: "governance", label: "Governance", icon: ShieldCheck, artifact: "governance" },
    ], []);

    const navigateTo = (id: string) => {
        if (id === "dashboard") setActiveArtifact(null);
        else if (id === "research") setActiveArtifact("brief");
        else setActiveArtifact(id);
        setMobileMenuOpen(false);
    };

    const activeTab = useMemo(() => tabs.find(t => t.artifact === activeArtifact) || tabs[0], [tabs, activeArtifact]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".zip")) {
            toast.error("Invalid format. Please upload a .zip archive.");
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            toast.error("File exceeds 50 MB limit.");
            return;
        }

        setIsIngesting(true);
        setIngestionError(null);
        setActiveArtifact("dataroom");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/v1/ingestion/upload", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server error: ${res.status}`);
            }
            const data = await res.json();
            setIngestionResult(data as IngestionResult);
            trackEvent(ANALYTICS_EVENTS.RESEARCH_COMPLETED, { type: "dataroom_ingestion" });
            toast.success("Artifacts ingested successfully.");
        } catch (err) {
            console.error("Ingestion failed:", err);
            const msg = err instanceof Error ? err.message : "Upload failed. Is the backend running?";
            setIngestionError(msg);
            toast.error(msg);
        } finally {
            setIsIngesting(false);
        }
    };

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    }, []);

    const formatMessageContent = useCallback((content: string) => {
        return content.replace(/^(INVESTMENT_BRIEF|RISK_ASSESSMENT|RED_FLAG|STRATEGIC_RISK)[:\s]*/m, "").trim();
    }, []);

    const transport = useMemo(() => new TextStreamChatTransport({
        api: "/api/chat",
    }), []);

    const { messages, sendMessage: append, status } = useChat({
        transport,
        onFinish: (options) => {
            const { message } = options;
            const content = message.parts
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map(p => p.text)
                .join("");

            if (content.includes("INVESTMENT_BRIEF")) {
                setActiveArtifact("brief");
                trackEvent(ANALYTICS_EVENTS.RESEARCH_COMPLETED, { artifact: "brief" });
            } else if (content.includes("RISK_ASSESSMENT")) {
                setActiveArtifact("risk");
                trackEvent(ANALYTICS_EVENTS.RESEARCH_COMPLETED, { artifact: "risk" });
            }
        }
    });

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;
        trackEvent(ANALYTICS_EVENTS.RESEARCH_STARTED, { query: input });
        append({ text: input });
        setInput("");
    }, [input, append]);

    const isLoading = status === "streaming" || status === "submitted";

    useKeyboardShortcuts([
        { key: "k", meta: true, label: "Command Palette", action: () => setCommandPaletteOpen(true) },
        { key: "/", meta: true, label: "Focus Chat", action: () => textareaRef.current?.focus() },
        { key: "1", meta: true, label: "Dashboard", action: () => setActiveArtifact(null) },
        { key: "2", meta: true, label: "Research", action: () => setActiveArtifact("brief") },
        { key: "3", meta: true, label: "Debate", action: () => setActiveArtifact("debate") },
        { key: "4", meta: true, label: "Graph", action: () => setActiveArtifact("graph") },
        { key: "5", meta: true, label: "Simulation", action: () => setActiveArtifact("simulation") },
        { key: "6", meta: true, label: "Signals", action: () => setActiveArtifact("signals") },
        { key: "7", meta: true, label: "Data Room", action: () => setActiveArtifact("dataroom") },
        { key: "8", meta: true, label: "Governance", action: () => setActiveArtifact("governance") },
    ]);

    useEffect(() => {
        trackEvent(ANALYTICS_EVENTS.CANVAS_VIEWED);
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const getMessageTime = (m: UIMessage) => {
        const ts = 'createdAt' in m && m.createdAt ? new Date(m.createdAt as string | number | Date) : new Date();
        return ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex h-screen w-full bg-background text-white overflow-hidden font-sans">
            {}
            {isLoading && (
                <div className="fixed top-0 inset-x-0 h-0.5 bg-surface-glass z-50">
                    <div className="h-full w-1/3 bg-gradient-to-r from-brand-blue via-brand-indigo to-brand-purple animate-progress" />
                </div>
            )}

            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                onNavigate={navigateTo}
            />

            <AnimatePresence>
                {isMobile && isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[15]"
                    />
                )}
            </AnimatePresence>

            {}
            <motion.div
                initial={false}
                animate={{
                    width: isMobile ? (isSidebarOpen ? "100%" : "0%") : (isSidebarOpen ? "420px" : "72px"),
                    x: isMobile && !isSidebarOpen ? -420 : 0
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                    "relative flex flex-col border-r border-surface-glass-border bg-surface-raised z-20",
                    isMobile && "fixed inset-y-0 left-0"
                )}
            >
                {}
                <div className="flex items-center justify-between p-5 border-b border-surface-glass-border/60">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-gradient-to-br from-brand-blue to-brand-indigo rounded-lg flex items-center justify-center shadow-[0_0_15px_var(--brand-blue-glow)]">
                                <Zap className="h-4 w-4 text-white fill-white" />
                            </div>
                            <span className="text-lg font-bold tracking-tight">Nexus AI</span>
                        </div>
                    ) : (
                        <button onClick={() => setSidebarOpen(true)} className="mx-auto p-2 bg-brand-blue/10 rounded-xl hover:bg-brand-blue/20 transition-colors">
                            <Zap className="h-5 w-5 text-brand-blue fill-brand-blue/20" />
                        </button>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!isSidebarOpen)}
                        aria-label="Toggle Sidebar"
                        className="p-2 hover:bg-surface-glass rounded-lg transition-colors"
                    >
                        {isSidebarOpen ? <ChevronLeft className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
                    </button>
                </div>

                {}
                {!isSidebarOpen && !isMobile && (
                    <div className="flex-1 flex flex-col items-center py-6 gap-3 overflow-y-auto scrollbar-hide">
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveArtifact(item.artifact)}
                                title={item.label}
                                className={cn(
                                    "p-2.5 rounded-xl transition-all relative group",
                                    activeArtifact === item.artifact
                                        ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20"
                                        : "text-text-dim hover:text-white hover:bg-surface-glass"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-surface-overlay border border-surface-glass-border rounded-lg text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                    {item.label}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {}
                {isSidebarOpen && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full p-8">
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center max-w-xs">
                                    <div className="h-14 w-14 bg-surface-glass border border-surface-glass-border rounded-2xl flex items-center justify-center mb-5 shadow-lg">
                                        <MessageSquare className="h-7 w-7 text-brand-blue/50 stroke-[1.5px]" />
                                    </div>
                                    <h3 className="text-base font-semibold text-white mb-2">Start a conversation</h3>
                                    <p className="text-xs text-text-muted leading-relaxed mb-6">Ask about any company, run due diligence, or explore your portfolio data.</p>
                                    <div className="grid grid-cols-1 gap-2 w-full">
                                        {["Analyze BioTech 10-K for red flags", "Generate investment brief for DataNexus", "Run Monte Carlo on portfolio"].map((query, i) => (
                                            <button key={i} onClick={() => setInput(query)} className="text-[11px] text-left px-4 py-2.5 bg-surface-glass border border-surface-glass-border hover:border-brand-blue/30 hover:bg-brand-blue/5 rounded-xl transition-all text-text-muted hover:text-white">
                                                {query}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        <AnimatePresence>
                            {messages.map((m: UIMessage) => (
                                <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        "flex flex-col max-w-[88%] rounded-2xl p-4 text-sm leading-relaxed relative group",
                                        m.role === "user"
                                            ? "ml-auto bg-brand-blue/10 border border-brand-blue/20 text-blue-50"
                                            : "bg-surface-glass border border-surface-glass-border text-foreground/90"
                                    )}
                                >
                                    {m.role === "assistant" && (
                                        <button onClick={() => { navigator.clipboard.writeText(formatMessageContent(m.parts.filter((p): p is { type: 'text', text: string } => p.type === 'text').map(p => p.text).join(''))); toast.success("Copied"); }} aria-label="Copy" className="absolute top-2 right-2 p-1.5 bg-surface-base/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-base">
                                            <Share2 className="h-3 w-3 text-text-dim" />
                                        </button>
                                    )}
                                    <div className="mb-1.5 flex items-center justify-between gap-4">
                                        <span className="text-[10px] font-medium text-text-dim">{m.role === "user" ? "You" : "Nexus"}</span>
                                        <span className="text-[10px] font-mono text-text-dim/40">{getMessageTime(m)}</span>
                                    </div>
                                    {m.role === "assistant" ? (
                                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-surface-glass prose-pre:border prose-pre:border-surface-glass-border prose-code:text-brand-blue prose-code:bg-brand-blue/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatMessageContent(m.parts.filter((p): p is { type: 'text', text: string } => p.type === 'text').map(p => p.text).join(''))}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p>{formatMessageContent(m.parts.filter((p): p is { type: 'text', text: string } => p.type === 'text').map(p => p.text).join(''))}</p>
                                    )}
                                </motion.div>
                            ))}
                            {isLoading && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-surface-glass border border-surface-glass-border rounded-xl px-4 py-3 w-fit flex items-center gap-3">
                                    <div className="flex gap-1">
                                        {[0, 0.2, 0.4].map(delay => (
                                            <motion.div key={delay} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay }} className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                                        ))}
                                    </div>
                                    <span className="text-[11px] text-brand-blue/80">Thinking...</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>
                )}

                {}
                {isSidebarOpen && (
                    <div className={cn("p-4 border-t border-surface-glass-border/60 bg-surface-raised", isMobile && "pb-20")}>
                        <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-surface-glass border border-surface-glass-border rounded-2xl p-2 focus-within:border-brand-blue/40 transition-all">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                                rows={1}
                                placeholder="Ask anything..."
                                className="flex-1 bg-transparent border-none outline-none py-2 px-3 text-sm text-white placeholder:text-text-dim/50 resize-none max-h-[200px]"
                            />
                            <button type="submit" disabled={isLoading || !input.trim()} className="p-2.5 bg-brand-blue hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-brand-blue rounded-xl transition-all shrink-0">
                                {isLoading ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Send className="h-4 w-4 text-white" />}
                            </button>
                        </form>
                        <p className="text-[10px] text-text-dim/40 text-center mt-2">Shift + Enter for new line</p>
                    </div>
                )}
            </motion.div>

            {}
            <div className="flex-1 relative flex flex-col bg-background overflow-hidden">
                {}
                <div className="h-16 border-b border-surface-glass-border/60 flex items-center justify-between px-6 bg-surface-raised/50 backdrop-blur-xl z-10">
                    <div className="flex items-center gap-6">
                        {isMobile && (
                            <button onClick={() => setSidebarOpen(true)} className="p-2 bg-surface-glass border border-surface-glass-border rounded-xl relative">
                                <MessageSquare className="h-4 w-4 text-brand-blue" />
                                {messages.length > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 bg-brand-blue rounded-full" />}
                            </button>
                        )}
                        <nav className={cn("flex items-center gap-1 overflow-x-auto scrollbar-hide", isMobile ? "hidden" : "flex")} role="tablist">
                            {tabs.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveArtifact(item.artifact)}
                                    className={cn(
                                        "relative flex items-center gap-2 text-[13px] font-medium transition-colors outline-none px-3 py-2 rounded-lg",
                                        (activeArtifact === item.artifact)
                                            ? "text-white bg-surface-glass"
                                            : "text-text-muted hover:text-white hover:bg-surface-glass/50"
                                    )}
                                >
                                    <item.icon className="h-3.5 w-3.5" />
                                    {item.label}
                                    {activeArtifact === item.artifact && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-blue rounded-full"
                                            transition={{ type: "spring", stiffness: 400, damping: 28 }}
                                        />
                                    )}
                                </button>
                            ))}
                        </nav>
                        {isMobile && <span className="text-sm font-medium text-white">{activeTab.label}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                        {!isMobile && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-surface-glass-border bg-surface-glass">
                                <div className="h-1.5 w-1.5 rounded-full bg-success" />
                                <span className="text-[11px] text-text-muted font-medium">Online</span>
                            </div>
                        )}
                        <button onClick={() => signOut().then(() => window.location.href = "/login").catch(() => toast.error("Sign out failed"))} className="flex items-center gap-2 text-xs text-text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-glass">
                            <User className="h-3.5 w-3.5" />
                            {!isMobile && "Sign out"}
                        </button>
                    </div>
                </div>

                {}
                <motion.div
                    id="main-content"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    className="flex-1 overflow-auto p-4 md:p-8 bg-[radial-gradient(circle_at_top_right,_var(--brand-blue-glow)_0%,_transparent_50%)] scrollbar-hide"
                >
                    {!activeArtifact ? (
                        <div className="h-full"><ErrorBoundary><DashboardTab onNavigate={navigateTo} /></ErrorBoundary></div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeArtifact}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="w-full max-w-6xl mx-auto space-y-6 pb-24 md:pb-20"
                            >
                                <GlassCard className="p-6 md:p-10 min-h-[500px] md:min-h-[600px] shadow-2xl relative overflow-hidden">
                                    <ErrorBoundary>
                                        {activeArtifact === "signals" && <SignalsTab onAnalyze={(q) => append({ text: q })} />}
                                        {activeArtifact === "governance" && <GovernanceTab />}
                                        {activeArtifact === "brief" && <ResearchTab />}
                                        {activeArtifact === "debate" && <DebateSection accountId="ACC-0001" />}
                                        {activeArtifact === "simulation" && <FinancialSimulation revenue={100_000_000} />}
                                        {activeArtifact === "graph" && <ResearchGraph accountId="ACC-0001" />}
                                        {activeArtifact === "dataroom" && (
                                            <div className="space-y-8 relative z-10">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-surface-glass-border pb-6">
                                                    <div>
                                                        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">Data Room</h3>
                                                        <p className="text-text-muted mt-1.5 text-sm">Upload and analyze research artifacts.</p>
                                                    </div>
                                                    <label className="flex items-center justify-center gap-2 bg-brand-blue hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-lg active:scale-[0.98]">
                                                        <FolderOpen className="h-4 w-4" /> Upload .zip
                                                        <input type="file" className="hidden" accept=".zip" onChange={handleFileUpload} />
                                                    </label>
                                                </div>
                                                {isIngesting ? (
                                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                                        <Loader2 className="h-10 w-10 text-brand-blue animate-spin" />
                                                        <p className="text-text-muted text-sm">Analyzing artifacts...</p>
                                                    </div>
                                                ) : ingestionResult ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative z-10">
                                                        {ingestionResult.artifacts?.map((item, idx) => (
                                                            <div key={idx} className={cn("p-6 rounded-2xl border transition-all hover:translate-y-[-2px] duration-300", item.priority === "high" ? "bg-error/5 border-error/20" : "bg-surface-glass border-surface-glass-border")}>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className="text-xs text-text-dim font-mono truncate max-w-[200px]">{item.file_name}</span>
                                                                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0", item.priority === "high" ? "bg-error text-white" : "bg-brand-blue/20 text-brand-blue")}>{item.priority}</span>
                                                                </div>
                                                                <p className="text-sm leading-relaxed text-foreground/90">{item.summary}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center opacity-30 py-20 text-center">
                                                        <Layout className="h-16 w-16 mb-4 stroke-[0.5px]" />
                                                        <p className="text-sm text-text-muted">No artifacts uploaded yet</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {activeArtifact === "risk" && (
                                            <div className="flex flex-col items-center justify-center gap-6 py-20 relative z-10">
                                                <div className="relative">
                                                    <div className="h-20 w-20 md:h-28 md:w-28 rounded-full border-4 border-surface-glass-border border-t-brand-blue animate-spin" />
                                                    <Zap className="absolute inset-0 m-auto h-7 w-7 text-brand-blue animate-pulse" />
                                                </div>
                                                <div className="text-center space-y-2">
                                                    <h3 className="text-xl font-semibold">Analyzing risk exposure</h3>
                                                    <p className="text-text-muted text-sm">Running portfolio stress test...</p>
                                                </div>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                </GlassCard>
                            </motion.div>
                        </AnimatePresence>
                    )}
                </motion.div>

                {}
                {isMobile && (
                    <>
                        <AnimatePresence>
                            {mobileMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="fixed bottom-16 inset-x-0 mx-4 bg-surface-overlay border border-surface-glass-border rounded-2xl shadow-2xl z-30 p-2 backdrop-blur-xl"
                                >
                                    <div className="flex items-center justify-between px-3 py-2 mb-1">
                                        <span className="text-xs font-medium text-text-muted">All tabs</span>
                                        <button onClick={() => setMobileMenuOpen(false)} className="p-1 hover:bg-surface-glass rounded-lg">
                                            <X className="h-4 w-4 text-text-dim" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1">
                                        {tabs.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => { setActiveArtifact(item.artifact); setMobileMenuOpen(false); }}
                                                className={cn(
                                                    "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                                                    activeArtifact === item.artifact ? "bg-brand-blue/10 text-brand-blue" : "text-text-muted hover:bg-surface-glass hover:text-white"
                                                )}
                                            >
                                                <item.icon className="h-5 w-5" />
                                                <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="fixed bottom-0 inset-x-0 h-16 bg-surface-raised/90 backdrop-blur-xl border-t border-surface-glass-border flex items-center justify-around px-4 z-30">
                            {tabs.slice(0, 4).map((item) => (
                                <button key={item.id} onClick={() => setActiveArtifact(item.artifact)} className={cn("flex flex-col items-center gap-1 transition-all py-1", activeArtifact === item.artifact ? "text-brand-blue" : "text-text-muted")}>
                                    <item.icon className="h-5 w-5" />
                                    <span className="text-[9px] font-medium">{item.label.split(' ')[0]}</span>
                                    {activeArtifact === item.artifact && <motion.div layoutId="mobileTab" className="h-1 w-1 rounded-full bg-brand-blue" />}
                                </button>
                            ))}
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className={cn("flex flex-col items-center gap-1 transition-all py-1", mobileMenuOpen ? "text-brand-blue" : "text-text-muted")}
                            >
                                {mobileMenuOpen ? <ChevronUp className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
                                <span className="text-[9px] font-medium">More</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}