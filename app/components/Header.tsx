import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header id="main-header">
      <div id="logo">
        <Link href="/">
          <Image
            className="logo"
            src="/politechnika-krakowska-logo%20(1).svg"
            alt="Politechnika Krakowska — Home"
            width={2000}
            height={1946}
            priority
          />
        </Link>
      </div>
      <nav aria-label="Main navigation">
        <ul>
          <li><Link href="/pages/about">About</Link></li>
          <li><Link href="/pages/product-list">Product List</Link></li>
          <li><Link href="/pages/basket">Basket</Link></li>
          <li><Link href="/pages/order-history">Order History</Link></li>
        </ul>
      </nav>
    </header>
  );
}
