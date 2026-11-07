/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { warehouseService } from "../locations/warehouseService";
import { isDemoMode } from '../../app/dataMode';
import { normalizeApiError } from '../api/httpClient';
import { zoneService } from "../locations/zoneService";
import { binService } from "../locations/binService";
import { productService } from "../productService";
import {
  InventoryItemDetail,
  InventoryStockSummary,
  InventoryStatus,
  TrackingMode,
  normalizeInventoryStatus,
  getInventoryStatusLabel,
} from "./types";

const CACHE_KEY = "smartwms_cached_inventory_v1";

export const inventoryService = {
  /**
   * Retrieves all inventory details with complete warehouse/zone/bin/product join
   * Read-only, offline-first with persistent local cache.
   */
  async getAllInventoryDetails(isEn = false): Promise<{
    items: InventoryItemDetail[];
    isFromCache: boolean;
  }> {
    // This inherited aggregator is demo-only; real reads use inventoryReadApi.
    if (!isDemoMode) throw normalizeApiError(502, { code: 'FE_DEMO_INVENTORY_DISABLED' });
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    if (!isOnline) {
      const cached = this.getCachedInventory();
      if (cached && cached.length > 0) {
        return { items: cached, isFromCache: true };
      }
    }

    try {
      const [warehouses, zones, bins, products] = await Promise.all([
        warehouseService.getWarehousesList(),
        zoneService.getZonesList(),
        binService.getBinsList(),
        productService.getProductsList(),
      ]);

      const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
      const zoneMap = new Map(zones.map((z) => [z.id, z]));
      const productMap = new Map(products.map((p) => [p.id, p]));
      const productSkuMap = new Map(products.map((p) => [p.sku.toUpperCase(), p]));

      // Query contents for bins that have currentOccupancy > 0
      const populatedBins = bins.filter((b) => (b.currentOccupancy || 0) > 0);

      const binContentsList = await Promise.all(
        populatedBins.map(async (bin) => {
          try {
            return await binService.getBinContents(bin.id);
          } catch (err) {
            console.warn(`Failed to fetch contents for bin ${bin.code}`, err);
            return null;
          }
        })
      );

      const items: InventoryItemDetail[] = [];

      binContentsList.forEach((binContent) => {
        if (!binContent || !binContent.items || binContent.items.length === 0) return;

        const binDto = bins.find((b) => b.id === binContent.binId);
        const zoneDto = binDto ? zoneMap.get(binDto.zoneId) : undefined;
        const warehouseDto = zoneDto ? warehouseMap.get(zoneDto.warehouseId) : undefined;

        binContent.items.forEach((it, idx) => {
          const matchedProd =
            productMap.get(it.productId) ||
            productSkuMap.get(it.sku.toUpperCase());

          const statusEnum = normalizeInventoryStatus(it.status);

          let trackingModeEnum = TrackingMode.None;
          if (it.trackingMode !== undefined && it.trackingMode !== null) {
            trackingModeEnum = it.trackingMode as TrackingMode;
          } else if (it.serialNumbers && it.serialNumbers.length > 0) {
            trackingModeEnum = TrackingMode.Serial;
          } else if (it.lotNumber && it.lotNumber.trim() !== "" && it.lotNumber !== "—") {
            trackingModeEnum = TrackingMode.Lot;
          }

          const rowId = `inv-${binContent.binId}-${it.sku}-${it.lotNumber || "nolot"}-${statusEnum}-${idx}`;

          items.push({
            id: rowId,
            productId: it.productId || matchedProd?.id || `p-${it.sku}`,
            sku: it.sku || matchedProd?.sku || "UNKNOWN-SKU",
            productName: it.productName || matchedProd?.name || it.sku,
            category: (matchedProd as any)?.category || "General",
            unit: matchedProd?.unit || "Pcs",
            warehouseId: warehouseDto?.id || "WH-DEFAULT",
            warehouseCode: warehouseDto?.code || "WH-01",
            warehouseName: warehouseDto?.name || "Kho Tổng",
            zoneId: zoneDto?.id || "ZONE-DEFAULT",
            zoneCode: zoneDto?.code || "ZONE-MAIN",
            zoneName: zoneDto?.name || "Khu Vực Lưu Trữ",
            binId: binContent.binId,
            binCode: binContent.binCode,
            binMaxCapacity: binContent.maxCapacity,
            binCurrentOccupancy: binContent.currentOccupancy,
            binUtilizationPercentage: binContent.utilizationPercentage,
            lotNumber: it.lotNumber || undefined,
            expirationDate: it.expirationDate || undefined,
            trackingMode: trackingModeEnum,
            serialNumbers: it.serialNumbers,
            status: statusEnum,
            statusLabelVi: getInventoryStatusLabel(statusEnum, false),
            statusLabelEn: getInventoryStatusLabel(statusEnum, true),
            quantity: Number(it.quantity) || 0,
          });
        });
      });

      // Save to local cache for offline resiliency
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(items));
      } catch (err) {
        console.warn("Could not save inventory to localStorage cache", err);
      }

      return { items, isFromCache: false };
    } catch (err) {
      console.warn("Online inventory fetch failed, attempting cache fallback", err);
      const cached = this.getCachedInventory();
      if (cached && cached.length > 0) {
        return { items: cached, isFromCache: true };
      }
      throw err;
    }
  },

  /**
   * Helper to retrieve cached items from localStorage
   */
  getCachedInventory(): InventoryItemDetail[] | null {
    if (!isDemoMode) return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Failed reading cached inventory from localStorage", e);
    }
    return null;
  },

  /**
   * Computes stock summary metrics.
   * totalPhysicalQty is the physical quantity across all 5 statuses.
   * NEVER label totalPhysicalQty as ATP / Available Stock.
   */
  computeSummary(items: InventoryItemDetail[]): InventoryStockSummary {
    let totalPhysical = 0;
    let available = 0;
    let reserved = 0;
    let qcHold = 0;
    let damaged = 0;
    let expired = 0;

    const uniqueSkus = new Set<string>();
    const uniqueBins = new Set<string>();

    items.forEach((item) => {
      const q = item.quantity || 0;
      totalPhysical += q;
      uniqueSkus.add(item.sku);
      uniqueBins.add(item.binId);

      switch (item.status) {
        case InventoryStatus.Available:
          available += q;
          break;
        case InventoryStatus.Reserved:
          reserved += q;
          break;
        case InventoryStatus.QCHold:
          qcHold += q;
          break;
        case InventoryStatus.Damaged:
          damaged += q;
          break;
        case InventoryStatus.Expired:
          expired += q;
          break;
        default:
          available += q;
          break;
      }
    });

    return {
      totalPhysicalQty: totalPhysical,
      availableQty: available,
      reservedQty: reserved,
      qcHoldQty: qcHold,
      damagedQty: damaged,
      expiredQty: expired,
      totalSkus: uniqueSkus.size,
      totalBins: uniqueBins.size,
    };
  },
};

export * from "./types";
