/**
 * Barcode parser - Extracts product data from various barcode formats
 * Supports: CODE128, UPC, EAN with embedded price/discount information
 */

export interface BarcodeData {
  barcode: string;
  price?: number;
  discount?: number;
  quantity?: number;
  manualDiscount?: number;
  rawData: string;
}
function parseLooseNumber(value: string): number | undefined {
  const match = value
    .replace(",", ".")
    .match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }
  const parsed = parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Parse barcode data from scanned text
 * Formats:
 * - Simple barcode: "123456789"
 * - With price: "123456789|25.99" or "123456789:25.99"
 * - With price and discount: "123456789|25.99|10" or "123456789:25.99:10"
 * - With quantity: "123456789|25.99|10|2" (barcode|price|discount%|quantity)
 * - With manual discount: "123456789|25.99|10|2|5.00"
 */
export function parseBarcodeData(scannedText: string): BarcodeData {
  const trimmed = scannedText.trim();

  const normalized = trimmed.replace(/[;\n\r\t]+/g, "|");

  if (normalized !== trimmed) {
    return parseBarcodeData(normalized);
  }

  // Try pipe-separated format first
  if (trimmed.includes("|")) {
    return parsePipeFormat(trimmed);
  }

  // Try colon-separated format
  if (trimmed.includes(":")) {
    return parseColonFormat(trimmed);
  }

  // Support whitespace-separated scanner payloads like:
  // "123456789 299.00 10 2"
  if (/\s+/.test(trimmed)) {
    const compact = trimmed.split(/\s+/).filter(Boolean);
    if (compact.length > 1) {
      return parsePipeFormat(compact.join("|"));
    }
  }

  // Plain barcode (no price/discount embedded)
  return {
    barcode: trimmed,
    rawData: trimmed
  };
}

function parsePipeFormat(data: string): BarcodeData {
  const parts = data.split("|").map(p => p.trim());
  const barcode = parts[0];

  const result: BarcodeData = {
    barcode,
    rawData: data
  };

  // Parse price (second part)
  if (parts[1]) {
    const priceNum = parseLooseNumber(parts[1]);
    if (priceNum !== undefined) {
      result.price = Math.abs(priceNum);
    }
  }

  // Parse discount percentage (third part)
  if (parts[2]) {
    const discountNum = parseLooseNumber(parts[2]);
    if (discountNum !== undefined) {
      result.discount = Math.max(0, Math.min(100, discountNum));
    }
  }

  // Parse quantity (fourth part)
  if (parts[3]) {
    const quantityNum = parseInt(parts[3], 10);
    if (!isNaN(quantityNum) && quantityNum > 0) {
      result.quantity = quantityNum;
    }
  }

  // Parse manual discount (fifth part)
  if (parts[4]) {
    const manualNum = parseLooseNumber(parts[4]);
    if (manualNum !== undefined) {
      result.manualDiscount = Math.abs(manualNum);
    }
  }

  return result;
}

function parseColonFormat(data: string): BarcodeData {
  const parts = data.split(":").map(p => p.trim());
  const barcode = parts[0];

  const result: BarcodeData = {
    barcode,
    rawData: data
  };

  if (parts[1]) {
    const priceNum = parseLooseNumber(parts[1]);
    if (priceNum !== undefined) {
      result.price = Math.abs(priceNum);
    }
  }

  if (parts[2]) {
    const discountNum = parseLooseNumber(parts[2]);
    if (discountNum !== undefined) {
      result.discount = Math.max(0, Math.min(100, discountNum));
    }
  }

  if (parts[3]) {
    const quantityNum = parseInt(parts[3], 10);
    if (!isNaN(quantityNum) && quantityNum > 0) {
      result.quantity = quantityNum;
    }
  }

  if (parts[4]) {
    const manualNum = parseLooseNumber(parts[4]);
    if (manualNum !== undefined) {
      result.manualDiscount = Math.abs(manualNum);
    }
  }

  return result;
}

/**
 * Format barcode with embedded data for display/debugging
 */
export function formatBarcodeString(
  barcode: string,
  price?: number,
  discount?: number,
  quantity?: number,
  manualDiscount?: number
): string {
  let result = barcode;

  if (price !== undefined) {
    result += `|${price.toFixed(2)}`;
    if (discount !== undefined || quantity !== undefined || manualDiscount !== undefined) {
      result += `|${discount ?? 0}`;
      if (quantity !== undefined || manualDiscount !== undefined) {
        result += `|${quantity ?? 1}`;
        if (manualDiscount !== undefined) {
          result += `|${manualDiscount.toFixed(2)}`;
        }
      }
    }
  }

  return result;
}
