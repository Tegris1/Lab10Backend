import { demoUser } from "../lib/orders/demo-user";
import type { NewOrderSnapshot } from "../lib/orders/order-write";

// Fixed values recorded at placement. Do not derive historical prices from today's catalogue.
const purchasedProducts = {
  1: { productId: 1, nameSnapshot: "Quantum DISK 1", codeSnapshot: "R3SMC193Q8", unitPriceGrosze: BigInt(445421) },
  2: { productId: 2, nameSnapshot: "Quantum RAM 2", codeSnapshot: "RK15X22XQC", unitPriceGrosze: BigInt(163827) },
  3: { productId: 3, nameSnapshot: "NovaTech DISK 3", codeSnapshot: "KCW7MHAY3B", unitPriceGrosze: BigInt(299030) },
  4: { productId: 4, nameSnapshot: "NovaTech DISK 4", codeSnapshot: "U6V4QJJSZK", unitPriceGrosze: BigInt(48227) },
  5: { productId: 5, nameSnapshot: "CoreMax GPU 5", codeSnapshot: "FAG1P0PCN9", unitPriceGrosze: BigInt(487279) },
  6: { productId: 6, nameSnapshot: "NovaTech GPU 6", codeSnapshot: "VFSG37I1K1", unitPriceGrosze: BigInt(478507) },
} as const;
const item = (id: keyof typeof purchasedProducts, quantity: number) => ({ ...purchasedProducts[id], quantity });

export const demoOrders: readonly NewOrderSnapshot[] = [
  { id: "lab08-order-0001", number: "LAB08-2026-0001", userId: demoUser.id, status: "PAID",
    orderedAt: "2026-10-10T12:00:00.000Z", items: [item(1, 1), item(2, 2)] },
  { id: "lab08-order-0002", number: "LAB08-2026-0002", userId: demoUser.id, status: "SHIPPED",
    orderedAt: "2026-10-12T14:30:00.000Z", items: [item(3, 1), item(4, 2)] },
  { id: "lab08-order-0003", number: "LAB08-2026-0003", userId: demoUser.id, status: "CANCELLED",
    orderedAt: "2026-10-15T08:15:00.000Z", items: [item(5, 1)] },
  { id: "lab08-order-0004", number: "LAB08-2026-0004", userId: demoUser.id, status: "PENDING",
    orderedAt: "2026-10-20T16:45:00.000Z", items: [item(6, 2)] },
];
