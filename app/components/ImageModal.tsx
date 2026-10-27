"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";

export default function ImageModal({ title, productHref, children }: {
  title: string;
  productHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      // The underlying product remains mounted during an intercepted navigation.
      requestAnimationFrame(() => {
        if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      });
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[92vw] max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 font-sans text-slate-900 shadow-2xl backdrop:bg-slate-950/75 sm:p-8"
      onCancel={(event) => { event.preventDefault(); router.back(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) router.back(); }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-xl font-bold sm:text-2xl">{title}</h2>
        <button type="button" aria-label="Close image" onClick={() => router.back()}
          className="shrink-0 cursor-pointer rounded-lg bg-slate-100 px-4 py-2 font-semibold hover:bg-slate-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Close</button>
      </div>
      {children}
      <Link href={productHref}
        className="mt-5 inline-block font-semibold text-indigo-700 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">View product details</Link>
    </dialog>
  );
}
