import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseCatalogPath } from "@/lib/products/catalog-path";
import { getProductByRouteId } from "@/lib/products/product-details";
import { listProducts } from "@/lib/products/product-repo";
import CategoryIcon from "./CategoryIcon";
import ProductDetails from "./ProductDetails";

export default async function CatalogView({ slug, required = false }: { slug?: string[]; required?: boolean }) {
  const route = parseCatalogPath(slug, required);
  if (!route) notFound();
  const base = required ? "/catalog/required" : "/catalog";
  if (route.id !== undefined) {
    const product = await getProductByRouteId(String(route.id));
    if (product.type !== route.type) notFound();
    return <ProductDetails product={product} backHref={`${base}/${route.type}`} />;
  }
  const products = await listProducts({ type: route.type, stock: "all", sort: "name" });
  const price = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
  return (
    <main className="rounded-2xl bg-white p-5 font-sans text-slate-900 shadow-sm sm:p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-700">Browse components</p>
      <h1 className="mb-3 text-3xl font-bold tracking-tight">{route.type ? `${route.type.toUpperCase()} catalogue` : "Component catalogue"}</h1>
      <p className="mb-6 text-slate-600">Choose a category to find components for your build.</p>
      <nav aria-label="Catalogue categories" className="mb-8 flex flex-wrap gap-2">
        {!required && <Link href={base} aria-current={!route.type ? "page" : undefined}
          className="rounded-lg border border-indigo-200 px-4 py-2 font-semibold aria-[current=page]:bg-indigo-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">All</Link>}
        {(["cpu", "gpu", "ram", "disk"] as const).map(type => (
          <Link key={type} href={`${base}/${type}`} aria-current={route.type === type ? "page" : undefined}
            className="rounded-lg border border-indigo-200 px-4 py-2 font-semibold uppercase aria-[current=page]:bg-indigo-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">{type}</Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-slate-600">{products.length} products</p>
      {products.length === 0 ? <p>No products in this category.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Catalogue products">
          {products.map(product => (
            <li key={product.id} className="min-w-0 rounded-xl border border-slate-200 p-5">
              <div className="mb-3 flex items-center gap-2 text-indigo-700"><CategoryIcon type={product.type} /><span className="text-xs font-semibold uppercase">{product.type}</span></div>
              <h2 className="mb-2 font-bold">{product.name}</h2>
              <p className="mb-4 text-sm leading-relaxed text-slate-600">{product.description}</p>
              <p className="mb-3 font-semibold">{price.format(product.price / 100)}</p>
              <Link href={`${base}/${product.type}/${product.id}`} className="font-semibold text-indigo-700 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">View product</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
