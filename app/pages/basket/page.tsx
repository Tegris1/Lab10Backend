import { permanentRedirect } from "next/navigation";

export default function LegacyBasket() {
  permanentRedirect("/basket");
}
