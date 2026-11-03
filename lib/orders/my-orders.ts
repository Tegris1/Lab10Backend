import "server-only";
import { requireSession } from "../auth/session";
import { findOrderForUser, listOrdersForUser } from "./order-repo";

export async function getMyOrders() {
  const session = await requireSession();
  return listOrdersForUser(session.user.id);
}

export async function getMyOrder(orderId: unknown) {
  const session = await requireSession();
  return findOrderForUser(session.user.id, orderId);
}
