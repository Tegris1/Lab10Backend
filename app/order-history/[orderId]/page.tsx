import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { getMyOrder } from "@/lib/orders/my-orders";
import OrderCard from "@/app/components/OrderCard";
import OrderHistorySignIn from "@/app/components/OrderHistorySignIn";
import styles from "@/app/components/order-history.module.css";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderDetails({ params }: { params: Promise<{ orderId: string }> }) {
  await connection();
  const { orderId } = await params;
  let order;
  try { order = await getMyOrder(orderId); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return <OrderHistorySignIn />;
    throw error;
  }
  if (!order) notFound();
  return (
    <main className={styles.panel} data-order-details>
      <p className={styles.eyebrow}>Your purchases</p>
      <h1 className={styles.heading}>Order details</h1>
      <p className={`${styles.intro} mb-6`}>Names, codes and prices were recorded when this order was placed.</p>
      <OrderCard order={order} detail />
      <Link className={styles.catalogueLink} href="/order-history">Back to your orders</Link>
    </main>
  );
}
