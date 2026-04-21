'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('App crashed', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-slate-100">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-center text-sm text-slate-400">
            {error.message || 'An unexpected error occurred.'}
            {error.digest ? <span className="ml-2 opacity-50">({error.digest})</span> : null}
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-400"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
