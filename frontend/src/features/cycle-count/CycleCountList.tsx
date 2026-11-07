/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Building2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCheck2,
  Wifi,
  WifiOff,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Eye,
  Edit3,
  Play,
} from "lucide-react";
import {
  CycleCountSheet,
  CycleCountKPIs,
  CycleCountStatus,
} from "../../services/cycleCount/types";
import PaginationFooter from "../../components/common/PaginationFooter";

const getStatusLabel = (status: CycleCountStatus | string, isEn: boolean): string => {
  switch (status) {
    case "Draft":
      return isEn ? "Draft" : "Nháp";
    case "Counting":
      return isEn ? "Counting" : "Đang kiểm đếm";
    case "Review":
      return isEn ? "Review" : "Chờ xem xét";
    case "Confirmed":
      return isEn ? "Confirmed" : "Đã xác nhận";
    default:
      return status;
  }
};

const formatZoneDisplayName = (
  rawZoneName: string,
  zoneCode?: string,
  isEn?: boolean
): string => {
  if (!rawZoneName) return isEn ? "All Zones" : "Toàn bộ phân khu";

  // Check common patterns like:
  // "Khu Khô (Zone A - Ambient Dry)" -> VI: "Khu khô (Zone A)", EN: "Ambient Dry (Zone A)"
  // "Khu Mát (Zone C - Cool Storage)" -> VI: "Khu mát (Zone C)", EN: "Cool Storage (Zone C)"
  // "Khu Hàng Giá Trị Cao (Zone B - Secure)" -> VI: "Khu hàng giá trị cao (Zone B)", EN: "Secure (Zone B)"
  const match = rawZoneName.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (match) {
    const viMain = match[1].trim();
    const inside = match[2].trim();

    const parts = inside.split("-");
    const codePart = parts[0].trim();
    const enDesc = parts[1] ? parts[1].trim() : "";

    const codeMatch = codePart.match(/Zone\s+[A-Z0-9]+/i);
    const extractedCode = codeMatch ? codeMatch[0] : (zoneCode || codePart);

    if (isEn) {
      if (enDesc && extractedCode) {
        return `${enDesc} (${extractedCode})`;
      }
      if (viMain.toLowerCase().includes("khô")) return `Ambient Dry (${extractedCode || "Zone A"})`;
      if (viMain.toLowerCase().includes("mát")) return `Cool Storage (${extractedCode || "Zone C"})`;
      if (viMain.toLowerCase().includes("giá trị")) return `Secure High-Value (${extractedCode || "Zone B"})`;
      return rawZoneName;
    } else {
      const viClean = viMain.charAt(0).toUpperCase() + viMain.slice(1).toLowerCase();
      if (extractedCode) {
        return `${viClean} (${extractedCode})`;
      }
      return viClean;
    }
  }

  if (!isEn && rawZoneName.includes(" - ")) {
    return rawZoneName.split(" - ")[0].trim();
  }
  return rawZoneName;
};

const formatOperatorWithRole = (operator?: string, isEn?: boolean): string => {
  if (!operator) return isEn ? "Unassigned" : "Chưa gán";
  if (isEn) return operator;

  return operator
    .replace(/\(Staff\)/gi, "(Nhân viên)")
    .replace(/\(Operator\)/gi, "(Vận hành)")
    .replace(/\(Lead\)/gi, "(Trưởng nhóm)")
    .replace(/\(Admin\)/gi, "(Quản trị viên)");
};

export interface CycleCountListProps {
  sheets: CycleCountSheet[];
  kpis: CycleCountKPIs;
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedWarehouse: string;
  onWarehouseChange: (val: string) => void;
  selectedZone: string;
  onZoneChange: (val: string) => void;
  selectedStatus: string;
  onStatusChange: (val: string) => void;
  varianceOnly: boolean;
  onVarianceOnlyChange: (val: boolean) => void;
  onResetFilters: () => void;
  warehouses: Array<{ id: string; code: string; name: any }>;
  zones: Array<{ id: string; warehouseId: string; name: any }>;
  onSelectSheet: (sheet: CycleCountSheet) => void;
  onCreateSheet: () => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  isOnline: boolean;
  isMockMode: boolean;
}

export default function CycleCountList({
  sheets,
  kpis,
  totalCount,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  searchTerm,
  onSearchChange,
  selectedWarehouse,
  onWarehouseChange,
  selectedZone,
  onZoneChange,
  selectedStatus,
  onStatusChange,
  varianceOnly,
  onVarianceOnlyChange,
  onResetFilters,
  warehouses,
  zones,
  onSelectSheet,
  onCreateSheet,
  isLoading,
  error,
  onRetry,
  isOnline,
  isMockMode,
}: CycleCountListProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US";

  const totalPages = Math.ceil(totalCount / pageSize);

  const filteredZones = zones.filter(
    (z) => !selectedWarehouse || !z.warehouseId || z.warehouseId === selectedWarehouse
  );

  const hasActiveFilters = Boolean(
    searchTerm.trim() !== "" ||
    selectedWarehouse !== "" ||
    selectedZone !== "" ||
    selectedStatus !== "ALL" ||
    varianceOnly === true
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 text-slate-800 animate-fadeIn">
      {/* Header bar */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              {t("cycleCounting.list.title", isEn ? "Cycle Counting" : "Kiểm kê chu kỳ")}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t(
                "cycleCounting.list.subtitle",
                isEn
                  ? "Count and reconcile physical inventory by zone or storage bins."
                  : "Kiểm đếm và đối chiếu tồn kho thực tế theo khu vực hoặc ô kệ."
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCreateSheet}
              disabled={!isOnline && !isMockMode}
              className="h-9 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>{t("cycleCounting.list.createBtn", isEn ? "Create count sheet" : "Tạo phiếu kiểm kê")}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-5">
        {/* KPI Cards (Section 3: Tổng phiếu, Đang đếm, Chờ duyệt, Có chênh lệch, Đã xác nhận) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Tổng phiếu */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold text-slate-600">
                {t("cycleCounting.kpis.totalSheets", isEn ? "Total count sheets" : "Tổng phiếu kiểm kê")}
              </span>
              <ClipboardList className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {kpis.totalSheets}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {kpis.draftSheets} {isEn ? (kpis.draftSheets === 1 ? "draft sheet" : "draft sheets") : "phiếu nháp"}
            </div>
          </div>

          {/* Đang kiểm đếm */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-blue-500 mb-1">
              <span className="text-xs font-semibold text-blue-700">
                {t("cycleCounting.kpis.countingSheets", isEn ? "In counting" : "Đang kiểm đếm")}
              </span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-700 font-mono">
              {kpis.countingSheets}
            </div>
            <div className="text-[11px] text-blue-600 mt-0.5">
              {t("cycleCounting.kpis.countingDesc", isEn ? "Active floor counting" : "Nhân sự đang quét thực tế")}
            </div>
          </div>

          {/* Chờ xem xét */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-amber-500 mb-1">
              <span className="text-xs font-semibold text-amber-800">
                {t("cycleCounting.kpis.reviewSheets", isEn ? "In review" : "Chờ xem xét")}
              </span>
              <FileCheck2 className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700 font-mono">
              {kpis.reviewSheets}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              {t("cycleCounting.kpis.reviewDesc", isEn ? "Pending manager approval" : "Cần quản lý duyệt")}
            </div>
          </div>

          {/* Có chênh lệch */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-rose-500 mb-1">
              <span className="text-xs font-semibold text-rose-700">
                {t("cycleCounting.kpis.varianceSheets", isEn ? "With variance" : "Có chênh lệch")}
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-700 font-mono">
              {kpis.varianceSheets}
            </div>
            <div className="text-[11px] text-rose-600 mt-0.5">
              {t("cycleCounting.kpis.varianceDesc", isEn ? "Surplus or shortage detected" : "Phát hiện thừa hoặc thiếu")}
            </div>
          </div>

          {/* Đã xác nhận */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-emerald-500 mb-1">
              <span className="text-xs font-semibold text-emerald-700">
                {t("cycleCounting.kpis.confirmedSheets", isEn ? "Confirmed" : "Đã xác nhận")}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 font-mono">
              {kpis.confirmedSheets}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">
              {t("cycleCounting.kpis.confirmedDesc", isEn ? "Count completed" : "Đã hoàn tất kiểm kê")}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t(
                  "cycleCounting.list.searchPlaceholder",
                  "Tìm kiếm mã phiếu, người đếm, SKU, ô kệ..."
                )}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800"
              />
            </div>

            {/* Warehouse Filter */}
            <div>
              <select
                value={selectedWarehouse}
                onChange={(e) => onWarehouseChange(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 cursor-pointer"
              >
                <option value="">{t("cycleCounting.list.allWarehouses", "Tất cả kho")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {typeof w.name === "object" ? w.name.vi || w.name.en : w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Zone Filter */}
            <div>
              <select
                value={selectedZone}
                onChange={(e) => onZoneChange(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 cursor-pointer"
              >
                <option value="">{t("cycleCounting.list.allZones", "Tất cả phân khu")}</option>
                {filteredZones.map((z) => {
                  const rawName =
                    typeof z.name === "object"
                      ? isEn
                        ? z.name.en || z.name.vi
                        : z.name.vi || z.name.en
                      : z.name;
                  return (
                    <option key={z.id} value={z.id}>
                      {formatZoneDisplayName(rawName, undefined, isEn)}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 cursor-pointer font-medium"
              >
                <option value="ALL">{isEn ? "All statuses" : "Tất cả trạng thái"}</option>
                <option value="Draft">{getStatusLabel("Draft", isEn)}</option>
                <option value="Counting">{getStatusLabel("Counting", isEn)}</option>
                <option value="Review">{getStatusLabel("Review", isEn)}</option>
                <option value="Confirmed">{getStatusLabel("Confirmed", isEn)}</option>
              </select>
            </div>
          </div>

          {/* Variance only toggle & Reset */}
          <div className="flex flex-wrap items-center justify-between pt-1 border-t border-slate-100 text-xs min-h-[32px]">
            <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-slate-700">
              <input
                type="checkbox"
                checked={varianceOnly}
                onChange={(e) => onVarianceOnlyChange(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <span>
                {t("cycleCounting.list.varianceOnlyToggle", isEn ? "Show count sheets with variance only" : "Chỉ hiển thị các phiếu có chênh lệch")}
              </span>
            </label>

            {hasActiveFilters && (
              <button
                onClick={onResetFilters}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t("common.buttons.reset", isEn ? "Reset filters" : "Đặt lại bộ lọc")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Table or States */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">
              {t("cycleCounting.list.loading", "Đang tải danh sách phiếu kiểm kê...")}
            </p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-2xs space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-rose-900">{error}</p>
            <button
              onClick={onRetry}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
            >
              {t("common.buttons.retry", "Thử lại")}
            </button>
          </div>
        ) : sheets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs space-y-3">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">
              {t("cycleCounting.list.noSheetsTitle", "Không tìm thấy phiếu kiểm kê nào")}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {t(
                "cycleCounting.list.noSheetsSubtitle",
                "Chưa có phiếu kiểm kê phù hợp với điều kiện tìm kiếm hoặc chưa được khởi tạo."
              )}
            </p>
            <button
              onClick={onCreateSheet}
              disabled={!isOnline && !isMockMode}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{t("cycleCounting.list.createBtn", isEn ? "Create count sheet" : "Tạo phiếu kiểm kê")}</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200/80 [&_th]:!normal-case [&_th]:!tracking-normal">
                  <tr className="text-slate-600 font-semibold text-xs">
                    <th className="py-3 px-4 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colDocument", isEn ? "Count sheet code" : "Số phiếu kiểm kê")}
                    </th>
                    <th className="py-3 px-3 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colWarehouseZone", isEn ? "Warehouse / Zone" : "Kho / Phân khu")}
                    </th>
                    <th className="py-3 px-3 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colScope", isEn ? "Bin scope" : "Phạm vi ô kệ")}
                    </th>
                    <th className="py-3 px-3 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colScheduled", isEn ? "Scheduled date" : "Ngày thực hiện")}
                    </th>
                    <th className="py-3 px-3 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colOperator", isEn ? "Assigned operator" : "Người kiểm đếm")}
                    </th>
                    <th className="py-3 px-3 text-center font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colProgress", isEn ? "Progress (SKU)" : "Tiến độ (SKU)")}
                    </th>
                    <th className="py-3 px-3 text-center font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colVariance", isEn ? "Variance" : "Chênh lệch")}
                    </th>
                    <th className="py-3 px-3 text-center font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colStatus", isEn ? "Status" : "Trạng thái")}
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("cycleCounting.list.colActions", isEn ? "Actions" : "Thao tác")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sheets.map((sheet) => {
                    const progress =
                      sheet.totalSkus > 0
                        ? Math.round((sheet.countedSkus / sheet.totalSkus) * 100)
                        : 0;

                    const isDraft = sheet.status === "Draft";
                    const isCounting = sheet.status === "Counting";
                    const isReview = sheet.status === "Review";
                    const isConfirmed = sheet.status === "Confirmed";

                    return (
                      <tr
                        key={sheet.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        onClick={() => onSelectSheet(sheet)}
                      >
                        {/* Sheet Document Number */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                              <ClipboardList className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors block">
                                {sheet.sheetNumber}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {sheet.createdDate.slice(0, 10)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Warehouse & Zone */}
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block">
                            {sheet.warehouseCode}
                          </span>
                          <span
                            className="text-[11px] text-slate-500 block line-clamp-2 leading-tight max-w-[200px]"
                            title={formatZoneDisplayName(sheet.zoneName, sheet.zoneCode, isEn)}
                          >
                            {formatZoneDisplayName(sheet.zoneName, sheet.zoneCode, isEn)}
                          </span>
                        </td>

                        {/* Scope */}
                        <td className="py-3 px-3">
                          {sheet.binScope === "ALL" ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                              {t("cycleCounting.createModal.allBins", isEn ? "All bins in zone" : "Toàn bộ phân khu")}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {sheet.selectedBinCodes?.length || 0}{" "}
                              {t("cycleCounting.confirmModal.binsSelected", isEn ? "selected bins" : "ô kệ cụ thể")}
                            </span>
                          )}
                        </td>

                        {/* Scheduled Date */}
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {sheet.scheduledDate}
                        </td>

                        {/* Operator */}
                        <td className="py-3 px-3 text-slate-700">
                          {formatOperatorWithRole(sheet.assignedOperator, isEn)}
                        </td>

                        {/* Progress */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-mono font-bold text-slate-800 text-[11px]">
                              {sheet.countedSkus} / {sheet.totalSkus}
                            </span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Variance badge */}
                        <td className="py-3 px-3 text-center">
                          {sheet.varianceSkus > 0 ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {sheet.varianceSkus} SKU lệch
                            </span>
                          ) : sheet.countedSkus > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Khớp 100%
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                              isDraft
                                ? "bg-slate-100 text-slate-700 border border-slate-200"
                                : isCounting
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : isReview
                                ? "bg-amber-50 text-amber-800 border border-amber-300"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-300"
                            }`}
                          >
                            {getStatusLabel(sheet.status, isEn)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSheet(sheet);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {isDraft ? (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{isEn ? "Start" : "Bắt đầu"}</span>
                              </>
                            ) : isCounting ? (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{isEn ? "Continue" : "Tiếp tục"}</span>
                              </>
                            ) : isReview ? (
                              <>
                                <FileCheck2 className="w-3.5 h-3.5" />
                                <span>{isEn ? "Review" : "Xem xét"}</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isEn ? "View" : "Xem"}</span>
                              </>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <PaginationFooter
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
