"use server";
import { revalidatePath } from "next/cache";
import { addProductToMyCart, removeMyCartItem, setMyCartQuantity, type CartMutationResult } from "@/lib/cart/my-cart";

function refreshBasket(result: CartMutationResult) {
  if (result.ok) {
    revalidatePath("/basket");
    revalidatePath("/pages/basket");
  }
  return result;
}

export async function addProduct(input: unknown) {
  return refreshBasket(await addProductToMyCart(input));
}

export async function setQuantity(input: unknown) {
  return refreshBasket(await setMyCartQuantity(input));
}

export async function removeItem(input: unknown) {
  return refreshBasket(await removeMyCartItem(input));
}
