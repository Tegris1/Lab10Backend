import Image from "next/image";
import NavLink from "./NavLink";

export default function Header() {
  return (
    <header id="main-header">
      <div id="logo">
        <NavLink href="/">
          <Image
            className="logo"
            src="/politechnika-krakowska-logo%20(1).svg"
            alt="Politechnika Krakowska — Home"
            width={2000}
            height={1946}
            priority
          />
        </NavLink>
      </div>
      <nav aria-label="Main navigation">
        <ul>
          <li><NavLink href="/pages/about">About</NavLink></li>
          <li><NavLink href="/product-list">Product List</NavLink></li>
          <li><NavLink href="/catalog">Catalogue</NavLink></li>
          <li><NavLink href="/pages/basket">Basket</NavLink></li>
          <li><NavLink href="/pages/order-history">Order History</NavLink></li>
        </ul>
      </nav>
    </header>
  );
}
