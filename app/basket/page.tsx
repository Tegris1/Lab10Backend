import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { getMyCart } from "@/lib/cart/my-cart";
import { getCurrentSession } from "@/lib/auth/session";
import { SignInButton } from "@/app/components/AuthControls";
import { BasketItemControls } from "@/app/components/BasketControls";
import PlaceOrderButton from "@/app/components/PlaceOrderButton";
import { formatGrosze } from "@/lib/orders/money";
import styles from "@/app/components/order-history.module.css";

export const metadata: Metadata = { title: "Basket" };

export default async function Basket() {
  await connection();
  const session = await getCurrentSession();
  if (!session) return (
    <main className={styles.panel} data-basket data-auth-required>
      <h1 className={styles.heading}>Basket</h1>
      <p className="mb-6 text-slate-600">Sign in to view your own basket.</p>
      <SignInButton />
    </main>
  );
  const cart = await getMyCart();
  const items = cart?.items ?? [];
  return (
    <main className={styles.panel} data-basket>
      <p className={styles.eyebrow}>Your selection</p>
      <h1 className={styles.heading}>Basket</h1>
      <p className={styles.intro}>Prices and availability reflect the current catalogue.</p>
      <div className={styles.profile}>
        <div><p className={styles.profileName}>{session.user.name}</p>
          <p className={styles.muted}>Items in your basket are not reserved.</p></div>
        <p>{items.length} {items.length === 1 ? "product" : "products"}</p>
      </div>
      {items.length === 0 ? <div><p className={styles.empty}>Your basket is empty.</p>
        <p className={styles.total}>Basket total <strong data-cart-total>{formatGrosze("0")}</strong></p></div> : (
        <div className={styles.order}>
          <ul className={styles.items} aria-label="Basket items">
            {items.map(item => (
              <li key={item.id} className={styles.item} data-cart-item={item.id}>
                <div className="flex min-w-0 items-start gap-3">
                  <Link href={`/product-list/${item.productId}`} aria-label={`View ${item.name}`} className="shrink-0 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-indigo-700">
                    <Image src={item.image} alt={`Illustration for ${item.name}`} width={96} height={72}
                      className="h-18 w-24 rounded-lg border border-slate-200 object-cover" />
                  </Link>
                  <div className="min-w-0">
                  <h2 className={styles.productName}>
                    <Link className={styles.productLink} href={`/product-list/${item.productId}`}>{item.name}</Link>
                  </h2>
                  <p className={styles.muted}>{item.code}</p>
                  <p className={styles.muted}>{item.amount === 0 ? "Out of stock" : `${item.amount} units available`}</p>
                  {item.quantity > item.amount && <p className="mt-2 text-xs leading-relaxed text-amber-800" role="status" data-cart-stock-warning>
                    {item.amount === 0 ? "This item is unavailable. Please remove it." : "Requested quantity exceeds current stock. Reduce the quantity or remove this item."}
                  </p>}
                  </div>
                </div>
                <dl className={styles.facts}>
                  <div><dt className={styles.label}>Quantity</dt><dd className={styles.value}>{item.quantity}</dd></div>
                  <div><dt className={styles.label}>Unit price</dt><dd className={styles.value}>{formatGrosze(item.unitPriceGrosze)}</dd></div>
                  <div><dt className={styles.label}>Line total</dt><dd className={styles.value}>{formatGrosze(item.lineTotalGrosze)}</dd></div>
                </dl>
                <div className="sm:col-span-2">
                  <BasketItemControls key={`${item.id}-${item.quantity}-${item.amount}`} itemId={item.id} name={item.name}
                    quantity={item.quantity} amount={item.amount} />
                </div>
              </li>
            ))}
          </ul>
          <footer className={styles.total} aria-live="polite" aria-atomic="true"><span>Basket total</span>
            <strong className={styles.totalValue} data-cart-total>{formatGrosze(cart?.totalGrosze ?? "0")}</strong></footer>
        </div>
      )}
      {items.length > 0 && <PlaceOrderButton requestKey={randomUUID()} available={items.every(item => item.quantity <= item.amount)} />}
      <Link className={styles.catalogueLink} href="/product-list">Browse products →</Link>
    </main>
  );
}
