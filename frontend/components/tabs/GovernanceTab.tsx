import React from "react";
import {
    ShieldCheck,
    CheckCircle2,
    XCircle,
    Clock,
    ExternalLink,
    Lock,
    ShieldAlert,
    TrendingUp,
    FlaskConical
} from "lucide-react";
import { motion } from "framer-motion";
import {
    ResponsiveContainer,
    Area,
    AreaChart
} from "recharts";
import { cn } from "@/lib/utils";

const COMPLIANCE_FRAMEWORKS = [
    { name: "SOC 2 Type II", status: "pass", lastAudit: "2025-12-10", details: "All 5 Trust Services Criteria met." },
    { name: "GDPR / CCPA", status: "pass", lastAudit: "2026-01-15", details: "Data residency and right-to-erase protocols verified." },
    { name: "Investment Policy", status: "warning", lastAudit: "2026-03-01", details: "Sector concentration slightly exceeds 25% threshold." },
    { name: "ESG Standard", status: "pass", lastAudit: "2025-11-20", details: "Carbon footprint disclosure requirements fulfilled." },
];

const AUDIT_LOG = [
    { action: "Policy Override", actor: "SR VP Invest", time: "2h ago", details: "Manual approval for TechNexus exposure increase." },
    { action: "Data Access", actor: "Nexus Agent", time: "5h ago", details: "Accessed PII-redacted 10-Q raw artifacts." },
    { action: "Key Rotation", actor: "System Auth", time: "1d ago", details: "Production database encryption keys rotated." },
];

const TREND_DATA = [
    { score: 82 }, { score: 84 }, { score: 83 }, { score: 86 }, { score: 85 }, { score: 88 }
];

export function GovernanceTab() {
    const score = 88;
    const strokeWidth = 14;
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Governance & Compliance</h2>
                        <div className="px-2 py-0.5 bg-brand-purple/10 border border-brand-purple/20 rounded-lg text-[10px] font-medium text-brand-purple flex items-center gap-1">
                            <FlaskConical className="h-2.5 w-2.5" /> Sample
                        </div>
                    </div>
                    <p className="text-text-muted mt-1 text-sm">Continuous monitoring of regulatory frameworks and investment policies.</p>
                </div>
                <div className="px-4 py-2 bg-success/10 border border-success/20 rounded-xl text-success text-xs font-medium flex items-center gap-2">
                    <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
                    All systems compliant
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {}
                <div className="bg-surface-glass border border-surface-glass-border rounded-2xl p-8 flex flex-col items-center justify-center relative group overflow-hidden">
                    <h3 className="text-xs text-text-dim mb-8 font-medium">Health Index</h3>

                    <div className="relative flex items-center justify-center mb-6">
                        {}
                        <div className="absolute inset-0 bg-brand-blue/5 rounded-full blur-2xl scale-110 group-hover:bg-brand-blue/10 transition-all" />
                        <svg className="w-48 h-48 -rotate-90 relative z-10">
                            <defs>
                                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="var(--brand-blue)" />
                                    <stop offset="100%" stopColor="var(--brand-indigo)" />
                                </linearGradient>
                            </defs>
                            <circle
                                cx="96"
                                cy="96"
                                r={radius}
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth={strokeWidth}
                                className="text-foreground/5"
                            />
                            <motion.circle
                                cx="96"
                                cy="96"
                                r={radius}
                                fill="transparent"
                                stroke="url(#scoreGrad)"
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: offset }}
                                transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <motion.span
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                                className="text-5xl font-bold font-data tracking-tighter"
                            >
                                {score}
                            </motion.span>
                            <span className="text-[10px] text-text-dim mt-1">Aggregate</span>
                        </div>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-text-muted flex items-center gap-1.5">
                                <TrendingUp className="h-3 w-3" /> 6-month trend
                            </span>
                            <span className="text-xs font-medium text-success">+4.2%</span>
                        </div>
                        <div className="h-10 w-full opacity-60">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={TREND_DATA}>
                                    <defs>
                                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--brand-blue)" stopOpacity={0.2} />
                                            <stop offset="100%" stopColor="var(--brand-blue)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area
                                        type="monotone"
                                        dataKey="score"
                                        stroke="var(--brand-blue)"
                                        strokeWidth={2}
                                        fill="url(#trendFill)"
                                        dot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 w-full">
                        <div className="text-center p-3 bg-surface-base/40 rounded-xl border border-surface-glass-border">
                            <div className="text-[10px] text-text-dim mb-0.5">Risk Buffer</div>
                            <div className="text-lg font-bold font-data text-success">12.5%</div>
                        </div>
                        <div className="text-center p-3 bg-surface-base/40 rounded-xl border border-surface-glass-border">
                            <div className="text-[10px] text-text-dim mb-0.5">Violations</div>
                            <div className="text-lg font-bold font-data text-white">0</div>
                        </div>
                    </div>
                </div>

                {}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs text-text-dim font-medium">Compliance Frameworks</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {COMPLIANCE_FRAMEWORKS.map((fw, idx) => (
                            <motion.div
                                key={fw.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.08 }}
                                className="bg-surface-glass border border-surface-glass-border rounded-2xl p-6 hover:border-brand-blue/15 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={cn(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-medium border",
                                        fw.status === "pass" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                                    )}>
                                        {fw.status === "pass" ? "Passed" : "Warning"}
                                    </div>
                                    <div className="text-[10px] text-text-dim font-data">
                                        Last: {fw.lastAudit}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div className={cn(
                                        "p-2 rounded-xl border transition-colors",
                                        fw.status === "pass" ? "bg-surface-glass border-success/20 text-success" : "bg-surface-glass border-warning/20 text-warning"
                                    )}>
                                        {fw.status === "pass" ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                                    </div>
                                    <h4 className="text-base font-medium text-foreground/90 group-hover:text-white transition-colors">{fw.name}</h4>
                                </div>

                                <p className="text-sm text-text-muted leading-relaxed mb-4">
                                    {fw.details}
                                </p>

                                {}
                                <div className="h-1.5 bg-surface-base rounded-full overflow-hidden mb-4">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: fw.status === "pass" ? "100%" : "75%" }}
                                        transition={{ duration: 1.5, delay: idx * 0.1 }}
                                        className={cn("h-full rounded-full", fw.status === "pass" ? "bg-success" : "bg-warning")}
                                    />
                                </div>

                                <button className="w-full py-2.5 bg-surface-base/50 hover:bg-surface-base border border-surface-glass-border rounded-xl text-xs font-medium text-brand-blue flex items-center justify-center gap-1.5 transition-all">
                                    View documentation <ExternalLink className="h-3 w-3" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {}
            <div className="space-y-4">
                <h3 className="text-xs text-text-dim font-medium">Audit Log</h3>
                <div className="bg-surface-glass border border-surface-glass-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-base/50 border-b border-surface-glass-border">
                                <tr>
                                    <th className="px-6 py-4 text-[11px] text-text-dim font-medium">Action</th>
                                    <th className="px-6 py-4 text-[11px] text-text-dim font-medium">Actor</th>
                                    <th className="px-6 py-4 text-[11px] text-text-dim font-medium">Time</th>
                                    <th className="px-6 py-4 text-[11px] text-text-dim font-medium">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-glass-border">
                                {AUDIT_LOG.map((log, idx) => (
                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className={cn(
                                                    "p-1.5 rounded-lg bg-surface-glass border border-surface-glass-border",
                                                    log.action.includes("Policy") ? "text-warning" : "text-brand-blue"
                                                )}>
                                                    {log.action.includes("Policy") ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                                                </div>
                                                <span className="font-medium text-foreground/90 group-hover:text-white transition-colors">{log.action}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-xs bg-brand-blue/10 px-2.5 py-1 rounded-lg text-brand-blue border border-brand-blue/15 font-mono">
                                                {log.actor}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 text-text-dim font-data text-xs">{log.time}</td>
                                        <td className="px-6 py-4 text-xs text-text-muted">{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}