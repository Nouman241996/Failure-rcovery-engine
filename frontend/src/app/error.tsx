'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-500/40 bg-red-950/30 p-6 text-red-100">
      <h2 className="text-lg font-semibold">Failed to load this page</h2>
      <p className="text-sm opacity-80">{error.message}</p>
      <button
        onClick={reset}
        className="rounded bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-400"
      >
        Retry
      </button>
    </div>
  );
}
