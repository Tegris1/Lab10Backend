import Link from "next/link";
import type { OrderView } from "@/lib/orders/prisma-order-repo";
import { formatGrosze } from "@/lib/orders/money";
import styles from "./order-history.module.css";

const statusLabels = { PENDING: "Pending", PAID: "Paid", SHIPPED: "Shipped", CANCELLED: "Cancelled" };
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" });

export default function OrderCard({ order, detail = false }: { order: OrderView; detail?: boolean }) {
  return (
    <article className={styles.order} data-order-id={order.id}>
      <header className={styles.orderHeader}>
        <div>
          <h2 className={styles.number}>{detail ? order.number : (
            <Link className={styles.productLink} href={`/order-history/${encodeURIComponent(order.id)}`}>{order.number}</Link>
          )}</h2>
          <p className={styles.muted}><time dateTime={order.orderedAt}>{dateFormat.format(new Date(order.orderedAt))}</time> (Warsaw time)</p>
        </div>
        <span className={`${styles.status} ${styles[order.status]}`}>{statusLabels[order.status]}</span>
      </header>
      <ul className={styles.items} aria-label={`Items in order ${order.number}`}>
        {order.items.map(item => (
          <li key={item.id} className={styles.item}>
            <div>
              <h3 className={styles.productName}>{item.productId === null ? item.name : (
                <Link className={styles.productLink} href={`/product-list/${item.productId}`}>{item.name}</Link>
              )}</h3>
              <p className={styles.muted}>{item.code}</p>
              {item.productId === null && <p className={styles.muted}>Product no longer in the catalogue.</p>}
            </div>
            <dl className={styles.facts}>
              <div><dt className={styles.label}>Quantity</dt><dd className={styles.value}>{item.quantity}</dd></div>
              <div><dt className={styles.label}>Price at purchase</dt><dd className={styles.value}>{formatGrosze(item.unitPriceGrosze)}</dd></div>
              <div><dt className={styles.label}>Line total</dt><dd className={styles.value}>{formatGrosze(item.lineTotalGrosze)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <footer className={styles.total}><span>Order total</span><strong className={styles.totalValue}>{formatGrosze(order.totalGrosze)}</strong></footer>
    </article>
  );
}
