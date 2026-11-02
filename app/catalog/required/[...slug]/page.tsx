import CatalogView from "@/app/components/CatalogView";
import { connection } from "next/server";

export const metadata = { title: "Catalogue by category" };

export default async function RequiredCatalogPage({ params }: { params: Promise<{ slug: string[] }> }) {
  await connection();
  const { slug } = await params;
  return <CatalogView slug={slug} required />;
}
