import { describe, it, expect } from 'vitest';
import { calculateCheckout, CheckoutItemInput } from './billing';

describe('calculateCheckout', () => {
  it('should return 0 totals for an empty cart', () => {
    const result = calculateCheckout([]);
    expect(result.items).toEqual([]);
    expect(result.totalAmount).toBe(0);
    expect(result.itemDiscountAmount).toBe(0);
    expect(result.billDiscountAmount).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.finalAmount).toBe(0);
  });

  it('should calculate totals for a single item with no discounts or taxes', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 2, price: 100, discountPercent: 0, taxPercent: 0 }
    ];
    const result = calculateCheckout(items);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].lineSubtotal).toBe(200);
    expect(result.items[0].discountAmount).toBe(0);
    expect(result.items[0].taxableAmount).toBe(200);
    expect(result.items[0].taxAmount).toBe(0);
    expect(result.items[0].total).toBe(200);

    expect(result.totalAmount).toBe(200);
    expect(result.itemDiscountAmount).toBe(0);
    expect(result.billDiscountAmount).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.finalAmount).toBe(200);
  });

  it('should calculate totals for multiple items with no discounts or taxes', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 2, price: 100, discountPercent: 0, taxPercent: 0 },
      { productId: 'p2', quantity: 1, price: 50, discountPercent: 0, taxPercent: 0 }
    ];
    const result = calculateCheckout(items);

    expect(result.totalAmount).toBe(250);
    expect(result.finalAmount).toBe(250);
  });

  it('should apply item-level percentage discounts', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 1, price: 100, discountPercent: 10, taxPercent: 0 }
    ];
    const result = calculateCheckout(items);

    expect(result.items[0].discountAmount).toBe(10);
    expect(result.items[0].total).toBe(90);
    expect(result.itemDiscountAmount).toBe(10);
    expect(result.finalAmount).toBe(90);
  });

  it('should apply item-level manual discounts', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 1, price: 100, discountPercent: 0, manualDiscountAmount: 15, taxPercent: 0 }
    ];
    const result = calculateCheckout(items);

    expect(result.items[0].discountAmount).toBe(15);
    expect(result.items[0].total).toBe(85);
    expect(result.itemDiscountAmount).toBe(15);
    expect(result.finalAmount).toBe(85);
  });

  it('should combine item-level percentage and manual discounts without exceeding subtotal', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 1, price: 100, discountPercent: 50, manualDiscountAmount: 60, taxPercent: 0 }
    ];
    const result = calculateCheckout(items);

    // Line subtotal is 100
    // Percentage discount is 50
    // Manual discount is maxed out at (100 - 50) = 50, even though 60 was requested
    expect(result.items[0].discountAmount).toBe(100);
    expect(result.items[0].total).toBe(0);
    expect(result.itemDiscountAmount).toBe(100);
    expect(result.finalAmount).toBe(0);
  });

  it('should apply item-level taxes', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 1, price: 100, discountPercent: 0, taxPercent: 10 }
    ];
    const result = calculateCheckout(items);

    expect(result.items[0].taxAmount).toBe(10);
    expect(result.items[0].total).toBe(110);
    expect(result.taxAmount).toBe(10);
    expect(result.finalAmount).toBe(110);
  });

  it('should calculate taxes after item discounts', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 1, price: 100, discountPercent: 10, taxPercent: 10 }
    ];
    const result = calculateCheckout(items);

    // Subtotal: 100
    // Discount: 10
    // Taxable: 90
    // Tax: 9
    expect(result.items[0].taxableAmount).toBe(90);
    expect(result.items[0].taxAmount).toBe(9);
    expect(result.items[0].total).toBe(99);
    expect(result.taxAmount).toBe(9);
    expect(result.finalAmount).toBe(99);
  });

  it('should apply bill-level percentage discount', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 2, price: 100, discountPercent: 0, taxPercent: 0 }
    ];
    const result = calculateCheckout(items, 10, 0); // 10% bill discount

    // Subtotal: 200
    // Bill Discount: 20
    expect(result.totalAmount).toBe(200);
    expect(result.billDiscountAmount).toBe(20);
    expect(result.discountAmount).toBe(20);
    expect(result.finalAmount).toBe(180);
  });

  it('should apply bill-level manual discount', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 2, price: 100, discountPercent: 0, taxPercent: 0 }
    ];
    const result = calculateCheckout(items, 0, 30); // $30 bill discount

    // Subtotal: 200
    // Bill Discount: 30
    expect(result.totalAmount).toBe(200);
    expect(result.billDiscountAmount).toBe(30);
    expect(result.discountAmount).toBe(30);
    expect(result.finalAmount).toBe(170);
  });

  it('should combine item discounts, taxes, and bill discounts', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 1, price: 100, discountPercent: 10, manualDiscountAmount: 5, taxPercent: 8 },
      { productId: 'p2', quantity: 2, price: 50, discountPercent: 0, taxPercent: 5 }
    ];
    // p1: subtotal 100, discount 15, taxable 85, tax 6.80, total 91.80
    // p2: subtotal 100, discount 0, taxable 100, tax 5.00, total 105.00
    // Items subtotal before bill discount: 196.80

    // Apply 10% bill discount and $10 manual bill discount
    // Bill percent discount: 19.68
    // Bill manual discount: 10.00
    // Total bill discount: 29.68
    // Final Amount: 196.80 - 29.68 = 167.12
    const result = calculateCheckout(items, 10, 10);

    expect(result.totalAmount).toBe(200);
    expect(result.itemDiscountAmount).toBe(15);
    expect(result.taxAmount).toBe(11.80);
    expect(result.billDiscountAmount).toBe(29.68);
    expect(result.discountAmount).toBe(44.68); // 15 + 29.68
    expect(result.finalAmount).toBe(167.12);
  });

  it('should not allow total amount to drop below zero', () => {
    const items: CheckoutItemInput[] = [
      { productId: 'p1', quantity: 1, price: 100, discountPercent: 0, taxPercent: 0 }
    ];
    const result = calculateCheckout(items, 0, 150); // $150 manual bill discount, which exceeds the total

    expect(result.totalAmount).toBe(100);
    expect(result.billDiscountAmount).toBe(100); // Caps out at the subtotal 100
    expect(result.discountAmount).toBe(100);
    expect(result.finalAmount).toBe(0);
  });
});
