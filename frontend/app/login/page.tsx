"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

function PasswordStrength({ password }: { password: string }) {
    const getStrength = () => {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return score;
    };

    const strength = getStrength();
    if (password.length === 0) return null;

    const labels = ["Weak", "Weak", "Fair", "Good", "Strong"];
    const colors = ["bg-error", "bg-error", "bg-warning", "bg-accent-teal", "bg-success"];

    return (
        <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-1 flex-1 rounded-full transition-all duration-300",
                            i < strength ? colors[strength] : "bg-surface-glass-border"
                        )}
                    />
                ))}
            </div>
            <p className={cn("text-[10px] font-medium", strength <= 1 ? "text-error" : strength <= 2 ? "text-warning" : "text-success")}>
                {labels[strength]}
            </p>
        </div>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!cardRef.current) return;
            const rect = cardRef.current.getBoundingClientRect();
            setMousePos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        };
        window.addEventListener("mousemove", handleMove);
        return () => window.removeEventListener("mousemove", handleMove);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setLoading(true);

        try {
            if (mode === "signup") {
                const { error: err } = await signUp.email({ email, password, name });
                if (err) throw new Error(err.message);
            } else {
                const { error: err } = await signIn.email({ email, password });
                if (err) throw new Error(err.message);
            }
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Authentication failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans antialiased relative overflow-hidden">
            {}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    animate={{
                        scale: [1, 1.15, 1],
                        x: [0, 40, 0],
                        y: [0, 25, 0],
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-blue/8 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        x: [0, -30, 0],
                        y: [0, 50, 0],
                    }}
                    transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -bottom-[10%] -right-[10%] w-[45%] h-[45%] bg-brand-purple/6 rounded-full blur-[140px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        x: [0, 20, 0],
                        y: [0, -20, 0],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-accent-gold/3 rounded-full blur-[100px]"
                />
            </div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700">
                {}
                <div className="flex flex-col items-center justify-center gap-3 mb-10">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="h-14 w-14 bg-gradient-to-br from-brand-blue to-brand-indigo rounded-2xl flex items-center justify-center shadow-[0_0_30px_var(--brand-blue-glow)] relative group overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <Zap className="h-7 w-7 text-white fill-white relative z-10" />
                    </motion.div>
                    <div className="text-center">
                        <span className="text-3xl font-bold text-white tracking-tight block">Nexus AI</span>
                        <span className="text-xs text-text-muted mt-1 block">Investment Intelligence Platform</span>
                    </div>
                </div>

                {}
                <div
                    ref={cardRef}
                    className="bg-surface-glass border border-surface-glass-border backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
                >
                    {}
                    <div
                        className="absolute inset-0 opacity-30 pointer-events-none transition-opacity duration-300"
                        style={{
                            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(59, 130, 246, 0.08), transparent 70%)`,
                        }}
                    />
                    {}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

                    <div className="relative z-10">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={mode}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <h1 className="text-xl font-semibold text-white mb-1">
                                    {mode === "signin" ? "Welcome back" : "Create your account"}
                                </h1>
                                <p className="text-sm text-text-muted mb-8">
                                    {mode === "signin" ? "Sign in to continue your research." : "Get started with Nexus AI."}
                                </p>
                            </motion.div>
                        </AnimatePresence>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <AnimatePresence>
                                {mode === "signup" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-1.5 overflow-hidden"
                                    >
                                        <label className="block text-[11px] font-medium text-text-muted ml-0.5">Full name</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            disabled={loading}
                                            placeholder="Alex Chen"
                                            className="w-full bg-surface-base/50 border border-surface-glass-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-text-dim/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/30 transition-all backdrop-blur-sm"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium text-text-muted ml-0.5">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                    aria-invalid={!!error}
                                    aria-describedby={error ? "auth-error" : undefined}
                                    placeholder="you@company.com"
                                    className={cn(
                                        "w-full bg-surface-base/50 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-text-dim/30 focus:outline-none focus:ring-2 transition-all backdrop-blur-sm",
                                        error ? "border-error/50 focus:ring-error/30" : "border-surface-glass-border focus:ring-brand-blue/30 focus:border-brand-blue/30"
                                    )}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium text-text-muted ml-0.5">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={loading}
                                        minLength={8}
                                        aria-invalid={!!error}
                                        aria-describedby={error ? "auth-error" : undefined}
                                        placeholder="Min. 8 characters"
                                        className={cn(
                                            "w-full bg-surface-base/50 border rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-text-dim/30 focus:outline-none focus:ring-2 transition-all backdrop-blur-sm",
                                            error ? "border-error/50 focus:ring-error/30" : "border-surface-glass-border focus:ring-brand-blue/30 focus:border-brand-blue/30"
                                        )}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-dim hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {mode === "signup" && <PasswordStrength password={password} />}
                            </div>

                            {error && (
                                <motion.div
                                    id="auth-error"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-start gap-3 text-sm text-error bg-error/10 border border-error/20 rounded-xl px-4 py-3"
                                >
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </motion.div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-brand-blue hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl py-3.5 text-sm transition-all shadow-[0_0_25px_rgba(59,130,246,0.2)] active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {mode === "signin" ? "Signing in..." : "Creating account..."}
                                    </>
                                ) : (
                                    mode === "signin" ? "Sign in" : "Create account"
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-surface-glass-border text-center">
                            <p className="text-sm text-text-muted">
                                {mode === "signin" ? "New to Nexus AI? " : "Already have an account? "}
                                <button
                                    onClick={() => { if (!loading) { setMode(mode === "signin" ? "signup" : "signin"); setError(null); } }}
                                    disabled={loading}
                                    className="text-brand-blue hover:text-blue-400 font-medium ml-1 disabled:opacity-30 transition-colors"
                                >
                                    {mode === "signin" ? "Create account" : "Sign in"}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}