/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  Building2,
  Layers,
  Grid3X3,
  Calendar,
  User,
  Clock,
  Wifi,
  WifiOff,
  Filter,
  Check,
  TrendingUp,
  TrendingDown,
  Equal,
  RotateCcw,
  FileCheck2,
  Save,
  Search,
  Eye,
  Hash,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  CycleCountSheet,
  CycleCountItem,
  CycleCountVarianceSummary,
  TrackingMode,
  ConfirmCycleCountRequest,
} from "../../services/cycleCount/types";
import { cycleCountService } from "../../services/cycleCount/cycleCountService";
import ConfirmCycleCountModal from "./ConfirmCycleCountModal";

export interface CycleCountWorkingScreenProps {
  sheet: CycleCountSheet;
  onBack: () => void;
  onRefresh: () => void;
  onShowToast: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    title?: string
  ) => void;
  isOnline: boolean;
  isMockMode: boolean;
  currentUser?: string;
}

export default function CycleCountWorkingScreen({
  sheet: initialSheet,
  onBack,
  onRefresh,
  onShowToast,
  isOnline,
  isMockMode,
  currentUser = "Trần Anh Kiện (Staff)",
}: CycleCountWorkingScreenProps) {
  const { t } = useTranslation();

  const [currentSheet, setCurrentSheet] = useState<CycleCountSheet>(initialSheet);
  const [localCounts, setLocalCounts] = useState<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {};
    initialSheet.items.forEach((item) => {
      map[item.id] = item.countedQty;
    });
    return map;
  });

  const [localNotes, setLocalNotes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialSheet.items.forEach((item) => {
      map[item.id] = item.notes || "";
    });
    return map;
  });

  const [showVarianceOnly, setShowVarianceOnly] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // References to input fields for keyboard Enter navigation
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setCurrentSheet(initialSheet);
    const countMap: Record<string, number | null> = {};
    const noteMap: Record<string, string> = {};
    initialSheet.items.forEach((item) => {
      countMap[item.id] = item.countedQty;
      noteMap[item.id] = item.notes || "";
    });
    setLocalCounts(countMap);
    setLocalNotes(noteMap);
  }, [initialSheet]);

  // Compute live variance summary based on current values
  const summary: CycleCountVarianceSummary = React.useMemo(() => {
    let countedLines = 0;
    let uncountedLines = 0;
    let matchedLines = 0;
    let surplusLines = 0;
    let shortageLines = 0;
    let totalSystemQty = 0;
    let totalCountedQty = 0;
    let netVarianceQty = 0;
    let grossVarianceQty = 0;

    currentSheet.items.forEach((item) => {
      totalSystemQty += item.systemQty;
      const countVal = localCounts[item.id];

      if (countVal !== null && countVal !== undefined) {
        countedLines++;
        totalCountedQty += countVal;
        const diff = countVal - item.systemQty;
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

    return {
      totalLines: currentSheet.items.length,
      countedLines,
      uncountedLines,
      matchedLines,
      surplusLines,
      shortageLines,
      totalSystemQty,
      totalCountedQty,
      netVarianceQty,
      grossVarianceQty,
      hasVariance: surplusLines > 0 || shortageLines > 0,
    };
  }, [currentSheet, localCounts]);

  const progressPercentage =
    summary.totalLines > 0
      ? Math.round((summary.countedLines / summary.totalLines) * 100)
      : 0;

  // Filter items
  const filteredItems = currentSheet.items.filter((item) => {
    const countVal = localCounts[item.id];
    const isCounted = countVal !== null && countVal !== undefined;
    const diff = isCounted ? countVal - item.systemQty : 0;

    if (showVarianceOnly) {
      if (!isCounted || diff === 0) return false;
    }

    if (itemSearchTerm) {
      const term = itemSearchTerm.toLowerCase();
      const matchSku = item.sku.toLowerCase().includes(term);
      const matchName = item.productName.toLowerCase().includes(term);
      const matchBin = item.binCode.toLowerCase().includes(term);
      const matchLot = item.lotNumber?.toLowerCase().includes(term);
      if (!matchSku && !matchName && !matchBin && !matchLot) return false;
    }

    return true;
  });

  // Handle Count Change
  const handleCountChange = (itemId: string, rawVal: string) => {
    if (rawVal === "") {
      setLocalCounts((prev) => ({ ...prev, [itemId]: null }));
      return;
    }
    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setLocalCounts((prev) => ({ ...prev, [itemId]: parsed }));
    }
  };

  // Quick Match system qty
  const handleQuickMatch = (item: CycleCountItem) => {
    setLocalCounts((prev) => ({ ...prev, [item.id]: item.systemQty }));
  };

  // Save all counts
  const handleSaveAllCounts = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(localCounts)
        .filter(([_, val]) => val !== null && val !== undefined)
        .map(([itemId, val]) => ({
          itemId,
          countedQty: val as number,
          notes: localNotes[itemId],
        }));

      const updated = await cycleCountService.bulkUpdateCounts(currentSheet.id, updates);
      setCurrentSheet(updated);
      onShowToast(
        t(
          "cycleCounting.toast.savedSuccess",
          "Đã lưu kết quả kiểm đếm vào phiếu kiểm kê."
        ),
        "success"
      );
      onRefresh();
    } catch (err: any) {
      onShowToast(err.message || "Lỗi khi lưu số lượng kiểm đếm.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Step transition: Start Counting
  const handleStartCounting = async () => {
    try {
      const updated = await cycleCountService.startCounting(currentSheet.id);
      setCurrentSheet(updated);
      onShowToast(
        t("cycleCounting.toast.startedCounting", "Bắt đầu ca kiểm đếm thực tế."),
        "info"
      );
      onRefresh();
    } catch (err: any) {
      onShowToast(err.message || "Lỗi khi cập nhật trạng thái.", "error");
    }
  };

  // Step transition: Submit for Review
  const handleSubmitForReview = async () => {
    await handleSaveAllCounts();
    try {
      const updated = await cycleCountService.submitForReview(currentSheet.id);
      setCurrentSheet(updated);
      onShowToast(
        t(
          "cycleCounting.toast.submittedReview",
          "Đã chuyển phiếu kiểm kê sang trạng thái Xem xét chênh lệch (Review)."
        ),
        "success"
      );
      onRefresh();
    } catch (err: any) {
      onShowToast(err.message || "Lỗi khi chuyển trạng thái.", "error");
    }
  };

  // Final Reconcile Confirm handler
  const handleConfirmReconcile = async (req: ConfirmCycleCountRequest) => {
    const updated = await cycleCountService.confirmCycleCount(req);
    setCurrentSheet(updated);
    onShowToast(
      t(
        "cycleCounting.toast.confirmedSuccess",
        "Đã xác nhận kiểm kê thành công! Bản ghi đối soát đã được lưu trữ."
      ),
      "success"
    );
    onRefresh();
  };

  // Keyboard navigation: Enter jumps to next item input
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextItem = filteredItems[index + 1];
      if (nextItem && inputRefs.current[nextItem.id]) {
        inputRefs.current[nextItem.id]?.focus();
      }
    }
  };

  const isConfirmed = currentSheet.status === "Confirmed";
  const isDraft = currentSheet.status === "Draft";
  const isCounting = currentSheet.status === "Counting";
  const isReview = currentSheet.status === "Review";

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 text-slate-800 animate-fadeIn">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-3.5 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title={t("common.buttons.back", "Quay lại")}
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {currentSheet.sheetNumber}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isDraft
                      ? "bg-slate-100 text-slate-700 border border-slate-200"
                      : isCounting
                      ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse"
                      : isReview
                      ? "bg-amber-50 text-amber-800 border border-amber-300"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-300"
                  }`}
                >
                  {isDraft && t("cycleCounting.status.draft", "Draft (Nháp)")}
                  {isCounting && t("cycleCounting.status.counting", "Counting (Đang đếm)")}
                  {isReview && t("cycleCounting.status.review", "Review (Chờ duyệt)")}
                  {isConfirmed && t("cycleCounting.status.confirmed", "Confirmed (Đã chốt)")}
                </span>

                {/* Offline Cache Indicator */}
                <div
                  className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                    isOnline
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {isOnline ? (
                    <Wifi className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-amber-600" />
                  )}
                  <span>
                    {isOnline
                      ? t("cycleCounting.onlineSync", "Dữ liệu trực tuyến")
                      : t("cycleCounting.offlineCached", "Bản đệm Offline")}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentSheet.warehouseName} • {currentSheet.zoneName}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            {!isConfirmed && (
              <button
                onClick={handleSaveAllCounts}
                disabled={isSaving}
                className="h-9 px-4 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {isSaving
                    ? t("common.buttons.saving", "Đang lưu...")
                    : t("common.buttons.save", "Lưu số đếm")}
                </span>
              </button>
            )}

            {isDraft && (
              <button
                onClick={handleStartCounting}
                className="h-9 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>{t("cycleCounting.actions.startCounting", "Bắt Đầu Kiểm Đếm")}</span>
              </button>
            )}

            {isCounting && (
              <button
                onClick={handleSubmitForReview}
                className="h-9 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>{t("cycleCounting.actions.submitReview", "Chuyển Sang Xem Chênh Lệch")}</span>
              </button>
            )}

            {isReview && (
              <button
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={!isOnline && !isMockMode}
                className="h-9 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t("cycleCounting.actions.confirmCount", "Xác Nhận Kiểm Kê")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-5">
        {/* WMS 4-Stage Stepper */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Step 1: Tạo phiếu kiểm kê */}
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isDraft
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-emerald-500 text-white"
                }`}
              >
                {!isDraft ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  {t("cycleCounting.stepper.step1Title", "1. Tạo phiếu kiểm kê")}
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {t("cycleCounting.stepper.step1Desc", "Lập phạm vi & gán người đếm")}
                </span>
              </div>
            </div>

            {/* Step 2: Kiểm đếm thực tế */}
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isCounting
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : isReview || isConfirmed
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isReview || isConfirmed ? <Check className="w-4 h-4" /> : "2"}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  {t("cycleCounting.stepper.step2Title", "2. Kiểm đếm thực tế")}
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {t("cycleCounting.stepper.step2Desc", "Quét & nhập số lượng kho")}
                </span>
              </div>
            </div>

            {/* Step 3: Xem chênh lệch */}
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isReview
                    ? "bg-amber-500 text-white ring-4 ring-amber-100"
                    : isConfirmed
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isConfirmed ? <Check className="w-4 h-4" /> : "3"}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  {t("cycleCounting.stepper.step3Title", "3. Xem chênh lệch")}
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {t("cycleCounting.stepper.step3Desc", "Đối soát Khớp / Thừa / Thiếu")}
                </span>
              </div>
            </div>

            {/* Step 4: Xác nhận kiểm kê */}
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isConfirmed
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isConfirmed ? <Check className="w-4 h-4" /> : "4"}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  {t("cycleCounting.stepper.step4Title", "4. Xác nhận kiểm kê")}
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {t("cycleCounting.stepper.step4Desc", "Cân bằng & chốt dữ liệu")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Metadata & Progress Bar Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">
                {t("cycleCounting.details.warehouse", "Nhà kho:")}
              </span>
              <span className="font-semibold text-slate-800">
                {currentSheet.warehouseName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">
                {t("cycleCounting.details.zoneScope", "Phân khu & Vị trí:")}
              </span>
              <span className="font-semibold text-slate-800">
                {currentSheet.zoneName} ({currentSheet.binScope === "ALL" ? "Toàn khu" : "Kệ chọn lọc"})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">
                {t("cycleCounting.details.operator", "Người kiểm đếm:")}
              </span>
              <span className="font-semibold text-slate-800">
                {currentSheet.assignedOperator || "Chưa gán"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">
                {t("cycleCounting.details.schedule", "Ngày kiểm kê:")}
              </span>
              <span className="font-semibold text-slate-800">
                {currentSheet.scheduledDate}
              </span>
            </div>
          </div>

          {currentSheet.notes && (
            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-mono">
              <span className="font-semibold text-slate-700">Ghi chú:</span> {currentSheet.notes}
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">
                {t("cycleCounting.details.countingProgress", "Tiến độ kiểm đếm:")}{" "}
                <span className="text-blue-600 font-mono">
                  {summary.countedLines} / {summary.totalLines} SKU
                </span>
              </span>
              <span className="font-mono font-bold text-slate-700">
                {progressPercentage}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Variance Review Summary KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium block">
              {t("cycleCounting.review.totalLines", "Tổng dòng SKU")}
            </span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">
              {summary.totalLines}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] text-emerald-700 font-medium block flex items-center gap-1">
              <Equal className="w-3.5 h-3.5 text-emerald-600" />
              {t("cycleCounting.review.matched", "Khớp số (Matched)")}
            </span>
            <span className="text-lg font-bold text-emerald-600 mt-1 block">
              {summary.matchedLines}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] text-emerald-700 font-medium block flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              {t("cycleCounting.review.surplus", "Thừa (Surplus)")}
            </span>
            <span className="text-lg font-bold text-emerald-600 mt-1 block">
              {summary.surplusLines}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] text-rose-700 font-medium block flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              {t("cycleCounting.review.shortage", "Thiếu (Shortage)")}
            </span>
            <span className="text-lg font-bold text-rose-600 mt-1 block">
              {summary.shortageLines}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-500 font-medium block">
              {t("cycleCounting.review.netVariance", "Chênh lệch thuần")}
            </span>
            <span
              className={`text-lg font-bold mt-1 block font-mono ${
                summary.netVarianceQty > 0
                  ? "text-emerald-600"
                  : summary.netVarianceQty < 0
                  ? "text-rose-600"
                  : "text-slate-700"
              }`}
            >
              {summary.netVarianceQty > 0
                ? `+${summary.netVarianceQty}`
                : summary.netVarianceQty}
            </span>
          </div>
        </div>

        {/* Filter & Working Table Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={itemSearchTerm}
                onChange={(e) => setItemSearchTerm(e.target.value)}
                placeholder={t(
                  "cycleCounting.working.searchPlaceholder",
                  "Tìm kiếm theo SKU, tên sản phẩm, ô kệ, số lô..."
                )}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Variance Only Toggle */}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showVarianceOnly}
                  onChange={(e) => setShowVarianceOnly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>
                  {t(
                    "cycleCounting.review.showVarianceOnly",
                    "Chỉ hiển thị mặt hàng chênh lệch"
                  )}
                </span>
                {summary.hasVariance && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800 font-bold">
                    {summary.surplusLines + summary.shortageLines}
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs enterprise-table">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">
                    {t("cycleCounting.working.colSkuProduct", "SKU & Sản phẩm")}
                  </th>
                  <th className="py-3 px-3">
                    {t("cycleCounting.working.colBin", "Vị trí Ô kệ")}
                  </th>
                  <th className="py-3 px-3">
                    {t("cycleCounting.working.colTracking", "Theo dõi")}
                  </th>
                  <th className="py-3 px-3 text-right">
                    {t("cycleCounting.working.colSystemQty", "Tồn hệ thống")}
                  </th>
                  <th className="py-3 px-4 text-center w-40">
                    {t("cycleCounting.working.colCountedQty", "Số thực đếm")}
                  </th>
                  <th className="py-3 px-3 text-center">
                    {t("cycleCounting.working.colDifference", "Chênh lệch")}
                  </th>
                  <th className="py-3 px-3 text-center">
                    {t("cycleCounting.working.colStatus", "Trạng thái")}
                  </th>
                  <th className="py-3 px-4">
                    {t("cycleCounting.working.colNotes", "Ghi chú")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ClipboardList className="w-8 h-8 text-slate-300" />
                        <span className="text-xs">
                          {t("cycleCounting.working.noItemsFound", "Không có mặt hàng nào khớp bộ lọc.")}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const countVal = localCounts[item.id];
                    const isCounted = countVal !== null && countVal !== undefined;
                    const diff = isCounted ? countVal - item.systemQty : 0;
                    const isSurplus = diff > 0;
                    const isShortage = diff < 0;
                    const isMatched = isCounted && diff === 0;

                    // Row highlight
                    const rowBgClass = !isCounted
                      ? "bg-slate-50/40 hover:bg-slate-50"
                      : isSurplus
                      ? "bg-emerald-50/30 hover:bg-emerald-50/50"
                      : isShortage
                      ? "bg-rose-50/30 hover:bg-rose-50/50"
                      : "hover:bg-slate-50";

                    return (
                      <tr key={item.id} className={`transition-colors ${rowBgClass}`}>
                        {/* SKU & Product */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-900">
                              {item.sku}
                            </span>
                            <span className="text-slate-600 truncate max-w-[220px]">
                              {item.productName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ĐVT: {item.unit}
                            </span>
                          </div>
                        </td>

                        {/* Bin Code */}
                        <td className="py-3 px-3 font-mono font-semibold text-blue-700">
                          {item.binCode}
                        </td>

                        {/* Tracking Mode & Lot/Serial */}
                        <td className="py-3 px-3">
                          {item.trackingMode === TrackingMode.Lot && (
                            <div className="space-y-0.5">
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                LOT: {item.lotNumber}
                              </span>
                              {item.expirationDate && (
                                <span className="block text-[10px] text-slate-400">
                                  HSD: {item.expirationDate}
                                </span>
                              )}
                            </div>
                          )}

                          {item.trackingMode === TrackingMode.Serial && (
                            <div className="space-y-0.5">
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                SERIAL ({item.serialNumbers?.length || 0})
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                (Read-only)
                              </span>
                            </div>
                          )}

                          {item.trackingMode === TrackingMode.None && (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* System Quantity */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 text-sm">
                          {item.systemQty}
                        </td>

                        {/* Counted Quantity Entry Input */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              ref={(el) => {
                                inputRefs.current[item.id] = el;
                              }}
                              type="number"
                              min={0}
                              disabled={isConfirmed}
                              value={countVal !== null && countVal !== undefined ? countVal : ""}
                              onChange={(e) => handleCountChange(item.id, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index)}
                              placeholder="Nhập số..."
                              className={`w-24 h-9 px-2.5 text-center font-mono font-bold text-sm rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                                !isCounted
                                  ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-500/20 text-slate-800"
                                  : isSurplus
                                  ? "border-emerald-400 bg-emerald-50/50 text-emerald-800 focus:border-emerald-500"
                                  : isShortage
                                  ? "border-rose-400 bg-rose-50/50 text-rose-800 focus:border-rose-500"
                                  : "border-slate-300 bg-white text-slate-900"
                              } ${isConfirmed ? "bg-slate-100 cursor-not-allowed" : ""}`}
                            />
                            {!isConfirmed && (
                              <button
                                type="button"
                                onClick={() => handleQuickMatch(item)}
                                title={t(
                                  "cycleCounting.working.quickMatchTitle",
                                  "Khớp đúng với số tồn hệ thống"
                                )}
                                className="px-2 py-1 text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                              >
                                {t("cycleCounting.working.matchBtn", "Khớp")}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Difference / Variance */}
                        <td className="py-3 px-3 text-center">
                          {isCounted ? (
                            <span
                              className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                                isMatched
                                  ? "bg-slate-100 text-slate-600"
                                  : isSurplus
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {isSurplus && <TrendingUp className="w-3 h-3 text-emerald-700" />}
                              {isShortage && <TrendingDown className="w-3 h-3 text-rose-700" />}
                              {isMatched && <Equal className="w-3 h-3 text-slate-500" />}
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Count Status */}
                        <td className="py-3 px-3 text-center">
                          {isCounted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3" />
                              {t("cycleCounting.working.countedBadge", "Đã kiểm")}
                            </span>
                          ) : (
                            <span className="inline-block text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              {t("cycleCounting.working.uncountedBadge", "Chưa kiểm")}
                            </span>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            disabled={isConfirmed}
                            value={localNotes[item.id] || ""}
                            onChange={(e) =>
                              setLocalNotes((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="Ghi chú hiện trường..."
                            className="w-full text-xs px-2 py-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-400 focus:bg-white rounded-lg focus:outline-none text-slate-700 transition-colors"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3.5 bg-slate-50/70 border-t border-slate-200/80 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>
              {t("cycleCounting.working.footerStats", "Hiển thị {{count}} mặt hàng trong phiếu kiểm kê", {
                count: filteredItems.length,
              })}
            </span>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span>
                Tổng tồn HT: <strong className="text-slate-800">{summary.totalSystemQty}</strong>
              </span>
              <span>
                Tổng thực đếm:{" "}
                <strong className="text-slate-800">{summary.totalCountedQty}</strong>
              </span>
              <span>
                Lệch thuần:{" "}
                <strong
                  className={
                    summary.netVarianceQty > 0
                      ? "text-emerald-700"
                      : summary.netVarianceQty < 0
                      ? "text-rose-700"
                      : "text-slate-800"
                  }
                >
                  {summary.netVarianceQty > 0 ? `+${summary.netVarianceQty}` : summary.netVarianceQty}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmCycleCountModal
        isOpen={isConfirmModalOpen}
        sheet={currentSheet}
        summary={summary}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmReconcile}
        isOnline={isOnline}
        isMockMode={isMockMode}
        currentUser={currentUser}
      />
    </div>
  );
}
