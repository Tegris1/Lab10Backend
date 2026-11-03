import { permanentRedirect } from "next/navigation";

export default function LegacyOrderHistory() {
  permanentRedirect("/order-history");
}
