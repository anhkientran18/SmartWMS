/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IWarehouseProvider } from "./types";
import { apiWarehouseProvider, isLocationMutationEnabled } from "./apiWarehouseProvider";
import { mockWarehouseProvider, resetMockWarehousesStore } from "./mockWarehouseProvider";

export const getLocationDataMode = (): "mock" | "api" => {
  const mode = (import.meta as any).env?.VITE_DATA_MODE?.trim().toLowerCase();
  if (mode === "api") {
    return "api";
  }
  return "mock";
};

export const isLocationMockMode = (): boolean => getLocationDataMode() === "mock";

const getActiveWarehouseProvider = (): IWarehouseProvider => {
  if (getLocationDataMode() === "api") {
    return apiWarehouseProvider;
  }
  return mockWarehouseProvider;
};

export const warehouseService: IWarehouseProvider = {
  getWarehouses: (params) => getActiveWarehouseProvider().getWarehouses(params),
  getWarehousesList: (searchKeyword) => getActiveWarehouseProvider().getWarehousesList(searchKeyword),
  getWarehouseById: (id) => getActiveWarehouseProvider().getWarehouseById(id),
  createWarehouse: (request) => getActiveWarehouseProvider().createWarehouse(request),
  updateWarehouse: (id, request) => getActiveWarehouseProvider().updateWarehouse(id, request),
  deleteWarehouse: (id) => getActiveWarehouseProvider().deleteWarehouse(id),
};

export { isLocationMutationEnabled, resetMockWarehousesStore };
