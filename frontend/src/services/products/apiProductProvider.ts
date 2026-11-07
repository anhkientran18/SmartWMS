// F0: INHERITED / UNVERIFIED. Historical contract claims below require F1 audit.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { httpClient } from "../api/httpClient";
import {
  Result,
  PaginatedResult,
  ProductDto,
  GetProductsParams,
  ParsedBarcodeDto,
  CreateProductRequest,
  UpdateProductRequest,
} from "../api/apiTypes";
import { IProductProvider } from "./types";

/**
 * Feature flag for unverified product mutations.
 * Evaluates VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS from environment (defaults to false).
 */
export const isProductMutationEnabled = (): boolean => {
  const mode = (import.meta as any).env?.VITE_DATA_MODE?.trim().toLowerCase();
  if (mode !== "api") return true;
  return (import.meta as any).env?.VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS === "true";
};

/**
 * Real API Product Provider connecting to SmartWMS backend.
 * Used when VITE_DATA_MODE=api.
 * Errors are NOT fallen back to mock; instead, they trigger real error states.
 */
export const apiProductProvider: IProductProvider = {
  /**
   * GET /api/v1/Products
   * STABLE: Queries paginated products with server-side pagination.
   */
  async getProducts(params: GetProductsParams): Promise<PaginatedResult<ProductDto>> {
    const queryParams: Record<string, string> = {
      pageNumber: params.pageNumber.toString(),
      pageSize: params.pageSize.toString(),
    };

    if (params.searchKeyword && params.searchKeyword.trim()) {
      queryParams.searchKeyword = params.searchKeyword.trim();
    }

    const response = await httpClient.get<Result<PaginatedResult<ProductDto>>>(
      "/api/v1/Products",
      { params: queryParams }
    );

    return response.data.data;
  },

  /**
   * GET /api/v1/Products/list?searchKeyword={optional}
   * STABLE: Queries full product list, ideal for KPI aggregations.
   */
  async getProductsList(searchKeyword?: string): Promise<ProductDto[]> {
    const params: Record<string, string> = {};
    if (searchKeyword && searchKeyword.trim()) {
      params.searchKeyword = searchKeyword.trim();
    }

    const response = await httpClient.get<Result<ProductDto[]>>(
      "/api/v1/Products/list",
      { params }
    );

    return response.data.data || [];
  },

  /**
   * GET /api/v1/Products/{id}
   * STABLE: Retrieves single product details by GUID.
   */
  async getProductById(id: string): Promise<ProductDto> {
    const response = await httpClient.get<Result<ProductDto>>(
      `/api/v1/Products/${encodeURIComponent(id)}`
    );

    return response.data.data;
  },

  /**
   * GET /api/v1/Products/{sku}/qrcode
   * STABLE: Retrieves product QR code as base64 PNG data URI (data:image/png;base64,...).
   */
  async getProductQrCode(sku: string): Promise<string> {
    const response = await httpClient.get<Result<string>>(
      `/api/v1/Products/${encodeURIComponent(sku)}/qrcode`
    );

    return response.data.data;
  },

  /**
   * POST /api/v1/Products/parse-barcode
   * Parses raw barcode data and returns ParsedBarcodeDto.
   */
  async parseBarcode(rawBarcodeData: string): Promise<ParsedBarcodeDto> {
    const response = await httpClient.post<Result<ParsedBarcodeDto>>(
      "/api/v1/Products/parse-barcode",
      { rawBarcodeData }
    );

    return response.data.data;
  },

  /**
   * POST /api/v1/Products
   * NEEDS RETEST: Creates a new product. Gated by VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS.
   */
  async createProduct(request: CreateProductRequest): Promise<string> {
    if (!isProductMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS=false). Thao tác tạo sản phẩm chưa được kích hoạt."
      );
    }

    const response = await httpClient.post<Result<string>>(
      "/api/v1/Products",
      request
    );

    return response.data.data;
  },

  /**
   * PUT /api/v1/Products/{id}
   * NEEDS RETEST: Updates existing product. Gated by VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS.
   */
  async updateProduct(id: string, request: UpdateProductRequest): Promise<boolean> {
    if (!isProductMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS=false). Thao tác cập nhật sản phẩm chưa được kích hoạt."
      );
    }

    const response = await httpClient.put<Result<boolean>>(
      `/api/v1/Products/${encodeURIComponent(id)}`,
      request
    );

    return response.data.data;
  },

  /**
   * DELETE /api/v1/Products/{id}
   * NEEDS RETEST: Deletes product by GUID. Gated by VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS.
   */
  async deleteProduct(id: string): Promise<boolean> {
    if (!isProductMutationEnabled()) {
      throw new Error(
        "Backend mutation đang chờ retest (VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS=false). Thao tác xóa sản phẩm chưa được kích hoạt."
      );
    }

    const response = await httpClient.delete<Result<boolean>>(
      `/api/v1/Products/${encodeURIComponent(id)}`
    );

    return response.data.data;
  },
};
