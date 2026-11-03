"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkoutMyCart } from "@/lib/orders/checkout";
import type { CheckoutFailure } from "@/lib/orders/checkout-input";

export async function placeOrder(_previous: CheckoutFailure | null, formData: FormData): Promise<CheckoutFailure | null> {
  const result = await checkoutMyCart({ requestKey: formData.get("requestKey") });
  if (!result.ok) return result;

  revalidatePath("/basket");
  revalidatePath("/pages/basket");
  revalidatePath("/order-history");
  revalidatePath("/pages/order-history");
  revalidatePath("/product-list", "layout");
  revalidatePath("/catalog", "layout");
  for (const productId of result.productIds) revalidatePath(`/product-list/${productId}`);
  // Redirect outside the error handling: it intentionally throws Next.js's redirect signal.
  redirect(`/order-history/${result.orderId}`);
}
