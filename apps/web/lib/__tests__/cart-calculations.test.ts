import { describe, it, expect } from 'vitest';
import { calculateCart } from '../cart-calculations';
import type { CartItem } from '../../types';

describe('calculateCart', () => {
  const createMockItem = (overrides: Partial<CartItem> = {}): CartItem => ({
    productId: 'test-product-1',
    name: 'Test Product',
    barcode: '123456',
    quantity: 1,
    price: 100,
    discountPercent: 0,
    manualDiscountAmount: 0,
    taxPercent: 0,
    stock: 10,
    ...overrides,
  });

  it('should handle an empty cart', () => {
    const result = calculateCart([], 0, 0);
    expect(result).toEqual({
      lines: [],
      totalAmount: 0,
      itemDiscountAmount: 0,
      billDiscountAmount: 0,
      discountAmount: 0,
      taxAmount: 0,
      finalAmount: 0,
    });
  });

  it('should calculate basics correctly without discounts or taxes', () => {
    const item1 = createMockItem({ price: 100, quantity: 2 });
    const item2 = createMockItem({ productId: 'prod-2', price: 50, quantity: 1 });

    const result = calculateCart([item1, item2]);

    expect(result.totalAmount).toBe(250);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.finalAmount).toBe(250);

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].lineSubtotal).toBe(200);
    expect(result.lines[0].total).toBe(200);
    expect(result.lines[1].lineSubtotal).toBe(50);
    expect(result.lines[1].total).toBe(50);
  });

  it('should apply item-level percent discounts correctly', () => {
    const item1 = createMockItem({ price: 100, quantity: 2, discountPercent: 10 }); // 200 * 10% = 20 discount

    const result = calculateCart([item1]);

    expect(result.totalAmount).toBe(200);
    expect(result.itemDiscountAmount).toBe(20);
    expect(result.discountAmount).toBe(20);
    expect(result.finalAmount).toBe(180);

    expect(result.lines[0].discountAmount).toBe(20);
    expect(result.lines[0].total).toBe(180);
  });

  it('should apply item-level manual discounts correctly', () => {
    const item1 = createMockItem({ price: 100, quantity: 2, manualDiscountAmount: 30 }); // 200 - 30 = 170

    const result = calculateCart([item1]);

    expect(result.totalAmount).toBe(200);
    expect(result.itemDiscountAmount).toBe(30);
    expect(result.discountAmount).toBe(30);
    expect(result.finalAmount).toBe(170);

    expect(result.lines[0].discountAmount).toBe(30);
    expect(result.lines[0].total).toBe(170);
  });

  it('should cap item manual discount to the line subtotal', () => {
    const item1 = createMockItem({ price: 100, quantity: 1, manualDiscountAmount: 150 });

    const result = calculateCart([item1]);

    expect(result.totalAmount).toBe(100);
    expect(result.itemDiscountAmount).toBe(100);
    expect(result.finalAmount).toBe(0);

    expect(result.lines[0].discountAmount).toBe(100);
    expect(result.lines[0].total).toBe(0);
  });

  it('should apply item taxes correctly on top of discounted amounts', () => {
    // 100 - 10% = 90
    // 90 + 10% tax = 99
    const item1 = createMockItem({ price: 100, quantity: 1, discountPercent: 10, taxPercent: 10 });

    const result = calculateCart([item1]);

    expect(result.totalAmount).toBe(100);
    expect(result.itemDiscountAmount).toBe(10);
    expect(result.taxAmount).toBe(9);
    expect(result.finalAmount).toBe(99);

    expect(result.lines[0].discountAmount).toBe(10);
    expect(result.lines[0].taxAmount).toBe(9);
    expect(result.lines[0].total).toBe(99);
  });

  it('should apply bill-level percent discount correctly', () => {
    const item1 = createMockItem({ price: 100, quantity: 2 });

    // 200 subtotal, 10% bill discount = 20
    const result = calculateCart([item1], 10, 0);

    expect(result.totalAmount).toBe(200);
    expect(result.itemDiscountAmount).toBe(0);
    expect(result.billDiscountAmount).toBe(20);
    expect(result.discountAmount).toBe(20);
    expect(result.finalAmount).toBe(180);
  });

  it('should apply bill-level manual discount correctly', () => {
    const item1 = createMockItem({ price: 100, quantity: 2 });

    // 200 subtotal, 50 manual bill discount
    const result = calculateCart([item1], 0, 50);

    expect(result.totalAmount).toBe(200);
    expect(result.itemDiscountAmount).toBe(0);
    expect(result.billDiscountAmount).toBe(50);
    expect(result.discountAmount).toBe(50);
    expect(result.finalAmount).toBe(150);
  });

  it('should cap bill manual discount so final amount does not go below zero', () => {
    const item1 = createMockItem({ price: 100, quantity: 1 });

    // 100 subtotal, 150 manual bill discount -> cap at 100
    const result = calculateCart([item1], 0, 150);

    expect(result.totalAmount).toBe(100);
    expect(result.billDiscountAmount).toBe(100);
    expect(result.finalAmount).toBe(0);
  });

  it('should apply combined item and bill discounts correctly', () => {
    // 100 - 10% discount = 90
    // 90 + 10% tax = 99 total for line
    const item1 = createMockItem({ price: 100, quantity: 1, discountPercent: 10, taxPercent: 10 });

    // Subtotal before bill discount = 99
    // Bill 10% discount = 9.9
    // Bill manual discount = 10.1
    // Total bill discount = 20
    // Final = 99 - 20 = 79
    const result = calculateCart([item1], 10, 10.1);

    expect(result.totalAmount).toBe(100);
    expect(result.itemDiscountAmount).toBe(10);
    expect(result.taxAmount).toBe(9);
    expect(result.billDiscountAmount).toBe(20);
    expect(result.discountAmount).toBe(30);
    expect(result.finalAmount).toBe(79);
  });

  it('should correctly round currency at all steps', () => {
    // 33.333... * 3 = 100
    const item1 = createMockItem({ price: 33.33, quantity: 3, taxPercent: 5.5 });

    // 33.33 * 3 = 99.99
    // Tax = 99.99 * 5.5% = 5.49945 -> rounded to 5.50
    // Item total = 99.99 + 5.50 = 105.49

    // Bill 10.5% discount = 105.49 * 10.5% = 11.07645 -> rounded to 11.08
    // Final = 105.49 - 11.08 = 94.41
    const result = calculateCart([item1], 10.5, 0);

    expect(result.totalAmount).toBe(99.99);
    expect(result.taxAmount).toBe(5.50);
    expect(result.itemDiscountAmount).toBe(0);
    expect(result.billDiscountAmount).toBe(11.08);
    expect(result.discountAmount).toBe(11.08);
    expect(result.finalAmount).toBe(94.41);

    expect(result.lines[0].lineSubtotal).toBe(99.99);
    expect(result.lines[0].taxAmount).toBe(5.50);
    expect(result.lines[0].total).toBe(105.49);
  });
});
