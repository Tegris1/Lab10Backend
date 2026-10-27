import ImageModal from "@/app/components/ImageModal";
import ProductImage from "@/app/components/ProductImage";
import { getProductByRouteId } from "@/lib/products/product-details";

export default async function InterceptedProductImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductByRouteId(id);
  return (
    <ImageModal title={`${product.name} — Image`} productHref={`/product-list/${product.id}`}>
      <ProductImage product={product} />
    </ImageModal>
  );
}
