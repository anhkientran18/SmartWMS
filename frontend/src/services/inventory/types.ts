/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mandatory Inventory Status Mapping for SmartWMS:
 * Available = 1
 * Reserved = 2
 * QCHold = 3
 * Damaged = 4
 * Expired = 5
 */
export enum InventoryStatus {
  Available = 1,
  Reserved = 2,
  QCHold = 3,
  Damaged = 4,
  Expired = 5,
}

/**
 * Tracking Mode Enum:
 * None = 0
 * Lot = 1
 * Serial = 2 (read-only in UI, no mutation workflow)
 */
export enum TrackingMode {
  None = 0,
  Lot = 1,
  Serial = 2,
}

/**
 * Unified Inventory Item detail record for stock visibility views
 */
export interface InventoryItemDetail {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  category?: string;
  unit?: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  binId: string;
  binCode: string;
  binMaxCapacity?: number;
  binCurrentOccupancy?: number;
  binUtilizationPercentage?: number;
  lotNumber?: string;
  expirationDate?: string;
  trackingMode: TrackingMode;
  serialNumbers?: string[];
  status: InventoryStatus;
  statusLabelVi: string;
  statusLabelEn: string;
  quantity: number;
}

/**
 * Stock Summary aggregations
 * Note: totalPhysicalQty is the physical quantity across all statuses.
 * NEVER label totalPhysicalQty as ATP / Available Stock.
 */
export interface InventoryStockSummary {
  totalPhysicalQty: number; // Physical total across all 5 statuses
  availableQty: number; // Status = 1
  reservedQty: number; // Status = 2
  qcHoldQty: number; // Status = 3
  damagedQty: number; // Status = 4
  expiredQty: number; // Status = 5
  totalSkus: number;
  totalBins: number;
}

/**
 * Inventory filter parameters for stock search and filtration
 */
export interface InventoryFilterParams {
  searchTerm?: string;
  warehouseId?: string;
  zoneId?: string;
  binId?: string;
  productId?: string;
  status?: InventoryStatus | "all";
}

/**
 * Helper to normalize any status value to InventoryStatus (1..5)
 */
export function normalizeInventoryStatus(raw: string | number | undefined | null): InventoryStatus {
  if (typeof raw === "number") {
    if (raw >= 1 && raw <= 5) return raw as InventoryStatus;
    return InventoryStatus.Available;
  }
  const str = String(raw || "").toUpperCase().trim();
  if (str === "RESERVED" || str === "2") return InventoryStatus.Reserved;
  if (str === "QCHOLD" || str === "QC_HOLD" || str === "QUARANTINE" || str === "BLOCKED" || str === "3") {
    return InventoryStatus.QCHold;
  }
  if (str === "DAMAGED" || str === "DEFECTIVE" || str === "4") return InventoryStatus.Damaged;
  if (str === "EXPIRED" || str === "5") return InventoryStatus.Expired;
  return InventoryStatus.Available;
}

/**
 * Helper to get localized labels for InventoryStatus
 */
export function getInventoryStatusLabel(status: InventoryStatus, isEn = false): string {
  switch (status) {
    case InventoryStatus.Available:
      return isEn ? "Available" : "Khả dụng";
    case InventoryStatus.Reserved:
      return isEn ? "Reserved" : "Đã giữ";
    case InventoryStatus.QCHold:
      return isEn ? "QC Hold" : "Chờ kiểm định";
    case InventoryStatus.Damaged:
      return isEn ? "Damaged" : "Hư hỏng";
    case InventoryStatus.Expired:
      return isEn ? "Expired" : "Hết hạn";
    default:
      return isEn ? "Available" : "Khả dụng";
  }
}

/**
 * Helper to get localized labels for TrackingMode
 */
export function getTrackingModeLabel(mode: TrackingMode, isEn = false): string {
  switch (mode) {
    case TrackingMode.Serial:
      return isEn ? "Serial tracked" : "Theo serial";
    case TrackingMode.Lot:
      return isEn ? "Lot tracked" : "Theo lô";
    case TrackingMode.None:
    default:
      return isEn ? "Not tracked" : "Không theo dõi";
  }
}
