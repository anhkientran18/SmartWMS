/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tracking Mode Enum matching SmartWMS Architecture
 * None = 0, Lot = 1, Serial = 2 (Serial read-only in cycle count)
 */
export enum TrackingMode {
  None = 0,
  Lot = 1,
  Serial = 2,
}

/**
 * Cycle Count Sheet Lifecycle Status
 * Draft -> Counting -> Review -> Confirmed
 */
export type CycleCountStatus = "Draft" | "Counting" | "Review" | "Confirmed";

/**
 * Variance classification
 */
export type VarianceType = "MATCHED" | "SURPLUS" | "SHORTAGE";

/**
 * Line item in a cycle count sheet
 */
export interface CycleCountItem {
  id: string;
  cycleCountId: string;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  category?: string;
  binId: string;
  binCode: string;
  trackingMode: TrackingMode;
  lotNumber?: string;
  expirationDate?: string;
  serialNumbers?: string[]; // Read-only if trackingMode === Serial
  systemQty: number;
  countedQty: number | null;
  varianceQty: number; // countedQty - systemQty (0 when uncounted or matched)
  varianceType: VarianceType;
  isCounted: boolean;
  countedAt?: string;
  notes?: string;
}

/**
 * Cycle Count Sheet Document
 */
export interface CycleCountSheet {
  id: string;
  sheetNumber: string; // e.g., CC-2026-001
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  binScope: "ALL" | "SELECTED";
  selectedBinCodes?: string[];
  status: CycleCountStatus;
  createdDate: string;
  scheduledDate: string;
  completedDate?: string;
  confirmedDate?: string;
  assignedOperator?: string;
  notes?: string;
  items: CycleCountItem[];
  // Aggregated metadata
  totalSkus: number;
  countedSkus: number;
  varianceSkus: number;
}

/**
 * Filter parameters for cycle count search and pagination
 */
export interface CycleCountFilterParams {
  searchTerm?: string;
  warehouseId?: string;
  zoneId?: string;
  status?: CycleCountStatus | "ALL";
  varianceOnly?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * KPI Statistics for Cycle Counting
 */
export interface CycleCountKPIs {
  totalSheets: number;
  draftSheets: number;
  countingSheets: number;
  reviewSheets: number;
  varianceSheets: number;
  confirmedSheets: number;
}

/**
 * Summary for Variance Review
 */
export interface CycleCountVarianceSummary {
  totalLines: number;
  countedLines: number;
  uncountedLines: number;
  matchedLines: number;
  surplusLines: number;
  shortageLines: number;
  totalSystemQty: number;
  totalCountedQty: number;
  netVarianceQty: number;
  grossVarianceQty: number;
  hasVariance: boolean;
}

/**
 * Backend Contract Request wrapper pattern: { requestData: { ... } }
 */
export interface CreateCycleCountSheetRequestData {
  warehouseId: string;
  zoneId: string;
  binScope: "ALL" | "SELECTED";
  selectedBinCodes?: string[];
  scheduledDate: string;
  notes?: string;
  assignedOperator?: string;
}

export interface CreateCycleCountSheetRequest {
  requestData: CreateCycleCountSheetRequestData;
}

export interface UpdateCountEntryRequestData {
  cycleCountId: string;
  itemId: string;
  countedQty: number;
  notes?: string;
}

export interface UpdateCountEntryRequest {
  requestData: UpdateCountEntryRequestData;
}

export interface ConfirmCycleCountRequestData {
  cycleCountId: string;
  confirmedBy?: string;
  reconcileNotes?: string;
}

export interface ConfirmCycleCountRequest {
  requestData: ConfirmCycleCountRequestData;
}
