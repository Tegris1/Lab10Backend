"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SIGN_IN_CALLBACK_PATH } from "@/lib/auth-paths";
import styles from "./auth-controls.module.css";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function signIn() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signIn.social({
        provider: "github", callbackURL: SIGN_IN_CALLBACK_PATH,
        errorCallbackURL: "/sign-in?error=oauth",
      });
      if (result.error) { setError(true); setPending(false); }
    } catch { setError(true); setPending(false); }
  }

  return (
    <div>
      <button type="button" className={styles.button} disabled={pending} onClick={signIn} data-auth-sign-in>
        {pending ? "Connecting to GitHub…" : "Sign in with GitHub"}
      </button>
      {error && <p className={styles.message} role="alert">Could not start sign-in. Please try again.</p>}
      <span className={styles.srOnly} role="status">{pending ? "Redirecting to GitHub…" : ""}</span>
    </div>
  );
}

export default function AuthControls({ user, unavailable = false }: {
  user: { id: string; name: string; email: string } | null;
  unavailable?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<"current" | "all" | null>(null);
  const [error, setError] = useState<"current" | "all" | null>(null);
  const [syncError, setSyncError] = useState(false);
  const identity = JSON.stringify(user ? [user.id, user.name, user.email] : null);

  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    let refreshRequested = false;
    async function checkSession() {
      if (checking || refreshRequested || document.visibilityState === "hidden") return;
      checking = true;
      try {
        // Only a minimal identity is returned; session and OAuth tokens stay on the server.
        const response = await fetch("/api/account/session", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Session unavailable");
        const state: { user: { id: string; name: string; email: string } | null } = await response.json();
        if (controller.signal.aborted) return;
        setSyncError(false);
        const nextIdentity = JSON.stringify(state.user ? [state.user.id, state.user.name, state.user.email] : null);
        if (unavailable || identity !== nextIdentity) {
          refreshRequested = true;
          router.refresh();
        }
      } catch {
        if (!controller.signal.aborted) setSyncError(true);
      } finally { checking = false; }
    }
    void checkSession();
    window.addEventListener("focus", checkSession);
    window.addEventListener("online", checkSession);
    document.addEventListener("visibilitychange", checkSession);
    const interval = window.setInterval(checkSession, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", checkSession);
      window.removeEventListener("online", checkSession);
      document.removeEventListener("visibilitychange", checkSession);
    };
  }, [identity, unavailable, pathname, router]);

  async function signOut(allDevices: boolean) {
    const operation = allDevices ? "all" : "current";
    setPending(operation);
    setError(null);
    try {
      const result = allDevices ? await authClient.revokeSessions() : await authClient.signOut();
      if (result.error) { setError(operation); setPending(null); return; }
      router.replace("/");
      router.refresh();
    } catch { setError(operation); setPending(null); }
  }

  if (unavailable) return <p className={styles.message} role="status">Account temporarily unavailable. Please reload to try again.</p>;
  if (!user) return <div className={styles.controls}><SignInButton />
    {syncError && <p className={styles.message} role="status">Could not verify your session. Please reload to try again.</p>}
  </div>;
  return (
    <div className={styles.controls} data-auth-user>
      <p className={styles.identity}><span>Signed in as </span><strong>{user.name}</strong><span className={styles.email}>{user.email}</span></p>
      <div className={styles.sessionControls}>
        <div className={styles.buttons}>
          <button type="button" className={styles.button} disabled={pending !== null} onClick={() => signOut(false)} data-auth-sign-out>
            {pending === "current" ? "Signing out…" : "Sign out"}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={pending !== null} onClick={() => signOut(true)} data-auth-sign-out-all>
            {pending === "all" ? "Signing out everywhere…" : "Sign out on all devices"}
          </button>
        </div>
        <p className={styles.hint}>Sign out ends this session. Sign out on all devices also ends your other sessions.</p>
        <span className={styles.srOnly} role="status">{pending ? "Signing out. Please wait." : ""}</span>
      </div>
      {error && <p className={styles.message} role="alert">{error === "all" ? "Could not confirm sign-out on all devices. Please try again." : "Could not sign out. Please try again."}</p>}
      {syncError && <p className={styles.message} role="status">Could not verify your session. Please reload to try again.</p>}
    </div>
  );
}
