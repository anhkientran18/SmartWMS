/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CycleCountSheet,
  CycleCountItem,
  CycleCountFilterParams,
  CycleCountKPIs,
  CycleCountVarianceSummary,
  CreateCycleCountSheetRequest,
  UpdateCountEntryRequest,
  ConfirmCycleCountRequest,
} from "./types";
import { ICycleCountProvider } from "./cycleCountProvider";
import { mockCycleCountProvider } from "./mockCycleCountProvider";
import { apiCycleCountProvider } from "./apiCycleCountProvider";

class CycleCountService {
  private provider: ICycleCountProvider;

  constructor() {
    const dataMode = (import.meta.env.VITE_DATA_MODE || "mock").toLowerCase();
    this.provider = dataMode === "api" ? apiCycleCountProvider : mockCycleCountProvider;
  }

  public setProvider(provider: ICycleCountProvider): void {
    this.provider = provider;
  }

  public getProvider(): ICycleCountProvider {
    return this.provider;
  }

  public isMockMode(): boolean {
    return this.provider === mockCycleCountProvider;
  }

  public async getCycleCounts(
    params?: CycleCountFilterParams
  ): Promise<{ sheets: CycleCountSheet[]; total: number }> {
    return this.provider.getCycleCounts(params);
  }

  public async getCycleCountById(id: string): Promise<CycleCountSheet | null> {
    return this.provider.getCycleCountById(id);
  }

  public async getKPIs(): Promise<CycleCountKPIs> {
    return this.provider.getKPIs();
  }

  public async createCycleCountSheet(
    req: CreateCycleCountSheetRequest
  ): Promise<CycleCountSheet> {
    return this.provider.createCycleCountSheet(req);
  }

  public async updateCountEntry(
    req: UpdateCountEntryRequest
  ): Promise<CycleCountItem> {
    return this.provider.updateCountEntry(req);
  }

  public async bulkUpdateCounts(
    cycleCountId: string,
    updates: { itemId: string; countedQty: number; notes?: string }[]
  ): Promise<CycleCountSheet> {
    return this.provider.bulkUpdateCounts(cycleCountId, updates);
  }

  public async startCounting(id: string): Promise<CycleCountSheet> {
    return this.provider.startCounting(id);
  }

  public async submitForReview(id: string): Promise<CycleCountSheet> {
    return this.provider.submitForReview(id);
  }

  public async confirmCycleCount(
    req: ConfirmCycleCountRequest
  ): Promise<CycleCountSheet> {
    return this.provider.confirmCycleCount(req);
  }

  /**
   * Helper utility to calculate comprehensive variance summary for a count sheet
   */
  public calculateVarianceSummary(sheet: CycleCountSheet): CycleCountVarianceSummary {
    let countedLines = 0;
    let uncountedLines = 0;
    let matchedLines = 0;
    let surplusLines = 0;
    let shortageLines = 0;
    let totalSystemQty = 0;
    let totalCountedQty = 0;
    let netVarianceQty = 0;
    let grossVarianceQty = 0;

    sheet.items.forEach((item) => {
      totalSystemQty += item.systemQty;

      if (item.isCounted && item.countedQty !== null) {
        countedLines++;
        totalCountedQty += item.countedQty;
        const diff = item.countedQty - item.systemQty;
        netVarianceQty += diff;
        grossVarianceQty += Math.abs(diff);

        if (diff === 0) {
          matchedLines++;
        } else if (diff > 0) {
          surplusLines++;
        } else {
          shortageLines++;
        }
      } else {
        uncountedLines++;
      }
    });

    const hasVariance = surplusLines > 0 || shortageLines > 0;

    return {
      totalLines: sheet.items.length,
      countedLines,
      uncountedLines,
      matchedLines,
      surplusLines,
      shortageLines,
      totalSystemQty,
      totalCountedQty,
      netVarianceQty,
      grossVarianceQty,
      hasVariance,
    };
  }
}

export const cycleCountService = new CycleCountService();
