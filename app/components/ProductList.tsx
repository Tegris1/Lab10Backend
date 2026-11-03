import "server-only";
import type { Product, CatalogSort, ProductStock, ProductType } from "@/app/types/products";
import SortRadio from "./SortRadio";
import ProductFilters from "./ProductFilters";
import CategoryIcon from "./CategoryIcon";
import { AddToBasketButton } from "./BasketControls";
import "./product-list.css";
import ProductNavigation, { ProductPageLink } from "./ProductNavigation";

const priceFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

export default function ProductList({
  sort,
  type,
  stock,
  warnings,
  products,
}: {
  sort: CatalogSort;
  type?: ProductType;
  stock: ProductStock;
  warnings: string[];
  products: Product[];
}) {
  return (
    <ProductNavigation>
      <main className="product-list font-sans">
        <header className="product-list-heading">
          <div>
            <p className="product-list-eyebrow">Computer components</p>
            <h1 className="font-bold">Product List</h1>
            <p>Find the right components for your next build.</p>
          </div>
          <span className="product-count" role="status">
            {products.length}{" "}
            {products.length === 1 ? "product" : "products"}
          </span>
        </header>
        {warnings.length > 0 && (
          <div className="product-list-message" role="status" aria-label="URL settings notice">
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        )}
        <div className="product-list-controls">
          <ProductFilters type={type} stock={stock} sort={sort} />
          <SortRadio sort={sort} />
        </div>
        {products.length === 0 ? (
          <p className="product-list-message">
            {type || stock !== "all"
              ? "No products match the selected filters."
              : "Katalog produktów jest pusty."}
          </p>
        ) : (
          <ul className="product-items" aria-label="Products">
            {products.map((product) => (
              <li key={product.id}>
                <article className="product-card hover:border-indigo-300">
                  <div className="product-card-category">
                    <span className="product-category-label">
                      <CategoryIcon type={product.type} />
                      {product.type.toUpperCase()}
                    </span>
                    <span
                      className={`product-stock ${product.amount > 0 ? "product-stock-available" : "product-stock-empty"}`}
                    >
                      {product.amount > 0 ? "In stock" : "Out of stock"}
                    </span>
                  </div>
                  <h2 className="font-bold tracking-tight">{product.name}</h2>
                  <p className="product-description">{product.description}</p>
                  <footer className="product-card-footer">
                    <span className="product-price">
                      {priceFormatter.format(product.price / 100)}
                    </span>
                    <span className="product-quantity">
                      {product.amount} available
                    </span>
                  </footer>
                  <ProductPageLink href={`/product-list/${product.id}`} view="details"
                    className="mt-3 w-fit font-semibold text-indigo-700 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-indigo-700">
                    to product details
                  </ProductPageLink>
                  <AddToBasketButton productId={product.id} name={product.name} available={product.amount > 0} />
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </ProductNavigation>
  );
}
