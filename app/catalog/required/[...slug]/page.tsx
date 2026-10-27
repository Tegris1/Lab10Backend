import CatalogView from "@/app/components/CatalogView";

export const metadata = { title: "Catalogue by category" };

export default async function RequiredCatalogPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <CatalogView slug={slug} required />;
}
