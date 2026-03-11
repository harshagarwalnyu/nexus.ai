import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <div className="bg-surface-glass border border-surface-glass-border p-8 rounded-2xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
        <p className="text-text-muted mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="bg-brand-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-primary/90 transition-colors inline-block"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}