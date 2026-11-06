/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  BarChart4,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Mail,
  ExternalLink,
  RefreshCw,
  Layers,
  MapPin,
  Cpu,
  ChevronRight,
  ShieldAlert,
  Check,
  X,
  Inbox,
  ChevronDown,
  Send,
  Download,
  Zap,
  Store,
  Boxes,
  Gauge,
  ArrowRight,
  ArrowRightLeft,
  Package,
  RotateCcw,
  Clock,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import {
  Bin,
  InboundReceipt,
  OutboundOrder,
  SystemNotification,
  Product,
  WarehouseZone,
} from "../../types/index";
import BinDetailModal from "../inventory/BinDetailModal";

// Mock SignalR Hook for real-time updates
const useSignalR = () => {
  const [connectionState, setConnectionState] = useState("Connected");
  const triggerHubUpdate = (message: string) => {
    console.log(`[SignalR Hub] Emitted: ${message}`);
  };
  return { connectionState, triggerHubUpdate };
};

interface WebDashboardProps {
  bins: Bin[];
  products: Product[];
  inbounds: InboundReceipt[];
  outbounds: OutboundOrder[];
  notifications: SystemNotification[];
  zones?: WarehouseZone[];
  onUpdateBinQty: (
    binCode: string,
    sku: string,
    qty: number,
    action: "ADD" | "SUBTRACT",
  ) => void;
  onTransfer?: (
    sourceBinCode: string,
    targetBinCode: string,
    sku: string,
    qty: number,
    reason: string
  ) => Promise<boolean | void> | void;
  onTriggerAuditLog?: (action: string, details: string) => void;
  onRefreshData?: () => void | Promise<void>;
  onResolveNotif?: (
    id: string,
    approved: boolean,
    extraData?: {
      vendorEmail?: string;
      emailBodyEn?: string;
      emailBodyVi?: string;
      subjectEn?: string;
      subjectVi?: string;
    }
  ) => void | Promise<void>;
  lang: string;
}

export default function WebDashboard({
  bins,
  products,
  inbounds,
  outbounds,
  zones = [],
  onTransfer,
  lang,
  onUpdateBinQty,
  onTriggerAuditLog,
  onRefreshData,
  onResolveNotif,
}: WebDashboardProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US";
  const navigate = useNavigate();
  const { triggerHubUpdate } = useSignalR();

  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [generatingInsight, setGeneratingInsight] = useState(false);

  // Fast replenishment trigger feedback state
  const [replenishTriggering, setReplenishTriggering] = useState(false);
  const [replenishResult, setReplenishResult] = useState<string | null>(null);

  // Aggregate stats
  const totalStock = bins.reduce((sum, b) => sum + b.currentOccupancy, 0);
  const maxCapacity = bins.reduce((sum, b) => sum + b.maxCapacity, 0);
  const spaceFillRate =
    maxCapacity > 0 ? Math.round((totalStock / maxCapacity) * 100) : 0;
  const pendingInbounds = inbounds.filter(
    (i) => i.status !== "Completed",
  ).length;

  // Detect counter shortage bins (<20% occupied in Zone S)
  const counterBins = useMemo(() => {
    return bins.filter((b) => b.zoneId === "z-store" || b.code.startsWith("POS-"));
  }, [bins]);

  const counterShortageCount = useMemo(() => {
    return counterBins.filter((b) => {
      const rate = b.maxCapacity > 0 ? b.currentOccupancy / b.maxCapacity : 0;
      return rate < 0.2;
    }).length;
  }, [counterBins]);

  const activeAlertsCount = counterShortageCount > 0 ? counterShortageCount : 1;

  // Mail Queue State
  const [activeQueueId, setActiveQueueId] = useState("coca");

  const mailQueue = [
    {
      id: "coca",
      label: "Coca-Cola PO",
      vendor: "vendor-coca@partner.com",
      subject: t("f0.text.automatedRestockPo2342Coca320"),
      bodyPrefix: t("f0.text.dearPartnerNNourSystemDetectedCriticallyLowStock"),
      items: [{ product: "COCA-320", lowStock: 120, proposed: 120 }],
    },
    {
      id: "pepsi",
      label: "PepsiCo PO",
      vendor: "vendor-pepsi@partner.com",
      subject: t("f0.text.automatedRestockPo2343MultipleItems"),
      bodyPrefix: t("f0.text.dearPartnerNNpleaseSeeTheRequiredRestockQuantities"),
      items: [
        { product: "PEPSI-330", lowStock: 80, proposed: 100 },
        { product: "7UP-330", lowStock: 45, proposed: 100 },
      ],
    },
    {
      id: "vinamilk",
      label: "Vinamilk PO",
      vendor: "vendor-vnm@partner.com",
      subject: t("f0.text.automatedRestockPo2344MilkVnm"),
      bodyPrefix: t("f0.text.dearPartnerNNstandardRestockRequestForThisWeek"),
      items: [{ product: "MILK-VNM", lowStock: 200, proposed: 500 }],
    },
  ];

  const currentQueueItem =
    mailQueue.find((q) => q.id === activeQueueId) || mailQueue[0];

  const [vendor, setVendor] = useState(currentQueueItem.vendor);
  const [subject, setSubject] = useState(currentQueueItem.subject);
  const [mailBody, setMailBody] = useState(currentQueueItem.bodyPrefix);

  useEffect(() => {
    setVendor(currentQueueItem.vendor);
    setSubject(currentQueueItem.subject);
    setMailBody(currentQueueItem.bodyPrefix);
  }, [activeQueueId, i18n.language, isEn]);

  // Handle Automated Fast Restock action from AI Agent Card 3
  const handleTriggerAutoReplenish = () => {
    navigate("/dashboard/replenishment");
  };

  // Re-fetch AI insights simulation
  const fetchAIInsights = () => {
    setGeneratingInsight(true);
    setTimeout(() => {
      setGeneratingInsight(false);
    }, 600);
  };

  // Chart data formatting
  const chartData = [
    { name: t("f0.text.mon"), PO: 140, Sales: 90 },
    { name: t("f0.text.tue"), PO: 190, Sales: 120 },
    { name: t("f0.text.wed"), PO: 240, Sales: 140 },
    { name: t("f0.text.thu"), PO: 120, Sales: 160 },
    { name: t("f0.text.fri"), PO: 180, Sales: 190 },
    { name: t("f0.text.sat"), PO: 80, Sales: 100 },
    { name: t("f0.text.sun"), PO: 50, Sales: 40 },
  ];

  // Aggregated flow metrics for Bento header
  const chartTotals = useMemo(() => {
    const totalPO = chartData.reduce((sum, item) => sum + item.PO, 0);
    const totalSales = chartData.reduce((sum, item) => sum + item.Sales, 0);
    const throughputRatio = totalPO > 0 ? ((totalSales / totalPO) * 100).toFixed(1) : "0.0";
    return { totalPO, totalSales, throughputRatio };
  }, [chartData]);

  // Helper to get bins per zone
  const coolBins = useMemo(() => bins.filter((b) => b.zoneId === "z1"), [bins]);
  const dryBins = useMemo(() => bins.filter((b) => b.zoneId === "z2"), [bins]);
  const storeBins = useMemo(
    () => bins.filter((b) => b.zoneId === "z-store" || b.code.startsWith("POS-")),
    [bins]
  );

  // Compute live zone summary stats
  const coolStats = useMemo(() => {
    const total = coolBins.reduce((sum, b) => sum + b.currentOccupancy, 0);
    const max = coolBins.reduce((sum, b) => sum + b.maxCapacity, 0);
    const rate = max > 0 ? Math.round((total / max) * 100) : 0;
    return { total, max, rate };
  }, [coolBins]);

  const dryStats = useMemo(() => {
    const total = dryBins.reduce((sum, b) => sum + b.currentOccupancy, 0);
    const max = dryBins.reduce((sum, b) => sum + b.maxCapacity, 0);
    const rate = max > 0 ? Math.round((total / max) * 100) : 0;
    return { total, max, rate };
  }, [dryBins]);

  const storeStats = useMemo(() => {
    const total = storeBins.reduce((sum, b) => sum + b.currentOccupancy, 0);
    const max = storeBins.reduce((sum, b) => sum + b.maxCapacity, 0);
    const rate = max > 0 ? Math.round((total / max) * 100) : 0;
    return { total, max, rate };
  }, [storeBins]);

  // Helper to render high-density bin cell in Macro View (UI/UX WMS Standard)
  const renderBinCell = (bin: Bin, isRetail: boolean = false) => {
    const occupancyRate = bin.maxCapacity > 0 ? (bin.currentOccupancy || 0) / bin.maxCapacity : 0;
    const fillPercent = Math.min(100, Math.max(0, Math.round(occupancyRate * 100)));
    const isEmpty = (bin.currentOccupancy || 0) === 0;
    const isFull = fillPercent >= 99;
    const isOptimal = fillPercent >= 20 && fillPercent <= 80;
    const isNearCapacity = fillPercent > 80 && !isFull;
    const isShortage = isRetail && fillPercent < 20 && !isEmpty;

    const skuCount = bin.storedSkus?.length || 0;

    // 2. Ô Kệ Trống: Thiết kế thẻ nét đứt (Dashed border) màu xám, hiển thị rõ ràng sức chứa và trạng thái
    if (isEmpty) {
      return (
        <button
          key={bin.id}
          type="button"
          onClick={() => {
            setSelectedBin(bin);
            setIsDrawerOpen(true);
          }}
          className="group relative p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 hover:bg-white hover:border-slate-400 text-left transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[128px] w-full focus:outline-none focus:ring-2 focus:ring-slate-400/40 hover:-translate-y-0.5 shadow-2xs hover:shadow-xs"
          title={`${bin.code} - ${t("f0.text.emptyBinReadyForStorage")}`}
        >
          {/* Header: Mã kệ bên trái, Badge 0 SKU bên phải */}
          <div className="flex items-center justify-between w-full gap-2">
            <span className="font-mono font-bold text-xs text-slate-600 tracking-tight whitespace-nowrap">
              {bin.code}
            </span>
            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-500 shrink-0">
              0 SKU
            </span>
          </div>

          {/* Nội dung chính: Tải lượng 0 / max và trạng thái Ô trống */}
          <div className="my-2 space-y-1 w-full">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-slate-400 tracking-tight leading-none">
                0
              </span>
              <span className="text-xs font-mono font-medium text-slate-400">
                / {bin.maxCapacity} {t("f0.text.pcs")}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-sans font-medium text-slate-400 inline-block">
                {t("f0.text.empty")}
              </span>
            </div>
          </div>

          {/* Footer thẻ: Progress bar 0% & Mức lấp đầy */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between text-[10px] leading-none">
              <span className="text-slate-400 text-[10px]">
                {t("f0.text.fillRate")}
              </span>
              <span className="font-mono text-[11px] text-slate-400 font-medium">
                0%
              </span>
            </div>
            <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-slate-300 rounded-full" style={{ width: "0%" }} />
            </div>
          </div>
        </button>
      );
    }

    // 1. Thẻ Ô Kệ Có Hàng (Macro View):
    // Màu sắc theo chuẩn ISO:
    // Xanh lá = Tối ưu (20 - 80%)
    // Vàng = Sắp đầy (> 80%)
    // Đỏ = Quá tải (>= 99%) hoặc Thiếu hàng (< 20% tại quầy bán lẻ)
    let bannerColor = "bg-emerald-500";
    let borderColor = "border-slate-200/90 hover:border-emerald-500";
    let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
    let progressBarColor = "bg-emerald-500";
    let percentTextColor = "text-emerald-700";
    let statusLabel = t("f0.text.optimal");

    if (isShortage) {
      // Đỏ = Thiếu hàng
      bannerColor = "bg-rose-500";
      borderColor = "border-rose-300 hover:border-rose-500 ring-1 ring-rose-300/40";
      badgeStyle = "bg-rose-50 text-rose-700 border-rose-300";
      progressBarColor = "bg-rose-500";
      percentTextColor = "text-rose-700";
      statusLabel = t("f0.text.shortage");
    } else if (isFull) {
      // Đỏ = Quá tải
      bannerColor = "bg-rose-500";
      borderColor = "border-rose-300 hover:border-rose-500";
      badgeStyle = "bg-rose-50 text-rose-700 border-rose-300";
      progressBarColor = "bg-rose-500";
      percentTextColor = "text-rose-700";
      statusLabel = t("f0.text.overload");
    } else if (isNearCapacity) {
      // Vàng = Sắp đầy
      bannerColor = "bg-amber-400";
      borderColor = "border-amber-200 hover:border-amber-400";
      badgeStyle = "bg-amber-50 text-amber-800 border-amber-300";
      progressBarColor = "bg-amber-400";
      percentTextColor = "text-amber-700";
      statusLabel = t("f0.text.nearFull");
    } else if (isOptimal) {
      // Xanh lá = Tối ưu
      bannerColor = "bg-emerald-500";
      borderColor = "border-slate-200 hover:border-emerald-500";
      badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
      progressBarColor = "bg-emerald-500";
      percentTextColor = "text-emerald-700";
      statusLabel = t("f0.text.optimal");
    }

    return (
      <button
        key={bin.id}
        type="button"
        onClick={() => {
          setSelectedBin(bin);
          setIsDrawerOpen(true);
        }}
        className={`group relative rounded-xl border bg-white text-left transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[128px] w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40 hover:-translate-y-0.5 shadow-2xs hover:shadow-md overflow-hidden ${borderColor}`}
        title={`${bin.code} - ${fillPercent}% (${bin.currentOccupancy}/${bin.maxCapacity})`}
      >
        {/* Banner Top thể hiện màu sắc chuẩn ISO */}
        <div className={`h-1.5 w-full ${bannerColor}`} />

        <div className="p-3.5 flex flex-col justify-between flex-1 w-full">
          {/* Header thẻ: Mã kệ nằm bên trái, Badge nhỏ ghi số lượng SKU nằm bên phải */}
          <div className="flex items-center justify-between w-full gap-2">
            <span className="font-mono font-bold text-xs text-slate-900 tracking-tight whitespace-nowrap">
              {bin.code}
            </span>
            <span
              className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md border shadow-2xs shrink-0 ${badgeStyle}`}
            >
              {skuCount} {skuCount === 1 ? "SKU" : "SKUs"}
            </span>
          </div>

          {/* Nội dung chính (Giữa thẻ): Hiển thị con số Tải lượng tổng và trạng thái trên dòng riêng */}
          <div className="my-2 space-y-1 w-full">
            {/* Row chính: quantity / capacity */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-slate-900 tracking-tight leading-none">
                {bin.currentOccupancy}
              </span>
              <span className="text-xs font-mono font-medium text-slate-400">
                / {bin.maxCapacity} {t("f0.text.pcs")}
              </span>
            </div>

            {/* Vùng trạng thái riêng biệt, không tranh chiều ngang với capacity */}
            <div>
              <span className="text-[11px] font-sans font-medium text-slate-500 inline-block">
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Footer thẻ: Thanh Progress Bar mỏng thể hiện % lấp đầy */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between text-[10px] leading-none">
              <span className="text-slate-400 text-[10px]">
                {t("f0.text.fillRate")}
              </span>
              <span className={`font-mono font-bold text-[11px] ${percentTextColor}`}>
                {fillPercent}%
              </span>
            </div>

            {/* Thanh Progress Bar mỏng */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
                style={{ width: `${Math.min(100, fillPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-28 space-y-6 bg-slate-50 relative">
      {/* 1. COMMAND CENTER HEADER */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Main Title */}
          <h2 className="text-lg sm:text-xl font-sans font-bold text-slate-900 tracking-tight">
            {t(
              "dashboard.header.title",
              t("f0.text.smartwmsEnterpriseOperationsCenter"),
            )}
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t(
              "dashboard.header.subtitle",
              t("f0.text.warehouseInventoryOverviewStorageCapacityAndOperationalAlerts"),
            )}
          </p>
        </div>

        {/* Right side: Control Action Buttons */}
        <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
          <button
            type="button"
            onClick={() => navigate("/dashboard/replenishment")}
            className={`group relative flex items-center gap-2 px-3.5 py-2 h-9 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              counterShortageCount > 0
                ? "text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 shadow-2xs"
                : "text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100"
            }`}
            title={t("f0.text.openRetailCounterReplenishmentMatrix")}
          >
            <Zap className={`h-4 w-4 ${counterShortageCount > 0 ? "text-amber-600" : "text-slate-500"}`} strokeWidth={1.75} />
            <span>{t("f0.text.fastRestockBoard")}</span>
            {counterShortageCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-mono font-bold text-white bg-rose-600 rounded-full shadow-2xs">
                {counterShortageCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={fetchAIInsights}
            className="flex items-center gap-2 px-3.5 py-2 h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-slate-500 ${generatingInsight ? "animate-spin" : ""}`}
              strokeWidth={1.75}
            />
            <span>
              {t(
                "dashboard.action.refresh",
                t("f0.text.refreshMatrix"),
              )}
            </span>
          </button>
        </div>
      </div>

      {/* 2. DẢI 4 THẺ CHỈ SỐ KPI (EXECUTIVE TELEMETRY CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1 - TỔNG SỐ LƯỢNG TỒN */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {t("dashboard.kpi.total")}
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <Layers className="h-4 w-4" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-slate-900 tracking-tight">
                {totalStock.toLocaleString(isEn ? "en-US" : "vi-VN")}
              </span>
              <span className="text-xs font-mono text-slate-400">
                / {maxCapacity.toLocaleString(isEn ? "en-US" : "vi-VN")} {t("f0.text.pcs")}
              </span>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-2.5 mt-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-semibold text-[10px] border border-emerald-200/60">
              <TrendingUp className="h-3 w-3 text-emerald-600" strokeWidth={2} />
              +8.3%
            </span>
            <span className="text-xs text-slate-400 font-normal">
              {t("f0.text.vsYesterday")}
            </span>
          </div>
        </div>

        {/* Thẻ 2 - TỶ LỆ LẤP ĐẦY */}
        <div
          className={`bg-white p-4.5 rounded-xl border border-slate-200/90 ${
            spaceFillRate > 80 ? "border-l-4 border-l-amber-500" : ""
          } shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {t("dashboard.kpi.fillRate")}
              </span>
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center border shrink-0 ${
                  spaceFillRate > 80
                    ? "bg-amber-50 text-amber-600 border-amber-100"
                    : "bg-emerald-50 text-emerald-600 border-emerald-100"
                }`}
              >
                <Gauge className="h-4 w-4" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div>
                <span className="text-2xl font-mono font-bold text-slate-900 tracking-tight leading-none block">
                  {spaceFillRate}%
                </span>
                <span className="text-xs text-slate-500 font-normal block mt-1">
                  {t("f0.text.safeLimit85")}
                </span>
              </div>
              <div className="relative h-11 w-11 shrink-0">
                <svg className="h-full w-full rotate-[-90deg]">
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    className="stroke-slate-100"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    className={`transition-all duration-1000 ease-out ${
                      spaceFillRate > 80 ? "stroke-amber-500" : "stroke-emerald-500"
                    }`}
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="113"
                    strokeDashoffset={113 - (113 * Math.min(100, spaceFillRate)) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle2
                    className={`h-3.5 w-3.5 ${
                      spaceFillRate > 80 ? "text-amber-500" : "text-emerald-500"
                    }`}
                    strokeWidth={2}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Progress bar & footer */}
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  spaceFillRate > 80 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, spaceFillRate)}%` }}
              />
            </div>
            <div className="border-t border-slate-100 pt-2 mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>0%</span>
              <span className="font-semibold text-slate-600">{spaceFillRate}% / 100%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Thẻ 3 - LỆNH CHỜ KÍCH HOẠT */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {t("dashboard.kpi.deliveries")}
              </span>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                <Inbox className="h-4 w-4" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-slate-900 tracking-tight">
                {pendingInbounds}
              </span>
              <span className="text-xs font-mono text-slate-400 font-normal">
                {t("dashboard.kpi.pending")}
              </span>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-2.5 mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-normal">
              {t("f0.text.inboundQueue")}
            </span>
            <button
              onClick={() => navigate("/dashboard/orders")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors cursor-pointer"
              title={t("f0.text.goToOrderManagement")}
            >
              <span>{t("f0.text.orders")}</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Thẻ 4 - CẢNH BÁO QUẦY HẾT HÀNG */}
        <div
          className={`bg-white p-4.5 rounded-xl border border-slate-200/90 ${
            counterShortageCount > 0 ? "border-l-4 border-l-rose-500" : ""
          } shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {t("f0.text.counterStockAlert")}
              </span>
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center border shrink-0 ${
                  counterShortageCount > 0
                    ? "bg-rose-50 text-rose-600 border-rose-200"
                    : "bg-emerald-50 text-emerald-600 border-emerald-100"
                }`}
              >
                <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span
                className={`text-2xl font-mono font-bold tracking-tight ${
                  counterShortageCount > 0 ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {counterShortageCount}
              </span>
              <span className="text-xs font-mono text-slate-400 font-normal">
                {t("f0.text.countersLow")}
              </span>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-2.5 mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-normal">
              {counterShortageCount > 0
                ? t("f0.text.actionRequired")
                : t("f0.text.noAlerts")}
            </span>
            {counterShortageCount > 0 && (
              <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                {t("f0.text.urgent")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. NÂNG CẤP KHỐI NHẬN ĐỊNH TỰ ĐỘNG TỪ AI AGENT (AI INSIGHTS CARDS Ở PHẦN TRÊN CÙNG) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 3. CẢNH BÁO & KHUYẾN NGHỊ VẬN HÀNH (OPERATIONAL ALERTS & RECOMMENDATIONS) */}
      {/* ========================================================================= */}
      <section className="bg-slate-50 border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col gap-4 text-slate-800">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200/80 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
              <Cpu className="h-4.5 w-4.5 text-blue-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                {t("f0.text.operationalAlertsRecommendations")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("f0.text.keySignalsRequiringAttentionFromCurrentWarehouseOperationalData")}
              </p>
            </div>
          </div>
        </div>

        {/* Replenish trigger status alert toast */}
        {replenishResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.75} />
              <span className="font-medium">{replenishResult}</span>
            </div>
            <button
              onClick={() => navigate("/dashboard/replenishment")}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded transition-colors shrink-0 cursor-pointer"
            >
              {t("f0.text.openDispatchBoard")}
            </button>
          </div>
        )}

        {/* 3 INSIGHTS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
          {/* Card 1: Tối ưu không gian kho (Space Capacity Optimization) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-colors flex flex-col justify-between shadow-2xs">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded">
                  {t("f0.text.spaceCapacity")}
                </span>
                <div className="p-1 rounded bg-blue-50 text-blue-600 shrink-0">
                  <Layers className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
              </div>

              {/* Title & Metric Box */}
              <div className="mt-3 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">
                  {t("f0.text.spaceCapacityOptimization")}
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex justify-between items-center font-mono text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">Zone C:</span>
                    <span className="text-blue-700 font-bold">82%</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">Zone D:</span>
                    <span className="text-blue-700 font-bold">68%</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">{t("f0.text.freed")}</span>
                    <span className="text-emerald-700 font-bold">+15%</span>
                  </div>
                </div>
                <p className="text-left leading-relaxed text-slate-600 text-xs">
                  {t("f0.text.zoneCOperatesAt82FootprintAndZoneD")}
                </p>
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-3 mt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  document.getElementById("parallel-heatmap-section")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="font-mono text-[11px] text-slate-500">
                  {t("f0.text.targetZoneCD")}
                </span>
                <span className="text-blue-700 font-medium text-xs">
                  {t("f0.text.viewRackMap")}
                </span>
              </button>
            </div>
          </div>

          {/* Card 2: Động lực vốn lưu động (Capital & Liquidity Velocity) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-colors flex flex-col justify-between shadow-2xs">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded">
                  {t("f0.text.inventoryVelocity")}
                </span>
                <div className="p-1 rounded bg-indigo-50 text-indigo-600 shrink-0">
                  <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
              </div>

              {/* Title & Metric Box */}
              <div className="mt-3 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">
                  {t("f0.text.capitalLiquidityVelocity")}
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex justify-between items-center font-mono text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">{t("f0.text.velocity")}</span>
                    <span className="text-emerald-700 font-bold">{t("f0.text.14xWeek")}</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">{t("f0.text.risk")}</span>
                    <span className="text-indigo-700 font-bold">0.8%</span>
                  </div>
                </div>
                <p className="text-left leading-relaxed text-slate-600 text-xs">
                  {t("f0.text.inventoryTurnoverReached14xWeekWithSteadyLiquidity")}
                </p>
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-3 mt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setSelectedTicket("COCA-320");
                }}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="font-mono text-[11px] text-slate-500">
                  {t("f0.text.statusStable")}
                </span>
                <span className="text-indigo-700 font-medium text-xs">
                  {t("f0.text.reviewPoQueue")}
                </span>
              </button>
            </div>
          </div>

          {/* Card 3: Cảnh báo điểm nghẽn & Đứt gãy hàng quầy (Counter Bottleneck) */}
          <div className="bg-white p-4 rounded-xl border border-rose-200 hover:border-rose-300 transition-colors flex flex-col justify-between shadow-2xs">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                  {t("f0.text.counterBottleneck")}
                </span>
                <div className="p-1 rounded bg-rose-50 text-rose-600 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
              </div>

              {/* Title & Metric Box */}
              <div className="mt-3 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">
                  {t("f0.text.counterRestockBottleneck")}
                </h4>
                <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-2.5 flex justify-between items-center font-mono text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">{t("f0.text.location")}</span>
                    <span className="text-slate-900 font-bold">POS-Q01</span>
                  </div>
                  <span className="text-rose-200">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">{t("f0.text.threshold")}</span>
                    <span className="text-rose-700 font-bold">{t("f0.text.posCounter20")}</span>
                  </div>
                </div>
                <p className="text-left leading-relaxed text-slate-600 text-xs">
                  {t("f0.text.retailCounterPosQ01HasFallenBelowThe20")}
                </p>
              </div>
            </div>

            {/* Footer CTA Button */}
            <div className="pt-3 mt-3 border-t border-slate-100">
              <button
                onClick={handleTriggerAutoReplenish}
                disabled={replenishTriggering}
                className="w-full py-2 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <Zap className={`h-3.5 w-3.5 shrink-0 ${replenishTriggering ? "animate-spin" : ""}`} strokeWidth={2} />
                <span>
                  {replenishTriggering
                    ? t("f0.text.processing")
                    : t("f0.text.restockCounter")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SƠ ĐỒ SỬ DỤNG VỊ TRÍ KHO (WAREHOUSE LOCATION UTILIZATION) */}
      {/* ========================================================================= */}
      <section
        id="parallel-heatmap-section"
        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col"
      >
        {/* Heatmap Section Header & Color Legend */}
        <div className="p-4 sm:p-5 border-b border-slate-200/90 bg-slate-50/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg shrink-0">
              <MapPin className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                {t("f0.text.warehouseLocationUtilization")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("f0.text.monitorStorageUtilizationAcrossCoolDryAndRetailZones")}
              </p>
            </div>
          </div>

          {/* Color Legend Standardized & Compact */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600">20–80%</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-slate-600">&gt;80%</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-600">100%</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-rose-700 font-semibold">&lt;20%</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs border border-dashed border-slate-400 bg-slate-100 shrink-0" />
              <span className="text-slate-500">0%</span>
            </div>
          </div>
        </div>

        {/* 3 PARALLEL ZONE PANELS */}
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ========================================= */}
          {/* Phân Khu 1: PHÂN KHU MÁT (ZONE C - Sản Phẩm Mát) */}
          {/* ========================================= */}
          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/90 flex flex-col justify-between space-y-3">
            <div>
              {/* Zone Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                    <Boxes className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs tracking-tight">
                      {t("f0.text.coolZoneZoneC")}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {t("f0.text.chilledDairyProducts")}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                  WH-01-COOL
                </span>
              </div>

              {/* Zone Summary Strip */}
              <div className="mt-2.5 mb-3 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500 font-medium">
                  {coolBins.length} {isEn ? (coolBins.length === 1 ? "Bin" : "Bins") : "Kệ"}
                </span>
                <span className="text-blue-700 font-bold">
                  {coolStats.total} / {coolStats.max} {t("f0.text.pcs")} • {coolStats.rate}%
                </span>
              </div>

              {/* Rack Grid for Zone C */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {coolBins.map((bin) => renderBinCell(bin, false))}
              </div>
            </div>
          </div>

          {/* ========================================= */}
          {/* Phân Khu 2: PHÂN KHU KHÔ (ZONE D - Hàng Khô/Điện Tử) */}
          {/* ========================================= */}
          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/90 flex flex-col justify-between space-y-3">
            <div>
              {/* Zone Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                    <Package className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs tracking-tight">
                      {t("f0.text.dryZoneZoneD")}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {t("f0.text.dryInventoryElectronics")}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                  WH-01-DRY
                </span>
              </div>

              {/* Zone Summary Strip */}
              <div className="mt-2.5 mb-3 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500 font-medium">
                  {dryBins.length} {isEn ? (dryBins.length === 1 ? "Bin" : "Bins") : "Kệ"}
                </span>
                <span className="text-amber-700 font-bold">
                  {dryStats.total} / {dryStats.max} {t("f0.text.pcs")} • {dryStats.rate}%
                </span>
              </div>

              {/* Rack Grid for Zone D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dryBins.map((bin) => renderBinCell(bin, false))}
              </div>
            </div>
          </div>

          {/* ========================================= */}
          {/* Phân Khu 3: PHÂN KHU QUẦY BÁN LẺ (ZONE S - Kệ POS Tiền Phương) */}
          {/* ========================================= */}
          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/90 flex flex-col justify-between space-y-3">
            <div>
              {/* Zone Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                    <Store className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs tracking-tight flex items-center gap-1.5">
                      <span>{t("f0.text.retailCountersZoneS")}</span>
                      {counterShortageCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold">
                          {counterShortageCount} {t("f0.text.alert")}
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {t("f0.text.forwardPickCustomerFront")}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                  WH-01-STORE
                </span>
              </div>

              {/* Zone Summary Strip */}
              <div className="mt-2.5 mb-3 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500 font-medium">
                  {storeBins.length} {isEn ? (storeBins.length === 1 ? "Bin" : "Bins") : "Kệ"}
                </span>
                <span className="text-slate-900 font-bold">
                  {storeStats.total} / {storeStats.max} {t("f0.text.pcs")} • {storeStats.rate}%
                </span>
              </div>

              {/* Rack Grid for Zone S */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {storeBins.map((bin) => renderBinCell(bin, true))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. BIỂU ĐỒ NHẬP / XUẤT & ĐỀ XUẤT BỔ SUNG HÀNG */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KHỐI BÊN TRÁI (8 CỘT - lg:col-span-8): BIỂU ĐỒ LƯU LƯỢNG NHẬP/XUẤT KÈM THẺ TỔNG HỢP */}
        <section className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg shrink-0">
                <BarChart4 className="h-4.5 w-4.5" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                  {t(
                    "dashboard.chart.title",
                    t("f0.text.weeklyInboundOutbound"),
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t(
                    "dashboard.chart.subtitle",
                    t("f0.text.weeklyComparisonOfInboundPosAndOutboundSalesOrders"),
                  )}
                </p>
              </div>
            </div>

            {/* 3 Mini Summary Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-500 text-[11px] font-sans font-medium">{t("f0.text.inbound")}</span>
                <span className="text-blue-700 font-bold">{chartTotals.totalPO.toLocaleString()} {t("f0.text.pcs")}</span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-500 text-[11px] font-sans font-medium">{t("f0.text.outbound")}</span>
                <span className="text-emerald-700 font-bold">{chartTotals.totalSales.toLocaleString()} {t("f0.text.pcs")}</span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-500 text-[11px] font-sans font-medium">{t("f0.text.throughput")}</span>
                <span className="text-indigo-700 font-bold">{chartTotals.throughputRatio}%</span>
              </div>
            </div>
          </div>

          {/* BarChart Container */}
          <div className="p-4 sm:p-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} dy={8} />
                <YAxis fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} dx={-8} />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs font-mono space-y-1.5">
                          <div className="font-bold text-slate-300 pb-1 border-b border-slate-800">
                            {label}
                          </div>
                          <div className="flex items-center justify-between gap-4 text-blue-400">
                            <span>{t("f0.text.inboundPo")}</span>
                            <span className="font-bold">{payload[0]?.value} {t("f0.text.pcs")}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-emerald-400">
                            <span>{t("f0.text.outboundSales")}</span>
                            <span className="font-bold">{payload[1]?.value} {t("f0.text.pcs")}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{
                    fontSize: 12,
                    fontWeight: 500,
                    paddingTop: 8,
                  }}
                />
                <Bar
                  dataKey="PO"
                  name={t("dashboard.chart.po")}
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="Sales"
                  name={t("dashboard.chart.sales")}
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* KHỐI BÊN PHẢI (4 CỘT - lg:col-span-4): BẢNG ĐỀ XUẤT BỔ SUNG HÀNG */}
        <section className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg shrink-0">
                  <Mail className="h-4.5 w-4.5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-900 text-sm tracking-tight">
                    {t("f0.text.replenishmentProposals")}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t("f0.text.pendingPoProposalsAwaitingReview")}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                {mailQueue.length} {t("f0.text.pending")}
              </span>
            </div>

            {/* Queue Action List */}
            <div className="p-4 space-y-3">
              {mailQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-colors space-y-3 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <h4 className="font-semibold text-xs text-slate-900">
                          {item.label}
                        </h4>
                      </div>
                      <p className="text-xs font-mono text-slate-500 mt-0.5 pl-4 truncate max-w-[200px]">
                        {item.vendor}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
                      {t("f0.text.restock")}
                    </span>
                  </div>

                  {/* Proposed SKUs */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400 font-normal">
                      {t("f0.text.proposed")}
                    </span>
                    {item.items.map((skuItem, sIdx) => (
                      <span
                        key={sIdx}
                        className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700"
                      >
                        <span>{skuItem.product}</span>
                        <span className="text-emerald-700 font-bold">+{skuItem.proposed}</span>
                      </span>
                    ))}
                  </div>

                  {/* Secondary Action Button Xem đề xuất */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQueueId(item.id);
                      setSelectedTicket("COCA-320");
                    }}
                    className="w-full py-1.5 px-3 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{t("f0.text.reviewProposal")}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-3.5 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => navigate("/dashboard/orders")}
              className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <span>{t("f0.text.manageAllInboundOutboundOrders")}</span>
            </button>
          </div>
        </section>
      </div>

      {/* PO Mail Dispatch Drawer Backdrop */}
      <div
        className={`fixed inset-0 z-30 transition-opacity duration-300 ${
          selectedTicket === "COCA-320"
            ? "opacity-40 bg-black/40 block"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSelectedTicket(null)}
      />

      {/* Ticket PO Side Panel */}
      <div
        id="ticket-panel"
        className={`fixed top-0 right-0 h-full w-full sm:w-[540px] bg-white shadow-2xl z-40 transition-all duration-300 ease-in-out transform flex flex-col border-l border-slate-200 ${
          selectedTicket !== null
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between text-white sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30 shrink-0">
              <Mail className="h-4.5 w-4.5" strokeWidth={1.5} />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-white tracking-tight font-sans">
                {t("f0.text.poRestockEmailDispatch")}
              </h4>
              <p className="text-[10px] text-slate-400">
                {t("f0.text.automatedVendorReplenishmentOrder")}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedTicket(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={t("f0.text.closeDrawer")}
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Vendor Segmented Control Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 p-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {mailQueue.map((queue) => (
            <button
              key={queue.id}
              onClick={() => setActiveQueueId(queue.id)}
              className={`flex-1 min-w-[120px] rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeQueueId === queue.id
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/90"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
              }`}
            >
              <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{queue.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer Body: Enterprise Email Composer */}
        <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto bg-slate-50">
          <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-5 font-sans text-slate-800 flex flex-col shadow-xs flex-1 gap-4">
            {/* TO and SUBJECT fields */}
            <div className="space-y-3 pb-3 border-b border-slate-200 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold shrink-0 w-20 text-slate-500 text-[11px] uppercase tracking-wider">
                  {t("dashboard.email.to")}
                </span>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-indigo-700 flex-1 outline-none text-xs font-bold font-mono focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold shrink-0 w-20 text-slate-500 text-[11px] uppercase tracking-wider">
                  {t("dashboard.email.subject")}
                </span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold flex-1 outline-none text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Email Body & Proposed SKUs Table */}
            <div className="flex-1 flex flex-col gap-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                {t("f0.text.emailMessageBody")}
              </label>
              <textarea
                value={mailBody}
                onChange={(e) => setMailBody(e.target.value)}
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-3 text-xs leading-relaxed text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 resize-none min-h-[90px]"
                rows={4}
              />

              {currentQueueItem.items && currentQueueItem.items.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs mt-1">
                  <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-extrabold text-slate-700">
                    <span>{t("f0.text.proposedReplenishmentSkus")}</span>
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      {currentQueueItem.items.length} {t("f0.text.skus")}
                    </span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2 px-3">{t("f0.text.sku")}</th>
                        <th className="py-2 px-3 text-right">{t("f0.text.lowStock")}</th>
                        <th className="py-2 px-3 text-right">{t("f0.text.proposedQty")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {currentQueueItem.items.map((item) => (
                        <tr key={item.product} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{item.product}</td>
                          <td className="py-2 px-3 text-right">
                            <span className="inline-block font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              {item.lowStock}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="inline-block font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              +{item.proposed}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer shadow-2xs"
              >
                {t("f0.text.close")}
              </button>

              <button
                type="button"
                onClick={() => {
                  const successMsg = isEn
                    ? `✅ PO order successfully dispatched to ${vendor} (${currentQueueItem.label})!`
                    : `✅ Đã phê duyệt & gửi đơn đặt hàng PO thành công tới ${vendor} (${currentQueueItem.label})!`;
                  setReplenishResult(successMsg);
                  if (onTriggerAuditLog) {
                    onTriggerAuditLog(
                      t("f0.text.poEmailDispatched"),
                      isEn
                        ? `Manager approved and dispatched PO for ${currentQueueItem.label} (${vendor})`
                        : `Người quản lý phê duyệt và gửi đơn PO cho ${currentQueueItem.label} (${vendor})`
                    );
                  }
                  triggerHubUpdate(`Manager APPROVED PO for ${vendor}`);
                  setSelectedTicket(null);
                  setTimeout(() => {
                    setReplenishResult(null);
                  }, 6000);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Check className="h-4 w-4 stroke-[2.5]" strokeWidth={2} />
                <span>{t("f0.text.approveDispatchPo")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SLIDE-OVER DRAWER (RIGHT PANEL) - TRIGGERED BY CLICKING ANY BIN CELL */}
      {/* ========================================================================= */}
      {selectedBin && (
        <BinDetailModal
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedBin(null);
          }}
          selectedBin={selectedBin}
          allBins={bins}
          zones={zones}
          products={products}
          onTransfer={onTransfer || (async () => {})}
          isEn={isEn}
        />
      )}
    </div>
  );
}
