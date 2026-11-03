import Image from "next/image";
import NavLink from "./NavLink";
import AuthControls from "./AuthControls";
import { getCurrentSession } from "@/lib/auth/session";

export default async function Header() {
  let user: { id: string; name: string; email: string } | null = null;
  let unavailable = false;
  try {
    const session = await getCurrentSession();
    if (session) user = { id: session.user.id, name: session.user.name, email: session.user.email };
  } catch { unavailable = true; }
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
          <li><NavLink href="/basket">Basket</NavLink></li>
          <li><NavLink href="/order-history">Order History</NavLink></li>
        </ul>
      </nav>
      <AuthControls user={user} unavailable={unavailable} />
    </header>
  );
}
