import { demoUser } from "../lib/orders/demo-user";

export const demoCart = {
  id: "lab08-demo-cart",
  userId: demoUser.id,
  items: [
    { id: "lab08-cart-item-1", productId: 1, quantity: 1 },
    { id: "lab08-cart-item-2", productId: 2, quantity: 2 },
    { id: "lab08-cart-item-3", productId: 3, quantity: 3 },
  ],
} as const;
