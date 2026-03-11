import React, { useState } from "react";
import {
    Activity,
    Filter,
    ChevronRight,
    Zap,
    AlertTriangle,
    TrendingUp,
    Globe,
    Search,
    Clock,
    ShieldCheck,
    FlaskConical
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SIGNALS = [
    {
        id: "SIG-001",
        category: "Regulatory",
        title: "SEC 10-K Filing Update",
        entity: "DataNexus Corp",
        summary: "Significant shift in revenue recognition policy detected. Potential impact on Q4 guidance and long-term moat sustainability.",
        severity: "high",
        timestamp: "12m ago",
    },
    {
        id: "SIG-002",
        category: "Market",
        title: "Competitor Series C Pricing",
        entity: "CloudScale AI",
        summary: "Rival entity raised $200M at 40x ARR. Implies sector-wide multiple expansion but increased CAC risk for PayFlow.",
        severity: "medium",
        timestamp: "2h ago",
    },
    {
        id: "SIG-003",
        category: "Sentiment",
        title: "CEO Glassdoor Trend Shift",
        entity: "MedSync",
        summary: "Employee sentiment dropped 15% in 30 days. Correlated historically with R&D slippage and key talent attrition.",
        severity: "low",
        timestamp: "5h ago",
    },
    {
        id: "SIG-004",
        category: "Geo-Strategic",
        title: "Taiwan Semiconductor Lead Times",
        entity: "Hardware Portfolio",
        summary: "Wait times for H100 equivalents increased to 42 weeks. Supply chain risk for autonomous infrastructure mandates.",
        severity: "high",
        timestamp: "1d ago",
    },
    {
        id: "SIG-005",
        category: "Product",
        title: "LLM Inference API Versioning",
        entity: "Core Platform",
        summary: "Upcoming deprecation of legacy embedding models. Migration required to maintain semantic search accuracy across historical documents.",
        severity: "low",
        timestamp: "3h ago",
    },
];

const CATEGORIES = ["All", "Regulatory", "Market", "Sentiment", "Geo-Strategic", "Product"];
const SEVERITIES = ["All", "High", "Medium", "Low"];

const SEVERITY_COLORS: Record<string, string> = {
    high: "border-l-error",
    medium: "border-l-warning",
    low: "border-l-brand-blue",
};

export function SignalsTab({ onAnalyze }: { onAnalyze?: (query: string) => void }) {
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedSeverity, setSelectedSeverity] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [reviewedSignals, setReviewedSignals] = useState<Set<string>>(new Set());

    const toggleReviewed = (id: string) => {
        const next = new Set(reviewedSignals);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setReviewedSignals(next);
    };

    const severityDistribution = [
        { name: "High", value: 42, color: "bg-error", textColor: "text-error" },
        { name: "Medium", value: 28, color: "bg-warning", textColor: "text-warning" },
        { name: "Low", value: 30, color: "bg-brand-blue", textColor: "text-brand-blue" },
    ];

    const filteredSignals = SIGNALS.filter(s => {
        const categoryMatch = selectedCategory === "All" || s.category === selectedCategory;
        const severityMatch = selectedSeverity === "All" || s.severity === selectedSeverity.toLowerCase();
        const searchMatch = searchQuery === "" ||
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.entity.toLowerCase().includes(searchQuery.toLowerCase());
        return categoryMatch && severityMatch && searchMatch;
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Signals</h2>
                        <div className="px-2 py-0.5 bg-brand-purple/10 border border-brand-purple/20 rounded-lg text-[10px] font-medium text-brand-purple flex items-center gap-1">
                            <FlaskConical className="h-2.5 w-2.5" /> Sample
                        </div>
                    </div>
                    <p className="text-text-muted mt-1 text-sm">Real-time events from SEC filings, market data, and alternative sources.</p>
                </div>

                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim group-focus-within:text-brand-blue transition-colors" />
                    <input
                        type="text"
                        placeholder="Search signals..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-surface-glass border border-surface-glass-border rounded-xl py-2.5 pl-10 pr-4 text-sm w-full md:w-56 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 transition-all"
                    />
                </div>
            </div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {severityDistribution.map(item => (
                    <div key={item.name} className="bg-surface-glass border border-surface-glass-border p-5 rounded-2xl flex items-center justify-between">
                        <div>
                            <div className={cn("text-xs text-text-dim mb-1")}>{item.name} severity</div>
                            <div className="text-2xl font-bold font-data tracking-tight">{item.value}%</div>
                        </div>
                        <div className="h-2 w-28 bg-surface-base rounded-full overflow-hidden border border-surface-glass-border/30">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${item.value}%` }}
                                transition={{ duration: 1.2, ease: "easeOut" }}
                                className={cn("h-full rounded-full", item.color)}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {}
            <div className="flex flex-wrap gap-4 p-4 bg-surface-base/30 rounded-xl border border-surface-glass-border/40">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-text-dim mr-1">Category</span>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                selectedCategory === cat
                                    ? "bg-brand-blue text-white border-brand-blue"
                                    : "bg-surface-glass text-text-dim border-surface-glass-border hover:text-white"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-text-dim mr-1">Severity</span>
                    {SEVERITIES.map(sev => (
                        <button
                            key={sev}
                            onClick={() => setSelectedSeverity(sev)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                selectedSeverity === sev
                                    ? "bg-error text-white border-error"
                                    : "bg-surface-glass text-text-dim border-surface-glass-border hover:text-white"
                            )}
                        >
                            {sev}
                        </button>
                    ))}
                </div>
            </div>

            {}
            <div className="grid grid-cols-1 gap-3">
                <AnimatePresence mode="popLayout">
                    {filteredSignals.map((signal, idx) => (
                        <motion.div
                            key={signal.id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: reviewedSignals.has(signal.id) ? 0.4 : 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ delay: idx * 0.04 }}
                            className={cn(
                                "group bg-surface-glass border rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center gap-5 transition-all border-l-4",
                                SEVERITY_COLORS[signal.severity] || "border-l-surface-glass-border",
                                signal.severity === "high" && !reviewedSignals.has(signal.id) ? "border-error/30" : "border-surface-glass-border"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-xl shrink-0",
                                signal.severity === "high" ? "bg-error/10 text-error" :
                                signal.severity === "medium" ? "bg-warning/10 text-warning" :
                                "bg-brand-blue/10 text-brand-blue"
                            )}>
                                {signal.category === "Regulatory" && <Globe className="h-5 w-5" />}
                                {signal.category === "Market" && <TrendingUp className="h-5 w-5" />}
                                {signal.category === "Sentiment" && <Activity className="h-5 w-5" />}
                                {signal.category === "Geo-Strategic" && <AlertTriangle className="h-5 w-5" />}
                                {signal.category === "Product" && <Zap className="h-5 w-5" />}
                            </div>

                            <div className="flex-1 space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-text-dim font-mono">{signal.id}</span>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                        signal.severity === "high" ? "bg-error text-white" :
                                        signal.severity === "medium" ? "bg-warning/20 text-warning" :
                                        "bg-brand-blue/20 text-brand-blue"
                                    )}>
                                        {signal.severity}
                                    </span>
                                    {reviewedSignals.has(signal.id) && (
                                        <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">Reviewed</span>
                                    )}
                                </div>
                                <h3 className="text-base font-medium text-foreground/90 group-hover:text-white transition-colors">
                                    {signal.title} — <span className="text-brand-blue">{signal.entity}</span>
                                </h3>
                                <p className="text-sm text-text-muted leading-relaxed max-w-3xl">
                                    {signal.summary}
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-3 min-w-[140px]">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-xs text-text-dim font-data">
                                        <Clock className="h-3 w-3" />
                                        {signal.timestamp}
                                    </div>
                                    <button
                                        onClick={() => toggleReviewed(signal.id)}
                                        className={cn(
                                            "h-5 w-5 rounded-full border flex items-center justify-center transition-all",
                                            reviewedSignals.has(signal.id)
                                                ? "bg-success border-success text-white"
                                                : "border-surface-glass-border text-transparent hover:border-text-dim"
                                        )}
                                        title="Mark as reviewed"
                                    >
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => onAnalyze?.(`Analyze signal ${signal.id}: ${signal.title} for ${signal.entity}`)}
                                    className="flex items-center gap-1.5 bg-surface-glass border border-surface-glass-border text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all group/btn hover:bg-surface-glass/80"
                                >
                                    Analyze
                                    <ChevronRight className="h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {filteredSignals.length === 0 && (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                    <Activity className="h-12 w-12 text-text-dim/30 mb-3" />
                    <p className="text-sm text-text-muted">No signals match your filters.</p>
                    <button
                        onClick={() => { setSelectedCategory("All"); setSelectedSeverity("All"); setSearchQuery(""); }}
                        className="mt-3 text-xs text-brand-blue hover:text-blue-400 transition-colors"
                    >
                        Clear filters
                    </button>
                </div>
            )}
        </div>
    );
}