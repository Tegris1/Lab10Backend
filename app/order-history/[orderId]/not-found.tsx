import Link from "next/link";
import styles from "@/app/components/order-history.module.css";

export default function OrderNotFound() {
  return (
    <main className={styles.panel}>
      <h1 className={styles.heading}>Order unavailable</h1>
      <p className={styles.intro}>This order could not be found in your history.</p>
      <Link className={styles.catalogueLink} href="/order-history">Back to your orders</Link>
    </main>
  );
}
