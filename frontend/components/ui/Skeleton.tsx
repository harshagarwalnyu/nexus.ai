import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-shimmer rounded-md", className)} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-surface-glass border border-surface-glass-border p-6 rounded-2xl space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface-glass border border-surface-glass-border rounded-2xl overflow-hidden">
      <div className="bg-surface-glass border-b border-surface-glass-border p-4 flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="p-4 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {[1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GraphSkeleton() {
  return (
    <div className="h-[600px] w-full border border-surface-glass-border rounded-2xl bg-surface-base flex items-center justify-center">
      <div className="relative">
        <div className="h-32 w-32 rounded-full border-4 border-surface-glass-border/60 border-t-brand-blue animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-brand-blue/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}