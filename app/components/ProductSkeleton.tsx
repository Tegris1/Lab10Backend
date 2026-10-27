import styles from "./product-skeleton.module.css";
import "./product-list.css";

function Line({ className = "" }: { className?: string }) {
  return <span className={`${styles.block} ${className}`} />;
}

export function ProductListSkeleton() {
  return (
    <main className="product-list" aria-busy="true" aria-label="Loading product list">
      <p className={styles.status} role="status">Loading products…</p>
      <div aria-hidden="true">
        <div className="product-list-heading">
          <div className={styles.heading}>
            <Line className={styles.eyebrow} />
            <Line className={styles.title} />
            <Line className={styles.subtitle} />
          </div>
          <Line className={styles.badge} />
        </div>
        <div className="product-list-controls">
          <div className={styles.controls}>
            <Line className={styles.control} />
            <Line className={styles.control} />
            <Line className={styles.control} />
          </div>
          <Line className={styles.sort} />
        </div>
        <div className="product-items">
          {[0, 1, 2, 3].map((index) => (
            <div className="product-card" key={index}>
              <div className="product-card-category">
                <Line className={styles.badge} />
                <Line className={styles.badge} />
              </div>
              <Line className={styles.cardTitle} />
              <Line className={styles.line} />
              <Line className={styles.description} />
              <div className="product-card-footer">
                <Line className={styles.price} />
                <Line className={styles.badge} />
              </div>
              <Line className={styles.link} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function ProductDetailsSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading product details">
      <p className={styles.status} role="status">Loading product details…</p>
      <div aria-hidden="true">
        <Line className={styles.detailsTitle} />
        <figure>
          <Line className={styles.image} />
          <Line className={styles.subtitle} />
        </figure>
        <Line className={styles.line} />
        <Line className={styles.description} />
        <div className={styles.fields}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div className={styles.field} key={index}>
              <Line className={styles.label} />
              <Line className={styles.value} />
            </div>
          ))}
        </div>
        <Line className={styles.link} />
      </div>
    </main>
  );
}
