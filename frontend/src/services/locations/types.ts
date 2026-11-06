/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PaginatedResult,
  WarehouseDto,
  GetWarehousesParams,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  ZoneDto,
  GetZonesParams,
  CreateZoneRequest,
  UpdateZoneRequest,
  BinDto,
  GetBinsParams,
  CreateBinRequest,
  UpdateBinRequest,
  BinContentHeaderDto,
} from "../api/apiTypes";

/**
 * Common Warehouse Provider contract shared between MockProvider and ApiProvider
 */
export interface IWarehouseProvider {
  getWarehouses(params: GetWarehousesParams): Promise<PaginatedResult<WarehouseDto>>;
  getWarehousesList(searchKeyword?: string): Promise<WarehouseDto[]>;
  getWarehouseById(id: string): Promise<WarehouseDto>;
  createWarehouse(request: CreateWarehouseRequest): Promise<string>;
  updateWarehouse(id: string, request: UpdateWarehouseRequest): Promise<boolean>;
  deleteWarehouse(id: string): Promise<boolean>;
}

/**
 * Common Zone Provider contract shared between MockProvider and ApiProvider
 * Note: Contract does NOT provide GET /api/v1/Zones/{id}
 */
export interface IZoneProvider {
  getZones(params: GetZonesParams): Promise<PaginatedResult<ZoneDto>>;
  getZonesList(searchKeyword?: string): Promise<ZoneDto[]>;
  getZonesByWarehouse(warehouseId: string): Promise<ZoneDto[]>;
  createZone(request: CreateZoneRequest): Promise<string>;
  updateZone(id: string, request: UpdateZoneRequest): Promise<boolean>;
  deleteZone(id: string): Promise<boolean>;
}

/**
 * Common Bin Provider contract shared between MockProvider and ApiProvider
 */
export interface IBinProvider {
  getBins(params: GetBinsParams): Promise<PaginatedResult<BinDto>>;
  getBinsList(params?: { zoneId?: string; searchKeyword?: string }): Promise<BinDto[]>;
  getBinById(id: string): Promise<BinDto>;
  getBinContents(id: string): Promise<BinContentHeaderDto>;
  createBin(request: CreateBinRequest): Promise<string>;
  updateBin(id: string, request: UpdateBinRequest): Promise<boolean>;
  deleteBin(id: string): Promise<boolean>;
}

/**
 * Presentation helper: maps zone names to English when English locale is selected,
 * while strictly preserving natural Vietnamese names in Vietnamese mode.
 * Does NOT mutate underlying raw DTOs or database records.
 */
export function getLocalizedZoneName(name?: string, isEn = false): string {
  if (!name) return "";
  if (!isEn) return name;
  const lower = name.toLowerCase();
  if (lower.includes("phân khu mát") || lower.includes("kho mát") || lower.includes("mát")) return "Cool storage area";
  if (lower.includes("phân khu khô") || lower.includes("kho khô") || lower.includes("khô")) return "Dry storage area";
  if (lower.includes("quầy bán lẻ") || lower.includes("bán lẻ")) return "Retail area";
  if (lower.includes("tiêu chuẩn a")) return "Standard storage area A";
  if (lower.includes("lưu trữ b")) return "Storage area B";
  if (lower.includes("trung chuyển")) return "Transit / transfer hub";
  return name;
}

/**
 * Presentation helper: maps warehouse names to English when English locale is selected,
 * while preserving natural Vietnamese names in Vietnamese mode.
 */
export function getLocalizedWarehouseName(name?: string, isEn = false): string {
  if (!name) return "";
  if (!isEn) return name;
  const lower = name.toLowerCase();
  if (lower.includes("hà nội")) return "Hanoi Central Warehouse";
  if (lower.includes("miền nam")) return "Southern Regional Warehouse";
  if (lower.includes("đà nẵng")) return "Da Nang Retail & Transit Hub";
  return name;
}
