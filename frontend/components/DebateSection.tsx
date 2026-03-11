import React, { useState, useEffect } from "react";
import { ShieldCheck, TrendingDown, Gavel, PlayCircle, Loader2, AlertTriangle, ChevronRight, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

interface Threat {
    persona: string;
    threat: string;
    details: string;
}

interface RebuttalEvaluation {
    score_change: number;
    feedback: string;
}

export function DebateSection({ accountId }: { accountId: string }) {
    const [threats, setThreats] = useState<Threat[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [survivalScore, setSurvivalScore] = useState<number>(100);

    const [activeThreatIndex, setActiveThreatIndex] = useState<number>(0);
    const [rebuttalInput, setRebuttalInput] = useState<string>("");
    const [evaluating, setEvaluating] = useState(false);
    const [evaluations, setEvaluations] = useState<Record<number, RebuttalEvaluation>>({});
    const [liveDirective, setLiveDirective] = useState<string>("");
    const [wsConnected, setWsConnected] = useState(false);
    const docRef = React.useRef<Y.Doc | null>(null);

    useEffect(() => {
        const doc = new Y.Doc();
        docRef.current = doc;
        const wsUrl = process.env.NEXT_PUBLIC_YJS_WS_URL || 'ws://localhost:3001';

        const provider = new WebsocketProvider(wsUrl, `nexus-room-${accountId}`, doc);

        provider.on('status', (event: { status: string }) => {
            setWsConnected(event.status === 'connected');
        });

        const yThreats = doc.getArray<Threat>('threats');
        const yScore = doc.getMap('score');
        const yEvaluations = doc.getMap<RebuttalEvaluation>('evaluations');
        const yDirective = doc.getText('yDirective');

        const updateState = () => {
            setThreats(yThreats.toArray());
            setSurvivalScore(yScore.get('value') as number ?? 100);
            setEvaluations(yEvaluations.toJSON() as Record<number, RebuttalEvaluation>);
            setLiveDirective(yDirective.toString());
        };

        yThreats.observe(updateState);
        yScore.observe(updateState);
        yEvaluations.observe(updateState);
        yDirective.observe(updateState);

        return () => {
            provider.destroy();
            doc.destroy();
        };
    }, [accountId]);

    const runThreatGeneration = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/v1/research/warroom/threats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_id: accountId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (docRef.current) {
                const doc = docRef.current;
                const yThreats = doc.getArray<Threat>('threats');
                const yScore = doc.getMap('score');
                const yEvaluations = doc.getMap<RebuttalEvaluation>('evaluations');

                doc.transact(() => {
                    yThreats.delete(0, yThreats.length);
                    yThreats.push(data.threats || []);
                    yScore.set('value', 100);
                    const evalKeys = Object.keys(yEvaluations.toJSON());
                    evalKeys.forEach(k => yEvaluations.delete(k));
                });
            }

            setActiveThreatIndex(0);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Threat generation failed");
        } finally {
            setLoading(false);
        }
    };

    const submitRebuttal = async (index: number) => {
        if (!rebuttalInput.trim()) return;
        setEvaluating(true);
        try {
            const threat = threats[index];
            const res = await fetch("/api/v1/research/warroom/rebuttal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_id: accountId, threat, rebuttal: rebuttalInput, live_directive: liveDirective }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const evaluation = data.evaluation as RebuttalEvaluation;

            if (docRef.current) {
                const doc = docRef.current;
                const yEvaluations = doc.getMap<RebuttalEvaluation>('evaluations');
                const yScore = doc.getMap('score');

                doc.transact(() => {
                    yEvaluations.set(index.toString(), evaluation);
                    const currentScore = (yScore.get('value') as number) ?? 100;
                    yScore.set('value', Math.min(100, Math.max(0, currentScore + evaluation.score_change)));
                });
            }

            setRebuttalInput("");

            if (index < threats.length - 1) {
                setTimeout(() => {
                    setActiveThreatIndex(index + 1);
                }, 2000);
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to submit rebuttal");
        } finally {
            setEvaluating(false);
        }
    };

    if (threats.length === 0 && !loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border border-error/20 rounded-2xl bg-error/5 animate-in fade-in zoom-in-95 duration-500">
                <div className="p-4 bg-error/10 rounded-2xl mb-6">
                    <Crosshair className="h-10 w-10 text-error" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Adversarial Stress Test</h3>
                <p className="text-text-muted mb-8 text-center max-w-md text-sm">
                    Subject your investment thesis to a rigorous challenge by AI-powered adversarial personas. Defend your case to maintain your survival score.
                </p>
                <button
                    onClick={runThreatGeneration}
                    className="flex items-center gap-2 bg-error hover:bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all shadow-lg active:scale-[0.98]"
                >
                    <PlayCircle className="h-5 w-5" />
                    Generate Threats
                </button>
                {error && <p className="mt-6 text-error text-xs bg-error/10 px-4 py-2 rounded-lg border border-error/20">{error}</p>}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="relative">
                        <Loader2 className="h-10 w-10 animate-spin text-error" />
                        <div className="absolute inset-0 bg-error/20 blur-xl rounded-full" />
                    </div>
                    <p className="text-text-muted text-sm">Analyzing data room for vulnerabilities...</p>
                </div>
            )}

            {threats.length > 0 && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {}
                    <div className="w-full lg:w-1/3 flex flex-col gap-4">
                        {!wsConnected && (
                            <div className="bg-error/10 border border-error/20 text-error text-xs p-3 rounded-xl flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Disconnected from swarm. Live updates paused.
                            </div>
                        )}
                        <div className="bg-surface-glass border border-surface-glass-border rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                            <h3 className="text-xs text-text-dim mb-3 font-medium">Survival Score</h3>
                            <div className="relative">
                                <motion.div
                                    className="absolute inset-0 blur-3xl rounded-full"
                                    animate={{
                                        backgroundColor: survivalScore > 70 ? "var(--success)" : survivalScore > 40 ? "var(--warning)" : "var(--error)",
                                        opacity: [0.08, 0.2, 0.08]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <span className={cn(
                                    "text-6xl font-bold relative z-10 font-data tracking-tighter",
                                    survivalScore > 70 ? "text-success" : survivalScore > 40 ? "text-warning" : "text-error"
                                )}>
                                    {survivalScore}
                                </span>
                            </div>
                            <div className="mt-3 text-xs text-text-dim">Aggregate confidence</div>
                        </div>

                        <div className="space-y-1.5 overflow-y-auto max-h-[400px] pr-1 scrollbar-hide">
                            {threats.map((threat, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveThreatIndex(idx)}
                                    className={cn(
                                        "w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-2.5 group",
                                        activeThreatIndex === idx
                                            ? "bg-surface-glass border-surface-glass-border shadow-lg"
                                            : "bg-surface-glass border-surface-glass-border hover:border-surface-glass-border/80",
                                        evaluations[idx] && "opacity-40"
                                    )}
                                >
                                    <div className="mt-0.5">
                                        {evaluations[idx] ? (
                                            evaluations[idx].score_change > 0 ? <ShieldCheck className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-error" />
                                        ) : (
                                            <AlertTriangle className={cn("h-4 w-4", activeThreatIndex === idx ? "text-white" : "text-text-dim")} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] text-text-dim group-hover:text-white transition-colors">{threat.persona}</div>
                                        <div className="font-medium text-xs line-clamp-1 text-foreground/90">{threat.threat}</div>
                                    </div>
                                    <ChevronRight className={cn("h-3 w-3 mt-1.5 transition-all shrink-0", activeThreatIndex === idx ? "translate-x-0.5 opacity-100" : "opacity-0")} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {}
                    <div className="w-full lg:w-2/3 bg-surface-glass border border-error/10 rounded-2xl flex flex-col overflow-hidden relative">
                        <div className="p-6 md:p-8 flex-grow relative z-10">
                            <div className="flex items-center gap-2.5 mb-5">
                                <span className="bg-error/10 text-error px-2.5 py-1 rounded-lg text-[11px] font-medium border border-error/20">
                                    {threats[activeThreatIndex]?.persona}
                                </span>
                                <div className="h-px w-6 bg-error/20" />
                                <span className="text-xs text-text-dim">Adversarial challenge</span>
                            </div>

                            <h2 className="text-2xl font-semibold mb-3 text-white leading-tight">
                                {threats[activeThreatIndex]?.threat}
                            </h2>
                            <p className="text-base text-text-muted leading-relaxed mb-8 italic">
                                "{threats[activeThreatIndex]?.details}"
                            </p>

                            {evaluations[activeThreatIndex] ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-6"
                                >
                                    <div className="flex items-center gap-3 mb-3 text-brand-blue">
                                        <Gavel className="h-5 w-5" />
                                        <h4 className="font-medium text-base">Evaluation</h4>
                                        <span className={cn(
                                            "ml-auto text-xs font-medium px-3 py-1 rounded-full font-data",
                                            evaluations[activeThreatIndex].score_change > 0 ? "bg-success text-white" : "bg-error text-white"
                                        )}>
                                            {evaluations[activeThreatIndex].score_change > 0 ? "+" : ""}{evaluations[activeThreatIndex].score_change} points
                                        </span>
                                    </div>
                                    <p className="text-foreground/80 leading-relaxed">{evaluations[activeThreatIndex].feedback}</p>
                                </motion.div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[11px] text-text-dim font-medium ml-0.5">Strategy directive (optional)</label>
                                        <input
                                            type="text"
                                            value={liveDirective}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (docRef.current) {
                                                    const yDir = docRef.current.getText('yDirective');
                                                    docRef.current.transact(() => {
                                                        yDir.delete(0, yDir.length);
                                                        yDir.insert(0, val);
                                                    });
                                                }
                                            }}
                                            placeholder="e.g., Prioritize long-term moat over short-term burn..."
                                            className="w-full bg-surface-base/30 border border-surface-glass-border rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-error/30 transition-all placeholder:text-text-dim/30"
                                            disabled={evaluating}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[11px] text-text-dim font-medium ml-0.5">Your rebuttal</label>
                                        <textarea
                                            value={rebuttalInput}
                                            onChange={(e) => setRebuttalInput(e.target.value)}
                                            placeholder="Defend your thesis..."
                                            className="w-full bg-surface-base/30 border border-surface-glass-border rounded-xl p-4 min-h-[140px] text-white focus:outline-none focus:ring-2 focus:ring-error/30 transition-all placeholder:text-text-dim/30 resize-none"
                                            disabled={evaluating}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => submitRebuttal(activeThreatIndex)}
                                            disabled={evaluating || !rebuttalInput.trim()}
                                            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-all shadow-xl active:scale-[0.98]"
                                        >
                                            {evaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                                            Submit Rebuttal
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}