/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ZoneDto,
  GetZonesParams,
  PaginatedResult,
  CreateZoneRequest,
  UpdateZoneRequest,
} from "../api/apiTypes";
import { IZoneProvider } from "./types";
import { INITIAL_MOCK_ZONES } from "./locationMockData";

let mockZonesStore: ZoneDto[] = [...INITIAL_MOCK_ZONES];

export const resetMockZonesStore = () => {
  mockZonesStore = [...INITIAL_MOCK_ZONES];
};

export const mockZoneProvider: IZoneProvider = {
  async getZones(params: GetZonesParams): Promise<PaginatedResult<ZoneDto>> {
    let filtered = [...mockZonesStore];

    if (params.searchKeyword && params.searchKeyword.trim()) {
      const q = params.searchKeyword.trim().toLowerCase();
      filtered = filtered.filter(
        (z) => z.code.toLowerCase().includes(q) || z.name.toLowerCase().includes(q)
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

  async getZonesList(searchKeyword?: string): Promise<ZoneDto[]> {
    let list = [...mockZonesStore];
    if (searchKeyword && searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      list = list.filter(
        (z) => z.code.toLowerCase().includes(q) || z.name.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async getZonesByWarehouse(warehouseId: string): Promise<ZoneDto[]> {
    return mockZonesStore.filter((z) => z.warehouseId === warehouseId);
  },

  async createZone(request: CreateZoneRequest): Promise<string> {
    const newId = `zone-mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newZone: ZoneDto = {
      id: newId,
      code: request.code.trim().toUpperCase(),
      name: request.name.trim(),
      warehouseId: request.warehouseId,
    };
    mockZonesStore = [newZone, ...mockZonesStore];
    return newId;
  },

  async updateZone(id: string, request: UpdateZoneRequest): Promise<boolean> {
    const idx = mockZonesStore.findIndex((z) => z.id === id);
    if (idx === -1) return false;
    mockZonesStore[idx] = {
      ...mockZonesStore[idx],
      code: request.code.trim().toUpperCase(),
      name: request.name.trim(),
    };
    return true;
  },

  async deleteZone(id: string): Promise<boolean> {
    const prevLen = mockZonesStore.length;
    mockZonesStore = mockZonesStore.filter((z) => z.id !== id);
    return mockZonesStore.length < prevLen;
  },
};
