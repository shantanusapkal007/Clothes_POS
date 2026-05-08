import type { BillResponse, Product } from "../types";
import type { CartItem } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
const API_PREFIX = "/api";

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith(API_PREFIX) ? path : `${API_PREFIX}${path}`;
  return `${API_URL}${normalizedPath}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch {
    throw new Error("Unable to reach the server. Check the connection and try again.");
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    const text = payload?.message || (await response.text().catch(() => ""));
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getProducts(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<Product[]>(`/products${query}`);
}

export function getProductByBarcode(code: string) {
  return request<Product>(`/products/barcode/${encodeURIComponent(code)}`);
}

export function createProduct(product: Partial<Product> & Pick<Product, "name" | "price">) {
  return request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(product)
  });
}

export function updateProduct(id: string, product: Partial<Product>) {
  return request<Product>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(product)
  });
}

export function deleteProduct(id: string) {
  return request<void>(`/products/${id}`, {
    method: "DELETE"
  });
}

export function checkoutBill(items: CartItem[], paymentMethod: string) {
  return request<BillResponse & { summary: unknown }>("/bills", {
    method: "POST",
    body: JSON.stringify({
      paymentMethod,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        discountPercent: item.discountPercent,
        manualDiscountAmount: item.manualDiscountAmount,
        taxPercent: item.taxPercent
      }))
    })
  });
}

/* ─── Bill History ─── */

export type BillsListResponse = {
  bills: BillResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export function getBills(params?: {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const qs = query.toString();
  return request<BillsListResponse>(`/bills${qs ? `?${qs}` : ""}`);
}

export function getBill(id: string) {
  return request<BillResponse>(`/bills/${id}`);
}

export function refundBill(id: string, reason?: string) {
  return request<BillResponse>(`/bills/${id}/refund`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

