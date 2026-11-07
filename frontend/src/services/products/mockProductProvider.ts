/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PaginatedResult,
  ProductDto,
  GetProductsParams,
  ParsedBarcodeDto,
  CreateProductRequest,
  UpdateProductRequest,
} from "../api/apiTypes";
import { IProductProvider } from "./types";
import { INITIAL_MOCK_PRODUCTS } from "./productMockData";
import { PRODUCT_MOCK_TRANSLATIONS } from "./productMockTranslations";

/**
 * In-memory state for mock products.
 * Allows UI preview updates during AI Studio development without persistent backend storage.
 */
let mockProductsStore: ProductDto[] = INITIAL_MOCK_PRODUCTS.map((p) => ({ ...p }));

/**
 * Helper to reset or seed mock store if needed
 */
export const resetMockProductsStore = () => {
  mockProductsStore = INITIAL_MOCK_PRODUCTS.map((p) => ({ ...p }));
};

/**
 * Generate a reliable SVG data URI representation of a QR code for UI design preview
 */
const generateMockQrDataUri = (sku: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#ffffff" />
    <!-- Finder pattern top-left -->
    <rect x="20" y="20" width="45" height="45" fill="#0f172a" rx="4" />
    <rect x="28" y="28" width="29" height="29" fill="#ffffff" rx="2" />
    <rect x="35" y="35" width="15" height="15" fill="#2563eb" rx="2" />
    <!-- Finder pattern top-right -->
    <rect x="135" y="20" width="45" height="45" fill="#0f172a" rx="4" />
    <rect x="143" y="28" width="29" height="29" fill="#ffffff" rx="2" />
    <rect x="150" y="35" width="15" height="15" fill="#2563eb" rx="2" />
    <!-- Finder pattern bottom-left -->
    <rect x="20" y="135" width="45" height="45" fill="#0f172a" rx="4" />
    <rect x="28" y="143" width="29" height="29" fill="#ffffff" rx="2" />
    <rect x="35" y="150" width="15" height="15" fill="#2563eb" rx="2" />
    <!-- Matrix dots -->
    <rect x="75" y="25" width="12" height="12" fill="#0f172a" />
    <rect x="95" y="30" width="12" height="12" fill="#0f172a" />
    <rect x="115" y="25" width="12" height="12" fill="#0f172a" />
    <rect x="75" y="50" width="12" height="12" fill="#0f172a" />
    <rect x="95" y="65" width="12" height="12" fill="#2563eb" />
    <rect x="25" y="75" width="12" height="12" fill="#0f172a" />
    <rect x="45" y="95" width="12" height="12" fill="#0f172a" />
    <rect x="75" y="85" width="12" height="12" fill="#0f172a" />
    <rect x="95" y="95" width="12" height="12" fill="#0f172a" />
    <rect x="115" y="85" width="12" height="12" fill="#0f172a" />
    <rect x="145" y="75" width="12" height="12" fill="#0f172a" />
    <rect x="165" y="95" width="12" height="12" fill="#0f172a" />
    <rect x="75" y="115" width="12" height="12" fill="#0f172a" />
    <rect x="95" y="135" width="12" height="12" fill="#0f172a" />
    <rect x="115" y="115" width="12" height="12" fill="#2563eb" />
    <rect x="135" y="135" width="12" height="12" fill="#0f172a" />
    <rect x="155" y="155" width="12" height="12" fill="#0f172a" />
    <rect x="75" y="155" width="12" height="12" fill="#0f172a" />
    <rect x="95" y="165" width="12" height="12" fill="#0f172a" />
    <rect x="115" y="155" width="12" height="12" fill="#0f172a" />
    <!-- Label -->
    <text x="100" y="190" font-family="monospace" font-size="10" font-weight="bold" fill="#475569" text-anchor="middle">${sku}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Mock Product Provider for Google AI Studio UI Design Workflow.
 * Mimics exact backend interface and PaginatedResult shape.
 */
export const mockProductProvider: IProductProvider = {
  /**
   * Mock paginated products with exact PaginatedResult contract
   */
  async getProducts(params: GetProductsParams): Promise<PaginatedResult<ProductDto>> {
    // Artificial slight delay for realistic UI skeleton state demonstration (120ms)
    await new Promise((resolve) => setTimeout(resolve, 120));

    const keyword = (params.searchKeyword || "").trim().toLowerCase();

    // Search across sku, name, barcode, and English presentation translation if in mock mode
    const filtered = keyword
      ? mockProductsStore.filter((p) => {
          const matchSku = p.sku.toLowerCase().includes(keyword);
          const matchName = p.name.toLowerCase().includes(keyword);
          const matchBarcode = Boolean(p.barcode && p.barcode.toLowerCase().includes(keyword));
          const translation = PRODUCT_MOCK_TRANSLATIONS[p.sku];
          const matchEn = Boolean(
            translation &&
              (translation.en.name.toLowerCase().includes(keyword) ||
                translation.en.description.toLowerCase().includes(keyword))
          );
          return matchSku || matchName || matchBarcode || matchEn;
        })
      : [...mockProductsStore];

    const pageNumber = Math.max(1, params.pageNumber);
    const pageSize = Math.max(1, params.pageSize);
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startIndex = (pageNumber - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    const hasPreviousPage = pageNumber > 1;
    const hasNextPage = pageNumber < totalPages;
    const firstItemIndex = totalCount === 0 ? 0 : startIndex + 1;
    const lastItemIndex = Math.min(startIndex + pageSize, totalCount);

    return {
      items,
      pageIndex: pageNumber,
      pageSize,
      totalCount,
      totalPages,
      hasPreviousPage,
      hasNextPage,
      firstItemIndex,
      lastItemIndex,
    };
  },

  /**
   * Mock full product list (GET /api/v1/Products/list)
   */
  async getProductsList(searchKeyword?: string): Promise<ProductDto[]> {
    await new Promise((resolve) => setTimeout(resolve, 60));

    if (!searchKeyword || !searchKeyword.trim()) {
      return [...mockProductsStore];
    }

    const keyword = searchKeyword.trim().toLowerCase();
    return mockProductsStore.filter((p) => {
      const matchSku = p.sku.toLowerCase().includes(keyword);
      const matchName = p.name.toLowerCase().includes(keyword);
      const matchBarcode = Boolean(p.barcode && p.barcode.toLowerCase().includes(keyword));
      const translation = PRODUCT_MOCK_TRANSLATIONS[p.sku];
      const matchEn = Boolean(
        translation &&
          (translation.en.name.toLowerCase().includes(keyword) ||
            translation.en.description.toLowerCase().includes(keyword))
      );
      return matchSku || matchName || matchBarcode || matchEn;
    });
  },

  /**
   * Mock single product details (GET /api/v1/Products/{id})
   */
  async getProductById(id: string): Promise<ProductDto> {
    const item = mockProductsStore.find((p) => p.id === id);
    if (!item) {
      throw new Error(`Product with ID '${id}' not found in mock store.`);
    }
    return { ...item };
  },

  /**
   * Mock QR code generator (GET /api/v1/Products/{sku}/qrcode)
   */
  async getProductQrCode(sku: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return generateMockQrDataUri(sku);
  },

  /**
   * Mock barcode parser (POST /api/v1/Products/parse-barcode)
   */
  async parseBarcode(rawBarcodeData: string): Promise<ParsedBarcodeDto> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const cleanData = rawBarcodeData.trim();
    const match = mockProductsStore.find((p) => p.barcode === cleanData);

    if (match) {
      return {
        productId: match.id,
        sku: match.sku,
        productName: match.name,
        lotNumber: "LOT-202610-VN",
        expirationDate: "2027-10-20",
        stockStatus: "In Stock (Available)",
      };
    }

    return {
      productId: "99999999-9999-4999-9999-999999999999",
      sku: cleanData.slice(0, 10).toUpperCase() || "SCANNED-ITEM",
      productName: `Sản phẩm quét mã (${cleanData})`,
      lotNumber: "LOT-SCAN-DEMO",
      expirationDate: "2027-12-31",
      stockStatus: "Newly Scanned",
    };
  },

  /**
   * Mock create product in-memory preview (UI Preview Only)
   */
  async createProduct(request: CreateProductRequest): Promise<string> {
    const newId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newProduct: ProductDto = {
      id: newId,
      sku: request.sku.trim().toUpperCase(),
      barcode: request.barcode.trim(),
      name: request.name.trim(),
      description: request.description.trim(),
      unit: request.unit.trim(),
      weight: 0,
    };

    mockProductsStore = [newProduct, ...mockProductsStore];
    return newId;
  },

  /**
   * Mock update product in-memory preview (UI Preview Only)
   */
  async updateProduct(id: string, request: UpdateProductRequest): Promise<boolean> {
    const index = mockProductsStore.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Product '${id}' not found in mock store.`);
    }

    mockProductsStore[index] = {
      ...mockProductsStore[index],
      sku: request.sku.trim().toUpperCase(),
      barcode: request.barcode.trim(),
      name: request.name.trim(),
      description: request.description.trim(),
      unit: request.unit.trim(),
    };

    return true;
  },

  /**
   * Mock delete product in-memory preview (UI Preview Only)
   */
  async deleteProduct(id: string): Promise<boolean> {
    mockProductsStore = mockProductsStore.filter((p) => p.id !== id);
    return true;
  },
};
