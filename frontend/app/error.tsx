'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <div className="bg-surface-glass border border-surface-glass-border p-8 rounded-2xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-text-muted mb-8">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => reset()}
          className="bg-brand-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}