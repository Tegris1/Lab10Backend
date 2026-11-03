"use client";
import { useTransition } from "react";

export default function OrderHistoryError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <main className="rounded-2xl bg-white p-6 font-sans text-slate-900">
      <h1 className="mb-3 text-2xl font-bold">Could not load your orders</h1>
      <p className="mb-4 text-slate-600">Please try again in a moment.</p>
      <button className="rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-4"
        disabled={pending} onClick={() => startTransition(() => retry())}>Try again</button>
      <p role="status">{pending ? "Loading your orders…" : ""}</p>
    </main>
  );
}
