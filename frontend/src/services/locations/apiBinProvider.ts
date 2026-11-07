// F0: INHERITED / UNVERIFIED. Historical contract claims below require F1 audit.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { httpClient } from "../api/httpClient";
import {
  Result,
  PaginatedResult,
  BinDto,
  GetBinsParams,
  CreateBinRequest,
  UpdateBinRequest,
  BinContentHeaderDto,
} from "../api/apiTypes";
import { IBinProvider } from "./types";
import { isLocationMutationEnabled } from "./apiWarehouseProvider";

/**
 * Real API Bin Provider connecting to SmartWMS backend.
 * Used when VITE_DATA_MODE=api.
 * GET endpoints are STABLE per Postman audit.
 * Note: Pagination uses searchTerm (not searchKeyword).
 * Note: Detail and Contents endpoints require Bin UUID (not Bin Code).
 * Mutation endpoints are gated (NEEDS RETEST).
 */
export const apiBinProvider: IBinProvider = {
  /**
   * GET /api/v1/Bins
   * STABLE: Queries paginated bins.
   * Note: query param for search is `searchTerm`.
   */
  async getBins(params: GetBinsParams): Promise<PaginatedResult<BinDto>> {
    const queryParams: Record<string, string> = {
      pageNumber: params.pageNumber.toString(),
      pageSize: params.pageSize.toString(),
    };

    if (params.zoneId && params.zoneId.trim()) {
      queryParams.zoneId = params.zoneId.trim();
    }

    if (params.searchTerm && params.searchTerm.trim()) {
      queryParams.searchTerm = params.searchTerm.trim();
    }

    const response = await httpClient.get<Result<PaginatedResult<BinDto>>>(
      "/api/v1/Bins",
      { params: queryParams }
    );

    return response.data.data;
  },

  /**
   * GET /api/v1/Bins/list
   * STABLE: Queries full bins list.
   */
  async getBinsList(params?: { zoneId?: string; searchKeyword?: string }): Promise<BinDto[]> {
    const queryParams: Record<string, string> = {};
    if (params?.zoneId && params.zoneId.trim()) {
      queryParams.zoneId = params.zoneId.trim();
    }
    if (params?.searchKeyword && params.searchKeyword.trim()) {
      queryParams.searchKeyword = params.searchKeyword.trim();
    }

    const response = await httpClient.get<Result<BinDto[]>>(
      "/api/v1/Bins/list",
      { params: queryParams }
    );

    return response.data.data || [];
  },

  /**
   * GET /api/v1/Bins/{id}
   * STABLE: Retrieves single bin details by UUID.
   * Must use BIN UUID (not Bin Code).
   */
  async getBinById(id: string): Promise<BinDto> {
    const response = await httpClient.get<Result<BinDto>>(
      `/api/v1/Bins/${encodeURIComponent(id)}`
    );

    return response.data.data;
  },

  /**
   * GET /api/v1/Bins/{id}/contents
   * STABLE: Retrieves stored SKUs, occupancy and capacity details of a bin.
   * Must use BIN UUID (not Bin Code).
   */
  async getBinContents(id: string): Promise<BinContentHeaderDto> {
    const response = await httpClient.get<Result<BinContentHeaderDto>>(
      `/api/v1/Bins/${encodeURIComponent(id)}/contents`
    );

    return response.data.data;
  },

  /**
   * POST /api/v1/Bins
   * NEEDS RETEST: Creates a new bin. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async createBin(request: CreateBinRequest): Promise<string> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác tạo ô kệ chưa được kích hoạt."
      );
    }

    const response = await httpClient.post<Result<string>>(
      "/api/v1/Bins",
      request
    );

    return response.data.data;
  },

  /**
   * PUT /api/v1/Bins/{id}
   * NEEDS RETEST: Updates existing bin. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async updateBin(id: string, request: UpdateBinRequest): Promise<boolean> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác cập nhật ô kệ chưa được kích hoạt."
      );
    }

    const response = await httpClient.put<Result<boolean>>(
      `/api/v1/Bins/${encodeURIComponent(id)}`,
      request
    );

    return response.data.data;
  },

  /**
   * DELETE /api/v1/Bins/{id}
   * NEEDS RETEST: Deletes bin by UUID. Gated by VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS.
   */
  async deleteBin(id: string): Promise<boolean> {
    if (!isLocationMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false). Thao tác xóa ô kệ chưa được kích hoạt."
      );
    }

    const response = await httpClient.delete<Result<boolean>>(
      `/api/v1/Bins/${encodeURIComponent(id)}`
    );

    return response.data.data;
  },
};
