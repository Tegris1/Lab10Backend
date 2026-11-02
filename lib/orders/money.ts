const zero = BigInt(0);
const hundred = BigInt(100);
export const maxMoneyGrosze = BigInt("9223372036854775807");

export function calculateOrderTotal(items: readonly { quantity: number; unitPriceGrosze: bigint }[]): bigint {
  if (items.length === 0) throw new RangeError("An order must contain at least one item.");
  let total = zero;
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) {
      throw new RangeError("Order quantity must be a positive PostgreSQL integer.");
    }
    if (typeof item.unitPriceGrosze !== "bigint" || item.unitPriceGrosze < zero || item.unitPriceGrosze > maxMoneyGrosze) {
      throw new RangeError("Order prices must be nonnegative integer grosze within BIGINT bounds.");
    }
    total += BigInt(item.quantity) * item.unitPriceGrosze;
    if (total > maxMoneyGrosze) throw new RangeError("Order total exceeds BIGINT bounds.");
  }
  return total;
}

export function formatGrosze(value: bigint | string): string {
  if (typeof value === "string" && !/^(0|[1-9][0-9]*)$/.test(value)) throw new RangeError("Invalid monetary value.");
  const amount = BigInt(value);
  if (amount < zero || amount > maxMoneyGrosze) throw new RangeError("Invalid monetary value.");
  const whole = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(amount / hundred);
  return `${whole},${(amount % hundred).toString().padStart(2, "0")} zł`;
}
