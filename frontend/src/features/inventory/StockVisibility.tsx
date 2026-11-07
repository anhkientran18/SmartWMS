/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { isDemoMode } from '../../app/dataMode';
import RealStockVisibility from './RealStockVisibility';
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Package,
  Building2,
  MapPin,
  Layers,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Eye,
  Maximize2,
  Gauge,
  WifiOff,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Hash,
  Calendar,
  Grid3X3,
} from "lucide-react";
import {
  inventoryService,
  InventoryItemDetail,
  InventoryStockSummary,
  InventoryStatus,
  TrackingMode,
  normalizeInventoryStatus,
  getInventoryStatusLabel,
  getTrackingModeLabel,
} from "../../services/inventory/inventoryService";
import { warehouseService } from "../../services/locations/warehouseService";
import { zoneService } from "../../services/locations/zoneService";
import { binService } from "../../services/locations/binService";
import { getLocalizedZoneName, getLocalizedWarehouseName } from "../../services/locations/types";
import { StatusBadge } from "../../components/common/StatusBadge";

export interface StockVisibilityProps {
  lang?: string;
  onShowToast?: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    title?: string
  ) => void;
}

export default function StockVisibility({ lang, onShowToast }: StockVisibilityProps) {
  return isDemoMode ? <DemoStockVisibility lang={lang} onShowToast={onShowToast} /> : <RealStockVisibility />;
}

function DemoStockVisibility({ lang, onShowToast }: StockVisibilityProps) {
  const { t, i18n } = useTranslation();
  if (lang && i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }
  const isEn = lang === "en-US" || i18n.language?.startsWith("en");

  // Network State
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // View / Grouping Dimension: product | bin | zone | warehouse
  const [viewDimension, setViewDimension] = useState<"product" | "bin" | "zone" | "warehouse">("product");

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedBinCode, setSelectedBinCode] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedWarehouseId ||
    selectedZoneId ||
    selectedBinCode ||
    selectedStatus !== "all"
  );

  // Selected Item for Detail Drawer
  const [selectedItemForDrawer, setSelectedItemForDrawer] = useState<InventoryItemDetail | null>(null);

  // Fetch Master Data for filter options
  const { data: warehouses = [] } = useQuery({
    queryKey: ["inventory", "filter-warehouses"],
    queryFn: () => warehouseService.getWarehousesList(),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["inventory", "filter-zones", selectedWarehouseId],
    queryFn: () => {
      if (selectedWarehouseId) {
        return zoneService.getZonesByWarehouse(selectedWarehouseId);
      }
      return zoneService.getZonesList();
    },
  });

  const { data: bins = [] } = useQuery({
    queryKey: ["inventory", "filter-bins", selectedZoneId],
    queryFn: () => binService.getBinsList({ zoneId: selectedZoneId || undefined }),
  });

  // Query All Inventory Details
  const {
    data: inventoryData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["inventory", "all-details"],
    queryFn: () => inventoryService.getAllInventoryDetails(isEn),
    staleTime: 60000,
  });

  const rawItems: InventoryItemDetail[] = inventoryData?.items || [];
  const isFromCache = inventoryData?.isFromCache || false;

  // Compute Overall KPI Metrics across all items (Authoritative)
  const overallSummary: InventoryStockSummary = useMemo(() => {
    return inventoryService.computeSummary(rawItems);
  }, [rawItems]);

  // Client-side Filtration
  const filteredItems = useMemo(() => {
    let list = [...rawItems];

    if (selectedWarehouseId) {
      list = list.filter((it) => it.warehouseId === selectedWarehouseId);
    }

    if (selectedZoneId) {
      list = list.filter((it) => it.zoneId === selectedZoneId);
    }

    if (selectedBinCode) {
      list = list.filter((it) => it.binCode.toLowerCase() === selectedBinCode.toLowerCase());
    }

    if (selectedStatus !== "all") {
      const targetNum = Number(selectedStatus);
      list = list.filter((it) => it.status === targetNum);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (it) =>
          it.sku.toLowerCase().includes(q) ||
          it.productName.toLowerCase().includes(q) ||
          it.binCode.toLowerCase().includes(q) ||
          it.zoneName.toLowerCase().includes(q) ||
          it.warehouseName.toLowerCase().includes(q) ||
          (it.lotNumber && it.lotNumber.toLowerCase().includes(q)) ||
          (it.serialNumbers && it.serialNumbers.some((sn) => sn.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [rawItems, selectedWarehouseId, selectedZoneId, selectedBinCode, selectedStatus, searchTerm]);

  // Aggregation by Product / SKU
  const productAggregations = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        sku: string;
        productName: string;
        category: string;
        unit: string;
        trackingMode: TrackingMode;
        totalPhysicalQty: number;
        availableQty: number;
        reservedQty: number;
        qcHoldQty: number;
        damagedQty: number;
        expiredQty: number;
        binsList: { binCode: string; warehouseCode: string; qty: number }[];
        lotsList: Set<string>;
        rawItems: InventoryItemDetail[];
      }
    >();

    filteredItems.forEach((it) => {
      let entry = map.get(it.sku);
      if (!entry) {
        entry = {
          productId: it.productId,
          sku: it.sku,
          productName: it.productName,
          category: it.category || "General",
          unit: it.unit || "Pcs",
          trackingMode: it.trackingMode,
          totalPhysicalQty: 0,
          availableQty: 0,
          reservedQty: 0,
          qcHoldQty: 0,
          damagedQty: 0,
          expiredQty: 0,
          binsList: [],
          lotsList: new Set(),
          rawItems: [],
        };
        map.set(it.sku, entry);
      }

      entry.totalPhysicalQty += it.quantity;
      entry.rawItems.push(it);

      if (it.lotNumber) entry.lotsList.add(it.lotNumber);

      const existingBin = entry.binsList.find((b) => b.binCode === it.binCode);
      if (existingBin) {
        existingBin.qty += it.quantity;
      } else {
        entry.binsList.push({
          binCode: it.binCode,
          warehouseCode: it.warehouseCode,
          qty: it.quantity,
        });
      }

      switch (it.status) {
        case InventoryStatus.Available:
          entry.availableQty += it.quantity;
          break;
        case InventoryStatus.Reserved:
          entry.reservedQty += it.quantity;
          break;
        case InventoryStatus.QCHold:
          entry.qcHoldQty += it.quantity;
          break;
        case InventoryStatus.Damaged:
          entry.damagedQty += it.quantity;
          break;
        case InventoryStatus.Expired:
          entry.expiredQty += it.quantity;
          break;
      }
    });

    return Array.from(map.values());
  }, [filteredItems]);

  // Aggregation by Storage Bin
  const binAggregations = useMemo(() => {
    const map = new Map<
      string,
      {
        binId: string;
        binCode: string;
        warehouseName: string;
        warehouseCode: string;
        zoneName: string;
        zoneCode: string;
        maxCapacity: number;
        currentOccupancy: number;
        utilizationPercentage: number;
        totalPhysicalQty: number;
        availableQty: number;
        reservedQty: number;
        qcHoldQty: number;
        damagedQty: number;
        expiredQty: number;
        items: InventoryItemDetail[];
      }
    >();

    filteredItems.forEach((it) => {
      let entry = map.get(it.binId);
      if (!entry) {
        const maxCap = it.binMaxCapacity || 100;
        const occ = it.binCurrentOccupancy || 0;
        const util = it.binUtilizationPercentage || (maxCap > 0 ? Math.round((occ / maxCap) * 100) : 0);

        entry = {
          binId: it.binId,
          binCode: it.binCode,
          warehouseName: it.warehouseName,
          warehouseCode: it.warehouseCode,
          zoneName: it.zoneName,
          zoneCode: it.zoneCode,
          maxCapacity: maxCap,
          currentOccupancy: occ,
          utilizationPercentage: util,
          totalPhysicalQty: 0,
          availableQty: 0,
          reservedQty: 0,
          qcHoldQty: 0,
          damagedQty: 0,
          expiredQty: 0,
          items: [],
        };
        map.set(it.binId, entry);
      }

      entry.totalPhysicalQty += it.quantity;
      entry.items.push(it);

      switch (it.status) {
        case InventoryStatus.Available:
          entry.availableQty += it.quantity;
          break;
        case InventoryStatus.Reserved:
          entry.reservedQty += it.quantity;
          break;
        case InventoryStatus.QCHold:
          entry.qcHoldQty += it.quantity;
          break;
        case InventoryStatus.Damaged:
          entry.damagedQty += it.quantity;
          break;
        case InventoryStatus.Expired:
          entry.expiredQty += it.quantity;
          break;
      }
    });

    return Array.from(map.values());
  }, [filteredItems]);

  // Aggregation by Zone
  const zoneAggregations = useMemo(() => {
    const map = new Map<
      string,
      {
        zoneId: string;
        zoneName: string;
        zoneCode: string;
        warehouseName: string;
        warehouseCode: string;
        totalPhysicalQty: number;
        availableQty: number;
        reservedQty: number;
        uniqueBins: Set<string>;
        uniqueSkus: Set<string>;
        rawItems: InventoryItemDetail[];
      }
    >();

    filteredItems.forEach((it) => {
      let entry = map.get(it.zoneId);
      if (!entry) {
        entry = {
          zoneId: it.zoneId,
          zoneName: it.zoneName,
          zoneCode: it.zoneCode,
          warehouseName: it.warehouseName,
          warehouseCode: it.warehouseCode,
          totalPhysicalQty: 0,
          availableQty: 0,
          reservedQty: 0,
          uniqueBins: new Set(),
          uniqueSkus: new Set(),
          rawItems: [],
        };
        map.set(it.zoneId, entry);
      }

      entry.totalPhysicalQty += it.quantity;
      entry.uniqueBins.add(it.binId);
      entry.uniqueSkus.add(it.sku);
      entry.rawItems.push(it);

      if (it.status === InventoryStatus.Available) entry.availableQty += it.quantity;
      if (it.status === InventoryStatus.Reserved) entry.reservedQty += it.quantity;
    });

    return Array.from(map.values());
  }, [filteredItems]);

  // Aggregation by Warehouse
  const warehouseAggregations = useMemo(() => {
    const map = new Map<
      string,
      {
        warehouseId: string;
        warehouseName: string;
        warehouseCode: string;
        totalPhysicalQty: number;
        availableQty: number;
        reservedQty: number;
        uniqueZones: Set<string>;
        uniqueBins: Set<string>;
        uniqueSkus: Set<string>;
        rawItems: InventoryItemDetail[];
      }
    >();

    filteredItems.forEach((it) => {
      let entry = map.get(it.warehouseId);
      if (!entry) {
        entry = {
          warehouseId: it.warehouseId,
          warehouseName: it.warehouseName,
          warehouseCode: it.warehouseCode,
          totalPhysicalQty: 0,
          availableQty: 0,
          reservedQty: 0,
          uniqueZones: new Set(),
          uniqueBins: new Set(),
          uniqueSkus: new Set(),
          rawItems: [],
        };
        map.set(it.warehouseId, entry);
      }

      entry.totalPhysicalQty += it.quantity;
      entry.uniqueZones.add(it.zoneId);
      entry.uniqueBins.add(it.binId);
      entry.uniqueSkus.add(it.sku);
      entry.rawItems.push(it);

      if (it.status === InventoryStatus.Available) entry.availableQty += it.quantity;
      if (it.status === InventoryStatus.Reserved) entry.reservedQty += it.quantity;
    });

    return Array.from(map.values());
  }, [filteredItems]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedWarehouseId("");
    setSelectedZoneId("");
    setSelectedBinCode("");
    setSelectedStatus("all");
  };

  // Status Badge Renderer
  const renderStatusBadge = (status: InventoryStatus) => {
    const label = getInventoryStatusLabel(status, isEn);
    switch (status) {
      case InventoryStatus.Available:
        return <StatusBadge variant="green" size="sm" label={label} />;
      case InventoryStatus.Reserved:
        return <StatusBadge variant="blue" size="sm" label={label} />;
      case InventoryStatus.QCHold:
        return <StatusBadge variant="amber" size="sm" label={label} />;
      case InventoryStatus.Damaged:
        return <StatusBadge variant="red" size="sm" label={label} />;
      case InventoryStatus.Expired:
        return <StatusBadge variant="gray" size="sm" label={label} />;
      default:
        return <StatusBadge variant="gray" size="sm" label={label} />;
    }
  };

  // Tracking Mode Badge Renderer
  const renderTrackingBadge = (mode: TrackingMode) => {
    const label = getTrackingModeLabel(mode, isEn);
    switch (mode) {
      case TrackingMode.Serial:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {label}
          </span>
        );
      case TrackingMode.Lot:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            {label}
          </span>
        );
      case TrackingMode.None:
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {label}
          </span>
        );
    }
  };

  return (
    <div className="w-full h-auto flex flex-col p-4 sm:p-6 font-sans animate-fadeIn bg-slate-50 min-h-screen">
      {/* 1. Header Toolbar */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-200">
                <Boxes className="w-5 h-5" strokeWidth={2} />
              </div>
              <span>{t("f0.text.inventoryStockVisibility")}</span>
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {t("f0.text.readOnly")}
            </span>
            {(!isOnline || isFromCache) && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5" />
                <span>{t("f0.text.cachedData")}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {t("f0.text.trackInventoryByProductWarehouseZoneAndBin")}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-9 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
            title={t("f0.text.refreshInventoryData")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
            <span>{t("f0.text.refresh")}</span>
          </button>
        </div>
      </div>

      {/* Offline / Cache Alert Banner */}
      {(!isOnline || isFromCache) && (
        <div className="mb-5 p-3.5 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {!isOnline
                ? t("f0.text.offlineModeShowingCachedInventoryData")
                : t("f0.text.showingCachedInventoryDataContentMayNotBeUp")}
            </span>
          </div>
          <span className="text-[10px] uppercase bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded font-semibold">
            {t("f0.text.cachedData")}
          </span>
        </div>
      )}

      {/* 2. Top Metric KPI Cards (Authoritative physical total & 5 statuses) */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <span className="text-xs text-slate-500 font-normal">
          {t("f0.text.systemWideSummary")}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
        {/* Card 1: Tổng tồn kho vật lý */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-blue-600 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-slate-600 block">
              {t("f0.text.totalPhysicalStock")}
            </span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-bold text-slate-900 tracking-tight">
                {overallSummary.totalPhysicalQty.toLocaleString()}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {t("f0.text.allPhysicalStock")}
            </span>
          </div>
        </div>

        {/* Card 2: Khả dụng */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-emerald-500 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-emerald-700 block">
              {t("f0.text.available")}
            </span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-bold text-emerald-600 tracking-tight">
                {overallSummary.availableQty.toLocaleString()}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {t("f0.text.readyForAllocation")}
            </span>
          </div>
        </div>

        {/* Card 3: Đã giữ */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-indigo-500 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-indigo-700 block">
              {t("f0.text.reserved")}
            </span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-bold text-indigo-600 tracking-tight">
                {overallSummary.reservedQty.toLocaleString()}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {t("f0.text.lockedForOrders")}
            </span>
          </div>
        </div>

        {/* Card 4: Chờ kiểm định */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-amber-500 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-amber-800 block">
              {t("f0.text.qcHold")}
            </span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-bold text-amber-600 tracking-tight">
                {overallSummary.qcHoldQty.toLocaleString()}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {t("f0.text.qualityTesting")}
            </span>
          </div>
        </div>

        {/* Card 5: Hư hỏng */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-rose-500 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-rose-700 block">
              {t("f0.text.damaged")}
            </span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-bold text-rose-600 tracking-tight">
                {overallSummary.damagedQty.toLocaleString()}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {t("f0.text.defectiveGoods")}
            </span>
          </div>
        </div>

        {/* Card 6: Hết hạn */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-slate-400 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-slate-600 block">
              {t("f0.text.expired")}
            </span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-bold text-slate-700 tracking-tight">
                {overallSummary.expiredQty.toLocaleString()}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {t("f0.text.passedExpiryDate")}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Dimension Selector & Integrated Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs mb-6 overflow-hidden">
        {/* Row 1: View Dimension Selector */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-white">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setViewDimension("product")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                viewDimension === "product"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className={`w-3.5 h-3.5 ${viewDimension === "product" ? "text-blue-600" : "text-slate-500"}`} />
              <span>{t("f0.text.byProduct")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-200/80 text-slate-700 font-medium">
                {productAggregations.length}
              </span>
            </button>

            <button
              onClick={() => setViewDimension("bin")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                viewDimension === "bin"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Grid3X3 className={`w-3.5 h-3.5 ${viewDimension === "bin" ? "text-blue-600" : "text-slate-500"}`} />
              <span>{t("f0.text.byBin")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-200/80 text-slate-700 font-medium">
                {binAggregations.length}
              </span>
            </button>

            <button
              onClick={() => setViewDimension("zone")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                viewDimension === "zone"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${viewDimension === "zone" ? "text-blue-600" : "text-slate-500"}`} />
              <span>{t("f0.text.byZone")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-200/80 text-slate-700 font-medium">
                {zoneAggregations.length}
              </span>
            </button>

            <button
              onClick={() => setViewDimension("warehouse")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                viewDimension === "warehouse"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className={`w-3.5 h-3.5 ${viewDimension === "warehouse" ? "text-blue-600" : "text-slate-500"}`} />
              <span>{t("f0.text.byWarehouse")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-200/80 text-slate-700 font-medium">
                {warehouseAggregations.length}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Status Filter Pills Cluster */}
        <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-500 mr-1 select-none whitespace-nowrap">
            {t("f0.text.status2")}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "all", labelVi: "Tất cả trạng thái", labelEn: "All statuses" },
              { id: "1", labelVi: "Khả dụng", labelEn: "Available" },
              { id: "2", labelVi: "Đã giữ", labelEn: "Reserved" },
              { id: "3", labelVi: "Chờ kiểm định", labelEn: "QC hold" },
              { id: "4", labelVi: "Hư hỏng", labelEn: "Damaged" },
              { id: "5", labelVi: "Hết hạn", labelEn: "Expired" },
            ].map((pill) => {
              const isSelected = selectedStatus === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setSelectedStatus(pill.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {isEn ? pill.labelEn : pill.labelVi}
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-Filter Dropdown Bar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("f0.text.searchSkuNameLotBinSerial")}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Warehouse Filter */}
          <div className="relative">
            <select
              value={selectedWarehouseId}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                setSelectedZoneId("");
                setSelectedBinCode("");
              }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none"
            >
              <option value="">{t("f0.text.allWarehouses")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {getLocalizedWarehouseName(w.name, isEn)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 3. Zone Filter */}
          <div className="relative">
            <select
              value={selectedZoneId}
              onChange={(e) => {
                setSelectedZoneId(e.target.value);
                setSelectedBinCode("");
              }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none"
            >
              <option value="">{t("f0.text.allZones")}</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} - {getLocalizedZoneName(z.name, isEn)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 4. Bin Filter */}
          <div className="relative">
            <select
              value={selectedBinCode}
              onChange={(e) => setSelectedBinCode(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none"
            >
              <option value="">{t("f0.text.allBins")}</option>
              {bins.map((b) => (
                <option key={b.id} value={b.code}>
                  {b.code}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 5. Reset Filters (Rendered only when active filters exist) */}
          <div className="flex items-center">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t("f0.text.resetFilters")}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Main Data Table Render (Responsive 1366x768 / 1920x1080 without clipping) */}
        <div className="w-full overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-semibold text-slate-500">
                {t("f0.text.loadingWarehouseInventoryData")}
              </p>
            </div>
          ) : isError ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-sm font-bold text-slate-800">
                {t("f0.text.failedToLoadInventoryRecords")}
              </p>
              <p className="text-xs text-slate-500 max-w-md">
                {(error as any)?.message || (t("f0.text.anUnexpectedErrorOccurred"))}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
              >
                {t("f0.text.retry")}
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-400">
              <Boxes className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-bold text-slate-700">
                {t("f0.text.noInventoryItemsMatchYourCurrentFilters")}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {t("f0.text.tryClearingSearchKeywordsOrChoosingAllWarehouses")}
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                {t("f0.text.clearAllFilters")}
              </button>
            </div>
          ) : viewDimension === "product" ? (
            /* ========================================================= */
            /* TAB 1: GROUPED BY PRODUCT / SKU                           */
            /* ========================================================= */
            <table className="w-full text-left text-xs min-w-[850px] enterprise-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 [&_th]:normal-case [&_th]:tracking-normal">
                <tr style={{ textTransform: "none", letterSpacing: "normal" }}>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>
                    {t("f0.text.skuProduct2")}
                  </th>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>
                    {t("f0.text.tracking")}
                  </th>
                  <th className="py-3 px-4 text-right font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>
                    {t("f0.text.physicalStock")}
                  </th>
                  <th className="py-3 px-4 text-right text-emerald-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>
                    {t("f0.text.available")}
                  </th>
                  <th className="py-3 px-4 text-right text-indigo-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>
                    {t("f0.text.reserved")}
                  </th>
                  <th className="py-3 px-4 text-right text-slate-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>
                    {t("f0.text.qcDamagedExpired")}
                  </th>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>
                    {t("f0.text.binLocations")}
                  </th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>
                    {t("f0.text.details")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productAggregations.map((prod) => (
                  <tr key={prod.sku} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-blue-700 text-xs">{prod.sku}</span>
                        <span className="text-slate-800 font-semibold text-xs mt-0.5">{prod.productName}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {prod.category} • {prod.unit}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{renderTrackingBadge(prod.trackingMode)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      {prod.totalPhysicalQty.toLocaleString()}{" "}
                      <span className="text-[10px] font-normal text-slate-400 font-sans">{prod.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 text-xs">
                      {prod.availableQty.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 text-xs">
                      {prod.reservedQty.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs">
                      <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <span className="text-amber-700 font-semibold" title={t("f0.text.qcHold2")}>
                          QC {prod.qcHoldQty}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-rose-700 font-semibold" title={t("f0.text.damaged")}>
                          {t("f0.text.damaged2")} {prod.damagedQty}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 font-semibold" title={t("f0.text.expired")}>
                          {t("f0.text.expired")} {prod.expiredQty}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-[280px]">
                        {prod.binsList.map((b) => (
                          <span
                            key={b.binCode}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-mono font-semibold text-slate-700 border border-slate-200"
                          >
                            <MapPin className="w-2.5 h-2.5 text-blue-500" />
                            <span>{b.binCode}</span>
                            <span className="text-blue-700 font-bold">({b.qty})</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedItemForDrawer(prod.rawItems[0])}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                        title={t("f0.text.viewStockDetail")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t("f0.text.view")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : viewDimension === "bin" ? (
            /* ========================================================= */
            /* TAB 2: GROUPED BY STORAGE BIN                             */
            /* ========================================================= */
            <table className="w-full text-left text-xs min-w-[850px] enterprise-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 [&_th]:normal-case [&_th]:tracking-normal">
                <tr style={{ textTransform: "none", letterSpacing: "normal" }}>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.binCode")}</th>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.location2")}</th>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.occupancyCapacity")}</th>
                  <th className="py-3 px-4 text-right font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.physicalQty")}</th>
                  <th className="py-3 px-4 text-right text-emerald-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.available")}</th>
                  <th className="py-3 px-4 text-right text-indigo-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.reserved")}</th>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.storedItems")}</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.details")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {binAggregations.map((bin) => (
                  <tr key={bin.binId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-blue-700 text-xs block">{bin.binCode}</span>
                      <span className="text-[10px] text-slate-400 font-sans block">{bin.binId}</span>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-slate-800">{bin.warehouseName}</span>
                        <span className="text-[11px] text-slate-500">{bin.zoneName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex flex-col gap-1 w-32">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-800">
                            {bin.currentOccupancy} / {bin.maxCapacity}
                          </span>
                          <span className="text-slate-500">{bin.utilizationPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              bin.utilizationPercentage >= 95
                                ? "bg-rose-500"
                                : bin.utilizationPercentage >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, bin.utilizationPercentage)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {bin.totalPhysicalQty}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {bin.availableQty}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600">
                      {bin.reservedQty}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-[280px]">
                        {bin.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-200 font-mono"
                          >
                            <span className="font-bold text-blue-700">{it.sku}</span>
                            <span>x{it.quantity}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <button
                        onClick={() => setSelectedItemForDrawer(bin.items[0])}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                        title={t("f0.text.viewBinStockDetails")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t("f0.text.view")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : viewDimension === "zone" ? (
            /* ========================================================= */
            /* TAB 3: GROUPED BY ZONE                                    */
            /* ========================================================= */
            <table className="w-full text-left text-xs min-w-[750px] enterprise-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 [&_th]:normal-case [&_th]:tracking-normal">
                <tr style={{ textTransform: "none", letterSpacing: "normal" }}>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.zoneCode")}</th>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.warehouse")}</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.bins")}</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.distinctSkus")}</th>
                  <th className="py-3 px-4 text-right font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.physicalTotal")}</th>
                  <th className="py-3 px-4 text-right text-emerald-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.available")}</th>
                  <th className="py-3 px-4 text-right text-indigo-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.reserved")}</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {zoneAggregations.map((z) => (
                  <tr key={z.zoneId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 text-xs block">{z.zoneName}</span>
                      <span className="font-mono text-[10px] text-blue-600 mt-0.5 block">{z.zoneCode}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{z.warehouseName}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                      {z.uniqueBins.size} {t("f0.text.bins2")}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-blue-700">
                      {z.uniqueSkus.size} SKUs
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {z.totalPhysicalQty.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {z.availableQty.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600">
                      {z.reservedQty.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedZoneId(z.zoneId);
                          setViewDimension("bin");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Grid3X3 className="w-3.5 h-3.5" />
                        <span>{t("f0.text.viewBins")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* ========================================================= */
            /* TAB 4: GROUPED BY WAREHOUSE                               */
            /* ========================================================= */
            <table className="w-full text-left text-xs min-w-[750px] enterprise-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 [&_th]:normal-case [&_th]:tracking-normal">
                <tr style={{ textTransform: "none", letterSpacing: "normal" }}>
                  <th className="py-3 px-4 font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.warehouse")}</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.zones")}</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.bins")}</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.skus3")}</th>
                  <th className="py-3 px-4 text-right font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.physicalTotal")}</th>
                  <th className="py-3 px-4 text-right text-emerald-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.available")}</th>
                  <th className="py-3 px-4 text-right text-indigo-700 font-semibold normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.reserved")}</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-600 normal-case tracking-normal" style={{ textTransform: "none", letterSpacing: "normal" }}>{t("f0.text.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouseAggregations.map((w) => (
                  <tr key={w.warehouseId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 text-xs block">{w.warehouseName}</span>
                      <span className="font-mono text-[10px] text-blue-600 block mt-0.5">{w.warehouseCode}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                      {w.uniqueZones.size} {t("f0.text.zones2")}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                      {w.uniqueBins.size} {t("f0.text.bins2")}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-blue-700">
                      {w.uniqueSkus.size} SKUs
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {w.totalPhysicalQty.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {w.availableQty.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600">
                      {w.reservedQty.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedWarehouseId(w.warehouseId);
                          setViewDimension("zone");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{t("f0.text.viewZones")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. SLIDE-OVER DRAWER: STOCK DETAIL VIEW (READ ONLY)       */}
      {/* ========================================================= */}
      {selectedItemForDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
                    <span className="font-mono text-blue-400">{selectedItemForDrawer.sku}</span>
                    <span>•</span>
                    <span className="truncate">{selectedItemForDrawer.productName}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t("f0.text.inventoryDetails")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemForDrawer(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Read Only Notice Badge */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="font-medium text-xs">
                    {t("f0.text.readOnlyStockVisibility")}
                  </span>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {t("f0.text.readOnly")}
                </span>
              </div>

              {/* Status & Tracking Mode Snapshot */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">
                    {t("f0.text.inventoryStatus")}
                  </span>
                  <div className="mt-1">{renderStatusBadge(selectedItemForDrawer.status)}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium block">
                    {t("f0.text.trackingMode")}
                  </span>
                  <div className="mt-1">{renderTrackingBadge(selectedItemForDrawer.trackingMode)}</div>
                </div>
              </div>

              {/* Location Hierarchy */}
              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t("f0.text.storageLocationHierarchy")}</span>
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("f0.text.warehouse")}:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedItemForDrawer.warehouseCode} - {selectedItemForDrawer.warehouseName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("f0.text.zone")}:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedItemForDrawer.zoneCode} - {selectedItemForDrawer.zoneName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("f0.text.binCode2")}:</span>
                    <span className="font-mono font-bold text-blue-700 text-sm">{selectedItemForDrawer.binCode}</span>
                  </div>
                  {selectedItemForDrawer.binMaxCapacity !== undefined && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">{t("f0.text.binCapacityOccupancy")}:</span>
                      <span className="font-medium text-slate-800">
                        {selectedItemForDrawer.binCurrentOccupancy} / {selectedItemForDrawer.binMaxCapacity}{" "}
                        {t("f0.text.pcs")} ({selectedItemForDrawer.binUtilizationPercentage}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lot & Expiration Details */}
              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t("f0.text.lotExpirationDetails")}</span>
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("f0.text.lotNumber")}:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedItemForDrawer.lotNumber || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("f0.text.expirationDate")}:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedItemForDrawer.expirationDate || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("f0.text.physicalQuantity")}:</span>
                    <span className="font-mono font-bold text-blue-700 text-sm">
                      {selectedItemForDrawer.quantity} {selectedItemForDrawer.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Serial Numbers (Read Only display when TrackingMode == Serial) */}
              {selectedItemForDrawer.serialNumbers && selectedItemForDrawer.serialNumbers.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t("f0.text.assignedSerialNumbers")}</span>
                  </h4>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 flex-wrap font-mono">
                    {selectedItemForDrawer.serialNumbers.map((sn, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded bg-white text-blue-700 border border-blue-200 font-semibold text-[11px]"
                      >
                        {sn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                onClick={() => setSelectedItemForDrawer(null)}
                className="h-9 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition cursor-pointer"
              >
                {t("f0.text.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
