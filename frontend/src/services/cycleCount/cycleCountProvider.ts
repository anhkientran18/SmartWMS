/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CycleCountSheet,
  CycleCountItem,
  CycleCountFilterParams,
  CycleCountKPIs,
  CreateCycleCountSheetRequest,
  UpdateCountEntryRequest,
  ConfirmCycleCountRequest,
} from "./types";

export interface ICycleCountProvider {
  getCycleCounts(params?: CycleCountFilterParams): Promise<{ sheets: CycleCountSheet[]; total: number }>;
  getCycleCountById(id: string): Promise<CycleCountSheet | null>;
  getKPIs(): Promise<CycleCountKPIs>;
  createCycleCountSheet(req: CreateCycleCountSheetRequest): Promise<CycleCountSheet>;
  updateCountEntry(req: UpdateCountEntryRequest): Promise<CycleCountItem>;
  bulkUpdateCounts(
    cycleCountId: string,
    updates: { itemId: string; countedQty: number; notes?: string }[]
  ): Promise<CycleCountSheet>;
  startCounting(id: string): Promise<CycleCountSheet>;
  submitForReview(id: string): Promise<CycleCountSheet>;
  confirmCycleCount(req: ConfirmCycleCountRequest): Promise<CycleCountSheet>;
}
