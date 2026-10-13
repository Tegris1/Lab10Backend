import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>404 — Nie znaleziono strony</h1>
      <p>Strona pod tym adresem nie istnieje.</p>
      <Link href="/">Wróć na stronę główną</Link>
    </main>
  );
}
