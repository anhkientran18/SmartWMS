/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlertTriangle,
  MapPin,
  Store,
  Package,
  Layers,
  Eye,
  Zap,
  Check,
  Info,
  ArrowRight
} from "lucide-react";
import { Bin, Product, WarehouseZone } from "../../types/index";

export interface CounterReplenishmentProps {
  bins: Bin[];
  products: Product[];
  zones?: WarehouseZone[];
  onUpdateBinQty?: (
    binCode: string,
    sku: string,
    qty: number,
    action: "ADD" | "SUBTRACT"
  ) => Promise<void> | void;
  onRefreshData?: () => void;
  lang?: string;
}

export interface CounterStockItem {
  id: string;
  sku: string;
  productName: string;
  category: string;
  unit: string;
  counterBin: string;
  counterName: string;
  currentQty: number;
  minThreshold: number;
  maxCapacity: number;
  burnRateTextVi?: string;
  burnRateTextEn?: string;
  burnRateVelocity?: number;
  minutesUntilEmpty?: number;
  reserveBin: string;
  reserveZone: string;
  reserveQty: number;
  reserveLot: string;
  reserveExpDate: string;
  status: "out_of_stock" | "low_stock" | "normal";
}

export interface FastRoutingTask {
  id: string;
  sku: string;
  productName: string;
  unit: string;
  fromBin: string;
  fromZone: string;
  toBin: string;
  toCounterName: string;
  qtyToPick: number;
  lotNumber: string;
  expirationDate: string;
  urgency: "CRITICAL" | "HIGH" | "NORMAL";
  estimatedMinutes: number;
  burnRate: string;
  status: "pending" | "in_transit" | "completed";
  createdAt: string;
}

export default function CounterReplenishment({
  bins = [],
  products = [],
  zones = [],
  onUpdateBinQty,
  onRefreshData,
  lang = "vi-VN",
}: CounterReplenishmentProps) {
  const { t } = useTranslation();
  const isEn = lang === "en-US";

  // Identify retail counter bins in Zone S (POS-Q01, POS-Q02) and reserve bins
  const pos1Bin = bins.find((b) => b.code === "POS-Q01");
  const pos2Bin = bins.find((b) => b.code === "POS-Q02");

  const reserveCocaBin =
    bins.find(
      (b) =>
        b.storedSkus.some((s) => s.sku === "COCA-320" && s.qty > 0) &&
        b.code !== "POS-Q01" &&
        b.code !== "POS-Q02"
    ) || bins.find((b) => b.code === "D2-A02-N01");

  const reserveNoodleBin =
    bins.find(
      (b) =>
        b.storedSkus.some((s) => s.sku === "NOODLE-HH" && s.qty > 0) &&
        b.code !== "POS-Q01" &&
        b.code !== "POS-Q02"
    ) || bins.find((b) => b.code === "D2-A02-N01");

  const reserveMilkBin =
    bins.find(
      (b) =>
        b.storedSkus.some((s) => s.sku === "MILK-VNM" && s.qty > 0) &&
        b.code !== "POS-Q01" &&
        b.code !== "POS-Q02"
    ) || bins.find((b) => b.code === "C1-A01-N02");

  // Read current quantities from POS bins (fallback to 0)
  const cocaInPos1 = pos1Bin?.storedSkus.find((s) => s.sku === "COCA-320")?.qty ?? 0;
  const noodleInPos1 = pos1Bin?.storedSkus.find((s) => s.sku === "NOODLE-HH")?.qty ?? 0;
  const milkInPos2 = pos2Bin?.storedSkus.find((s) => s.sku === "MILK-VNM")?.qty ?? 0;

  const reserveCocaQty = reserveCocaBin?.storedSkus.find((s) => s.sku === "COCA-320")?.qty ?? 0;
  const reserveNoodleQty = reserveNoodleBin?.storedSkus.find((s) => s.sku === "NOODLE-HH")?.qty ?? 0;
  const reserveMilkQty = reserveMilkBin?.storedSkus.find((s) => s.sku === "MILK-VNM")?.qty ?? 0;

  const cocaReserveItem = reserveCocaBin?.storedSkus.find((s) => s.sku === "COCA-320");
  const noodleReserveItem = reserveNoodleBin?.storedSkus.find((s) => s.sku === "NOODLE-HH");
  const milkReserveItem = reserveMilkBin?.storedSkus.find((s) => s.sku === "MILK-VNM");

  // Helper to format clean, single-language zone names without mixed-language labels
  const formatLocalizedZoneName = (rawName?: string, zoneId?: string, binCode?: string) => {
    const text = (rawName || "").toLowerCase();
    const id = (zoneId || "").toLowerCase();
    const code = (binCode || "").toUpperCase();

    if (
      id === "z1" ||
      id.includes("cold") ||
      id.includes("cool") ||
      code.startsWith("C") ||
      text.includes("cool") ||
      text.includes("mát")
    ) {
      return t("f0.text.coolZoneZoneC2");
    }
    if (
      id === "z2" ||
      id.includes("dry") ||
      code.startsWith("D") ||
      text.includes("dry") ||
      text.includes("khô")
    ) {
      return t("f0.text.dryZoneZoneD2");
    }
    if (
      id === "z-store" ||
      id.includes("store") ||
      id.includes("pos") ||
      code.startsWith("POS") ||
      text.includes("counter") ||
      text.includes("quầy")
    ) {
      return t("f0.text.retailCounterZoneS");
    }

    if (!isEn && rawName && rawName.includes(" - ")) {
      return rawName.split(" - ")[0].trim();
    }
    return rawName || (t("f0.text.storageZone"));
  };

  // Helper to accurately lookup storage zone name from zones array
  const getZoneNameForBin = (binCode: string) => {
    const bin = bins.find((b) => b.code === binCode);
    const zone = bin ? zones.find((z) => z.id === bin.zoneId) : undefined;
    let raw = "";
    if (zone) {
      if (typeof zone.name === "object") {
        raw = isEn ? zone.name.en || zone.name.vi : zone.name.vi || zone.name.en;
      } else {
        raw = zone.name || "";
      }
    }
    return formatLocalizedZoneName(raw, bin?.zoneId, binCode);
  };

  // Base triage items on the counter shelves
  const counterItems: CounterStockItem[] = useMemo(() => {
    return [
      {
        id: "cnt-coca",
        sku: "COCA-320",
        productName: t("f0.text.cocaColaSleekCan320mlTrayX24"),
        category: t("f0.text.beverage"),
        unit: t("f0.text.tray"),
        counterBin: "POS-Q01",
        counterName: t("f0.text.cashierShelf1FrontStore"),
        currentQty: cocaInPos1,
        minThreshold: 25,
        maxCapacity: 50,
        reserveBin: reserveCocaBin?.code || "—",
        reserveZone: reserveCocaBin?.code ? getZoneNameForBin(reserveCocaBin.code) : "—",
        reserveQty: reserveCocaQty,
        reserveLot: cocaReserveItem?.lotNumber || "—",
        reserveExpDate: cocaReserveItem?.expirationDate || "—",
        status: cocaInPos1 <= 0 ? "out_of_stock" : cocaInPos1 < 25 ? "low_stock" : "normal",
      },
      {
        id: "cnt-noodle",
        sku: "NOODLE-HH",
        productName: t("f0.text.haoHaoInstantNoodlesSourSpicyX30"),
        category: t("f0.text.food"),
        unit: t("f0.text.box"),
        counterBin: "POS-Q01",
        counterName: t("f0.text.cashierShelf1FrontStore"),
        currentQty: noodleInPos1,
        minThreshold: 20,
        maxCapacity: 40,
        reserveBin: reserveNoodleBin?.code || "—",
        reserveZone: reserveNoodleBin?.code ? getZoneNameForBin(reserveNoodleBin.code) : "—",
        reserveQty: reserveNoodleQty,
        reserveLot: noodleReserveItem?.lotNumber || "—",
        reserveExpDate: noodleReserveItem?.expirationDate || "—",
        status: noodleInPos1 <= 0 ? "out_of_stock" : noodleInPos1 < 20 ? "low_stock" : "normal",
      },
      {
        id: "cnt-milk",
        sku: "MILK-VNM",
        productName: t("f0.text.vinamilkMilkCarton180mlX48"),
        category: t("f0.text.dairy"),
        unit: t("f0.text.carton"),
        counterBin: "POS-Q02",
        counterName: t("f0.text.retailShelf2CoolStoreArea"),
        currentQty: milkInPos2,
        minThreshold: 30,
        maxCapacity: 60,
        reserveBin: reserveMilkBin?.code || "—",
        reserveZone: reserveMilkBin?.code ? getZoneNameForBin(reserveMilkBin.code) : "—",
        reserveQty: reserveMilkQty,
        reserveLot: milkReserveItem?.lotNumber || "—",
        reserveExpDate: milkReserveItem?.expirationDate || "—",
        status: milkInPos2 <= 0 ? "out_of_stock" : milkInPos2 < 30 ? "low_stock" : "normal",
      },
    ];
  }, [
    cocaInPos1,
    noodleInPos1,
    milkInPos2,
    reserveCocaQty,
    reserveNoodleQty,
    reserveMilkQty,
    reserveCocaBin,
    reserveNoodleBin,
    reserveMilkBin,
    cocaReserveItem,
    noodleReserveItem,
    milkReserveItem,
    zones,
    isEn,
  ]);

  // Tasks state initialized to empty (no fake default tasks)
  const [tasks] = useState<FastRoutingTask[]>([]);

  // Selected item for the recommendation panel
  const [selectedItemId, setSelectedItemId] = useState<string>("cnt-coca");
  const [filterTab, setFilterTab] = useState<"ALL" | "OUT_OF_STOCK" | "LOW_STOCK">("ALL");

  const selectedItem = counterItems.find((i) => i.id === selectedItemId) || counterItems[0];

  // Exact KPI Calculations (no || 1, || 2 fallbacks)
  const criticalCount = counterItems.filter((i) => i.status === "out_of_stock").length;
  const warningCount = counterItems.filter((i) => i.status === "low_stock").length;

  const displayedCounterItems = useMemo(() => {
    if (filterTab === "OUT_OF_STOCK") {
      return counterItems.filter((i) => i.status === "out_of_stock");
    }
    if (filterTab === "LOW_STOCK") {
      return counterItems.filter((i) => i.status === "low_stock");
    }
    return counterItems;
  }, [counterItems, filterTab]);

  const shortageQty = selectedItem
    ? Math.max(0, selectedItem.maxCapacity - selectedItem.currentQty)
    : 0;
  const sourceAvailableQty = selectedItem?.reserveQty ?? 0;
  const canReplenish = Math.min(shortageQty, sourceAvailableQty);
  const remainingShortage = shortageQty - canReplenish;

  return (
    <div className="flex flex-col gap-6 font-sans h-full overflow-y-auto animate-fadeIn bg-slate-50 p-4 sm:p-6">
      {/* =========================================================================
          TOP HEADER & GLOBAL CTA (Read-only / Prototype State)
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">
              {t("f0.text.counterReplenishment")}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <Store className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.5} />
              {t("f0.text.zoneSRetailCheckoutCounters")}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-normal">
            {t("f0.text.monitorRetailCounterStockLevelsAndPrepareReplenishmentRecommendations")}
          </p>
        </div>

        {/* Primary Action Button (Disabled with tooltip) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={true}
            title={
              t("f0.text.awaitingAutoreplenishmentBackendContractStabilization")
            }
            className="bg-slate-100 text-slate-400 border border-slate-200 font-medium text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs cursor-not-allowed"
          >
            <Zap className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {t("f0.text.autoReplenishmentComingSoon")}
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2 THẺ CHỈ SỐ KPI (KPI STAT CARDS - Maximum 2 cards, No fake counts)
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Card 1: HẾT HÀNG */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 tracking-wider">
              {t("f0.text.outOfStock")}
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-[22px] font-bold font-mono text-[#DC2626] leading-none">
              {criticalCount} {t("f0.text.skus2")}
            </span>
          </div>
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
              {t("f0.text.stock0")}
            </span>
          </div>
        </div>

        {/* Card 2: CẢNH BÁO THIẾU HÀNG */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 tracking-wider">
              {t("f0.text.lowStock2")}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-[22px] font-bold font-mono text-[#D97706] leading-none">
              {warningCount} {t("f0.text.skus2")}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-normal">
              {t("f0.text.stockMinSafetyStock")}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PHÂN TẦNG: BẢNG TỒN KHO TẠI QUẦY (60%) + ĐỀ XUẤT BỔ SUNG HÀNG (40%)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =====================================================================
            BẢNG GIÁM SÁT TỒN KHO TẠI QUẦY (4 Cột cốt lõi, không overflow ngang trên desktop)
        ===================================================================== */}
        <div className="lg:col-span-7 flex flex-col bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header Card & Bộ Lọc Nhanh */}
          <div className="p-4 sm:p-5 bg-white border-b border-slate-200/80 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Store className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                <h2 className="font-bold text-slate-900 text-sm tracking-tight">
                  {t("f0.text.counterInventory")}
                </h2>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {counterItems.length} {t("f0.text.items")}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5">
              <p className="text-xs text-slate-500 font-normal">
                {t("f0.text.monitorItemsAtPosQ01AndPosQ02That")}
              </p>

              {/* Quick Tab Filter */}
              <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterTab("ALL")}
                  className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                    filterTab === "ALL"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                >
                  <span>{t("f0.text.all")}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      filterTab === "ALL"
                        ? "bg-slate-100 text-slate-800 font-bold"
                        : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {counterItems.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterTab("OUT_OF_STOCK")}
                  className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                    filterTab === "OUT_OF_STOCK"
                      ? "bg-white text-red-700 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-red-700 font-medium"
                  }`}
                >
                  <span>{t("f0.text.outOfStock")}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-bold">
                    {criticalCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterTab("LOW_STOCK")}
                  className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                    filterTab === "LOW_STOCK"
                      ? "bg-white text-amber-700 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-amber-700 font-medium"
                  }`}
                >
                  <span>{t("f0.text.lowStock3")}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
                    {warningCount}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-fixed">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[24%]" />
                <col className="w-[28%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-[#F1F5F9] border-b border-slate-200 text-[11px] font-semibold text-[#64748B]">
                <tr>
                  <th className="px-3.5 py-2.5">{t("f0.text.skuProduct")}</th>
                  <th className="px-3 py-2.5">{t("f0.text.counterBin")}</th>
                  <th className="px-3 py-2.5 text-center">{t("f0.text.counterStockThreshold")}</th>
                  <th className="px-3.5 py-2.5 text-center sm:text-left">{t("f0.text.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCounterItems.map((item) => {
                  const fillPercent = Math.min(100, Math.round((item.currentQty / item.maxCapacity) * 100));
                  const isOutOfStock = item.status === "out_of_stock";
                  const isLow = item.status === "low_stock";
                  const isSelected = selectedItemId === item.id;

                  const gaugeColor =
                    fillPercent <= 10
                      ? "bg-red-500"
                      : fillPercent <= 35
                      ? "bg-amber-500"
                      : "bg-emerald-500";

                  const textColor =
                    fillPercent <= 10
                      ? "text-red-600 font-bold"
                      : fillPercent <= 35
                      ? "text-amber-600 font-bold"
                      : "text-emerald-600 font-bold";

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`cursor-pointer transition-all border-l-[3px] ${
                        isSelected
                          ? "border-l-blue-600 bg-[#EFF6FF]"
                          : "border-l-transparent hover:bg-slate-50/70"
                      }`}
                    >
                      {/* Cột 1: SKU / Sản phẩm */}
                      <td className="px-3.5 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 whitespace-nowrap">
                              {item.sku}
                            </span>
                            <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 font-medium whitespace-nowrap">
                              {item.category}
                            </span>
                          </div>
                          <span
                            className="text-xs sm:text-[13px] font-medium text-slate-900 line-clamp-2 leading-snug break-words"
                            title={item.productName}
                          >
                            {item.productName}
                          </span>
                        </div>
                      </td>

                      {/* Cột 2: Vị trí quầy */}
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/90 w-fit whitespace-nowrap">
                            {item.counterBin}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-1 leading-snug break-words">
                            {item.counterName}
                          </span>
                        </div>
                      </td>

                      {/* Cột 3: Tồn quầy / Ngưỡng */}
                      <td className="px-3 py-3 text-center align-top">
                        <div className="flex flex-col items-center">
                          <span className={`font-mono text-xs whitespace-nowrap ${textColor}`}>
                            {item.currentQty} / {item.maxCapacity} {item.unit}{" "}
                            <span className="font-semibold text-slate-500">({fillPercent}%)</span>
                          </span>
                          <div className="w-full max-w-[100px] bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden border border-slate-200/80">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${gaugeColor}`}
                              style={{ width: `${fillPercent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal mt-1 whitespace-nowrap">
                            {t("f0.text.safetyMin")} {item.minThreshold}
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Trạng thái */}
                      <td className="px-3.5 py-3 align-top text-center sm:text-left">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                            {t("f0.text.outOfStock")}
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                            {t("f0.text.lowStock3")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                            {t("f0.text.adequate")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Bảng */}
          <div className="p-3 bg-slate-50/70 border-t border-slate-200/80 text-[11px] text-slate-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-slate-500 font-normal">
              <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
              <span>
                {t("f0.text.selectAProductRowToViewTheReplenishmentRecommendation")}
              </span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {isEn
                ? `Showing ${displayedCounterItems.length} of ${counterItems.length} items`
                : `Hiển thị ${displayedCounterItems.length} trong tổng số ${counterItems.length} mặt hàng`}
            </span>
          </div>
        </div>

        {/* =====================================================================
            ĐỀ XUẤT BỔ SUNG HÀNG (Replenishment Recommendation Panel)
        ===================================================================== */}
        <div className="lg:col-span-5 flex flex-col bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header Panel */}
          <div className="p-4 sm:p-5 bg-white border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm tracking-tight">
                  {t("f0.text.replenishmentRecommendation")}
                </h2>
                <p className="text-xs text-slate-500 font-normal">
                  {t("f0.text.detailsOfSourceStockAndTargetCounterToReplenish")}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Card sản phẩm đang chọn */}
            {selectedItem && (
              <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                      {selectedItem.sku}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center ${
                        selectedItem.status === "out_of_stock"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : selectedItem.status === "low_stock"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {selectedItem.status === "out_of_stock"
                        ? t("f0.text.outOfStock")
                        : selectedItem.status === "low_stock"
                        ? t("f0.text.lowStock2")
                        : t("f0.text.adequate2")}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-sm leading-snug">
                  {selectedItem.productName}
                </h3>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/70">
                  <span className="text-slate-500 font-normal">
                    {t("f0.text.currentAtCounter")}{" "}
                    <strong className="text-slate-900 font-mono font-bold">
                      {selectedItem.currentQty} / {selectedItem.maxCapacity} {selectedItem.unit}
                    </strong>
                  </span>
                  <span className="text-slate-600 font-normal text-xs">
                    {t("f0.text.replenishmentDemand")}{" "}
                    <strong className="text-slate-800 font-mono font-bold">
                      {shortageQty} {selectedItem.unit}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            {/* Structured Recommendation Information */}
            <div className="space-y-3 pt-1">
              {/* Mục 1: Vị trí quầy đích */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 tracking-wider">
                    {t("f0.text.destinationCounter")}
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/90">
                    {selectedItem.counterBin}
                  </span>
                </div>
                <p className="text-xs text-slate-800 leading-snug">
                  {selectedItem.counterName}
                </p>
                <div className="flex items-center justify-between text-xs font-normal text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>{t("f0.text.capacity")} {selectedItem.maxCapacity} {selectedItem.unit}</span>
                  <span>{t("f0.text.minSafety")} {selectedItem.minThreshold} {selectedItem.unit}</span>
                </div>
              </div>

              {/* Mục 2: Vị trí nguồn lưu trữ */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 tracking-wider">
                    {t("f0.text.sourceReserveStorage")}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {selectedItem.reserveBin}
                  </span>
                </div>
                <p className="text-xs text-slate-800 leading-snug">
                  {selectedItem.reserveZone}
                </p>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    {t("f0.text.availableInReserve")}{" "}
                    <strong className="text-emerald-700 font-mono font-bold">
                      {selectedItem.reserveQty} {selectedItem.unit}
                    </strong>
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                    <span>{t("f0.text.lot")} {selectedItem.reserveLot}</span>
                    <span>•</span>
                    <span>{t("f0.text.exp")} {selectedItem.reserveExpDate}</span>
                  </div>
                </div>
              </div>

              {/* Mục 3: Đề xuất số lượng bổ sung */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 tracking-wider">
                    {t("f0.text.replenishmentRecommendation2")}
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {canReplenish} {selectedItem.unit}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {/* Nhu cầu bổ sung */}
                  <div className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-slate-600 font-medium">
                      {t("f0.text.replenishmentDemand")}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {shortageQty} {selectedItem.unit}
                    </span>
                  </div>

                  {/* Có thể bổ sung từ nguồn này */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-blue-50/70 border border-blue-200/80">
                    <span className="text-blue-900 font-semibold text-xs">
                      {t("f0.text.canReplenishFromThisSource")}
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                      {canReplenish} {selectedItem.unit}
                    </span>
                  </div>

                  {/* Còn thiếu (chỉ render khi sourceAvailableQty < shortageQty) */}
                  {sourceAvailableQty < shortageQty && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-50/80 border border-amber-200/80">
                      <span className="text-amber-900 font-semibold text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" strokeWidth={2} />
                        <span>{t("f0.text.remainingShortage")}</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200 shadow-2xs">
                        {remainingShortage} {selectedItem.unit}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-snug pt-1 border-t border-slate-200/60">
                  {t("f0.text.safeReplenishmentCalculatedBasedOnCurrentAvailableStockAt")}
                </p>
              </div>
            </div>

            {/* Nút Xác Nhận Disabled & Chân Panel */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                disabled={true}
                className="w-full bg-slate-100 text-slate-400 border border-slate-200 font-medium text-xs sm:text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed shadow-2xs"
              >
                <Check className="w-4 h-4 text-slate-400" />
                <span>
                  {t("f0.text.confirmReplenishmentNotAvailable")}
                </span>
              </button>

              <div className="text-center pt-0.5">
                <p className="text-[11px] text-slate-500 font-normal">
                  {t("f0.text.thisFeatureWillBeEnabledOnceTheAutoreplenishmentBackend")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
