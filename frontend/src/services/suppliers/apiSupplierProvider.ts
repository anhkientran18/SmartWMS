// F0: INHERITED / UNVERIFIED. Historical contract claims below require F1 audit.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { httpClient } from "../api/httpClient";
import {
  Result,
  PaginatedResult,
  SupplierDto,
  GetSuppliersParams,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from "../api/apiTypes";
import { ISupplierProvider } from "./types";

/**
 * Feature flag for unverified supplier mutations.
 * Evaluates VITE_ENABLE_UNVERIFIED_SUPPLIER_MUTATIONS from environment (defaults to false).
 */
export const isSupplierMutationEnabled = (): boolean => {
  const mode = (import.meta as any).env?.VITE_DATA_MODE?.trim().toLowerCase();
  if (mode !== "api") return true;
  return (import.meta as any).env?.VITE_ENABLE_UNVERIFIED_SUPPLIER_MUTATIONS === "true";
};

/**
 * Real API Supplier Provider connecting to SmartWMS backend.
 * Used when VITE_DATA_MODE=api.
 * Errors are NOT fallen back to mock; instead, they trigger real error states.
 */
export const apiSupplierProvider: ISupplierProvider = {
  /**
   * GET /api/v1/Suppliers
   * STABLE: Queries paginated suppliers with server-side pagination.
   */
  async getSuppliers(params: GetSuppliersParams): Promise<PaginatedResult<SupplierDto>> {
    const queryParams: Record<string, string> = {
      pageNumber: params.pageNumber.toString(),
      pageSize: params.pageSize.toString(),
    };

    if (params.searchKeyword && params.searchKeyword.trim()) {
      queryParams.searchKeyword = params.searchKeyword.trim();
    }

    const response = await httpClient.get<Result<PaginatedResult<SupplierDto>>>(
      "/api/v1/Suppliers",
      { params: queryParams }
    );

    return response.data.data;
  },

  /**
   * GET /api/v1/Suppliers/list?searchKeyword={optional}
   * STABLE: Queries full supplier list, ideal for KPI aggregations & dropdowns.
   */
  async getSuppliersList(searchKeyword?: string): Promise<SupplierDto[]> {
    const params: Record<string, string> = {};
    if (searchKeyword && searchKeyword.trim()) {
      params.searchKeyword = searchKeyword.trim();
    }

    const response = await httpClient.get<Result<SupplierDto[]>>(
      "/api/v1/Suppliers/list",
      { params }
    );

    return response.data.data || [];
  },

  /**
   * GET /api/v1/Suppliers/{id}
   */
  async getSupplierById(id: string): Promise<SupplierDto> {
    const response = await httpClient.get<Result<SupplierDto>>(
      `/api/v1/Suppliers/${encodeURIComponent(id)}`
    );
    return response.data.data;
  },

  /**
   * POST /api/v1/Suppliers
   * Guarded by VITE_ENABLE_UNVERIFIED_SUPPLIER_MUTATIONS.
   */
  async createSupplier(request: CreateSupplierRequest): Promise<string> {
    if (!isSupplierMutationEnabled()) {
      throw new Error(
        "Chức năng tạo nhà cung cấp qua API chưa được kích hoạt (VITE_ENABLE_UNVERIFIED_SUPPLIER_MUTATIONS=false). Vui lòng kiểm tra môi trường hoặc sử dụng chế độ Mock."
      );
    }

    const response = await httpClient.post<Result<string>>(
      "/api/v1/Suppliers",
      request
    );

    return response.data.data;
  },

  /**
   * PUT /api/v1/Suppliers/{id}
   * Guarded by VITE_ENABLE_UNVERIFIED_SUPPLIER_MUTATIONS.
   */
  async updateSupplier(id: string, request: UpdateSupplierRequest): Promise<boolean> {
    if (!isSupplierMutationEnabled()) {
      throw new Error(
        "Chức năng cập nhật nhà cung cấp qua API chưa được kích hoạt (VITE_ENABLE_UNVERIFIED_SUPPLIER_MUTATIONS=false)."
      );
    }

    const response = await httpClient.put<Result<boolean>>(
      `/api/v1/Suppliers/${encodeURIComponent(id)}`,
      request
    );

    return response.data.isSuccess;
  },

  /**
   * DELETE /api/v1/Suppliers/{id}
   * Guarded by VITE_ENABLE_UNVERIFIED_SUPPLIER_MUTATIONS.
   */
  async deleteSupplier(id: string): Promise<boolean> {
    if (!isSupplierMutationEnabled()) {
      throw new Error(
        "Chức năng xóa nhà cung cấp qua API chưa được kích hoạt (VITE_ENABLE_UNVERIFIED_SUPPLIER_MUTATIONS=false)."
      );
    }

    const response = await httpClient.delete<Result<boolean>>(
      `/api/v1/Suppliers/${encodeURIComponent(id)}`
    );

    return response.data.isSuccess;
  },
};
