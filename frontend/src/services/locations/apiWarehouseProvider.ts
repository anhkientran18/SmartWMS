// F0: INHERITED / UNVERIFIED. Historical contract claims below require F1 audit.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { httpClient } from "../api/httpClient";
import {
  Result,
  PaginatedResult,
  WarehouseDto,
  GetWarehousesParams,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
} from "../api/apiTypes";
import { IWarehouseProvider } from "./types";

/**
 * Feature flag for unverified location mutations (Warehouses, Zones, Bins).
 * Evaluates VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS from environment (defaults to false).
 */
export const isLocationMutationEnabled = (): boolean => {
  const mode = (import.meta as any).env?.VITE_DATA_MODE?.trim().toLowerCase();
  if (mode !== "api") return true;
  return (import.meta as any).env?.VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS === "true";
};

/**
 * Real API Warehouse Provider connecting to SmartWMS backend.
 * Used when VITE_DATA_MODE=api.
 * GET endpoints are STABLE per Postman audit.
 * Mutation endpoints are gated (NEEDS RETEST).
 */
export const apiWarehouseProvider: IWarehouseProvider = {
  /**
   * GET /api/v1/Warehouses
   * STABLE: Queries paginated warehouses with server-side pagination.
   */
  async getWarehouses(params: GetWarehousesParams): Promise<PaginatedResult<WarehouseDto>> {
    const queryParams: Record<string, string> = {
      pageNumber: params.pageNumber.toString(),
      pageSize: params.pageSize.toString(),
    };

    if (params.searchKeyword && params.searchKeyword.trim()) {
      queryParams.searchKeyword = params.searchKeyword.trim();
    }

    const response = await httpClient.get<Result<PaginatedResult<WarehouseDto>>>(
      "/api/v1/Warehouses",
      { params: queryParams }
    );

    return response.data.data;
  },

  /**
   * GET /api/v1/Warehouses/list
   * STABLE: Queries full warehouse list.
   */
  async getWarehousesList(searchKeyword?: string): Promise<WarehouseDto[]> {
    const params: Record<string, string> = {};
    if (searchKeyword && searchKeyword.trim()) {
      params.searchKeyword = searchKeyword.trim();
    }

    const response = await httpClient.get<Result<WarehouseDto[]>>(
      "/api/v1/Warehouses/list",
      { params }
    );

    return response.data.data || [];
  },

  /**
   * GET /api/v1/Warehouses/{id}
   * STABLE: Retrieves single warehouse details by UUID.
   */
  async getWarehouseById(id: string): Promise<WarehouseDto> {
    const response = await httpClient.get<Result<WarehouseDto>>(
      `/api/v1/Warehouses/${encodeURIComponent(id)}`
    );

    return response.data.data;
  },

  /**
   * POST /api/v1/Warehouses
   * NEEDS RETEST: Creates a new warehouse. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async createWarehouse(request: CreateWarehouseRequest): Promise<string> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác tạo nhà kho chưa được kích hoạt."
      );
    }

    const response = await httpClient.post<Result<string>>(
      "/api/v1/Warehouses",
      request
    );

    return response.data.data;
  },

  /**
   * PUT /api/v1/Warehouses/{id}
   * NEEDS RETEST: Updates existing warehouse. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async updateWarehouse(id: string, request: UpdateWarehouseRequest): Promise<boolean> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác cập nhật nhà kho chưa được kích hoạt."
      );
    }

    const response = await httpClient.put<Result<boolean>>(
      `/api/v1/Warehouses/${encodeURIComponent(id)}`,
      request
    );

    return response.data.data;
  },

  /**
   * DELETE /api/v1/Warehouses/{id}
   * NEEDS RETEST: Deletes warehouse by UUID. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async deleteWarehouse(id: string): Promise<boolean> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác xóa nhà kho chưa được kích hoạt."
      );
    }

    const response = await httpClient.delete<Result<boolean>>(
      `/api/v1/Warehouses/${encodeURIComponent(id)}`
    );

    return response.data.data;
  },
};
