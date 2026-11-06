/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IProductProvider } from "./types";
import { apiProductProvider, isProductMutationEnabled } from "./apiProductProvider";
import { mockProductProvider, resetMockProductsStore } from "./mockProductProvider";

/**
 * Returns the current active data mode from environment.
 * Default is 'mock' when in AI Studio / development, or when VITE_DATA_MODE is 'mock'.
 * Set VITE_DATA_MODE=api to switch to real SmartWMS backend.
 */
export const getDataMode = (): "mock" | "api" => {
  const mode = (import.meta as any).env?.VITE_DATA_MODE?.trim().toLowerCase();
  if (mode === "api") {
    return "api";
  }
  return "mock";
};

/**
 * Helper to check if current mode is Mock Mode
 */
export const isMockMode = (): boolean => getDataMode() === "mock";

/**
 * Select active provider strictly based on VITE_DATA_MODE.
 * Note: Never uses try/catch to silently fallback from API to Mock.
 */
const getActiveProvider = (): IProductProvider => {
  if (getDataMode() === "api") {
    return apiProductProvider;
  }
  return mockProductProvider;
};

/**
 * Unified productService boundary exposed to UI.
 * UI does not need to know whether data is provided by Mock or Real API.
 */
export const productService: IProductProvider = {
  getProducts: (params) => getActiveProvider().getProducts(params),
  getProductsList: (searchKeyword) => getActiveProvider().getProductsList(searchKeyword),
  getProductById: (id) => getActiveProvider().getProductById(id),
  getProductQrCode: (sku) => getActiveProvider().getProductQrCode(sku),
  parseBarcode: (rawBarcodeData) => getActiveProvider().parseBarcode(rawBarcodeData),
  createProduct: (request) => getActiveProvider().createProduct(request),
  updateProduct: (id, request) => getActiveProvider().updateProduct(id, request),
  deleteProduct: (id) => getActiveProvider().deleteProduct(id),
};

export { isProductMutationEnabled, resetMockProductsStore };
export * from "./types";
export * from "./productMockData";
export * from "./productMockTranslations";
