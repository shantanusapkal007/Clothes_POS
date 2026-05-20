export type CheckoutItemInput = {
  productId: string;
  quantity: number;
  price: number;
  discountPercent: number;
  manualDiscountAmount?: number;
  taxPercent: number;
};

export type CheckoutLine = Omit<CheckoutItemInput, "manualDiscountAmount"> & {
  manualDiscountAmount: number;
  lineSubtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
};

export type CheckoutSummary = {
  items: CheckoutLine[];
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
};

const roundCurrency = (value: number) => Number(value.toFixed(2));

export function calculateCheckout(
  items: CheckoutItemInput[],
  billDiscountPercent: number = 0,
  billManualDiscountAmount: number = 0
): CheckoutSummary & { billDiscountAmount: number; itemDiscountAmount: number } {
  const calculatedItems = items.map((item) => {
    const lineSubtotal = roundCurrency(item.price * item.quantity);
    const percentDiscountAmount = roundCurrency(lineSubtotal * (item.discountPercent / 100));
    const manualDiscountAmount = roundCurrency(
      Math.min(
        Math.max(0, item.manualDiscountAmount ?? 0),
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
      manualDiscountAmount,
      lineSubtotal,
      discountAmount: itemDiscountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  });

  const subtotalBeforeBillDiscount = roundCurrency(calculatedItems.reduce((sum, item) => sum + item.total, 0));
  const billPercentDiscount = roundCurrency(subtotalBeforeBillDiscount * (billDiscountPercent / 100));
  const billManualDiscount = Math.min(billManualDiscountAmount, subtotalBeforeBillDiscount - billPercentDiscount);
  
  const totalBillDiscount = roundCurrency(billPercentDiscount + billManualDiscount);
  const finalAmount = roundCurrency(Math.max(0, subtotalBeforeBillDiscount - totalBillDiscount));

  return {
    items: calculatedItems,
    totalAmount: roundCurrency(calculatedItems.reduce((sum, item) => sum + item.lineSubtotal, 0)),
    itemDiscountAmount: roundCurrency(calculatedItems.reduce((sum, item) => sum + item.discountAmount, 0)),
    billDiscountAmount: totalBillDiscount,
    discountAmount: roundCurrency(calculatedItems.reduce((sum, item) => sum + item.discountAmount, 0) + totalBillDiscount),
    taxAmount: roundCurrency(calculatedItems.reduce((sum, item) => sum + item.taxAmount, 0)),
    finalAmount
  };
}
