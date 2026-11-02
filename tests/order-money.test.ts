import { describe, expect, it } from "vitest";
import { calculateOrderTotal, formatGrosze, maxMoneyGrosze } from "@/lib/orders/money";
import { prepareOrderSnapshot } from "@/lib/orders/order-write";
import { demoOrders } from "@/prisma/order-history-fixtures";

describe("historical order money and validation", () => {
  it("multiplies and sums exact grosze beyond Number's safe range", () => {
    const price = BigInt("9007199254740993");
    expect(calculateOrderTotal([{ quantity: 2, unitPriceGrosze: price }, { quantity: 3, unitPriceGrosze: BigInt(1) }]))
      .toBe(BigInt("18014398509481989"));
    expect(calculateOrderTotal([{ quantity: 1, unitPriceGrosze: maxMoneyGrosze }])).toBe(maxMoneyGrosze);
  });
  it("rejects empty orders, invalid quantities, negative prices and overflow before a write", () => {
    for (const items of [[], [{ quantity: 0, unitPriceGrosze: BigInt(1) }], [{ quantity: 1.5, unitPriceGrosze: BigInt(1) }],
      [{ quantity: 2147483648, unitPriceGrosze: BigInt(1) }], [{ quantity: 1, unitPriceGrosze: BigInt(-1) }],
      [{ quantity: 2, unitPriceGrosze: maxMoneyGrosze }]]) {
      expect(() => calculateOrderTotal(items)).toThrow(RangeError);
    }
    expect(calculateOrderTotal([{ quantity: 1, unitPriceGrosze: BigInt(0) }])).toBe(BigInt(0));
  });
  it("formats exact PLN without converting grosze to Number", () => {
    expect(formatGrosze(BigInt(0))).toBe("0,00 zł");
    expect(formatGrosze("19999")).toBe("199,99 zł");
    expect(formatGrosze("9007199254740993").replace(/\s/g, "")).toBe("90071992547409,93zł");
    expect(() => formatGrosze("1.5")).toThrow(RangeError);
  });
  it("copies snapshots and uses stable line identities while rejecting invalid identity/date/item fields", () => {
    const fixture = demoOrders[0];
    const prepared = prepareOrderSnapshot(fixture);
    expect(prepared.totalGrosze).toBe(BigInt(773075));
    expect(prepared.items?.create).toEqual(fixture.items.map((item, index) => ({ ...item, id: `${fixture.id}-line-${index + 1}`, lineNumber: index + 1 })));
    for (const input of [{ ...fixture, number: " " }, { ...fixture, orderedAt: "2026-02-30T00:00:00.000Z" },
      { ...fixture, items: [{ ...fixture.items[0], nameSnapshot: " " }] },
      { ...fixture, items: [{ ...fixture.items[0], productId: 0 }] }]) {
      expect(() => prepareOrderSnapshot(input)).toThrow(RangeError);
    }
  });
});
