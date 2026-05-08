import type { CartItem } from "../types";

const roundCurrency = (value: number) => Number(value.toFixed(2));

export function calculateCart(
  items: CartItem[],
  billDiscountPercent: number = 0,
  billManualDiscountAmount: number = 0
) {
  const lines = items.map((item) => {
    const lineSubtotal = roundCurrency(item.price * item.quantity);
    const percentDiscountAmount = roundCurrency(lineSubtotal * (item.discountPercent / 100));
    const manualDiscountAmount = roundCurrency(
      Math.min(
        Math.max(0, item.manualDiscountAmount),
        Math.max(0, lineSubtotal - percentDiscountAmount)
      )
    );
    const itemDiscountAmount = roundCurrency(
      Math.min(lineSubtotal, percentDiscountAmount + manualDiscountAmount)
    );
    const taxableAmount = roundCurrency(Math.max(0, lineSubtotal - itemDiscountAmount));
    const taxAmount = roundCurrency(taxableAmount * (item.taxPercent / 100));
    const total = roundCurrency(taxableAmount + taxAmount);

    return {
      ...item,
      lineSubtotal,
      discountAmount: itemDiscountAmount,
      taxAmount,
      total
    };
  });

  const subtotalBeforeBillDiscount = roundCurrency(lines.reduce((sum, line) => sum + line.total, 0));
  const billPercentDiscount = roundCurrency(subtotalBeforeBillDiscount * (billDiscountPercent / 100));
  const billManualDiscount = Math.min(billManualDiscountAmount, subtotalBeforeBillDiscount - billPercentDiscount);
  
  const totalBillDiscount = roundCurrency(billPercentDiscount + billManualDiscount);
  const finalAmount = roundCurrency(Math.max(0, subtotalBeforeBillDiscount - totalBillDiscount));

  return {
    lines,
    totalAmount: roundCurrency(lines.reduce((sum, line) => sum + line.lineSubtotal, 0)),
    itemDiscountAmount: roundCurrency(lines.reduce((sum, line) => sum + line.discountAmount, 0)),
    billDiscountAmount: totalBillDiscount,
    discountAmount: roundCurrency(lines.reduce((sum, line) => sum + line.discountAmount, 0) + totalBillDiscount),
    taxAmount: roundCurrency(lines.reduce((sum, line) => sum + line.taxAmount, 0)),
    finalAmount
  };
}
