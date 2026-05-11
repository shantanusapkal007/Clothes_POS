import { describe, it, expect } from 'vitest';
import { parseBarcodeData, formatBarcodeString } from '../barcode-parser';

describe('parseBarcodeData', () => {
  it('should parse a simple barcode', () => {
    const result = parseBarcodeData('123456789');
    expect(result).toEqual({
      barcode: '123456789',
      rawData: '123456789',
    });
  });

  describe('Pipe separated format (|)', () => {
    it('should parse barcode with price', () => {
      const result = parseBarcodeData('123456789|25.99');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        rawData: '123456789|25.99',
      });
    });

    it('should parse barcode with price and discount', () => {
      const result = parseBarcodeData('123456789|25.99|10');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        rawData: '123456789|25.99|10',
      });
    });

    it('should parse barcode with price, discount, and quantity', () => {
      const result = parseBarcodeData('123456789|25.99|10|2');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        quantity: 2,
        rawData: '123456789|25.99|10|2',
      });
    });

    it('should parse barcode with price, discount, quantity, and manual discount', () => {
      const result = parseBarcodeData('123456789|25.99|10|2|5.00');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        quantity: 2,
        manualDiscount: 5,
        rawData: '123456789|25.99|10|2|5.00',
      });
    });

    it('should ignore empty fields', () => {
      const result = parseBarcodeData('123456789||10||5.00');
      expect(result).toEqual({
        barcode: '123456789',
        discount: 10,
        manualDiscount: 5,
        rawData: '123456789||10||5.00',
      });
    });
  });

  describe('Colon separated format (:)', () => {
    it('should parse barcode with price', () => {
      const result = parseBarcodeData('123456789:25.99');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        rawData: '123456789:25.99',
      });
    });

    it('should parse barcode with price and discount', () => {
      const result = parseBarcodeData('123456789:25.99:10');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        rawData: '123456789:25.99:10',
      });
    });

    it('should parse barcode with all fields', () => {
      const result = parseBarcodeData('123456789:25.99:10:2:5.00');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        quantity: 2,
        manualDiscount: 5,
        rawData: '123456789:25.99:10:2:5.00',
      });
    });
  });

  describe('Whitespace separated format', () => {
    it('should parse space-separated values', () => {
      const result = parseBarcodeData('123456789 25.99 10 2 5.00');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        quantity: 2,
        manualDiscount: 5,
        rawData: '123456789|25.99|10|2|5.00', // Note: whitespace gets normalized to |
      });
    });

    it('should handle multiple spaces', () => {
      const result = parseBarcodeData('123456789   25.99    10');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        rawData: '123456789|25.99|10',
      });
    });
  });

  describe('Edge cases and normalizations', () => {
    it('should handle surrounding whitespace', () => {
      const result = parseBarcodeData('  123456789|25.99  ');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        rawData: '123456789|25.99',
      });
    });

    it('should normalize semicolons to pipes', () => {
      const result = parseBarcodeData('123456789;25.99;10');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        rawData: '123456789|25.99|10',
      });
    });

    it('should normalize newlines to pipes', () => {
      const result = parseBarcodeData('123456789\n25.99\n10');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        discount: 10,
        rawData: '123456789|25.99|10',
      });
    });

    it('should handle European number format with comma', () => {
      const result = parseBarcodeData('123456789|25,99');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99,
        rawData: '123456789|25,99',
      });
    });

    it('should take absolute value for price and manual discount', () => {
      const result = parseBarcodeData('123456789|-25.99|10|2|-5.00');
      expect(result).toEqual({
        barcode: '123456789',
        price: 25.99, // Math.abs
        discount: 10,
        quantity: 2,
        manualDiscount: 5, // Math.abs
        rawData: '123456789|-25.99|10|2|-5.00',
      });
    });

    it('should bound discount between 0 and 100', () => {
      const resultUnder = parseBarcodeData('123456789|25.99|-10');
      expect(resultUnder.discount).toBe(0);

      const resultOver = parseBarcodeData('123456789|25.99|150');
      expect(resultOver.discount).toBe(100);
    });

    it('should ignore non-numeric invalid fields', () => {
      const result = parseBarcodeData('123456789|abc|xyz|foo|bar');
      expect(result).toEqual({
        barcode: '123456789',
        rawData: '123456789|abc|xyz|foo|bar',
      });
    });

    it('should ignore negative or invalid quantity', () => {
      const resultZero = parseBarcodeData('123456789|25.99|10|0');
      expect(resultZero.quantity).toBeUndefined();

      const resultNeg = parseBarcodeData('123456789|25.99|10|-5');
      expect(resultNeg.quantity).toBeUndefined();

      const resultInvalid = parseBarcodeData('123456789|25.99|10|abc');
      expect(resultInvalid.quantity).toBeUndefined();
    });
  });
});

describe('formatBarcodeString', () => {
  it('should format just barcode', () => {
    expect(formatBarcodeString('123456789')).toBe('123456789');
  });

  it('should format barcode and price', () => {
    expect(formatBarcodeString('123456789', 25.99)).toBe('123456789|25.99');
  });

  it('should format all fields', () => {
    expect(formatBarcodeString('123456789', 25.99, 10, 2, 5.00)).toBe('123456789|25.99|10|2|5.00');
  });

  it('should add default zeros/ones when intermediate fields are skipped', () => {
    // If we only provide manual discount but have price
    expect(formatBarcodeString('123456789', 25.99, undefined, undefined, 5.00)).toBe('123456789|25.99|0|1|5.00');
  });
});
