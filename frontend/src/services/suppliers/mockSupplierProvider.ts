/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PaginatedResult,
  SupplierDto,
  GetSuppliersParams,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from "../api/apiTypes";
import { ISupplierProvider } from "./types";
import { INITIAL_MOCK_SUPPLIERS } from "./supplierMockData";

/**
 * In-memory mutable store for Mock Mode.
 */
let mockSuppliersStore: SupplierDto[] = [...INITIAL_MOCK_SUPPLIERS];

/**
 * Reset mock store back to initial dataset
 */
export const resetMockSuppliersStore = (): void => {
  mockSuppliersStore = [...INITIAL_MOCK_SUPPLIERS];
};

/**
 * Mock Supplier Provider for Google AI Studio UI Design Workflow.
 * Mimics exact backend interface and PaginatedResult shape.
 */
export const mockSupplierProvider: ISupplierProvider = {
  /**
   * Mock paginated suppliers with exact PaginatedResult structure.
   */
  async getSuppliers(params: GetSuppliersParams): Promise<PaginatedResult<SupplierDto>> {
    const pageIndex = Math.max(1, params.pageNumber);
    const pageSize = Math.max(1, params.pageSize);
    const keyword = params.searchKeyword?.trim().toLowerCase() || "";

    // Search across code, name, email, phone, address
    const filtered = keyword
      ? mockSuppliersStore.filter((s) => {
          const matchCode = s.code.toLowerCase().includes(keyword);
          const matchName = s.name.toLowerCase().includes(keyword);
          const matchEmail = s.email.toLowerCase().includes(keyword);
          const matchPhone = s.phone.toLowerCase().includes(keyword);
          const matchAddress = s.address.toLowerCase().includes(keyword);
          return matchCode || matchName || matchEmail || matchPhone || matchAddress;
        })
      : [...mockSuppliersStore];

    const totalCount = filtered.length;
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

  /**
   * Mock full supplier list query for dropdowns and KPI aggregations
   */
  async getSuppliersList(searchKeyword?: string): Promise<SupplierDto[]> {
    if (!searchKeyword || !searchKeyword.trim()) {
      return [...mockSuppliersStore];
    }
    const keyword = searchKeyword.trim().toLowerCase();
    return mockSuppliersStore.filter((s) => {
      const matchCode = s.code.toLowerCase().includes(keyword);
      const matchName = s.name.toLowerCase().includes(keyword);
      const matchEmail = s.email.toLowerCase().includes(keyword);
      const matchPhone = s.phone.toLowerCase().includes(keyword);
      const matchAddress = s.address.toLowerCase().includes(keyword);
      return matchCode || matchName || matchEmail || matchPhone || matchAddress;
    });
  },

  /**
   * Mock get single supplier by ID
   */
  async getSupplierById(id: string): Promise<SupplierDto> {
    const supplier = mockSuppliersStore.find((s) => s.id === id);
    if (!supplier) {
      throw new Error(`Nhà cung cấp với ID '${id}' không tồn tại trong hệ thống.`);
    }
    return { ...supplier };
  },

  /**
   * Mock create supplier
   */
  async createSupplier(request: CreateSupplierRequest): Promise<string> {
    const newId = crypto.randomUUID();
    const newSupplier: SupplierDto = {
      id: newId,
      code: request.code.trim().toUpperCase(),
      name: request.name.trim(),
      email: request.email.trim(),
      phone: request.phone.trim(),
      address: request.address.trim(),
    };

    mockSuppliersStore = [newSupplier, ...mockSuppliersStore];
    return newId;
  },

  /**
   * Mock update supplier
   */
  async updateSupplier(id: string, request: UpdateSupplierRequest): Promise<boolean> {
    const index = mockSuppliersStore.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy nhà cung cấp '${id}' để cập nhật.`);
    }

    mockSuppliersStore[index] = {
      ...mockSuppliersStore[index],
      code: request.code.trim().toUpperCase(),
      name: request.name.trim(),
      email: request.email.trim(),
      phone: request.phone.trim(),
      address: request.address.trim(),
    };

    return true;
  },

  /**
   * Mock delete supplier
   */
  async deleteSupplier(id: string): Promise<boolean> {
    const initialLen = mockSuppliersStore.length;
    mockSuppliersStore = mockSuppliersStore.filter((s) => s.id !== id);
    return mockSuppliersStore.length < initialLen;
  },
};
