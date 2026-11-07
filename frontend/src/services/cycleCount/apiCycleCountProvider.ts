// F0: INHERITED / UNVERIFIED. Historical contract claims below require F1 audit.
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
import { ICycleCountProvider } from "./cycleCountProvider";

/**
 * ApiCycleCountProvider Skeleton
 *
 * NOTE: Production endpoints for Cycle Counting are not yet bound in AI Studio.
 * Real backend connections should be integrated when developing in VS Code
 * with the confirmed .NET / CQRS API contracts.
 */
export class ApiCycleCountProvider implements ICycleCountProvider {
  private checkOnlineStatus(): void {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("OFFLINE_NETWORK_RESTRICTION: Network connection required for transactional cycle count operations.");
    }
  }

  async getCycleCounts(params?: CycleCountFilterParams): Promise<{ sheets: CycleCountSheet[]; total: number }> {
    throw new Error("API Cycle Counting endpoint is not yet connected. Please use Mock provider in AI Studio.");
  }

  async getCycleCountById(id: string): Promise<CycleCountSheet | null> {
    throw new Error("API Cycle Counting endpoint is not yet connected. Please use Mock provider in AI Studio.");
  }

  async getKPIs(): Promise<CycleCountKPIs> {
    throw new Error("API Cycle Counting endpoint is not yet connected. Please use Mock provider in AI Studio.");
  }

  async createCycleCountSheet(req: CreateCycleCountSheetRequest): Promise<CycleCountSheet> {
    this.checkOnlineStatus();
    throw new Error("Direct cycle count mutations are blocked in AI Studio prototype. Contract requires verified backend endpoint.");
  }

  async updateCountEntry(req: UpdateCountEntryRequest): Promise<CycleCountItem> {
    this.checkOnlineStatus();
    throw new Error("Direct count entries mutations are blocked in AI Studio prototype.");
  }

  async bulkUpdateCounts(
    cycleCountId: string,
    updates: { itemId: string; countedQty: number; notes?: string }[]
  ): Promise<CycleCountSheet> {
    this.checkOnlineStatus();
    throw new Error("Direct bulk count mutations are blocked in AI Studio prototype.");
  }

  async startCounting(id: string): Promise<CycleCountSheet> {
    this.checkOnlineStatus();
    throw new Error("Direct cycle count start mutations are blocked in AI Studio prototype.");
  }

  async submitForReview(id: string): Promise<CycleCountSheet> {
    this.checkOnlineStatus();
    throw new Error("Direct cycle count review mutations are blocked in AI Studio prototype.");
  }

  async confirmCycleCount(req: ConfirmCycleCountRequest): Promise<CycleCountSheet> {
    this.checkOnlineStatus();
    throw new Error("Direct cycle count reconcile mutations are blocked in AI Studio prototype.");
  }
}

export const apiCycleCountProvider = new ApiCycleCountProvider();
