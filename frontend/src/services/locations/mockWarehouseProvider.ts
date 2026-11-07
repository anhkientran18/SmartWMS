/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  WarehouseDto,
  GetWarehousesParams,
  PaginatedResult,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
} from "../api/apiTypes";
import { IWarehouseProvider } from "./types";
import { INITIAL_MOCK_WAREHOUSES } from "./locationMockData";

let mockWarehousesStore: WarehouseDto[] = [...INITIAL_MOCK_WAREHOUSES];

export const resetMockWarehousesStore = () => {
  mockWarehousesStore = [...INITIAL_MOCK_WAREHOUSES];
};

export const mockWarehouseProvider: IWarehouseProvider = {
  async getWarehouses(params: GetWarehousesParams): Promise<PaginatedResult<WarehouseDto>> {
    let filtered = [...mockWarehousesStore];

    if (params.searchKeyword && params.searchKeyword.trim()) {
      const q = params.searchKeyword.trim().toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.code.toLowerCase().includes(q) ||
          w.name.toLowerCase().includes(q) ||
          w.address.toLowerCase().includes(q)
      );
    }

    const totalCount = filtered.length;
    const pageSize = Math.max(1, params.pageSize || 10);
    const pageIndex = Math.max(1, params.pageNumber || 1);
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const startIndex = (pageIndex - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items,
      pageIndex,
      pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: pageIndex > 1,
      hasNextPage: pageIndex < totalPages,
      firstItemIndex: totalCount === 0 ? 0 : startIndex + 1,
      lastItemIndex: Math.min(startIndex + pageSize, totalCount),
    };
  },

  async getWarehousesList(searchKeyword?: string): Promise<WarehouseDto[]> {
    let list = [...mockWarehousesStore];
    if (searchKeyword && searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      list = list.filter(
        (w) =>
          w.code.toLowerCase().includes(q) ||
          w.name.toLowerCase().includes(q) ||
          w.address.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async getWarehouseById(id: string): Promise<WarehouseDto> {
    const found = mockWarehousesStore.find((w) => w.id === id);
    if (!found) {
      throw new Error(`Không tìm thấy nhà kho có ID ${id}`);
    }
    return found;
  },

  async createWarehouse(request: CreateWarehouseRequest): Promise<string> {
    const newId = `wh-mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newWarehouse: WarehouseDto = {
      id: newId,
      code: request.code.trim().toUpperCase(),
      name: request.name.trim(),
      address: request.address.trim(),
    };
    mockWarehousesStore = [newWarehouse, ...mockWarehousesStore];
    return newId;
  },

  async updateWarehouse(id: string, request: UpdateWarehouseRequest): Promise<boolean> {
    const idx = mockWarehousesStore.findIndex((w) => w.id === id);
    if (idx === -1) return false;
    mockWarehousesStore[idx] = {
      ...mockWarehousesStore[idx],
      code: request.code.trim().toUpperCase(),
      name: request.name.trim(),
      address: request.address.trim(),
    };
    return true;
  },

  async deleteWarehouse(id: string): Promise<boolean> {
    const prevLen = mockWarehousesStore.length;
    mockWarehousesStore = mockWarehousesStore.filter((w) => w.id !== id);
    return mockWarehousesStore.length < prevLen;
  },
};
