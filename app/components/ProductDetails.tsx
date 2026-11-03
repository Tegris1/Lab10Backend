import "server-only";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/app/types/products";
import ProductNavigation, { ProductPageLink } from "./ProductNavigation";
import styles from "./product-details.module.css";
import { AddToBasketButton } from "./BasketControls";

export default function ProductDetails({ product, backHref = "/product-list" }: {
  product: Product;
  backHref?: string;
}) {
  const price = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(product.price / 100);
  const date = product.date;
  const fields = [
    ["Product ID", product.id], ["Code", product.code], ["Category", product.type.toUpperCase()],
    ["Price", price], ["Stock", `${product.amount > 0 ? "In stock" : "Out of stock"} — ${product.amount} units`],
    ["Date", <time key="date" dateTime={product.date}>{date}</time>],
  ];
  return (
    <ProductNavigation>
      <main className={styles.panel}>
        <p className={styles.eyebrow}>{product.type} / Product details</p>
        <h1 className={styles.heading}>{product.name}</h1>
        <figure className={styles.figure}>
          <Link href={`/product-list/${product.id}/image`} scroll={false}
            className={styles.imageLink}
            aria-label={`Enlarge image of ${product.name}`}>
            <Image src={product.image} alt={`${product.type.toUpperCase()} component illustration`}
              width={640} height={400} sizes="(max-width: 640px) 90vw, 640px"
              className={styles.image} />
          </Link>
          <figcaption className={styles.caption}>Category illustration; actual product appearance may vary. Select the image to enlarge.</figcaption>
        </figure>
        <p className={styles.description}>{product.description}</p>
        <dl className={styles.facts}>
          {fields.map(([label, value]) => (
            <div key={String(label)} className={styles.fact}>
              <dt className={styles.label}>{label}</dt>
              <dd className={styles.value}>{value}</dd>
            </div>
          ))}
        </dl>
        <AddToBasketButton productId={product.id} name={product.name} available={product.amount > 0} />
        <ProductPageLink href={backHref} view="list"
          className={styles.backLink}>
          ← Back to product list
        </ProductPageLink>
      </main>
    </ProductNavigation>
  );
}
