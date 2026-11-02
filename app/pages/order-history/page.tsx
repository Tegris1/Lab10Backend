import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { demoUser } from "@/lib/orders/demo-user";
import { listOrdersForUser } from "@/lib/orders/order-repo";
import { formatGrosze } from "@/lib/orders/money";
import styles from "@/app/components/order-history.module.css";

export const metadata: Metadata = { title: "Order history" };
const statusLabels = { PENDING: "Pending", PAID: "Paid", SHIPPED: "Shipped", CANCELLED: "Cancelled" };
const dateFormat = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" });

export default async function OrderHistory() {
  await connection();
  const orders = await listOrdersForUser(demoUser.id);
  return (
    <main className={styles.panel} data-order-history>
      <p className={styles.eyebrow}>Your purchases</p>
      <h1 className={styles.heading}>Order history</h1>
      <p className={styles.intro}>Prices and product details are those recorded when each order was placed.</p>
      <div className={styles.profile}>
        <div><p className={styles.profileName}>Demo account · {demoUser.name}</p><p className={styles.muted}>Fictional orders for demonstration.</p></div>
        <p>{orders.length} {orders.length === 1 ? "order" : "orders"}</p>
      </div>
      {orders.length === 0 ? <p className={styles.empty}>No orders yet.</p> : (
        <ol className={styles.orders} aria-label="Order history">
          {orders.map(order => (
            <li key={order.id} className={styles.order} data-order-id={order.id}>
              <header className={styles.orderHeader}>
                <div><h2 className={styles.number}>{order.number}</h2>
                  <time className={styles.muted} dateTime={order.orderedAt}>{dateFormat.format(new Date(order.orderedAt))}</time></div>
                <span className={`${styles.status} ${styles[order.status]}`}>{statusLabels[order.status]}</span>
              </header>
              <ul className={styles.items} aria-label={`Items in ${order.number}`}>
                {order.items.map(item => (
                  <li key={item.id} className={styles.item} data-order-item={item.id}>
                    <div>
                      <h3 className={styles.productName}>{item.productId === null ? item.name : (
                        <Link className={styles.productLink} href={`/product-list/${item.productId}`}>{item.name}</Link>
                      )}</h3>
                      <p className={styles.muted}>{item.code}</p>
                      {item.productId === null && <p className={styles.muted}>No longer in catalogue</p>}
                    </div>
                    <dl className={styles.facts}>
                      <div><dt className={styles.label}>Quantity</dt><dd className={styles.value}>{item.quantity}</dd></div>
                      <div><dt className={styles.label}>Unit price</dt><dd className={styles.value}>{formatGrosze(item.unitPriceGrosze)}</dd></div>
                      <div><dt className={styles.label}>Line total</dt><dd className={styles.value}>{formatGrosze(item.lineTotalGrosze)}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>
              <footer className={styles.total}><span>Order total</span><strong className={styles.totalValue} data-order-total>{formatGrosze(order.totalGrosze)}</strong></footer>
            </li>
          ))}
        </ol>
      )}
      <Link className={styles.catalogueLink} href="/product-list">Browse products →</Link>
    </main>
  );
}
