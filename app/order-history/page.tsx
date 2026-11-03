import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { getMyOrders } from "@/lib/orders/my-orders";
import OrderCard from "@/app/components/OrderCard";
import OrderHistorySignIn from "@/app/components/OrderHistorySignIn";
import styles from "@/app/components/order-history.module.css";

export const metadata: Metadata = { title: "Order history" };

export default async function OrderHistory() {
  await connection();
  let orders;
  try { orders = await getMyOrders(); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return <OrderHistorySignIn />;
    throw error;
  }
  return (
    <main className={styles.panel} data-order-history>
      <p className={styles.eyebrow}>Your purchases</p>
      <h1 className={styles.heading}>Order history</h1>
      <p className={styles.intro}>Your orders, with the names and prices recorded at purchase.</p>
      {orders.length === 0 ? <p className={`${styles.empty} mt-6`} data-order-history-empty>You have no orders yet.</p> : (
        <ul className={`${styles.orders} mt-6`} aria-label="Your orders">
          {orders.map(order => <li key={order.id}><OrderCard order={order} /></li>)}
        </ul>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link className={styles.catalogueLink} href="/basket">View your basket →</Link>
        <Link className={styles.catalogueLink} href="/product-list">Browse products →</Link>
      </div>
    </main>
  );
}
