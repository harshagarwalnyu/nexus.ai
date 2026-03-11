import React from "react";
import {
    TrendingUp,
    ShieldAlert,
    Target,
    BarChart3,
    ArrowUpRight,
    Minus,
    Zap,
    FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";

const SWOT = [
    { label: "Strengths", items: ["Proprietary AI Moat", "85% Gross Margins", "Network Effects"], color: "text-success", borderColor: "border-l-success", icon: Zap },
    { label: "Weaknesses", items: ["High Key Person Risk", "Slow Enterprise Sales Cycle", "Tech Debt in Legacy Core"], color: "text-warning", borderColor: "border-l-warning", icon: ShieldAlert },
    { label: "Opportunities", items: ["Market Expansion (APAC)", "Cross-sell to FinTech Arm", "GenAI Native Integration"], color: "text-brand-blue", borderColor: "border-l-brand-blue", icon: Target },
    { label: "Threats", items: ["Open Source Encroachment", "Regulatory Headwinds (GDPR)", "Top Talent Attrition"], color: "text-error", borderColor: "border-l-error", icon: TrendingUp },
];

const METRICS = [
    { label: "ARR (Current)", value: 124000000, change: 42, isCurrency: true },
    { label: "Net Retention", value: 118, change: 2, isPercent: true },
    { label: "LTV / CAC", value: "6.4x", change: "Top Decile" },
    { label: "Burn Multiple", value: "0.8x", change: "Highly Efficient" },
];

const RISK_REGISTER = [
    { risk: "Data Sovereignty", impact: "High", probability: "Medium", mitigation: "Regional data silos with automated compliance routing" },
    { risk: "Compute Availability", impact: "Critical", probability: "Low", mitigation: "Multi-cloud reserve capacity with auto-failover" },
    { risk: "Model Collapse", impact: "Medium", probability: "Low", mitigation: "Synthetic data pipeline with drift detection" },
];

export function ResearchTab() {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-surface-glass-border pb-8">
                <div>
                    <span className="tactical-header mb-3">Intelligence Mandate: Alpha-01</span>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Strategic Investment Brief</h2>
                        <div className="px-2 py-0.5 bg-brand-purple/10 border border-brand-purple/20 rounded-lg text-[10px] font-medium text-brand-purple flex items-center gap-1">
                            <FlaskConical className="h-2.5 w-2.5" /> Sample
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-brand-blue font-mono text-xs">March 2026</span>
                        <div className="w-1 h-1 rounded-full bg-text-dim" />
                        <span className="text-text-muted">Entity: <span className="text-white font-medium">Nexus Core Alpha</span></span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-surface-glass border border-surface-glass-border rounded-xl">
                        <div className="text-[11px] text-text-dim mb-0.5">Thesis Confidence</div>
                        <div className="text-sm font-semibold font-data text-success">92% — High</div>
                    </div>
                </div>
            </div>

            {}
            <section className="space-y-3">
                <h3 className="text-sm font-medium text-text-dim flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Executive Summary
                </h3>
                <div className="bg-surface-glass border border-surface-glass-border rounded-2xl p-8 relative overflow-hidden border-l-4 border-l-brand-blue">
                    <p className="text-lg leading-relaxed text-foreground/90 relative z-10">
                        The target exhibits <span className="text-brand-blue font-medium">exceptional unit economics</span> and a defensible data moat.
                        Recent 10-Q analysis confirms that their transition to a consumption-based pricing model has unlocked
                        a secondary growth vector in the APAC region. Strategic positioning remains <span className="text-success font-medium">dominant</span> despite
                        increased competition from open-source alternatives.
                    </p>
                </div>
            </section>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {METRICS.map(m => (
                    <div key={m.label} className="bg-surface-glass border border-surface-glass-border p-5 rounded-2xl hover:border-brand-blue/20 transition-all">
                        <div className="text-[11px] text-text-dim mb-2 font-mono">{m.label}</div>
                        <div className="text-2xl font-bold font-data mb-1">
                            {typeof m.value === 'number'
                                ? (m.isCurrency ? formatCurrency(m.value) : m.isPercent ? formatPercent(m.value) : m.value)
                                : m.value}
                        </div>
                        <div className="text-xs font-medium text-success flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" /> {typeof m.change === 'number' ? formatPercent(m.change) : m.change} {typeof m.change === 'number' ? 'YoY' : ''}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {}
                <section className="space-y-3">
                    <h3 className="text-sm font-medium text-text-dim">SWOT Analysis</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {SWOT.map((s) => (
                            <div key={s.label} className={cn("bg-surface-base border border-surface-glass-border p-5 rounded-xl border-l-4", s.borderColor, "hover:bg-surface-glass transition-colors")}>
                                <div className={cn("flex items-center gap-2 mb-3 font-medium text-sm", s.color)}>
                                    <s.icon className="h-4 w-4" />
                                    {s.label}
                                </div>
                                <ul className="space-y-2.5">
                                    {s.items.map(item => (
                                        <li key={item} className="flex items-start gap-2 text-xs text-text-muted group">
                                            <Minus className="h-3 w-3 mt-0.5 shrink-0 opacity-20 group-hover:opacity-60 transition-opacity" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

                {}
                <section className="space-y-3">
                    <h3 className="text-sm font-medium text-text-dim">Risk Register</h3>
                    <div className="bg-surface-glass border border-surface-glass-border rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-[12px]">
                            <thead className="bg-surface-glass border-b border-surface-glass-border text-text-dim">
                                <tr>
                                    <th className="px-5 py-3 text-[11px] font-medium">Risk</th>
                                    <th className="px-5 py-3 text-[11px] font-medium">Impact</th>
                                    <th className="px-5 py-3 text-[11px] font-medium">Mitigation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-glass-border">
                                {RISK_REGISTER.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-surface-glass transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="font-medium text-foreground/90">{r.risk}</div>
                                            <div className="text-[10px] text-text-dim mt-0.5">Probability: {r.probability}</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                                r.impact === "Critical" ? "bg-error/20 text-error" :
                                                r.impact === "High" ? "bg-warning/20 text-warning" : "bg-brand-blue/20 text-brand-blue"
                                            )}>
                                                {r.impact}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-text-muted max-w-[200px]">{r.mitigation}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {}
            <section className="space-y-3">
                <h3 className="text-sm font-medium text-text-dim">Comparable Transactions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { name: "SaaS Alpha Buyout", multiple: "14.2x EV/ARR", date: "Jan 2026" },
                        { name: "Project Beta Merger", multiple: "11.8x EV/ARR", date: "Nov 2025" },
                        { name: "Gamma AI Exit", multiple: "18.5x EV/ARR", date: "Feb 2026" },
                    ].map((tx, idx) => (
                        <div key={idx} className="bg-surface-glass border border-surface-glass-border rounded-xl p-5 group hover:border-brand-blue/20 transition-all">
                            <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-medium text-foreground/90">{tx.name}</div>
                                <div className="text-sm font-bold text-brand-blue font-data group-hover:scale-105 transition-transform origin-right">
                                    {tx.multiple}
                                </div>
                            </div>
                            <div className="text-xs text-text-dim font-data">{tx.date}</div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}