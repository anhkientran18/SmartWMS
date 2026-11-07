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
  VarianceType,
  TrackingMode,
} from "./types";
import { ICycleCountProvider } from "./cycleCountProvider";
import { initialMockCycleCounts } from "./cycleCountMockData";

const STORAGE_KEY = "smartwms_cycle_counts_data";

export class MockCycleCountProvider implements ICycleCountProvider {
  private sheets: CycleCountSheet[];

  constructor() {
    this.sheets = this.loadFromStorage();
  }

  private loadFromStorage(): CycleCountSheet[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return JSON.parse(JSON.stringify(initialMockCycleCounts));
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sheets));
    } catch {
      // Ignore
    }
  }

  public resetToDefault(): void {
    this.sheets = JSON.parse(JSON.stringify(initialMockCycleCounts));
    this.saveToStorage();
  }

  private recalculateSheet(sheet: CycleCountSheet): void {
    let countedCount = 0;
    let varianceCount = 0;

    sheet.items.forEach((item) => {
      if (item.isCounted && item.countedQty !== null) {
        countedCount++;
        const diff = item.countedQty - item.systemQty;
        item.varianceQty = diff;
        if (diff === 0) {
          item.varianceType = "MATCHED";
        } else if (diff > 0) {
          item.varianceType = "SURPLUS";
          varianceCount++;
        } else {
          item.varianceType = "SHORTAGE";
          varianceCount++;
        }
      } else {
        item.varianceQty = 0;
        item.varianceType = "MATCHED";
      }
    });

    sheet.totalSkus = sheet.items.length;
    sheet.countedSkus = countedCount;
    sheet.varianceSkus = varianceCount;
  }

  async getCycleCounts(params?: CycleCountFilterParams): Promise<{ sheets: CycleCountSheet[]; total: number }> {
    await new Promise((res) => setTimeout(res, 120));
    let list = [...this.sheets];

    if (params) {
      if (params.searchTerm) {
        const term = params.searchTerm.toLowerCase().trim();
        list = list.filter(
          (s) =>
            s.sheetNumber.toLowerCase().includes(term) ||
            s.warehouseName.toLowerCase().includes(term) ||
            s.zoneName.toLowerCase().includes(term) ||
            (s.assignedOperator && s.assignedOperator.toLowerCase().includes(term)) ||
            s.items.some(
              (i) =>
                i.sku.toLowerCase().includes(term) ||
                i.productName.toLowerCase().includes(term) ||
                i.binCode.toLowerCase().includes(term)
            )
        );
      }

      if (params.warehouseId) {
        list = list.filter((s) => s.warehouseId === params.warehouseId);
      }

      if (params.zoneId) {
        list = list.filter((s) => s.zoneId === params.zoneId);
      }

      if (params.status && params.status !== "ALL") {
        list = list.filter((s) => s.status === params.status);
      }

      if (params.varianceOnly) {
        list = list.filter((s) => s.varianceSkus > 0);
      }
    }

    // Sort: Review & Counting on top, then Draft, then Confirmed
    const statusOrder: Record<string, number> = {
      Review: 1,
      Counting: 2,
      Draft: 3,
      Confirmed: 4,
    };
    list.sort((a, b) => {
      const orderDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
    });

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const startIndex = (page - 1) * pageSize;
    const paginated = list.slice(startIndex, startIndex + pageSize);

    return {
      sheets: paginated,
      total: list.length,
    };
  }

  async getCycleCountById(id: string): Promise<CycleCountSheet | null> {
    await new Promise((res) => setTimeout(res, 80));
    const found = this.sheets.find((s) => s.id === id);
    if (!found) return null;
    return JSON.parse(JSON.stringify(found));
  }

  async getKPIs(): Promise<CycleCountKPIs> {
    await new Promise((res) => setTimeout(res, 60));
    return {
      totalSheets: this.sheets.length,
      draftSheets: this.sheets.filter((s) => s.status === "Draft").length,
      countingSheets: this.sheets.filter((s) => s.status === "Counting").length,
      reviewSheets: this.sheets.filter((s) => s.status === "Review").length,
      varianceSheets: this.sheets.filter((s) => s.varianceSkus > 0).length,
      confirmedSheets: this.sheets.filter((s) => s.status === "Confirmed").length,
    };
  }

  async createCycleCountSheet(req: CreateCycleCountSheetRequest): Promise<CycleCountSheet> {
    await new Promise((res) => setTimeout(res, 200));
    const data = req.requestData;

    const countNumber = this.sheets.length + 1;
    const padded = String(countNumber).padStart(3, "0");
    const sheetNumber = `CC-2026-${padded}`;

    const newSheetId = `cc-sheet-${Date.now()}`;

    // Generate sample items based on selected warehouse/zone
    const sampleItems: CycleCountItem[] = [
      {
        id: `item-${Date.now()}-1`,
        cycleCountId: newSheetId,
        productId: "prod-sample-1",
        sku: "COCA-320",
        productName: "Nước ngọt Coca-Cola Sleek lon 320ml",
        unit: "Lon",
        category: "Beverage",
        binId: "bin-a1-01",
        binCode: data.selectedBinCodes?.[0] || "A1-01-01",
        trackingMode: TrackingMode.None,
        systemQty: 100,
        countedQty: null,
        varianceQty: 0,
        varianceType: "MATCHED",
        isCounted: false,
      },
      {
        id: `item-${Date.now()}-2`,
        cycleCountId: newSheetId,
        productId: "prod-sample-2",
        sku: "SNACK-LAYS-ST",
        productName: "Bánh Snack khoai tây Lay's 95g",
        unit: "Gói",
        category: "Food",
        binId: "bin-a1-02",
        binCode: data.selectedBinCodes?.[1] || "A1-01-02",
        trackingMode: TrackingMode.Lot,
        lotNumber: "LOT-NEW-01",
        expirationDate: "2027-02-15",
        systemQty: 50,
        countedQty: null,
        varianceQty: 0,
        varianceType: "MATCHED",
        isCounted: false,
      },
    ];

    const newSheet: CycleCountSheet = {
      id: newSheetId,
      sheetNumber,
      warehouseId: data.warehouseId,
      warehouseCode: data.warehouseId === "wh-02" ? "WH-HN-02" : "WH-HCM-01",
      warehouseName:
        data.warehouseId === "wh-02"
          ? "Hub Phân Phối Miền Bắc (Hà Nội)"
          : "Tổng kho Trung tâm TP.HCM",
      zoneId: data.zoneId,
      zoneCode: data.zoneId.toUpperCase(),
      zoneName:
        data.zoneId === "zone-c"
          ? "Khu Mát (Zone C - Cool Storage)"
          : data.zoneId === "zone-b"
          ? "Khu Hàng Giá Trị Cao (Zone B - Secure)"
          : "Khu Khô (Zone A - Ambient Dry)",
      binScope: data.binScope,
      selectedBinCodes: data.selectedBinCodes || [],
      status: "Draft",
      createdDate: new Date().toISOString(),
      scheduledDate: data.scheduledDate || new Date().toISOString().slice(0, 10),
      assignedOperator: data.assignedOperator || "Trần Anh Kiện (Staff)",
      notes: data.notes || "",
      items: sampleItems,
      totalSkus: sampleItems.length,
      countedSkus: 0,
      varianceSkus: 0,
    };

    this.sheets.unshift(newSheet);
    this.saveToStorage();
    return JSON.parse(JSON.stringify(newSheet));
  }

  async updateCountEntry(req: UpdateCountEntryRequest): Promise<CycleCountItem> {
    await new Promise((res) => setTimeout(res, 80));
    const { cycleCountId, itemId, countedQty, notes } = req.requestData;
    const sheet = this.sheets.find((s) => s.id === cycleCountId);
    if (!sheet) throw new Error(`Cycle count sheet ${cycleCountId} not found`);

    const item = sheet.items.find((i) => i.id === itemId);
    if (!item) throw new Error(`Item ${itemId} not found in sheet`);

    item.countedQty = Math.max(0, countedQty);
    item.isCounted = true;
    item.countedAt = new Date().toISOString();
    if (notes !== undefined) item.notes = notes;

    this.recalculateSheet(sheet);
    if (sheet.status === "Draft") {
      sheet.status = "Counting";
    }

    this.saveToStorage();
    return JSON.parse(JSON.stringify(item));
  }

  async bulkUpdateCounts(
    cycleCountId: string,
    updates: { itemId: string; countedQty: number; notes?: string }[]
  ): Promise<CycleCountSheet> {
    await new Promise((res) => setTimeout(res, 150));
    const sheet = this.sheets.find((s) => s.id === cycleCountId);
    if (!sheet) throw new Error(`Cycle count sheet ${cycleCountId} not found`);

    updates.forEach((u) => {
      const item = sheet.items.find((i) => i.id === u.itemId);
      if (item) {
        item.countedQty = Math.max(0, u.countedQty);
        item.isCounted = true;
        item.countedAt = new Date().toISOString();
        if (u.notes !== undefined) item.notes = u.notes;
      }
    });

    this.recalculateSheet(sheet);
    if (sheet.status === "Draft") {
      sheet.status = "Counting";
    }

    this.saveToStorage();
    return JSON.parse(JSON.stringify(sheet));
  }

  async startCounting(id: string): Promise<CycleCountSheet> {
    await new Promise((res) => setTimeout(res, 100));
    const sheet = this.sheets.find((s) => s.id === id);
    if (!sheet) throw new Error(`Sheet ${id} not found`);
    if (sheet.status === "Draft") {
      sheet.status = "Counting";
    }
    this.saveToStorage();
    return JSON.parse(JSON.stringify(sheet));
  }

  async submitForReview(id: string): Promise<CycleCountSheet> {
    await new Promise((res) => setTimeout(res, 150));
    const sheet = this.sheets.find((s) => s.id === id);
    if (!sheet) throw new Error(`Sheet ${id} not found`);
    sheet.status = "Review";
    sheet.completedDate = new Date().toISOString();
    this.recalculateSheet(sheet);
    this.saveToStorage();
    return JSON.parse(JSON.stringify(sheet));
  }

  async confirmCycleCount(req: ConfirmCycleCountRequest): Promise<CycleCountSheet> {
    await new Promise((res) => setTimeout(res, 250));
    const { cycleCountId, confirmedBy, reconcileNotes } = req.requestData;
    const sheet = this.sheets.find((s) => s.id === cycleCountId);
    if (!sheet) throw new Error(`Sheet ${cycleCountId} not found`);

    sheet.status = "Confirmed";
    sheet.confirmedDate = new Date().toISOString();
    if (reconcileNotes) {
      sheet.notes = sheet.notes
        ? `${sheet.notes}\n[Đối soát ${new Date().toLocaleDateString()} bởi ${confirmedBy || "Manager"}]: ${reconcileNotes}`
        : `[Đối soát ${new Date().toLocaleDateString()} bởi ${confirmedBy || "Manager"}]: ${reconcileNotes}`;
    }

    this.recalculateSheet(sheet);
    this.saveToStorage();
    return JSON.parse(JSON.stringify(sheet));
  }
}

export const mockCycleCountProvider = new MockCycleCountProvider();
