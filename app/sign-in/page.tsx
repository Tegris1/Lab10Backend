import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { SIGN_IN_CALLBACK_PATH } from "@/lib/auth-paths";
import { SignInButton } from "@/app/components/AuthControls";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getCurrentSession();
  if (session) redirect(SIGN_IN_CALLBACK_PATH);
  const parameters = await searchParams;
  return (
    <main className="rounded-2xl bg-white p-6 font-sans text-slate-900 sm:p-8" data-sign-in>
      <h1 className="mb-3 text-3xl font-bold">Sign in</h1>
      <p className="mb-6 text-slate-600">Sign in with GitHub to access your saved basket.</p>
      {parameters.error !== undefined && <p className="mb-4 text-red-700" role="alert">Sign-in could not be completed. Please try again.</p>}
      <SignInButton />
    </main>
  );
}
