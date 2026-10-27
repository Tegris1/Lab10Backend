import Link from "next/link";

export default function CatalogNotFound() {
  return (
    <main className="rounded-2xl bg-white p-8 font-sans text-slate-900">
      <h1 className="mb-3 text-2xl font-bold">Catalogue page not found</h1>
      <p className="mb-6 text-slate-600">Choose a valid category and a product that belongs to it.</p>
      <Link href="/catalog" className="font-semibold text-indigo-700 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2">Back to catalogue</Link>
    </main>
  );
}
