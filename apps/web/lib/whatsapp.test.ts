import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildWhatsAppBillMessage, openWhatsAppShare } from './whatsapp';
import { STORE_WHATSAPP_NUMBER } from './printer';

describe('whatsapp utils', () => {
  describe('buildWhatsAppBillMessage', () => {
    const mockBill = {
      totalAmount: 100,
      discountAmount: 10,
      taxAmount: 5,
      finalAmount: 95,
      createdAt: '2023-10-27T10:00:00Z',
      items: [
        {
          productName: 'T-Shirt',
          quantity: 2,
          price: 50,
          total: 100
        }
      ]
    };

    const mockBillLayout = {
      companyName: 'Test Store',
      companyPhone: '9876543210',
      whatsappSenderPhone: '1234567890',
      footerText: 'Thanks for visiting!'
    };

    const mockPaymentMethod = 'cash';
    const mockBillNumber = 'BILL-001';

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2023-10-28T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should format a basic bill correctly with all layout options provided', () => {
      const message = buildWhatsAppBillMessage(
        mockBill,
        mockBillNumber,
        mockBillLayout,
        mockPaymentMethod
      );

      expect(message).toContain('Test Store Bill');
      expect(message).toContain('Bill No: BILL-001');
      expect(message).toContain('Payment: CASH');
      expect(message).toContain('From: 1234567890');
      expect(message).toContain('Store WhatsApp: 1234567890');
      expect(message).toContain('Thanks for visiting!');
      expect(message).toContain('- T-Shirt x2 | ₹50.00 | ₹100.00');
      expect(message).toContain('Subtotal: ₹100.00');
      expect(message).toContain('Discount: ₹10.00');
      expect(message).toContain('Tax: ₹5.00');
      expect(message).toContain('Total: ₹95.00');
    });

    it('should fall back to defaults when layout options are missing', () => {
      const emptyLayout = {};
      const message = buildWhatsAppBillMessage(
        mockBill,
        mockBillNumber,
        emptyLayout,
        mockPaymentMethod
      );

      expect(message).toContain('Clothing Store Bill');
      expect(message).toContain(`From: ${STORE_WHATSAPP_NUMBER}`);
      expect(message).toContain(`Store WhatsApp: ${STORE_WHATSAPP_NUMBER}`);
      expect(message).toContain('Thank you for shopping with us.');
    });

    it('should fall back to companyPhone if whatsappSenderPhone is missing', () => {
      const layout = { companyPhone: '9998887770' };
      const message = buildWhatsAppBillMessage(
        mockBill,
        mockBillNumber,
        layout,
        mockPaymentMethod
      );

      expect(message).toContain('From: 9998887770');
    });

    it('should handle missing items array gracefully', () => {
      const noItemsBill = { ...mockBill, items: undefined };
      const message = buildWhatsAppBillMessage(
        noItemsBill,
        mockBillNumber,
        mockBillLayout,
        mockPaymentMethod
      );

      expect(message).not.toContain('Items:');
      expect(message).not.toContain('T-Shirt');
      expect(message).toContain('Subtotal: ₹100.00');
    });

    it('should handle empty items array gracefully', () => {
      const noItemsBill = { ...mockBill, items: [] };
      const message = buildWhatsAppBillMessage(
        noItemsBill,
        mockBillNumber,
        mockBillLayout,
        mockPaymentMethod
      );

      expect(message).not.toContain('Items:');
      expect(message).toContain('Subtotal: ₹100.00');
    });

    it('should handle valid createdAt date', () => {
      const message = buildWhatsAppBillMessage(
        mockBill,
        mockBillNumber,
        mockBillLayout,
        mockPaymentMethod
      );

      const expectedDateStr = new Date('2023-10-27T10:00:00Z').toLocaleString('en-IN');
      expect(message).toContain(`Date: ${expectedDateStr}`);
    });

    it('should handle missing createdAt date by using current date', () => {
      const noDateBill = { ...mockBill, createdAt: undefined };
      const message = buildWhatsAppBillMessage(
        noDateBill,
        mockBillNumber,
        mockBillLayout,
        mockPaymentMethod
      );

      const expectedDateStr = new Date('2023-10-28T12:00:00Z').toLocaleString('en-IN');
      expect(message).toContain(`Date: ${expectedDateStr}`);
    });

    it('should handle invalid createdAt date by using current date', () => {
      const invalidDateBill = { ...mockBill, createdAt: 'invalid-date' };
      const message = buildWhatsAppBillMessage(
        invalidDateBill,
        mockBillNumber,
        mockBillLayout,
        mockPaymentMethod
      );

      const expectedDateStr = new Date('2023-10-28T12:00:00Z').toLocaleString('en-IN');
      expect(message).toContain(`Date: ${expectedDateStr}`);
    });
  });

  describe('openWhatsAppShare', () => {
    let originalWindow: any;
    let originalLocation: any;

    beforeEach(() => {
      originalWindow = global.window;
      originalLocation = global.window?.location;

      // Mock window
      global.window = {
        open: vi.fn(),
        location: { href: '' }
      } as any;
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it('should open popup with phone number when provided', () => {
      vi.mocked(global.window.open).mockReturnValue({} as any);

      const result = openWhatsAppShare('Hello World', '123-456-7890');

      expect(result).toBe(true);
      expect(global.window.open).toHaveBeenCalledWith(
        'https://wa.me/1234567890?text=Hello%20World',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should open popup without phone number when not provided', () => {
      vi.mocked(global.window.open).mockReturnValue({} as any);

      const result = openWhatsAppShare('Hello World');

      expect(result).toBe(true);
      expect(global.window.open).toHaveBeenCalledWith(
        'https://wa.me/?text=Hello%20World',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should fallback to location.href if popup is blocked', () => {
      vi.mocked(global.window.open).mockReturnValue(null);

      const result = openWhatsAppShare('Hello World', '1234567890');

      expect(result).toBe(false);
      expect(global.window.location.href).toBe('https://wa.me/1234567890?text=Hello%20World');
    });

    it('should normalize phone number by removing non-digits', () => {
      vi.mocked(global.window.open).mockReturnValue({} as any);

      openWhatsAppShare('Test', '+1 (234) 567-8900');

      expect(global.window.open).toHaveBeenCalledWith(
        'https://wa.me/12345678900?text=Test',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });
});
