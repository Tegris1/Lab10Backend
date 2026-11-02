export default function OrderHistoryLoading() {
  return (
    <main className="rounded-2xl bg-white p-6 font-sans text-slate-900" aria-busy="true">
      <p role="status">Loading order history…</p>
      <div aria-hidden="true" className="mt-6 space-y-4 motion-safe:animate-pulse">
        {[1, 2, 3].map(item => <div key={item} className="h-40 rounded-xl bg-slate-100" />)}
      </div>
    </main>
  );
}
