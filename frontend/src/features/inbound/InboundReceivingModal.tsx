/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  ShieldAlert,
  Boxes,
  MapPin,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  Check,
  ChevronRight,
  PackageCheck,
  Ban,
  ArrowRight
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DetailedOrder } from "../orders/OrderManagement";
import { Product, Bin } from "../../types/index";
import { StatusBadge } from "../../components/common/StatusBadge";

export interface InboundReceivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DetailedOrder | null;
  products?: Product[];
  bins?: Bin[];
  lang?: string;
  onReceiptUpdated?: () => void | Promise<void>;
  onShowToast?: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    title?: string
  ) => void;
}

interface ItemReceivingDraft {
  sku: string;
  name: string;
  expectedQty: number;
  previouslyReceivedQty: number; // Snapshot of receivedQty at open time
  remainingQty: number;
  receiveThisTime: number; // DELTA to receive this action
  lotNumber: string;
  expiryDate: string;
  binCode: string;
  trackingMode?: "None" | "Lot" | "Serial";
  hasLpn?: boolean;
}

interface LiveReceiptPresentation {
  mode: 'api';
  title: string;
  context?: React.ReactNode;
  onClose: () => void;
  busy: boolean;
  children: React.ReactNode;
}

export default function InboundReceivingModal(props: InboundReceivingModalProps | LiveReceiptPresentation) {
  return 'mode' in props ? <LiveReceiptModal {...props} /> : <DemoInboundReceivingModal {...props} />;
}

function LiveReceiptModal({ title, context, onClose, busy, children }: LiveReceiptPresentation) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-label={t('f4.detail')} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className="m-auto p-0 w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] rounded-2xl border border-slate-200 shadow-2xl backdrop:bg-slate-950/70 backdrop:backdrop-blur-xs enterprise-modal-container">
    <div className="flex flex-col max-h-[90vh] bg-white">
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-3.5 min-w-0"><div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 shrink-0"><Inbox className="w-5 h-5" /></div><div className="min-w-0"><p className="text-xs text-slate-400 mb-1">{t('f4.detail')}</p><h2 className="text-base sm:text-lg font-bold font-mono tracking-tight break-words">{title}</h2>{context && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">{context}</div>}</div></div>
        <button aria-label={t('f4.close')} disabled={busy} onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-40"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-4 sm:p-6 overflow-y-auto enterprise-modal-body min-h-0">{children}</div>
    </div>
  </dialog>;
}

function DemoInboundReceivingModal({
  isOpen,
  onClose,
  order,
  products = [],
  bins = [],
  lang,
  onReceiptUpdated,
  onShowToast,
}: InboundReceivingModalProps) {
  const { t, i18n } = useTranslation();
  const isEn = lang === "en-US" || i18n.language?.startsWith("en");

  // Workflow Tab: "receiving" (Dock verification) | "putaway" (Separate step: storage bin assignment)
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<"receiving" | "putaway">("receiving");

  // Snapshot State: holds the loaded receipt state
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<string>("");
  const [snapshotVersion, setSnapshotVersion] = useState<number>(1);
  const [isSnapshotLoaded, setIsSnapshotLoaded] = useState<boolean>(true);

  // Form lines draft state
  const [itemDrafts, setItemDrafts] = useState<ItemReceivingDraft[]>([]);

  // Simulation controls for UX testing in AI Studio Preview
  const [simulationMode, setSimulationMode] = useState<"normal" | "conflict409" | "timeout504" | "missingSnapshot">("normal");

  // Dedicated Error / Edge Case States
  const [conflictState, setConflictState] = useState<{
    isOpen: boolean;
    serverSnapshot: Record<string, number>; // SKU -> current server receivedQty
  } | null>(null);

  const [timeoutState, setTimeoutState] = useState<{
    isOpen: boolean;
    pendingDeltaSummary: string;
  } | null>(null);

  // Confirmation Modal State before submitting deltas
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isPuttingAway, setIsPuttingAway] = useState(false);

  // Put-away selected bin assignments
  const [putAwayAssignments, setPutAwayAssignments] = useState<Record<string, string>>({});

  // Initialize or reload receipt snapshot
  const loadReceiptSnapshot = (currentOrder: DetailedOrder | null) => {
    if (!currentOrder) return;

    const timeStr = new Date().toLocaleTimeString(isEn ? "en-US" : "vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setSnapshotTimestamp(timeStr);
    setSnapshotVersion((v) => v + 1);
    setIsSnapshotLoaded(true);
    setConflictState(null);
    setTimeoutState(null);
    setShowConfirmModal(false);

    const initialDrafts: ItemReceivingDraft[] = (currentOrder.items || []).map((it, idx) => {
      const prod = products.find((p) => p.sku === it.sku);
      const expected = Number(it.expectedQty) || 0;
      const received = Number(it.receivedQty) || 0;
      const remaining = Math.max(0, expected - received);

      // Default suggested delta: remaining if remaining > 0, else 0
      const initialDelta = remaining > 0 ? (remaining > 50 ? 20 : remaining) : 0;
      const defaultLot = it.lotNumber || `LOT-${new Date().getFullYear()}-${it.sku.slice(0, 3)}-${String(idx + 1).padStart(2, "0")}`;
      const defaultExpiry = it.expiryDate || "2027-12-31";
      const defaultBin = it.binCode || (it.sku.startsWith("MILK") ? "C1-A01-N01" : "D2-A02-N01");

      return {
        sku: it.sku,
        name: it.name || prod?.name || it.sku,
        expectedQty: expected,
        previouslyReceivedQty: received,
        remainingQty: remaining,
        receiveThisTime: initialDelta,
        lotNumber: defaultLot,
        expiryDate: defaultExpiry,
        binCode: defaultBin,
        trackingMode: it.trackingMode || (it.sku.includes("SERIAL") ? "Serial" : "Lot"),
        hasLpn: it.hasLpn || false,
      };
    });

    setItemDrafts(initialDrafts);

    // Put-away is mock/UI-only until backend workflow is verified.
    const initialBins: Record<string, string> = {};
    initialDrafts.forEach((d) => {
      const qty = Math.max(0, d.previouslyReceivedQty || d.expectedQty);
      const fittingBin = bins.find((b) => (b.currentOccupancy + qty) <= b.maxCapacity) || bins.find((b) => b.code === d.binCode) || bins[0];
      initialBins[d.sku] = fittingBin ? fittingBin.code : (d.binCode || "D2-A02-N01");
    });
    setPutAwayAssignments(initialBins);
  };

  useEffect(() => {
    if (isOpen && order) {
      loadReceiptSnapshot(order);
      const isAllFullyReceived = (order.items || []).every(
        (it) => (it.receivedQty || 0) >= it.expectedQty && it.expectedQty > 0
      );
      if (isAllFullyReceived && order.status !== "Completed") {
        setActiveWorkflowTab("putaway");
      } else {
        setActiveWorkflowTab("receiving");
      }
    }
  }, [isOpen, order]);

  // Validation calculations
  const totalExpected = useMemo(
    () => itemDrafts.reduce((acc, it) => acc + it.expectedQty, 0),
    [itemDrafts]
  );
  const totalPreviouslyReceived = useMemo(
    () => itemDrafts.reduce((acc, it) => acc + it.previouslyReceivedQty, 0),
    [itemDrafts]
  );
  const totalReceiveDelta = useMemo(
    () => itemDrafts.reduce((acc, it) => acc + Math.max(0, it.receiveThisTime || 0), 0),
    [itemDrafts]
  );
  const totalProjected = totalPreviouslyReceived + totalReceiveDelta;
  const totalRemainingAfter = Math.max(0, totalExpected - totalProjected);

  // Tracking restriction check: UI only supports None & Lot receiving; Serial/LPN is blocked
  const isSerialOrLpnPresent = useMemo(() => {
    return itemDrafts.some(
      (it) => it.trackingMode === "Serial" || it.hasLpn || it.sku.toUpperCase().includes("SERIAL")
    );
  }, [itemDrafts]);

  // Receiving progress state:
  const isAllFullyReceived = totalPreviouslyReceived >= totalExpected && totalExpected > 0;
  const isPartiallyReceived = totalPreviouslyReceived > 0 && !isAllFullyReceived;
  const isNotReceivedYet = totalPreviouslyReceived === 0;

  // UX Rule 1: Receive delta must be > 0 across the action
  const hasValidDelta = totalReceiveDelta > 0;

  // UX Rule 2: Cannot receive if any delta is negative or exceeds remaining
  const hasNegativeDelta = itemDrafts.some((it) => it.receiveThisTime < 0);
  const hasExceededDelta = itemDrafts.some((it) => it.receiveThisTime > it.remainingQty);

  // UX Rule 3: Cannot receive when existing received quantity snapshot is unavailable
  const isSnapshotValid = isSnapshotLoaded && simulationMode !== "missingSnapshot";

  const isReceiveSubmitDisabled =
    !isSnapshotValid ||
    !hasValidDelta ||
    hasNegativeDelta ||
    hasExceededDelta ||
    isSerialOrLpnPresent ||
    isAllFullyReceived ||
    isSubmitting;

  // Filter items with delta > 0 for confirmation and submit
  const itemsToReceive = useMemo(() => {
    return itemDrafts.filter((it) => it.receiveThisTime > 0);
  }, [itemDrafts]);

  // Items eligible for Put-away: receivedQty > putAwayQty
  const itemsReadyForPutAway = useMemo(() => {
    if (!order) return [];
    return (order.items || []).filter((it) => {
      const received = it.receivedQty || 0;
      const putAway = (it as any).putAwayQty || 0;
      return received > putAway;
    });
  }, [order]);

  // Check if any assigned bin has projected occupancy exceeding max capacity
  const isAnyBinOverloaded = useMemo(() => {
    return itemsReadyForPutAway.some((it) => {
      const qtyToPutAway = Math.max(0, (it.receivedQty || 0) - ((it as any).putAwayQty || 0));
      const targetBinCode = putAwayAssignments[it.sku] || it.binCode || (bins[0]?.code || "D2-A02-N01");
      const targetBin = bins.find((b) => b.code === targetBinCode) || bins[0];
      if (!targetBin) return false;
      return (targetBin.currentOccupancy + qtyToPutAway) > targetBin.maxCapacity;
    });
  }, [itemsReadyForPutAway, putAwayAssignments, bins]);

  // Handle line item delta change (DELTA ONLY: non-negative, <= remainingQty)
  const handleDeltaChange = (sku: string, rawVal: string) => {
    if (rawVal === "") {
      setItemDrafts((prev) =>
        prev.map((d) => (d.sku === sku ? { ...d, receiveThisTime: 0 } : d))
      );
      return;
    }
    const val = parseInt(rawVal, 10);
    setItemDrafts((prev) =>
      prev.map((d) => {
        if (d.sku === sku) {
          if (isNaN(val) || val <= 0) {
            return { ...d, receiveThisTime: 0 };
          }
          return { ...d, receiveThisTime: val };
        }
        return d;
      })
    );
  };

  // Quick action: Set delta to remaining for a line item
  const handleSetMaxRemaining = (sku: string) => {
    setItemDrafts((prev) =>
      prev.map((d) => {
        if (d.sku === sku) {
          return { ...d, receiveThisTime: d.remainingQty };
        }
        return d;
      })
    );
  };

  // Handle lot / expiry change
  const handleLotChange = (sku: string, field: "lotNumber" | "expiryDate", val: string) => {
    setItemDrafts((prev) =>
      prev.map((d) => {
        if (d.sku === sku) {
          return { ...d, [field]: val };
        }
        return d;
      })
    );
  };

  // Safe Reload Action: Refetches the latest receipt from the server/state
  const handleReloadReceipt = async () => {
    if (!order) return;
    setIsReloading(true);
    try {
      const res = await fetch("/api/wms/all-data");
      if (res.ok) {
        const data = await res.json();
        const latestInbound = (data.inbounds || []).find((inb: any) => inb.id === order.code);
        if (latestInbound) {
          const mappedOrder: DetailedOrder = {
            ...order,
            status: latestInbound.status,
            items: latestInbound.items || [],
          };
          loadReceiptSnapshot(mappedOrder);
        } else {
          loadReceiptSnapshot(order);
        }
      } else {
        loadReceiptSnapshot(order);
      }
      setConflictState(null);
      setTimeoutState(null);
      setShowConfirmModal(false);
      if (onShowToast) {
        onShowToast(
          isEn ? "Inbound receipt reloaded successfully" : "Đã tải lại dữ liệu phiếu nhập thành công",
          "info",
          isEn ? "Receipt Synchronized" : "Đồng bộ phiếu nhập"
        );
      }
    } catch (e) {
      loadReceiptSnapshot(order);
    } finally {
      setIsReloading(false);
    }
  };

  // Primary Action: Confirm Receipt (Xác nhận nhận hàng)
  // Submits the prepared delta payload matching future backend contract
  const executeConfirmReceipt = async () => {
    if (!order || isReceiveSubmitDisabled || itemsToReceive.length === 0) return;

    setIsSubmitting(true);
    setConflictState(null);
    setTimeoutState(null);
    setShowConfirmModal(false);

    try {
      const isSimulatingConflict = simulationMode === "conflict409";
      const isSimulatingTimeout = simulationMode === "timeout504";

      // Prepare exact backend contract format:
      // quantityReceived = DELTA nhận thêm lần này.
      // expectedReceivedQuantity = số lượng đã nhận trước lần submit này.
      // KHÔNG gửi cumulative quantityReceived.
      const payload = {
        inboundReceiptId: order.code,
        id: order.code,
        receivedItems: itemsToReceive.map((it) => ({
          itemId: it.sku,
          sku: it.sku,
          quantityReceived: it.receiveThisTime, // DELTA ONLY
          expectedReceivedQuantity: it.previouslyReceivedQty, // SNAPSHOT BEFORE SUBMIT
          lotNumber: it.lotNumber,
          expiryDate: it.expiryDate,
        })),
        items: itemsToReceive.map((it) => ({
          sku: it.sku,
          receiveThisTime: it.receiveThisTime,
          delta: it.receiveThisTime,
          expectedReceivedQuantity: it.previouslyReceivedQty,
          lotNumber: it.lotNumber,
          expiryDate: it.expiryDate,
        })),
        operator: "Staff (Receiving Dock)",
        simulateConflict: isSimulatingConflict,
        simulateTimeout: isSimulatingTimeout,
        expectedSnapshotTime: snapshotTimestamp,
        expectedVersion: snapshotVersion,
      };

      const res = await fetch("/api/wms/inbounds/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Handle 409 Concurrency Conflict
      if (res.status === 409 || data.error === "Conflict409") {
        const currentServerQuantities: Record<string, number> = {};
        if (data.currentSnapshot?.items) {
          data.currentSnapshot.items.forEach((it: any) => {
            currentServerQuantities[it.sku] = it.receivedQty || 0;
          });
        } else {
          itemDrafts.forEach((it) => {
            currentServerQuantities[it.sku] = it.previouslyReceivedQty + 20;
          });
        }

        setConflictState({
          isOpen: true,
          serverSnapshot: currentServerQuantities,
        });

        if (onShowToast) {
          onShowToast(
            t(
              "inboundReceiving.conflict409.description",
              isEn
                ? "409 Conflict: Receipt data was modified by another operator"
                : "Xung đột 409: Dữ liệu phiếu đã bị thay đổi bởi phiên làm việc khác"
            ),
            "warning",
            t("inboundReceiving.conflict409.title", isEn ? "Data Conflict" : "Xung đột dữ liệu")
          );
        }
        return;
      }

      // Handle 504 Timeout Uncertainty
      if (res.status === 504 || data.error === "Timeout504") {
        const summary = itemsToReceive
          .map((it) => `${it.sku} (+${it.receiveThisTime})`)
          .join(", ");

        setTimeoutState({
          isOpen: true,
          pendingDeltaSummary: summary,
        });

        if (onShowToast) {
          onShowToast(
            t(
              "inboundReceiving.timeoutUncertainty.description",
              isEn
                ? "Status of previous receiving request is undetermined"
                : "Chưa xác định kết quả nhận hàng"
            ),
            "error",
            t("inboundReceiving.timeoutUncertainty.title", isEn ? "Connection Timeout" : "Gián đoạn mạng")
          );
        }
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || (isEn ? "Failed to confirm receipt" : "Lỗi xác nhận nhận hàng"));
      }

      // Success receiving at dock
      const successMsg = isEn
        ? `Successfully confirmed receiving ${totalReceiveDelta} units at dock! Goods are staged for put-away.`
        : `Đã xác nhận nhận thành công ${totalReceiveDelta} đơn vị tại dock! Hàng hóa sẵn sàng để cất vào kệ (Put-away).`;

      if (onShowToast) {
        onShowToast(successMsg, "success", isEn ? "Receipt Confirmed" : "Đã Xác Nhận Nhận Hàng");
      }

      if (onReceiptUpdated) {
        await onReceiptUpdated();
      }

      // Reload snapshot to update counts and stay on the screen
      await handleReloadReceipt();
    } catch (err: any) {
      if (!conflictState && !timeoutState) {
        if (onShowToast) {
          onShowToast(
            err.message || (isEn ? "Error during receiving" : "Lỗi trong quá trình nhận hàng"),
            "error"
          );
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Put-away Action: Moves received items into target storage bins
  const handleExecutePutAway = async () => {
    if (!order || itemsReadyForPutAway.length === 0) return;

    setIsPuttingAway(true);
    try {
      const res = await fetch("/api/wms/inbounds/put-away", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.code,
          operator: "Staff (Put-away to Bin)",
          assignments: putAwayAssignments,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to execute put-away");
      }

      const successMsg = isEn
        ? `Put-away completed! Stock successfully allocated into storage bins.`
        : `Hoàn tất cất hàng vào kệ! Tồn kho đã được ghi nhận vào các ô kệ lưu kho.`;

      if (onShowToast) {
        onShowToast(successMsg, "success", isEn ? "Put-away Completed" : "Hoàn Tất Cất Kệ");
      }

      if (onReceiptUpdated) {
        await onReceiptUpdated();
      }

      onClose();
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(err.message || "Put-away failed", "error");
      }
    } finally {
      setIsPuttingAway(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto enterprise-modal-container">
        {/* ======================================================== */}
        {/* 1. MODAL HEADER & ENTERPRISE CONTEXT RIBBON              */}
        {/* ======================================================== */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
                  {order.code}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {order.poNumber || order.code}
                </span>

                {/* Status Badge */}
                <StatusBadge
                  variant={
                    order.status === "Completed"
                      ? "green"
                      : isAllFullyReceived || order.status === "Received"
                      ? "blue"
                      : isPartiallyReceived || order.status === "Processing" || order.status === "In Progress"
                      ? "blue"
                      : "amber"
                  }
                  size="sm"
                  label={
                    order.status === "Completed"
                      ? (isEn ? "Completed" : "Hoàn tất")
                      : isAllFullyReceived || order.status === "Received"
                      ? (isEn ? "Waiting for Put-away" : "Chờ cất kệ")
                      : isPartiallyReceived || order.status === "Processing" || order.status === "In Progress"
                      ? (isEn ? "Receiving" : "Đang nhận hàng")
                      : (isEn ? "Waiting for Receiving" : "Chờ nhận hàng")
                  }
                />
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-300">{order.partner}</span>
                <span>•</span>
                <span className="font-mono text-slate-300">
                  {t("inboundReceiving.metadata.expectedDate", isEn ? "Expected Date" : "Ngày giao")}: {order.createdAt}
                </span>
                <span>•</span>
                <span>Central Hub WH-01</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReloadReceipt}
              disabled={isReloading}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={t("inboundReceiving.buttons.reloadReceipt", isEn ? "Reload snapshot" : "Tải lại phiếu")}
            >
              <RefreshCw className={`w-4 h-4 ${isReloading ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label={t("inboundReceiving.buttons.close", isEn ? "Close" : "Đóng")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. THREE-STEP WMS WORKFLOW STEPPER                       */}
        {/* ======================================================== */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
            {/* Step 1: Create Receipt */}
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200 text-xs">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-slate-900 block truncate">
                  {t("inboundReceiving.workflow.step1", isEn ? "1. Create Receipt" : "1. Tạo phiếu nhập")}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {t("inboundReceiving.workflow.step1Desc", isEn ? "PO voucher initialized" : "Đã lập chứng từ PO")}
                </span>
              </div>
            </div>

            {/* Step 2: Confirm Receipt (Dock Receiving) */}
            <button
              onClick={() => setActiveWorkflowTab("receiving")}
              className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs text-left transition cursor-pointer ${
                activeWorkflowTab === "receiving"
                  ? "bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20 text-blue-900 font-bold"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 ${
                  activeWorkflowTab === "receiving"
                    ? "bg-blue-600 text-white"
                    : isAllFullyReceived
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {isAllFullyReceived ? <Check className="w-3.5 h-3.5" /> : "2"}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold block truncate">
                  {t("inboundReceiving.workflow.step2", isEn ? "2. Confirm Receipt" : "2. Xác nhận nhận hàng")}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {t("inboundReceiving.workflow.step2Desc", isEn ? "Dock verification (No bin update)" : "Kiểm nhận tại Dock")}
                </span>
              </div>
            </button>

            {/* Step 3: Put-away */}
            <button
              onClick={() => setActiveWorkflowTab("putaway")}
              className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs text-left transition cursor-pointer ${
                activeWorkflowTab === "putaway"
                  ? "bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-900 font-bold"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 ${
                  activeWorkflowTab === "putaway"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                3
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold block truncate">
                    {t("inboundReceiving.workflow.step3", isEn ? "3. Put-away" : "3. Cất hàng vào kệ")}
                  </span>
                  {itemsReadyForPutAway.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-mono font-bold">
                      {itemsReadyForPutAway.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 block truncate">
                  {t("inboundReceiving.workflow.step3Desc", isEn ? "Storage Bin Allocation" : "Phân bổ vị trí Bin")}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. SIMULATION & SNAPSHOT DIAGNOSTIC TOOLBAR              */}
        {/* ======================================================== */}
        <div className="px-6 py-2 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] shrink-0">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-bold text-slate-700 font-mono flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              {t("inboundReceiving.metadata.snapshotTime", isEn ? "Snapshot:" : "Bản chụp lúc:")}
            </span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-800">
              {snapshotTimestamp || "10:00:00"} (v{snapshotVersion})
            </span>
            {!isSnapshotValid && (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {t("inboundReceiving.validation.snapshotUnavailable", isEn ? "Snapshot Unavailable" : "Bản chụp không khả dụng")}
              </span>
            )}
          </div>

          {/* Interactive Simulation Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              {t("inboundReceiving.simulation.label", isEn ? "Simulation Test:" : "Mô phỏng thử nghiệm:")}
            </span>
            <select
              value={simulationMode}
              onChange={(e) => setSimulationMode(e.target.value as any)}
              className="bg-white border border-slate-300 text-slate-800 text-[11px] font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="normal">
                {t("inboundReceiving.simulation.normal", isEn ? "Normal Receiving (Success)" : "Bình thường (Thành công)")}
              </option>
              <option value="conflict409">
                {t("inboundReceiving.simulation.conflict409", isEn ? "Simulate 409 Concurrency Conflict" : "Mô phỏng Xung đột 409")}
              </option>
              <option value="timeout504">
                {t("inboundReceiving.simulation.timeout", isEn ? "Simulate 504 Network Timeout Uncertainty" : "Mô phỏng Timeout Mạng")}
              </option>
              <option value="missingSnapshot">
                {t("inboundReceiving.simulation.noSnapshot", isEn ? "Simulate Missing Snapshot (Disabled)" : "Mô phỏng Mất Bản Chụp")}
              </option>
            </select>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. MAIN SCROLLABLE CONTENT BODY                          */}
        {/* ======================================================== */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 enterprise-modal-body">
          {/* ------------------------------------------------------ */}
          {/* TRACKING RESTRICTION NOTICE (SERIAL / LPN BLOCKED)     */}
          {/* ------------------------------------------------------ */}
          {isSerialOrLpnPresent && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-xs text-amber-900 flex items-start gap-3 shadow-xs animate-fadeIn">
              <Ban className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-black text-amber-950 uppercase tracking-wide">
                  {t("inboundReceiving.restrictions.unsupportedTracking", isEn ? "Receiving for Serial/LPN is not supported in this version." : "Quy trình nhận hàng cho Serial/LPN chưa được hỗ trợ trong phiên bản này.")}
                </h4>
                <p className="text-[11px] text-amber-800">
                  {t("inboundReceiving.restrictions.onlyNoneAndLotSupported", isEn ? "The system currently supports standard (None) and Lot-tracked receiving only." : "Hệ thống phiên bản hiện tại chỉ hỗ trợ kiểm nhận hàng không theo dõi (None) hoặc theo Lô (Lot).")}
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------ */}
          {/* A. 409 CONCURRENCY CONFLICT DEDICATED BANNER / STATE    */}
          {/* ------------------------------------------------------ */}
          {conflictState?.isOpen && (
            <div className="p-4.5 rounded-2xl bg-amber-50 border-2 border-amber-400 shadow-md animate-fadeIn text-xs space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                    {t("inboundReceiving.conflict409.title", isEn ? "Inbound Receipt Data Changed (409 Conflict)" : "Dữ liệu phiếu nhập đã thay đổi")}
                  </h3>
                  <p className="text-amber-900 mt-1 leading-relaxed">
                    {t("inboundReceiving.conflict409.description", isEn ? "Received quantities changed since you opened the receipt. To maintain data consistency, confirmation was halted." : "Số lượng đã nhận trên hệ thống đã thay đổi từ lần bạn mở phiếu. Vui lòng tải lại dữ liệu trước khi tiếp tục.")}
                  </p>
                  <p className="text-[11px] text-amber-800 font-semibold mt-1">
                    {t("inboundReceiving.conflict409.note", isEn ? "Automatic retry is disabled. Please reload the receipt to view latest quantities." : "Hệ thống không tự động thử lại để đảm bảo an toàn. Vui lòng tải lại phiếu để kiểm tra lại số lượng mới nhất.")}
                  </p>
                </div>
              </div>

              {/* Conflict Snapshot Comparison Table */}
              <div className="bg-white rounded-xl border border-amber-300 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-100/60 font-mono font-bold text-amber-900 text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">{isEn ? "SKU" : "Mã SKU"}</th>
                      <th className="py-2 px-3">{isEn ? "Expected" : "Dự kiến"}</th>
                      <th className="py-2 px-3 text-amber-700">
                        {isEn ? "Your Snapshot" : "Đã nhận lúc mở phiếu"}
                      </th>
                      <th className="py-2 px-3 text-rose-700 font-extrabold">
                        {isEn ? "Current in Database" : "Đã nhận thực tế trên hệ thống"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 font-mono">
                    {itemDrafts.map((d) => {
                      const serverQty = conflictState.serverSnapshot[d.sku] ?? d.previouslyReceivedQty;
                      const hasChanged = serverQty !== d.previouslyReceivedQty;
                      return (
                        <tr key={d.sku} className={hasChanged ? "bg-amber-50/50" : ""}>
                          <td className="py-2 px-3 font-bold text-slate-900">{d.sku}</td>
                          <td className="py-2 px-3 text-slate-600">{d.expectedQty}</td>
                          <td className="py-2 px-3 text-slate-700">{d.previouslyReceivedQty}</td>
                          <td className="py-2 px-3 font-black text-rose-700">
                            {serverQty} {hasChanged && (isEn ? "(Modified)" : "(+ Đã đổi)")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Actions: Reload Receipt vs Cancel (NO AUTO RETRY) */}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setConflictState(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t("inboundReceiving.buttons.cancel", isEn ? "Cancel" : "Hủy")}
                </button>
                <button
                  type="button"
                  onClick={handleReloadReceipt}
                  disabled={isReloading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin" : ""}`} />
                  <span>{t("inboundReceiving.buttons.reloadReceipt", isEn ? "Reload Receipt" : "Tải lại phiếu")}</span>
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------ */}
          {/* B. NETWORK TIMEOUT UNCERTAINTY DEDICATED BANNER / STATE */}
          {/* ------------------------------------------------------ */}
          {timeoutState?.isOpen && (
            <div className="p-4.5 rounded-2xl bg-rose-50 border-2 border-rose-400 shadow-md animate-fadeIn text-xs space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-800 shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5 text-rose-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-rose-950 uppercase tracking-wide">
                    {t("inboundReceiving.timeoutUncertainty.title", isEn ? "Processing Status Uncertain (Timeout)" : "Không xác định trạng thái xử lý")}
                  </h3>
                  <p className="text-rose-900 mt-1 leading-relaxed">
                    {t("inboundReceiving.timeoutUncertainty.description", isEn ? "Status of previous receiving request is undetermined. Do not submit new figures until receipt status has been checked." : "Chưa xác định kết quả nhận hàng. Không gửi lại với số liệu mới cho đến khi trạng thái phiếu được kiểm tra.")}
                  </p>
                  <div className="mt-2 p-2 rounded-lg bg-white border border-rose-200 text-[11px] font-mono text-slate-700">
                    <span className="font-bold text-rose-700">
                      {isEn ? "Pending Delta Unverified:" : "Lô nhận chưa xác minh:"}{" "}
                    </span>
                    {timeoutState.pendingDeltaSummary}
                  </div>
                  <p className="text-[11px] text-rose-800 font-semibold mt-1.5">
                    {t("inboundReceiving.timeoutUncertainty.note", isEn ? "The system will not silently create a new receiving delta." : "Hệ thống không tự động tạo thêm số lượng nhận mới để tránh nhận trùng lặp hàng.")}
                  </p>
                </div>
              </div>

              {/* Actions: Safe Check Status & Refresh vs Close */}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setTimeoutState(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t("inboundReceiving.buttons.close", isEn ? "Close" : "Đóng")}
                </button>
                <button
                  type="button"
                  onClick={handleReloadReceipt}
                  disabled={isReloading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin" : ""}`} />
                  <span>
                    {t("inboundReceiving.buttons.safeCheckStatus", isEn ? "Check Receipt Status" : "Kiểm tra trạng thái phiếu")}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------ */}
          {/* TAB 1: RECEIVING EXPERIENCE (XÁC NHẬN NHẬN HÀNG)       */}
          {/* ------------------------------------------------------ */}
          {activeWorkflowTab === "receiving" && (
            <div className="space-y-5">
              {/* Informative Guidance Banner */}
              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <PackageCheck className="w-4.5 h-4.5 text-blue-700 shrink-0" />
                  <span>
                    {isEn
                      ? "Dock Staging: Verify received amounts below. Goods are staged at dock and NOT added to storage bins until Put-away."
                      : "Kiểm nhận tại Dock: Kiểm đếm thực tế và nhập số lượng nhận lần này. Hàng hóa ghi nhận tại cửa nhập và CHƯA cộng vào ô kệ lưu kho cho tới bước Cất kệ."}
                  </span>
                </div>
                <div className="text-[11px] font-mono font-bold text-blue-800 bg-blue-100/90 px-3 py-1 rounded-lg shrink-0">
                  {totalPreviouslyReceived} / {totalExpected} ({Math.round((totalPreviouslyReceived / (totalExpected || 1)) * 100)}%)
                </div>
              </div>

              {/* Receipt Line Items Receiving Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[760px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-3.5">{t("inboundReceiving.table.skuAndProduct", isEn ? "SKU & Product Name" : "SKU & Sản Phẩm")}</th>
                        <th className="py-3 px-3">{t("inboundReceiving.table.lotInfo", isEn ? "Lot & Expiry" : "Thông Tin Lô / HSD")}</th>
                        <th className="py-3 px-3 text-center">{t("inboundReceiving.table.expectedQty", isEn ? "Expected" : "Dự Kiến")}</th>
                        <th className="py-3 px-3 text-center">{t("inboundReceiving.table.alreadyReceived", isEn ? "Already Received" : "Đã Nhận")}</th>
                        <th className="py-3 px-3 text-center">{t("inboundReceiving.table.remainingQty", isEn ? "Remaining" : "Còn Lại")}</th>
                        <th className="py-3 px-3 w-40">{t("inboundReceiving.table.receiveThisTime", isEn ? "Receive This Time" : "Nhận Lần Này")}</th>
                        <th className="py-3 px-3 text-right">{t("inboundReceiving.table.projectedTotal", isEn ? "Projected Total" : "Tổng Sau Xác Nhận")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemDrafts.map((row) => {
                        const projected = row.previouslyReceivedQty + (row.receiveThisTime || 0);
                        const projectedPct = Math.round((projected / (row.expectedQty || 1)) * 100);
                        const isOver = row.receiveThisTime > row.remainingQty;
                        const isItemFullyReceived = row.remainingQty === 0;

                        return (
                          <tr key={row.sku} className="hover:bg-slate-50/70 transition-colors">
                            {/* SKU & Product */}
                            <td className="py-3.5 px-3.5">
                              <div className="font-mono font-extrabold text-blue-700 text-xs flex items-center gap-1.5">
                                <span>{row.sku}</span>
                                {row.trackingMode === "Lot" && (
                                  <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    LOT
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-700 font-medium line-clamp-1 mt-0.5">
                                {row.name}
                              </div>
                            </td>

                            {/* Lot / Batch Info */}
                            <td className="py-3.5 px-3">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={row.lotNumber}
                                  onChange={(e) => handleLotChange(row.sku, "lotNumber", e.target.value)}
                                  placeholder="LOT-XXXX"
                                  disabled={isItemFullyReceived}
                                  className="w-28 px-2 py-0.8 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                />
                                <div className="text-[10px] font-mono text-slate-400">
                                  HSD: {row.expiryDate}
                                </div>
                              </div>
                            </td>

                            {/* Expected Quantity */}
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-800">
                              <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                                {row.expectedQty}
                              </span>
                            </td>

                            {/* Already Received Quantity */}
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700">
                              <span className="px-2 py-1 rounded-md bg-slate-50 text-slate-700 border border-slate-200">
                                {row.previouslyReceivedQty}
                              </span>
                            </td>

                            {/* Remaining Quantity */}
                            <td className="py-3.5 px-3 text-center font-mono font-bold">
                              <span
                                className={`px-2 py-1 rounded-md border ${
                                  row.remainingQty === 0
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {row.remainingQty}
                              </span>
                            </td>

                            {/* Input: Receive This Time (DELTA) */}
                            <td className="py-3.5 px-3">
                              {isItemFullyReceived ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                                  <Check className="w-3 h-3" />
                                  <span>{t("inboundReceiving.table.completedBadge", isEn ? "Completed" : "Đã nhận đủ")}</span>
                                </span>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max={row.remainingQty}
                                      value={row.receiveThisTime === 0 ? "" : row.receiveThisTime}
                                      onChange={(e) => handleDeltaChange(row.sku, e.target.value)}
                                      disabled={!isSnapshotValid || row.remainingQty === 0 || isSerialOrLpnPresent}
                                      placeholder="0"
                                      className={`w-20 px-2.5 py-1.5 font-mono text-xs font-bold text-center rounded-xl border focus:outline-none focus:ring-2 transition shadow-2xs ${
                                        isOver
                                          ? "border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-500/20"
                                          : row.receiveThisTime > 0
                                          ? "border-blue-400 bg-blue-50/50 text-blue-900 font-black focus:ring-blue-500/20"
                                          : "border-slate-300 bg-white text-slate-800 focus:ring-blue-500/20"
                                      } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
                                    />
                                    {row.remainingQty > 0 && !isSerialOrLpnPresent && (
                                      <button
                                        type="button"
                                        onClick={() => handleSetMaxRemaining(row.sku)}
                                        disabled={!isSnapshotValid}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer shrink-0"
                                        title={t("inboundReceiving.buttons.receiveMax", isEn ? "Receive all remaining" : "Nhận hết số còn lại")}
                                      >
                                        {t("inboundReceiving.table.maxBtn", isEn ? "Max" : "Hết")}
                                      </button>
                                    )}
                                  </div>
                                  {isOver && (
                                    <span className="text-[10px] text-rose-600 font-bold block mt-1">
                                      {t("inboundReceiving.validation.deltaExceedsRemaining", isEn ? "Exceeds remaining" : "Vượt quá còn lại")}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Projected Total After Confirmation */}
                            <td className="py-3.5 px-3 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono text-xs font-black text-slate-900">
                                  {projected} / {row.expectedQty}
                                </span>
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 border border-slate-200/80">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      projected >= row.expectedQty
                                        ? "bg-emerald-500"
                                        : "bg-blue-600"
                                    }`}
                                    style={{ width: `${Math.min(100, projectedPct)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  {projectedPct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 5. SUMMARY PANEL: Detailed counts and progress */}
                <div className="bg-slate-50 border-t border-slate-200 p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-3">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">
                        {t("inboundReceiving.summary.totalSkus", isEn ? "Total SKUs" : "Tổng mặt hàng")}
                      </span>
                      <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                        {itemDrafts.length}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">
                        {t("inboundReceiving.summary.expectedUnits", isEn ? "Expected Units" : "Tổng dự kiến")}
                      </span>
                      <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                        {totalExpected}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">
                        {t("inboundReceiving.summary.previouslyReceived", isEn ? "Previously Received" : "Đã nhận trước")}
                      </span>
                      <span className="text-sm font-black font-mono text-slate-700 mt-0.5 block">
                        {totalPreviouslyReceived}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200">
                      <span className="text-[10px] text-blue-700 uppercase font-mono font-bold block">
                        {t("inboundReceiving.summary.receivingNow", isEn ? "Receiving Now" : "Nhận lần này")}
                      </span>
                      <span className="text-sm font-black font-mono text-blue-700 mt-0.5 block">
                        +{totalReceiveDelta}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">
                        {t("inboundReceiving.summary.remainingAfter", isEn ? "Remaining After" : "Còn lại sau nhận")}
                      </span>
                      <span
                        className={`text-sm font-black font-mono mt-0.5 block ${
                          totalRemainingAfter === 0 ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {totalRemainingAfter}
                      </span>
                    </div>
                  </div>

                  {/* Overall Receiving Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                      <span>{t("inboundReceiving.summary.progress", isEn ? "Receiving Progress:" : "Tiến độ nhận hàng:")}</span>
                      <span className="font-bold text-slate-900">
                        {totalProjected} / {totalExpected} ({Math.round((totalProjected / (totalExpected || 1)) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                      <div
                        style={{
                          width: `${Math.min(100, Math.round((totalPreviouslyReceived / (totalExpected || 1)) * 100))}%`,
                        }}
                        className="bg-emerald-500 h-full"
                        title={isEn ? `Previously received: ${totalPreviouslyReceived}` : `Đã nhận trước: ${totalPreviouslyReceived}`}
                      />
                      <div
                        style={{
                          width: `${Math.min(
                            100 - Math.min(100, Math.round((totalPreviouslyReceived / (totalExpected || 1)) * 100)),
                            Math.round((totalReceiveDelta / (totalExpected || 1)) * 100)
                          )}%`,
                        }}
                        className="bg-blue-600 h-full animate-pulse"
                        title={isEn ? `Receiving this time: +${totalReceiveDelta}` : `Nhận lần này: +${totalReceiveDelta}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------ */}
          {/* TAB 2: PUT-AWAY EXPERIENCE (CẤT HÀNG VÀO KỆ)           */}
          {/* ------------------------------------------------------ */}
          {activeWorkflowTab === "putaway" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Boxes className="w-4.5 h-4.5 text-indigo-700 shrink-0" />
                  <span>
                    {isEn
                      ? "Put-away Workflow: Assign storage bins for received goods from dock. Confirming put-away updates bin occupancy and stores SKUs permanently."
                      : "Quy trình Cất kệ: Chỉ định vị trí ô kệ cho hàng hóa đã kiểm nhận tại Dock. Xác nhận cất kệ sẽ chính thức cộng tồn kho vào ô kệ lưu kho."}
                  </span>
                </div>
              </div>

              {itemsReadyForPutAway.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    {order.status === "Completed"
                      ? isEn
                        ? "All goods have already been put away into storage bins."
                        : "Tất cả hàng hóa trong phiếu đã được cất vào kệ hoàn tất."
                      : isEn
                      ? "No goods awaiting put-away. Please confirm receipt at dock first."
                      : "Không có hàng hóa nào đang chờ cất kệ. Vui lòng xác nhận nhận hàng tại Dock trước."}
                  </p>
                  {order.status !== "Completed" && (
                    <button
                      type="button"
                      onClick={() => setActiveWorkflowTab("receiving")}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
                    >
                      {isEn ? "Go to Dock Receiving" : "Chuyển sang Nhận hàng tại Dock"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-3.5">{isEn ? "SKU & Product" : "SKU & Sản Phẩm"}</th>
                        <th className="py-3 px-3">{isEn ? "Received at Dock" : "Đã Nhận Tại Dock"}</th>
                        <th className="py-3 px-3">{isEn ? "Target Storage Bin" : "Ô Kệ Đích (Target Bin)"}</th>
                        <th className="py-3 px-3 text-right">{isEn ? "Bin Occupancy Impact" : "Tác Động Sức Chứa"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Put-away is mock/UI-only until backend workflow is verified. */}
                      {itemsReadyForPutAway.map((it) => {
                        const targetBinCode = putAwayAssignments[it.sku] || it.binCode || (bins[0]?.code || "D2-A02-N01");
                        const targetBin = bins.find((b) => b.code === targetBinCode) || bins[0];
                        const qtyToPutAway = Math.max(0, (it.receivedQty || 0) - ((it as any).putAwayQty || 0));
                        const currentOcc = targetBin ? targetBin.currentOccupancy : 0;
                        const maxCap = targetBin ? targetBin.maxCapacity : 100;
                        const projectedOcc = currentOcc + qtyToPutAway;
                        const isOverloaded = projectedOcc > maxCap;

                        return (
                          <tr key={it.sku} className={`hover:bg-slate-50/70 ${isOverloaded ? "bg-rose-50/60" : ""}`}>
                            <td className="py-3.5 px-3.5">
                              <div className="font-mono font-bold text-indigo-700">{it.sku}</div>
                              <div className="text-[11px] text-slate-600 line-clamp-1">{it.name}</div>
                            </td>
                            <td className="py-3.5 px-3 font-mono font-black text-slate-900">
                              {qtyToPutAway} {isEn ? "pcs" : "đơn vị"}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="space-y-1">
                                <select
                                  value={targetBinCode}
                                  onChange={(e) =>
                                    setPutAwayAssignments((prev) => ({
                                      ...prev,
                                      [it.sku]: e.target.value,
                                    }))
                                  }
                                  className={`border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold cursor-pointer focus:outline-none w-full max-w-xs ${
                                    isOverloaded
                                      ? "border-rose-400 bg-rose-50 text-rose-900 focus:ring-1 focus:ring-rose-500"
                                      : "bg-slate-50 border-slate-200 text-indigo-900 focus:ring-1 focus:ring-indigo-500"
                                  }`}
                                >
                                  {bins.map((b) => {
                                    const available = Math.max(0, b.maxCapacity - b.currentOccupancy);
                                    return (
                                      <option key={b.code} value={b.code}>
                                        {b.code} ({b.currentOccupancy}/{b.maxCapacity} - {isEn ? "Avail:" : "Trống:"} {available})
                                      </option>
                                    );
                                  })}
                                </select>
                                {isOverloaded && (
                                  <div className="text-[11px] text-rose-600 font-bold flex items-center gap-1.5 pt-0.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    <span>
                                      {t(
                                        "inboundReceiving.putAway.binOverloaded",
                                        isEn
                                          ? "The selected bin does not have enough available capacity."
                                          : "Ô kệ không đủ sức chứa cho số lượng này."
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono text-[11px]">
                              {targetBin ? (
                                <div className="flex flex-col items-end">
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      isOverloaded
                                        ? "bg-rose-100 text-rose-700 border border-rose-300"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    {currentOcc} →{" "}
                                    <span
                                      className={
                                        isOverloaded
                                          ? "font-black text-rose-700 underline"
                                          : "font-bold text-indigo-600"
                                      }
                                    >
                                      {projectedOcc}
                                    </span>{" "}
                                    / {maxCap}
                                  </span>
                                  {isOverloaded && (
                                    <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                                      +{projectedOcc - maxCap} {isEn ? "overload" : "vượt sức chứa"}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                "N/A"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 5. MODAL ACTIONS FOOTER                                  */}
        {/* ======================================================== */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {activeWorkflowTab === "receiving" ? (
              <span>
                {isAllFullyReceived ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{t("inboundReceiving.statuses.completed", isEn ? "All items fully received at dock" : "Đã nhận đủ toàn bộ mặt hàng tại Dock")}</span>
                  </span>
                ) : hasValidDelta ? (
                  <span className="text-blue-700 font-semibold">
                    ✓ {isEn ? `Ready to receive +${totalReceiveDelta} units` : `Sẵn sàng nhận thêm +${totalReceiveDelta} đơn vị`}
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">
                    {t("inboundReceiving.validation.noDeltaEntered", isEn ? "Please enter a receive quantity (> 0)" : "Vui lòng nhập số lượng nhận > 0")}
                  </span>
                )}
              </span>
            ) : (
              <span>
                {isAnyBinOverloaded ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {t(
                        "inboundReceiving.putAway.binOverloaded",
                        isEn
                          ? "The selected bin does not have enough available capacity."
                          : "Ô kệ không đủ sức chứa cho số lượng này."
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="text-indigo-900 font-medium">
                    {isEn ? "Assigns inventory directly into storage bins" : "Gán hàng hóa trực tiếp vào các ô kệ lưu kho"}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
            >
              {t("inboundReceiving.buttons.close", isEn ? "Close" : "Đóng")}
            </button>

            {activeWorkflowTab === "receiving" ? (
              isAllFullyReceived ? (
                /* Completed State: No confirm button, offer navigation CTA to Put-away */
                <button
                  type="button"
                  onClick={() => setActiveWorkflowTab("putaway")}
                  className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Boxes className="w-4 h-4" />
                  <span>{t("inboundReceiving.buttons.proceedToPutAway", isEn ? "Proceed to Put-away" : "Chuyển sang cất kệ")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                /* Receiving in progress: Open Confirmation Modal */
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isReceiveSubmitDisabled}
                  className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  )}
                  <span>
                    {isNotReceivedYet
                      ? t("inboundReceiving.buttons.startReceiving", isEn ? "Start Receiving" : "Bắt đầu nhận hàng")
                      : t("inboundReceiving.buttons.confirmReceipt", isEn ? "Confirm Receipt" : "Xác nhận nhận hàng")}
                  </span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleExecutePutAway}
                disabled={itemsReadyForPutAway.length === 0 || isPuttingAway || isAnyBinOverloaded}
                className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {isPuttingAway ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Boxes className="w-3.5 h-3.5" strokeWidth={2.5} />
                )}
                <span>{t("inboundReceiving.buttons.confirmPutAway", isEn ? "Confirm Put-away into Bins" : "Xác nhận cất hàng vào kệ")}</span>
              </button>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 6. CONFIRMATION MODAL / DIALOG (UX RULE 6)               */}
        {/* ======================================================== */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 animate-scaleIn">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                  <PackageCheck className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-black text-slate-900">
                    {t("inboundReceiving.confirmation.title", isEn ? "Confirm Received Quantities" : "Xác nhận số lượng nhận hàng")}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {t("inboundReceiving.confirmation.receiptCode", isEn ? "Receipt Code" : "Mã phiếu nhập")}:{" "}
                    <span className="font-mono font-bold text-slate-900">{order.code}</span>
                  </p>
                </div>
              </div>

              {/* Items Breakdown in Confirmation */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-mono text-[11px] font-bold text-slate-600">
                  <span>{t("inboundReceiving.confirmation.skusReceiving", isEn ? "SKUs receiving this time" : "Số SKU đang nhận")}:</span>
                  <span className="text-slate-900 font-black">{itemsToReceive.length} SKUs</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-mono text-[11px] font-bold text-slate-600">
                  <span>{t("inboundReceiving.confirmation.totalUnitsReceiving", isEn ? "Total units receiving now" : "Tổng số lượng nhận lần này")}:</span>
                  <span className="text-blue-700 font-black">+{totalReceiveDelta} {isEn ? "units" : "đơn vị"}</span>
                </div>

                {/* Micro Item List */}
                <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                  {itemsToReceive.map((it) => (
                    <div key={it.sku} className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-700 truncate max-w-[240px]">
                        {it.sku} <span className="text-slate-400">({it.name})</span>
                      </span>
                      <span className="font-mono font-bold text-blue-700 shrink-0">
                        +{it.receiveThisTime}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning Notice */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  {t(
                    "inboundReceiving.confirmation.warning",
                    isEn
                      ? "This action records received goods at the dock staging area. Inventory is NOT placed into storage bins until Put-away."
                      : "Thao tác này cập nhật số lượng đã nhận tại Dock cửa nhập. Hàng hóa chưa được cất vào ô kệ lưu kho cho đến bước Cất kệ (Put-away)."
                  )}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t("inboundReceiving.confirmation.reviewBtn", isEn ? "Back to Review" : "Quay lại kiểm tra")}
                </button>
                <button
                  type="button"
                  onClick={executeConfirmReceipt}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  )}
                  <span>{t("inboundReceiving.confirmation.confirmBtn", isEn ? "Confirm Receipt" : "Xác nhận nhận hàng")}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
