"use client";
import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { addProduct, removeItem, setQuantity } from "@/app/basket/actions";
import type { CartMutationResult } from "@/lib/cart/my-cart";
import styles from "./basket-controls.module.css";

const unavailable: CartMutationResult = {
  ok: false, code: "UNAVAILABLE", field: "form", message: "Could not update your basket. Please try again.",
};

function Feedback({ result, id, success }: { result: CartMutationResult | null; id: string; success: string }) {
  if (!result) return null;
  if (result.ok) return <p id={id} className={styles.success} role="status">{success}</p>;
  return (
    <p id={id} className={styles.error} role="alert">
      {result.message}{" "}
      {result.code === "AUTH_REQUIRED" && <Link className={styles.link} href="/sign-in">Sign in</Link>}
    </p>
  );
}

export function AddToBasketButton({ productId, name, available }: { productId: number; name: string; available: boolean }) {
  const feedbackId = useId();
  const [result, submit, pending] = useActionState<CartMutationResult | null, FormData>(async () => {
    try { return await addProduct({ productId }); }
    catch { return unavailable; }
  }, null);

  return (
    <form action={submit} className={styles.addForm} aria-label={`Add ${name} to basket`} aria-busy={pending} data-add-product={productId}>
      <button type="submit" className={styles.primary} disabled={pending || !available}
        aria-label={available ? `Add ${name} to basket` : `${name} is out of stock`}
        aria-describedby={result ? feedbackId : undefined} data-cart-add>
        {pending ? "Adding…" : available ? "Add to basket" : "Out of stock"}
      </button>
      <span className={styles.pending} role="status">{pending ? "Saving to your basket…" : ""}</span>
      {!pending && <Feedback result={result} id={feedbackId} success="Added to basket." />}
      {!pending && result?.ok && <Link className={styles.link} href="/basket">View basket →</Link>}
    </form>
  );
}

export function BasketItemControls({ itemId, name, quantity, amount }: { itemId: string; name: string; quantity: number; amount: number }) {
  const inputId = useId();
  const hintId = useId();
  const feedbackId = useId();
  const [draft, setDraft] = useState(String(quantity));
  const [result, submit, pending] = useActionState<CartMutationResult | null, FormData>(async (_previous, data) => {
    try {
      if (data.get("intent") === "remove") return await removeItem({ itemId });
      const raw = data.get("quantity");
      const value = typeof raw === "string" && /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
      return await setQuantity({ itemId, quantity: value });
    } catch { return unavailable; }
  }, null);
  const invalidQuantity = result !== null && !result.ok && result.field === "quantity";

  return (
    <form action={submit} noValidate className={styles.itemForm} aria-label={`Edit ${name}`} aria-busy={pending} data-cart-controls>
      <div className={styles.fields}>
        <div>
          <label className={styles.label} htmlFor={inputId}>Quantity <span className={styles.srOnly}>for {name}</span></label>
          <input className={styles.input} id={inputId} name="quantity" type="number" inputMode="numeric" min={1}
            max={Math.max(1, Math.min(99, amount))} step={1} value={draft} onChange={event => setDraft(event.currentTarget.value)}
            disabled={pending} required aria-invalid={invalidQuantity}
            aria-describedby={`${hintId}${invalidQuantity ? ` ${feedbackId}` : ""}`} data-cart-quantity />
        </div>
        <button className={styles.primary} type="submit" name="intent" value="update" disabled={pending || amount === 0} data-cart-update>Update</button>
        <button className={styles.remove} type="submit" name="intent" value="remove" disabled={pending}
          aria-label={`Remove ${name} from basket`} data-cart-remove>Remove</button>
      </div>
      <p id={hintId} className={styles.hint}>
        {amount === 0 ? "This product is out of stock. You can remove it from your basket." : `Choose 1–${Math.min(99, amount)} units. ${amount} currently available.`}
      </p>
      <span className={styles.pending} role="status">{pending ? "Updating your basket…" : ""}</span>
      {!pending && <Feedback result={result} id={feedbackId} success="Quantity updated." />}
    </form>
  );
}
