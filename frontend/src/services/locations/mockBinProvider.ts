/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BinDto,
  GetBinsParams,
  PaginatedResult,
  CreateBinRequest,
  UpdateBinRequest,
  BinContentHeaderDto,
} from "../api/apiTypes";
import { IBinProvider } from "./types";
import { INITIAL_MOCK_BINS, INITIAL_MOCK_BIN_CONTENTS } from "./locationMockData";

let mockBinsStore: BinDto[] = [...INITIAL_MOCK_BINS];
let mockBinContentsStore: Record<string, BinContentHeaderDto> = { ...INITIAL_MOCK_BIN_CONTENTS };

export const resetMockBinsStore = () => {
  mockBinsStore = [...INITIAL_MOCK_BINS];
  mockBinContentsStore = { ...INITIAL_MOCK_BIN_CONTENTS };
};

export const mockBinProvider: IBinProvider = {
  async getBins(params: GetBinsParams): Promise<PaginatedResult<BinDto>> {
    let filtered = [...mockBinsStore];

    if (params.zoneId) {
      filtered = filtered.filter((b) => b.zoneId === params.zoneId);
    }

    if (params.searchTerm && params.searchTerm.trim()) {
      const q = params.searchTerm.trim().toLowerCase();
      filtered = filtered.filter((b) => b.code.toLowerCase().includes(q));
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

  async getBinsList(params?: { zoneId?: string; searchKeyword?: string }): Promise<BinDto[]> {
    let list = [...mockBinsStore];
    if (params?.zoneId) {
      list = list.filter((b) => b.zoneId === params.zoneId);
    }
    if (params?.searchKeyword && params?.searchKeyword.trim()) {
      const q = params.searchKeyword.trim().toLowerCase();
      list = list.filter((b) => b.code.toLowerCase().includes(q));
    }
    return list;
  },

  async getBinById(id: string): Promise<BinDto> {
    const found = mockBinsStore.find((b) => b.id === id);
    if (!found) {
      throw new Error(`Không tìm thấy ô kệ có ID ${id}`);
    }
    return found;
  },

  async getBinContents(id: string): Promise<BinContentHeaderDto> {
    const found = mockBinContentsStore[id];
    if (found) {
      return found;
    }

    // If not in contents store, find bin and construct empty content header
    const bin = mockBinsStore.find((b) => b.id === id);
    if (!bin) {
      throw new Error(`Không tìm thấy thông tin ô kệ ID ${id}`);
    }

    const maxCap = bin.maxCapacity || 0;
    const occ = bin.currentOccupancy || 0;
    const utilPct = maxCap > 0 ? Math.round((occ / maxCap) * 100) : 0;

    return {
      binId: bin.id,
      binCode: bin.code,
      maxCapacity: maxCap,
      currentOccupancy: occ,
      utilizationPercentage: utilPct,
      items: [],
    };
  },

  async createBin(request: CreateBinRequest): Promise<string> {
    const newId = `bin-mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newBin: BinDto = {
      id: newId,
      code: request.code.trim().toUpperCase(),
      zoneId: request.zoneId,
      maxCapacity: request.maxCapacity || 0,
      currentOccupancy: 0,
    };
    mockBinsStore = [newBin, ...mockBinsStore];
    mockBinContentsStore[newId] = {
      binId: newId,
      binCode: newBin.code,
      maxCapacity: newBin.maxCapacity,
      currentOccupancy: 0,
      utilizationPercentage: 0,
      items: [],
    };
    return newId;
  },

  async updateBin(id: string, request: UpdateBinRequest): Promise<boolean> {
    const idx = mockBinsStore.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    mockBinsStore[idx] = {
      ...mockBinsStore[idx],
      code: request.code.trim().toUpperCase(),
      maxCapacity: request.maxCapacity,
    };
    if (mockBinContentsStore[id]) {
      mockBinContentsStore[id].binCode = request.code.trim().toUpperCase();
      mockBinContentsStore[id].maxCapacity = request.maxCapacity;
      const occ = mockBinContentsStore[id].currentOccupancy;
      mockBinContentsStore[id].utilizationPercentage =
        request.maxCapacity > 0 ? Math.round((occ / request.maxCapacity) * 100) : 0;
    }
    return true;
  },

  async deleteBin(id: string): Promise<boolean> {
    const prevLen = mockBinsStore.length;
    mockBinsStore = mockBinsStore.filter((b) => b.id !== id);
    delete mockBinContentsStore[id];
    return mockBinsStore.length < prevLen;
  },
};
