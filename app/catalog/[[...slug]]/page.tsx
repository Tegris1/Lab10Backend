import CatalogView from "@/app/components/CatalogView";

export const metadata = { title: "Component catalogue" };

export default async function CatalogPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  return <CatalogView slug={slug} />;
}
