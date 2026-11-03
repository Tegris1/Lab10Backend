"use client";
import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { placeOrder } from "@/app/basket/checkout-action";
import styles from "./basket-controls.module.css";

export default function PlaceOrderButton({ requestKey, available }: { requestKey: string; available: boolean }) {
  const feedbackId = useId();
  // Preserve the key across refreshed basket props and retries after an uncertain response.
  const [stableRequestKey] = useState(requestKey);
  const [result, submit, pending] = useActionState(placeOrder, null);
  return (
    <form action={submit} className={styles.checkoutForm} aria-busy={pending} data-checkout>
      <input type="hidden" name="requestKey" value={stableRequestKey} />
      <button type="submit" className={styles.primary} disabled={pending || !available}
        aria-describedby={feedbackId} data-place-order>
        {pending ? "Placing order…" : "Place order"}
      </button>
      <p className={styles.hint}>Update quantities before placing your order. Your order will appear in your order history.</p>
      <div id={feedbackId}>
        {!available && <p className={styles.error}>Some quantities exceed current stock. Update or remove those items before ordering.</p>}
        <span className={styles.pending} role="status">{pending ? "Saving your order…" : ""}</span>
        {!pending && result && <p className={styles.error} role="alert">
          {result.message}{" "}
          {result.code === "AUTH_REQUIRED" && <Link className={styles.link} href="/sign-in">Sign in</Link>}
        </p>}
      </div>
    </form>
  );
}
