// F0: INHERITED / UNVERIFIED. Historical contract claims below require F1 audit.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Standard Result wrapper returned by SmartWMS backend
 */
export interface Result<T> {
  isSuccess: boolean;
  message: string | null;
  error: string | null;
  errors?: Record<string, string[]> | string[] | null;
  data: T;
}

/**
 * Server-side PaginatedResult contract
 */
export interface PaginatedResult<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  firstItemIndex: number;
  lastItemIndex: number;
}

/**
 * Backend ProductDto contract (Source of Truth)
 * Strictly conforms to backend schema without invented fields.
 */
export interface ProductDto {
  id: string; // Guid UUID
  sku: string;
  barcode: string;
  name: string;
  description: string;
  unit: string;
  weight: number;
}

/**
 * Query parameters for GET /api/v1/Products
 */
export interface GetProductsParams {
  pageNumber: number;
  pageSize: number;
  searchKeyword?: string;
}

/**
 * Contract for POST /api/v1/Products/parse-barcode response
 */
export interface ParsedBarcodeDto {
  productId: string; // Guid
  sku: string;
  productName: string;
  lotNumber: string;
  expirationDate: string | null;
  stockStatus: string;
}

/**
 * Contract for POST /api/v1/Products (CreateProductRequest - NEEDS RETEST)
 */
export interface CreateProductRequest {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  unit: string;
  width: number;
  height: number;
  depth: number;
}

/**
 * Contract for PUT /api/v1/Products/{id} (UpdateProductRequest - NEEDS RETEST)
 */
export interface UpdateProductRequest {
  id: string; // Guid
  sku: string;
  barcode: string;
  name: string;
  description: string;
  unit: string;
}

/**
 * Normalized API Error structure for UI handling
 */
export interface ApiError {
  code?: string;
  status?: number;
  message: string;
  error?: string | null;
  errors?: Record<string, string[]> | string[] | null;
  isAuthError?: boolean;
  isForbidden?: boolean;
}

// ==================================================
// WAREHOUSE CONTRACTS (SOURCE OF TRUTH)
// ==================================================

export interface WarehouseDto {
  id: string; // Guid UUID
  code: string;
  name: string;
  address: string;
}

export interface GetWarehousesParams {
  pageNumber: number;
  pageSize: number;
  searchKeyword?: string;
}

export interface CreateWarehouseRequest {
  code: string;
  name: string;
  address: string;
}

export interface UpdateWarehouseRequest {
  id: string; // Guid UUID
  code: string;
  name: string;
  address: string;
}

// ==================================================
// ZONE CONTRACTS (SOURCE OF TRUTH)
// ==================================================

export interface ZoneDto {
  id: string; // Guid UUID
  code: string;
  name: string;
  warehouseId: string; // Guid UUID
}

export interface GetZonesParams {
  pageNumber: number;
  pageSize: number;
  searchKeyword?: string;
}

export interface CreateZoneRequest {
  code: string;
  name: string;
  warehouseId: string; // Guid UUID
}

export interface UpdateZoneRequest {
  id: string; // Guid UUID
  code: string;
  name: string;
}

// ==================================================
// BIN & BIN CONTENT CONTRACTS (SOURCE OF TRUTH)
// ==================================================

export interface BinDto {
  id: string; // Guid UUID
  code: string;
  zoneId: string; // Guid UUID
  maxCapacity: number;
  currentOccupancy: number;
}

export interface GetBinsParams {
  pageNumber: number;
  pageSize: number;
  searchTerm?: string;
  zoneId?: string;
}

export interface CreateBinRequest {
  code: string;
  zoneId: string; // Guid UUID
  width: number;
  height: number;
  depth: number;
  maxCapacity: number;
}

export interface UpdateBinRequest {
  id: string; // Guid UUID
  code: string;
  maxCapacity: number;
}

export interface BinInventoryItemDto {
  productId: string; // Guid UUID
  sku: string;
  productName: string;
  lotNumber: string;
  quantity: number;
  expirationDate: string;
  status: string | number;
  trackingMode?: number;
  serialNumbers?: string[];
}

export interface BinContentHeaderDto {
  binId: string; // Guid UUID
  binCode: string;
  maxCapacity: number;
  currentOccupancy: number;
  utilizationPercentage: number;
  items: BinInventoryItemDto[];
}

// ==================================================
// SUPPLIER CONTRACTS (SOURCE OF TRUTH)
// ==================================================

/**
 * Backend SupplierDto contract (Source of Truth)
 * Strictly conforms to backend schema without invented fields.
 */
export interface SupplierDto {
  id: string; // Guid UUID
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface GetSuppliersParams {
  pageNumber: number;
  pageSize: number;
  searchKeyword?: string;
}

export interface CreateSupplierRequest {
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface UpdateSupplierRequest {
  id: string; // Guid UUID
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}
