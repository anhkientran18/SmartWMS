/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ISupplierProvider } from "./types";
import { apiSupplierProvider, isSupplierMutationEnabled } from "./apiSupplierProvider";
import { mockSupplierProvider, resetMockSuppliersStore } from "./mockSupplierProvider";

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
const getActiveProvider = (): ISupplierProvider => {
  if (getDataMode() === "api") {
    return apiSupplierProvider;
  }
  return mockSupplierProvider;
};

/**
 * Unified supplierService boundary exposed to UI.
 * UI does not need to know whether data is provided by Mock or Real API.
 */
export const supplierService: ISupplierProvider = {
  getSuppliers: (params) => getActiveProvider().getSuppliers(params),
  getSuppliersList: (searchKeyword) => getActiveProvider().getSuppliersList(searchKeyword),
  getSupplierById: (id) => getActiveProvider().getSupplierById(id),
  createSupplier: (request) => getActiveProvider().createSupplier(request),
  updateSupplier: (id, request) => getActiveProvider().updateSupplier(id, request),
  deleteSupplier: (id) => getActiveProvider().deleteSupplier(id),
};

export { isSupplierMutationEnabled, resetMockSuppliersStore };
export * from "./types";
export * from "./supplierMockData";
