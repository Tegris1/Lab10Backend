import CatalogView from "@/app/components/CatalogView";
import { connection } from "next/server";

export const metadata = { title: "Component catalogue" };

export default async function CatalogPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  await connection();
  const { slug } = await params;
  return <CatalogView slug={slug} />;
}
