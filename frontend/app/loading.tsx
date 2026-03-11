import React from "react";
import { CardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex-1 p-6 md:p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-8 w-48 bg-surface-glass-border rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-surface-glass-border rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
           <TableSkeleton rows={5} />
        </div>
        <div className="space-y-6">
           <CardSkeleton />
           <CardSkeleton />
        </div>
      </div>
    </div>
  );
}