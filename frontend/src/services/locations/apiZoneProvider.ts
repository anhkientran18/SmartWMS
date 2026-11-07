// F0: INHERITED / UNVERIFIED. Historical contract claims below require F1 audit.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { httpClient } from "../api/httpClient";
import {
  Result,
  PaginatedResult,
  ZoneDto,
  GetZonesParams,
  CreateZoneRequest,
  UpdateZoneRequest,
} from "../api/apiTypes";
import { IZoneProvider } from "./types";
import { isLocationMutationEnabled } from "./apiWarehouseProvider";

/**
 * Real API Zone Provider connecting to SmartWMS backend.
 * Used when VITE_DATA_MODE=api.
 * GET endpoints are STABLE per Postman audit.
 * Important: Contract does NOT support GET /api/v1/Zones/{id}.
 * Mutation endpoints are gated (NEEDS RETEST).
 */
export const apiZoneProvider: IZoneProvider = {
  /**
   * GET /api/v1/Zones
   * STABLE: Queries paginated zones.
   */
  async getZones(params: GetZonesParams): Promise<PaginatedResult<ZoneDto>> {
    const queryParams: Record<string, string> = {
      pageNumber: params.pageNumber.toString(),
      pageSize: params.pageSize.toString(),
    };

    if (params.searchKeyword && params.searchKeyword.trim()) {
      queryParams.searchKeyword = params.searchKeyword.trim();
    }

    const response = await httpClient.get<Result<PaginatedResult<ZoneDto>>>(
      "/api/v1/Zones",
      { params: queryParams }
    );

    return response.data.data;
  },

  /**
   * GET /api/v1/Zones/list
   * STABLE: Queries full zones list.
   */
  async getZonesList(searchKeyword?: string): Promise<ZoneDto[]> {
    const params: Record<string, string> = {};
    if (searchKeyword && searchKeyword.trim()) {
      params.searchKeyword = searchKeyword.trim();
    }

    const response = await httpClient.get<Result<ZoneDto[]>>(
      "/api/v1/Zones/list",
      { params }
    );

    return response.data.data || [];
  },

  /**
   * GET /api/v1/Zones/warehouse/{warehouseId}
   * STABLE: Retrieves zones belonging to a specific warehouse UUID.
   */
  async getZonesByWarehouse(warehouseId: string): Promise<ZoneDto[]> {
    const response = await httpClient.get<Result<ZoneDto[]>>(
      `/api/v1/Zones/warehouse/${encodeURIComponent(warehouseId)}`
    );

    return response.data.data || [];
  },

  /**
   * POST /api/v1/Zones
   * NEEDS RETEST: Creates a new zone. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async createZone(request: CreateZoneRequest): Promise<string> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác tạo phân khu chưa được kích hoạt."
      );
    }

    const response = await httpClient.post<Result<string>>(
      "/api/v1/Zones",
      request
    );

    return response.data.data;
  },

  /**
   * PUT /api/v1/Zones/{id}
   * NEEDS RETEST: Updates existing zone. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async updateZone(id: string, request: UpdateZoneRequest): Promise<boolean> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác cập nhật phân khu chưa được kích hoạt."
      );
    }

    const response = await httpClient.put<Result<boolean>>(
      `/api/v1/Zones/${encodeURIComponent(id)}`,
      request
    );

    return response.data.data;
  },

  /**
   * DELETE /api/v1/Zones/{id}
   * NEEDS RETEST: Deletes zone by UUID. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async deleteZone(id: string): Promise<boolean> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác xóa phân khu chưa được kích hoạt."
      );
    }

    const response = await httpClient.delete<Result<boolean>>(
      `/api/v1/Zones/${encodeURIComponent(id)}`
    );

    return response.data.data;
  },
};
