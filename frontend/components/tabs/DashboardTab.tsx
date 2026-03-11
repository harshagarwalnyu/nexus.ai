import React, { useState, useEffect } from "react";
import {
    Layout,
    TrendingUp,
    AlertCircle,
    FileText,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Filter
} from "lucide-react";
import { motion } from "framer-motion";
import {
    Treemap,
    ResponsiveContainer,
    Tooltip,
    Area,
    AreaChart
} from "recharts";
import { cn } from "@/lib/utils";
import {
    formatPercent,
    formatCurrency
} from "@/lib/format";
import { toast } from "@/lib/toast";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";

function AnimatedNumber({ value, suffix = "" }: { value: string, suffix?: string }) {
    const [displayValue, setDisplayValue] = useState(0);
    const targetValue = parseInt(value.replace(/[^0-9]/g, ""));

    useEffect(() => {
        let startTimestamp: number | null = null;
        const duration = 1500;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setDisplayValue(Math.floor(easeProgress * targetValue));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [targetValue]);

    const formatted = displayValue.toString().padStart(value.length, '0');
    return <span>{formatted}{suffix}</span>;
}

const portfolioData = [
    {
        name: "Enterprise Software",
        children: [
            { name: "SaaS Pro", size: 400, color: "var(--brand-blue)" },
            { name: "CloudScale", size: 300, color: "var(--brand-blue)" },
            { name: "DataNexus", size: 200, color: "var(--brand-blue)" },
        ],
    },
    {
        name: "FinTech",
        children: [
            { name: "PayFlow", size: 500, color: "var(--brand-indigo)" },
            { name: "BankLink", size: 250, color: "var(--brand-indigo)" },
        ],
    },
    {
        name: "Healthcare",
        children: [
            { name: "BioTech AI", size: 350, color: "var(--brand-purple)" },
            { name: "MedSync", size: 150, color: "var(--brand-purple)" },
        ],
    },
];

const KPI_CARDS = [
    {
        label: "Active Deals",
        value: "24",
        change: 12,
        trend: "up",
        icon: Layout,
        gradient: "from-brand-blue/10 to-transparent",
        sparkline: [10, 15, 8, 20, 18, 24]
    },
    {
        label: "Red Flags",
        value: "07",
        change: -2,
        trend: "down",
        icon: AlertCircle,
        color: "text-error",
        gradient: "from-error/5 to-transparent",
        sparkline: [2, 5, 8, 4, 9, 7]
    },
    {
        label: "Avg Survival Score",
        value: "82",
        change: 5,
        trend: "up",
        icon: Activity,
        gradient: "from-accent-teal/8 to-transparent",
        sparkline: [70, 75, 72, 78, 80, 82]
    },
    {
        label: "Reports Generated",
        value: "148",
        change: 18,
        trend: "up",
        icon: FileText,
        gradient: "from-brand-purple/8 to-transparent",
        sparkline: [100, 110, 105, 125, 135, 148]
    },
];

const RECENT_ACTIVITY = [
    { time: "2h ago", event: "Red Flag Detected", entity: "DataNexus 10-K", type: "error" },
    { time: "4h ago", event: "Brief Synthesized", entity: "BioTech AI Series B", type: "success" },
    { time: "1d ago", event: "Simulation Completed", entity: "Portfolio Q3 Stress Test", type: "info" },
];

const RECENT_SIGNALS = [
    { id: "SIG-001", title: "Revenue Recognition Shift", entity: "DataNexus", severity: "high" },
    { id: "SIG-002", title: "Multiple Expansion", entity: "CloudScale", severity: "medium" },
];

export function DashboardTab({ onNavigate }: { onNavigate?: (id: string) => void }) {
    const handleAction = (action: string) => {
        toast.info(`${action} initializing...`);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <span className="tactical-header mb-2">Lead Strategist Terminal</span>
                    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">Portfolio Overview</h2>
                    <p className="text-text-muted mt-1 text-sm">Real-time intelligence across all active mandates.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleAction("Filter")}
                        aria-label="Filter portfolio"
                        className="flex items-center gap-2 px-4 py-2 bg-surface-glass border border-surface-glass-border rounded-xl text-xs font-medium hover:bg-surface-glass/80 transition-all"
                    >
                        <Filter className="h-3 w-3" /> Filter
                    </button>
                    <button
                        onClick={() => handleAction("Global Search")}
                        aria-label="Search mandates"
                        className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-medium hover:bg-blue-500 transition-all shadow-lg"
                    >
                        <Search className="h-3 w-3" /> Search
                    </button>
                </div>
            </div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {KPI_CARDS.map((card, idx) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.08 }}
                        className={cn(
                            "bg-surface-glass border border-surface-glass-border p-5 rounded-2xl relative overflow-hidden group hover:border-surface-glass-border/60 transition-all",
                        )}
                    >
                        {}
                        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", card.gradient)} />

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-surface-glass rounded-lg border border-surface-glass-border/60">
                                    <card.icon className={cn("h-4 w-4", card.color || "text-brand-blue")} />
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1 text-xs font-medium font-data",
                                    card.trend === "up" ? "text-success" : "text-error"
                                )}>
                                    {card.change > 0 ? "+" : ""}{typeof card.change === 'number' ? formatPercent(card.change) : card.change}
                                    {card.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                </div>
                            </div>

                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-3xl font-bold tracking-tight font-data mb-0.5">
                                        <AnimatedNumber value={card.value} />
                                    </div>
                                    <div className="text-xs text-text-dim font-medium">{card.label}</div>
                                </div>

                                {}
                                <div className="w-20 h-10 opacity-60">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={card.sparkline.map(v => ({ v }))}>
                                            <defs>
                                                <linearGradient id={`spark-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={card.trend === "up" ? "var(--success)" : "var(--error)"} stopOpacity={0.3} />
                                                    <stop offset="100%" stopColor={card.trend === "up" ? "var(--success)" : "var(--error)"} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="v"
                                                stroke={card.trend === "up" ? "var(--success)" : "var(--error)"}
                                                strokeWidth={2}
                                                fill={`url(#spark-${idx})`}
                                                dot={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {}
                <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-foreground/80">Asset Allocation</h3>
                        <div className="flex items-center gap-4 text-[11px] text-text-dim">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand-blue"></div> Software</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand-indigo"></div> FinTech</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand-purple"></div> Health</div>
                        </div>
                    </div>
                    <div className="h-[400px] bg-surface-glass border border-surface-glass-border rounded-2xl p-4 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                                data={portfolioData}
                                dataKey="size"
                                stroke="var(--background)"
                                fill="var(--foreground)"
                                content={<CustomTreemapContent />}
                            >
                                <Tooltip
                                    formatter={(value: any) => [formatCurrency(Number(value) * 100000), "Allocation"]}
                                    contentStyle={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--surface-glass-border)", borderRadius: "12px", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
                                    itemStyle={{ color: "var(--foreground)", fontSize: "12px", fontWeight: "500" }}
                                />
                            </Treemap>
                        </ResponsiveContainer>
                    </div>
                </div>

                {}
                <div className="space-y-6">
                    {}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-foreground/80">Recent Activity</h3>
                        <div className="bg-surface-glass border border-surface-glass-border rounded-2xl p-5 space-y-5">
                            {RECENT_ACTIVITY.map((item, idx) => (
                                <div key={idx} className="flex gap-3 group cursor-pointer" onClick={() => onNavigate?.("signals")}>
                                    <div className="flex flex-col items-center">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full mb-2 shrink-0",
                                            item.type === "error" ? "bg-error" :
                                            item.type === "success" ? "bg-success" :
                                            item.type === "info" ? "bg-brand-blue" : "bg-text-dim"
                                        )} />
                                        {idx !== RECENT_ACTIVITY.length - 1 && <div className="flex-1 w-px bg-surface-glass-border" />}
                                    </div>
                                    <div className="pb-1">
                                        <div className="text-[11px] text-text-dim font-data mb-0.5">{item.time}</div>
                                        <div className="text-sm font-medium text-foreground/90 group-hover:text-brand-blue transition-colors">{item.event}</div>
                                        <div className="text-xs text-text-muted mt-0.5">{item.entity}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-foreground/80">Critical Signals</h3>
                        <div className="bg-surface-glass border border-surface-glass-border rounded-2xl p-5 space-y-3">
                            {RECENT_SIGNALS.map((sig) => (
                                <div key={sig.id} className="p-3.5 bg-surface-base/30 border border-surface-glass-border rounded-xl hover:bg-surface-glass transition-all group cursor-pointer" onClick={() => onNavigate?.("signals")}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] text-text-dim font-mono">{sig.id}</span>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                            sig.severity === "high" ? "bg-error/20 text-error" : "bg-brand-blue/20 text-brand-blue"
                                        )}>{sig.severity}</span>
                                    </div>
                                    <div className="text-sm font-medium text-foreground/90 group-hover:text-brand-blue transition-colors">{sig.title}</div>
                                    <div className="text-xs text-text-muted mt-0.5">{sig.entity}</div>
                                </div>
                            ))}
                            <button
                                onClick={() => onNavigate?.("signals")}
                                className="w-full py-2.5 bg-surface-glass hover:bg-surface-glass/80 border border-surface-glass-border/60 rounded-xl text-xs font-medium transition-all text-text-muted hover:text-white"
                            >
                                View all signals
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface TreemapProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    index?: number;
    name?: string;
    color?: string;
}

function CustomTreemapContent(props: TreemapProps) {
    const { x = 0, y = 0, width = 0, height = 0, name, color } = props;
    const gradId = `grad-${name?.replace(/\s+/g, "-")}`;

    return (
        <g>
            <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color || "var(--brand-blue)"} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={color || "var(--brand-blue)"} stopOpacity={0.3} />
                </linearGradient>
            </defs>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={`url(#${gradId})`}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
                rx={4}
                className="hover:brightness-125 transition-all cursor-pointer"
            />
            {width > 60 && height > 40 && (
                <text
                    x={x + 10}
                    y={y + 22}
                    fill="var(--foreground)"
                    style={{ fontSize: "11px", fontWeight: "500", opacity: 0.9 }}
                >
                    {name}
                </text>
            )}
        </g>
    );
}