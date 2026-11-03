import { SignInButton } from "./AuthControls";
import styles from "./order-history.module.css";

export default function OrderHistorySignIn() {
  return (
    <main className={styles.panel} data-order-history data-auth-required>
      <h1 className={styles.heading}>Order history</h1>
      <p className="mb-6 text-slate-600">Sign in to view your own orders.</p>
      <SignInButton />
    </main>
  );
}
