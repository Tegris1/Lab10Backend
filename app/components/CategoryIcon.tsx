import type { ProductType } from "@/app/types/products";

const icons = {
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3" />
    </>
  ),
  gpu: (
    <>
      <rect x="4" y="6" width="17" height="11" rx="2" />
      <path d="M2 4v15h3m3-2v3h8v-3M18 9v5" />
      <circle cx="11" cy="11.5" r="3" />
      <path d="m9 9.5 4 4m0-4-4 4" />
    </>
  ),
  ram: (
    <>
      <rect x="2" y="6" width="20" height="11" rx="1" />
      <path d="M5 17v3m3-3v3m3-3v3m5-3v3m3-3v3" />
      <rect x="5" y="9" width="3" height="5" rx="0.5" />
      <rect x="10.5" y="9" width="3" height="5" rx="0.5" />
      <rect x="16" y="9" width="3" height="5" rx="0.5" />
    </>
  ),
  disk: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="10" r="5" />
      <circle cx="12" cy="10" r="1" />
      <path d="m12 10 5 6M7 19h6m3 0h1" />
    </>
  ),
};

export default function CategoryIcon({ type }: { type: ProductType }) {
  return (
    <svg
      className="category-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icons[type]}
    </svg>
  );
}
