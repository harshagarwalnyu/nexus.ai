import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Layout,
    Zap,
    Gavel,
    Share2,
    Activity,
    ShieldCheck,
    LogOut,
    ArrowRight,
    FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Command {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    action: () => void;
    category: string;
    shortcut?: string;
}

const HighlightMatch = ({ text, match }: { text: string; match: string }) => {
    if (!match) return <span>{text}</span>;
    const escapedMatch = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedMatch})`, "gi"));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === match.toLowerCase()
                    ? <span key={i} className="text-brand-blue font-semibold underline decoration-1 underline-offset-2">{part}</span>
                    : <span key={i}>{part}</span>
            )}
        </span>
    );
};

export function CommandPalette({
    isOpen,
    onClose,
    onNavigate
}: {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (id: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const stored = localStorage.getItem("nexus_recent_commands");
        if (stored) setRecentSearches(JSON.parse(stored));
    }, []);

    const saveRecent = (id: string) => {
        const updated = [id, ...recentSearches.filter(s => s !== id)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem("nexus_recent_commands", JSON.stringify(updated));
    };

    const commands: Command[] = [
        { id: "dashboard", title: "Dashboard", description: "Portfolio overview and KPIs", icon: Layout, action: () => onNavigate("dashboard"), category: "Navigation", shortcut: "Cmd+1" },
        { id: "research", title: "Research", description: "Investment briefs and analysis", icon: Search, action: () => onNavigate("research"), category: "Navigation", shortcut: "Cmd+2" },
        { id: "debate", title: "Debate Swarm", description: "Adversarial thesis stress-test", icon: Gavel, action: () => onNavigate("debate"), category: "Analysis", shortcut: "Cmd+3" },
        { id: "graph", title: "Knowledge Graph", description: "Entity relationship visualization", icon: Share2, action: () => onNavigate("graph"), category: "Analysis", shortcut: "Cmd+4" },
        { id: "simulation", title: "Monte Carlo", description: "Stochastic financial modeling", icon: Zap, action: () => onNavigate("simulation"), category: "Analysis", shortcut: "Cmd+5" },
        { id: "signals", title: "Signals", description: "Real-time market events", icon: Activity, action: () => onNavigate("signals"), category: "Navigation", shortcut: "Cmd+6" },
        { id: "dataroom", title: "Data Room", description: "Upload and analyze documents", icon: FolderOpen, action: () => onNavigate("dataroom"), category: "Tools", shortcut: "Cmd+7" },
        { id: "governance", title: "Governance", description: "Compliance and audit monitoring", icon: ShieldCheck, category: "Navigation", action: () => onNavigate("governance"), shortcut: "Cmd+8" },
        { id: "logout", title: "Sign Out", description: "End your session", icon: LogOut, category: "Account", action: () => { window.location.href = "/login" } },
    ];

    const filtered = commands.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setSearch("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((i) => (i + 1) % filtered.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const cmd = filtered[selectedIndex];
            if (cmd) {
                saveRecent(cmd.id);
                cmd.action();
                onClose();
            }
        } else if (e.key === "Escape") {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-xl"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -16 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="relative w-full max-w-xl bg-surface-overlay border border-surface-glass-border rounded-2xl shadow-[0_32px_100px_rgba(0,0,0,0.7)] overflow-hidden"
                    >
                        <div className="p-4 border-b border-surface-glass-border flex items-center gap-3">
                            <Search className="h-5 w-5 text-text-dim" />
                            <input
                                ref={inputRef}
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
                                onKeyDown={handleKeyDown}
                                placeholder="Search commands..."
                                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-text-dim text-base"
                            />
                            <kbd className="px-2 py-1 rounded-lg bg-surface-glass border border-surface-glass-border text-[10px] text-text-dim font-mono">
                                ESC
                            </kbd>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto p-2 space-y-0.5 scrollbar-hide">
                            {filtered.length > 0 ? (
                                <>
                                    {search === "" && recentSearches.length > 0 && (
                                        <div className="px-3 pt-2 pb-1.5 text-[11px] text-text-dim font-medium">Recent</div>
                                    )}
                                    {filtered.map((cmd, idx) => (
                                        <button
                                            key={cmd.id}
                                            onClick={() => { saveRecent(cmd.id); cmd.action(); onClose(); }}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                                                selectedIndex === idx ? "bg-brand-blue/10 text-white" : "hover:bg-surface-glass text-text-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2 rounded-lg shrink-0 transition-colors",
                                                selectedIndex === idx ? "bg-brand-blue text-white" : "bg-surface-glass border border-surface-glass-border/60 text-text-dim"
                                            )}>
                                                <cmd.icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium">
                                                    <HighlightMatch text={cmd.title} match={search} />
                                                </div>
                                                <p className="text-xs text-text-dim truncate">{cmd.description}</p>
                                            </div>

                                            {cmd.shortcut && (
                                                <kbd className={cn(
                                                    "px-2 py-1 rounded-lg border text-[10px] font-mono shrink-0",
                                                    selectedIndex === idx ? "bg-white/10 border-white/20 text-white" : "bg-surface-base border-surface-glass-border text-text-dim"
                                                )}>
                                                    {cmd.shortcut}
                                                </kbd>
                                            )}

                                            {selectedIndex === idx && (
                                                <ArrowRight className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <div className="p-12 text-center">
                                    <Search className="h-10 w-10 text-text-dim/30 mx-auto mb-4" />
                                    <h4 className="text-sm font-medium text-white mb-1">No results</h4>
                                    <p className="text-xs text-text-muted">Try a different search term.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-surface-base/40 border-t border-surface-glass-border flex items-center justify-between text-[11px] text-text-dim">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1.5">
                                    <kbd className="px-1.5 py-0.5 rounded bg-surface-glass border border-surface-glass-border text-[10px] font-mono">&#8593;&#8595;</kbd>
                                    Navigate
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <kbd className="px-1.5 py-0.5 rounded bg-surface-glass border border-surface-glass-border text-[10px] font-mono">&#9166;</kbd>
                                    Open
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}