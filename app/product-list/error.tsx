"use client";

import { useTransition } from "react";

export default function ProductListError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <main>
      <h1>Nie udało się wczytać produktów</h1>
      <p>Wystąpił nieoczekiwany problem. Spróbuj ponownie za chwilę.</p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => retry())}
      >
        Spróbuj ponownie
      </button>
      <p role="status">{isPending ? "Ponowne wczytywanie produktów…" : ""}</p>
    </main>
  );
}
