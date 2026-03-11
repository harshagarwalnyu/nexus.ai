"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen bg-background text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {}
            <div className="flex flex-col items-center justify-center p-12 border border-error/20 rounded-2xl bg-error/5 text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Critical Application Error</h2>
              <p className="text-text-muted mb-6 text-sm">
                A critical error occurred at the application root.
              </p>
              <button
                onClick={() => reset()}
                className="bg-error hover:bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg active:scale-[0.98]"
              >
                Try to recover
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}