/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  X,
  Package,
  Boxes,
  CheckCircle2,
  Clock,
  Truck,
  AlertCircle,
  RefreshCw,
  MapPin,
  Calendar,
  Building2,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  WifiOff,
  Maximize2,
  FileText,
  Ban,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  OutboundOrderDetail,
  OutboundOrderStatus,
  TrackingMode,
  getOutboundAvailableActions,
  outboundService,
  PickReservationItem,
} from "../../services/outboundService";
import { StatusBadge } from "../../components/common/StatusBadge";

export interface OutboundDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  lang?: string;
  onOrderUpdated?: () => void | Promise<void>;
  onShowToast?: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    title?: string
  ) => void;
}

export default function OutboundDetailModal({
  isOpen,
  onClose,
  orderId,
  lang,
  onOrderUpdated,
  onShowToast,
}: OutboundDetailModalProps) {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);
  const isEn = lang === "en-US" || i18n.language?.startsWith("en");

  // Authoritative State
  const [order, setOrder] = useState<OutboundOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

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

  // Modals & Messages
  const [showPickConfirmModal, setShowPickConfirmModal] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Load Authoritative Order Detail
  const fetchOrderDetail = async (targetId: string) => {
    setIsLoading(true);
    try {
      const data = await outboundService.getOutboundOrderById(targetId);
      setOrder(data);
    } catch (err: any) {
      const status = err.status || err.response?.status;
      if (status === 404) {
        const notFoundText = isEn
          ? "The order no longer exists or has been cancelled."
          : "Đơn hàng không còn tồn tại hoặc đã bị hủy.";
        setFeedback({ type: "error", message: notFoundText });
        if (onShowToast) onShowToast(notFoundText, "error");
      } else {
        const errorText =
          err.message ||
          (isEn ? "Failed to load order detail" : "Không thể tải chi tiết đơn hàng");
        setFeedback({ type: "error", message: errorText });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      setFeedback(null);
      fetchOrderDetail(orderId);
    }
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const currentStatus: OutboundOrderStatus = order?.status || "Pending";
  const actions = getOutboundAvailableActions(currentStatus);

  // Lifecycle steps definition
  const steps: { key: OutboundOrderStatus; labelVi: string; labelEn: string; num: number }[] = [
    { key: "Pending", labelVi: "Chờ phân bổ", labelEn: "Pending", num: 1 },
    { key: "Allocated", labelVi: "Đã phân bổ", labelEn: "Allocated", num: 2 },
    { key: "Picked", labelVi: "Đã lấy hàng", labelEn: "Picked", num: 3 },
    { key: "Packed", labelVi: "Đã đóng gói", labelEn: "Packed", num: 4 },
    { key: "Shipped", labelVi: "Đã xuất kho", labelEn: "Shipped", num: 5 },
  ];

  const getStepIndex = (status: OutboundOrderStatus) => {
    switch (status) {
      case "Pending":
        return 0;
      case "Allocated":
        return 1;
      case "Picked":
        return 2;
      case "Packed":
        return 3;
      case "Shipped":
        return 4;
      default:
        return -1;
    }
  };

  const currentStepIdx = getStepIndex(currentStatus);

  // Handle 409 / Conflict helper
  const handleMutationError = async (err: any) => {
    const status = err.status || err.response?.status;
    if (status === 409) {
      const conflictMsg = isEn
        ? "The order or inventory data has changed. Please reload the latest information before continuing."
        : "Dữ liệu đơn hàng hoặc tồn kho đã thay đổi. Vui lòng tải lại thông tin trước khi tiếp tục.";
      setFeedback({ type: "warning", message: conflictMsg });
      if (onShowToast) {
        onShowToast(conflictMsg, "warning", isEn ? "Data Conflict (409)" : "Xung đột dữ liệu (409)");
      }
      if (order?.id) {
        await fetchOrderDetail(order.id);
      }
      return;
    }

    if (status === 404) {
      const notFoundMsg = isEn
        ? "The order no longer exists or has been cancelled."
        : "Đơn hàng không còn tồn tại hoặc đã bị hủy.";
      setFeedback({ type: "error", message: notFoundMsg });
      if (onShowToast) onShowToast(notFoundMsg, "error");
      return;
    }

    const msg =
      err.message ||
      (isEn ? "Operation failed. Please try again." : "Thao tác không thành công. Vui lòng thử lại.");
    setFeedback({ type: "error", message: msg });
    if (onShowToast) onShowToast(msg, "error");
  };

  // 1. ALLOCATE ACTION
  const handleAllocate = async () => {
    if (!order || !actions.canAllocate || isActionLoading || !isOnline) return;
    setIsActionLoading(true);
    setFeedback(null);
    try {
      const updated = await outboundService.allocateOutboundOrder(order.id);
      setOrder(updated);
      const successMsg = isEn
        ? `Order [${order.orderNumber}] allocated successfully! Stock reserved from bin.`
        : `Lệnh xuất [${order.orderNumber}] đã phân bổ thành công! Hàng hóa được gán giữ từ ô kệ.`;
      setFeedback({ type: "success", message: successMsg });
      if (onShowToast) onShowToast(successMsg, "success");
      if (onOrderUpdated) await onOrderUpdated();
    } catch (err: any) {
      await handleMutationError(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 2. PICK ACTION (FULL PICK ONLY)
  const handleExecutePick = async () => {
    if (!order || !actions.canPick || isActionLoading || !isOnline) return;
    setIsActionLoading(true);
    setFeedback(null);
    try {
      // Build Full Pick payload from active reservations of GET detail
      const reservations = order.items.flatMap((it) => it.reservations || []);
      const pickPayload: PickReservationItem[] = reservations.map((res) => ({
        reservationId: res.id,
        quantity: res.quantity,
      }));

      const updated = await outboundService.pickOutboundOrder(order.id, pickPayload);
      setOrder(updated);
      setShowPickConfirmModal(false);

      const successMsg = isEn
        ? `Full Pick confirmed for order [${order.orderNumber}]! All items moved to staging.`
        : `Đã xác nhận lấy toàn bộ hàng cho lệnh [${order.orderNumber}]! Hàng hóa sẵn sàng đóng gói.`;
      setFeedback({ type: "success", message: successMsg });
      if (onShowToast) onShowToast(successMsg, "success");
      if (onOrderUpdated) await onOrderUpdated();
    } catch (err: any) {
      await handleMutationError(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 3. PACK ACTION
  const handlePack = async () => {
    if (!order || !actions.canPack || isActionLoading || !isOnline) return;
    setIsActionLoading(true);
    setFeedback(null);
    try {
      const updated = await outboundService.packOutboundOrder(order.id);
      setOrder(updated);
      const successMsg = isEn
        ? `Order [${order.orderNumber}] packed successfully! Awaiting carrier dispatch.`
        : `Lệnh xuất [${order.orderNumber}] đã đóng gói thành công! Sẵn sàng bàn giao vận chuyển.`;
      setFeedback({ type: "success", message: successMsg });
      if (onShowToast) onShowToast(successMsg, "success");
      if (onOrderUpdated) await onOrderUpdated();
    } catch (err: any) {
      await handleMutationError(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 4. SHIP ACTION
  const handleShip = async () => {
    if (!order || !actions.canShip || isActionLoading || !isOnline) return;
    setIsActionLoading(true);
    setFeedback(null);
    try {
      const updated = await outboundService.shipOutboundOrder(order.id);
      setOrder(updated);
      const successMsg = isEn
        ? `Order [${order.orderNumber}] dispatched and shipped to customer!`
        : `Lệnh xuất [${order.orderNumber}] đã xuất kho và bàn giao đơn vị vận chuyển thành công!`;
      setFeedback({ type: "success", message: successMsg });
      if (onShowToast) onShowToast(successMsg, "success");
      if (onOrderUpdated) await onOrderUpdated();
    } catch (err: any) {
      await handleMutationError(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 5. CANCEL ACTION
  const handleCancel = async () => {
    if (!order || !actions.canCancel || isActionLoading || !isOnline) return;
    const confirmText = isEn
      ? `Are you sure you want to cancel order [${order.orderNumber}]?`
      : `Bạn có chắc chắn muốn hủy lệnh xuất kho [${order.orderNumber}] không?`;
    if (!window.confirm(confirmText)) return;

    setIsActionLoading(true);
    setFeedback(null);
    try {
      await outboundService.cancelOutboundOrder(order.id);
      const successMsg = isEn
        ? `Order [${order.orderNumber}] has been cancelled.`
        : `Lệnh xuất kho [${order.orderNumber}] đã được hủy thành công.`;
      if (onShowToast) onShowToast(successMsg, "info");
      if (onOrderUpdated) await onOrderUpdated();
      onClose();
    } catch (err: any) {
      await handleMutationError(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Render Status Badge using unified StatusBadge
  const renderStatusBadge = (status: OutboundOrderStatus) => {
    switch (status) {
      case "Pending":
        return (
          <StatusBadge
            variant="amber"
            size="sm"
            icon={Clock}
            label={isEn ? "Pending Allocation" : "Chờ phân bổ"}
          />
        );
      case "Allocated":
        return (
          <StatusBadge
            variant="blue"
            size="sm"
            icon={Boxes}
            label={isEn ? "Allocated" : "Đã phân bổ"}
          />
        );
      case "Picked":
        return (
          <StatusBadge
            variant="blue"
            size="sm"
            icon={Layers}
            label={isEn ? "Picked" : "Đã lấy hàng"}
          />
        );
      case "Packed":
        return (
          <StatusBadge
            variant="purple"
            size="sm"
            icon={Package}
            label={isEn ? "Packed" : "Đã đóng gói"}
          />
        );
      case "Shipped":
        return (
          <StatusBadge
            variant="green"
            size="sm"
            icon={CheckCircle2}
            label={isEn ? "Shipped" : "Đã xuất kho"}
          />
        );
      case "Cancelled":
        return (
          <StatusBadge
            variant="red"
            size="sm"
            icon={Ban}
            label={isEn ? "Cancelled" : "Đã hủy"}
          />
        );
    }
  };

  const allReservations = order?.items?.flatMap((it) => it.reservations || []) || [];
  const totalReservedUnits = allReservations.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto enterprise-modal-container">
        {/* 1. Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
                  {order?.orderNumber || orderId}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {order?.id || orderId}
                </span>
                {order && renderStatusBadge(order.status)}
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  BACKEND B3 STABLE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-300">
                  {order?.customerName || "Customer Partner"}
                </span>
                <span>•</span>
                <span className="font-mono text-slate-300">
                  {isEn ? "Bin" : "Ô kệ xuất"}: {order?.binCode || "D2-A02-N02"}
                </span>
                <span>•</span>
                <span className="font-mono text-slate-300">
                  {isEn ? "Expected Ship" : "Ngày dự kiến"}: {order?.expectedShipDate || order?.createdAt}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => order?.id && fetchOrderDetail(order.id)}
              disabled={isLoading || isActionLoading}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={isEn ? "Refresh detail from backend" : "Tải lại chi tiết từ backend"}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0 border-b border-amber-600">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {isEn
                ? "This operation requires an online connection to keep order and inventory state consistent."
                : "Thao tác nghiệp vụ này cần kết nối trực tuyến để đảm bảo trạng thái đơn hàng và tồn kho chính xác."}
            </span>
          </div>
        )}

        {/* Feedback Message Banner */}
        {feedback && (
          <div
            className={`px-4 py-3 text-xs font-bold flex items-center justify-between shrink-0 border-b ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : feedback.type === "warning"
                ? "bg-amber-50 text-amber-900 border-amber-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : feedback.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 2. Lifecycle Stepper (Authoritative) */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between max-w-3xl mx-auto relative">
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            {steps.map((step, idx) => {
              const isPast = currentStepIdx > idx;
              const isCurrent = currentStepIdx === idx;
              const isFuture = currentStepIdx < idx;

              return (
                <div key={step.key} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all shadow-xs ${
                      isPast
                        ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                        : isCurrent
                        ? "bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse"
                        : "bg-white text-slate-400 border-2 border-slate-300"
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                  </div>
                  <span
                    className={`text-[11px] font-semibold mt-1.5 transition-colors ${
                      isCurrent
                        ? "text-blue-700 font-bold"
                        : isPast
                        ? "text-emerald-700"
                        : "text-slate-400"
                    }`}
                  >
                    {isEn ? step.labelEn : step.labelVi}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white enterprise-modal-body">
          {isLoading && !order ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <span className="text-xs font-medium">
                {isEn ? "Loading order detail..." : "Đang tải dữ liệu chi tiết lệnh xuất..."}
              </span>
            </div>
          ) : order ? (
            <>
              {/* Order Metadata Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                    {isEn ? "Customer" : "Khách Hàng"}
                  </span>
                  <span className="font-bold text-slate-800 mt-0.5 block">
                    {order.customerName || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                    {isEn ? "Source Bin" : "Ô Kệ Nguồn"}
                  </span>
                  <span className="font-bold text-blue-700 font-mono mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    {order.binCode || "D2-A02-N02"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                    {isEn ? "Carrier Dispatch" : "Đơn Vị Giao Vận"}
                  </span>
                  <span className="font-medium text-slate-800 mt-0.5 block">
                    {order.carrier || "DHL Express"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                    {isEn ? "Priority" : "Mức Độ Ưu Tiên"}
                  </span>
                  <span className="font-bold text-slate-800 mt-0.5 block">
                    {order.priority || "Normal"}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-blue-600" />
                    <span>{isEn ? "Order Line Items" : "Danh Sách Hàng Hóa Xuất Kho"}</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500 font-bold">
                    {order.items.length} SKUs • {order.items.reduce((s, it) => s + it.quantity, 0)}{" "}
                    {isEn ? "units total" : "đơn vị"}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">{isEn ? "Product / SKU" : "Sản Phẩm / SKU"}</th>
                        <th className="py-2.5 px-3">{isEn ? "Tracking" : "Chế Độ Quản Lý"}</th>
                        <th className="py-2.5 px-3 text-right">{isEn ? "Requested" : "Yêu Cầu"}</th>
                        <th className="py-2.5 px-3 text-right">{isEn ? "Reserved" : "Đã Giữ"}</th>
                        <th className="py-2.5 px-3 text-right">{isEn ? "Picked" : "Đã Lấy"}</th>
                        <th className="py-2.5 px-3 text-right">{isEn ? "Shipped" : "Đã Xuất"}</th>
                        <th className="py-2.5 px-3 text-center">{isEn ? "Status" : "Trạng Thái"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {order.items.map((item, idx) => {
                        const isLot = item.trackingModeSnapshot === TrackingMode.Lot;
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/80">
                            <td className="py-3 px-3">
                              <span className="font-bold text-blue-700 block">{item.sku}</span>
                              <span className="text-[11px] text-slate-500 font-sans block line-clamp-1 font-normal">
                                {item.productName || item.sku}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${
                                  isLot
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {isLot ? "Tracking: Lot" : "Tracking: None"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-slate-900">
                              {item.quantity} {item.unit || "Pcs"}
                            </td>
                            <td className="py-3 px-3 text-right text-indigo-700 font-semibold">
                              {item.reservedQuantity}
                            </td>
                            <td className="py-3 px-3 text-right text-blue-700 font-semibold">
                              {item.pickedQuantity}
                            </td>
                            <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                              {item.shippedQuantity}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Allocated Reservations Section (Source of Truth from GET detail) */}
              {allReservations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>{isEn ? "Allocated Bin Reservations (Backend B3)" : "Danh Sách Hàng Gán Giữ Tại Ô Kệ (B3)"}</span>
                    </h3>
                    <span className="text-xs font-mono text-indigo-700 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                      {allReservations.length} {isEn ? "allocations" : "chỉ định"} • {totalReservedUnits}{" "}
                      {isEn ? "units locked" : "đơn vị gán giữ"}
                    </span>
                  </div>

                  <div className="border border-indigo-200/80 rounded-xl overflow-x-auto bg-indigo-50/20 shadow-2xs">
                    <table className="w-full text-left text-xs font-mono min-w-[600px]">
                      <thead className="bg-indigo-100/60 border-b border-indigo-200 text-[10px] font-mono font-bold text-indigo-900 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">{isEn ? "Reservation ID" : "Mã Gán Giữ"}</th>
                          <th className="py-2.5 px-3">{isEn ? "SKU / Product" : "SKU / Tên Hàng"}</th>
                          <th className="py-2.5 px-3">{isEn ? "Source Bin" : "Ô Kệ Lấy"}</th>
                          <th className="py-2.5 px-3">{isEn ? "Lot & Expiry" : "Số Lô & HSD"}</th>
                          <th className="py-2.5 px-3 text-right">{isEn ? "Reserved" : "Số Lượng"}</th>
                          <th className="py-2.5 px-3 text-right">{isEn ? "Picked" : "Đã Lấy"}</th>
                          <th className="py-2.5 px-3 text-center">{isEn ? "Status" : "Trạng Thái"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-100">
                        {order.items.map((item) =>
                          item.reservations.map((res) => {
                            const isLot = item.trackingModeSnapshot === TrackingMode.Lot;
                            return (
                              <tr key={res.id} className="hover:bg-indigo-50/60">
                                <td className="py-2.5 px-3 text-[11px] text-slate-600 font-bold">
                                  {res.id}
                                </td>
                                <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                                  <span className="font-mono font-bold text-blue-700">{item.sku}</span>{" "}
                                  <span className="text-[11px] text-slate-500">({item.productName})</span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800 font-bold text-[11px]">
                                    <MapPin className="w-3 h-3 text-indigo-600" />
                                    {res.sourceBinCode || order.binCode || "D2-A02-N02"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-[11px]">
                                  {isLot && res.lotNumber ? (
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800">{res.lotNumber}</span>
                                      <span className="text-[10px] text-slate-400">
                                        EXP: {res.expirationDate || "2027-12-31"}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-indigo-900">
                                  {res.quantity}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                                  {res.pickedQuantity}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                    {res.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* 5. Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 flex-wrap">
          {/* Cancel button if applicable */}
          {actions.canCancel ? (
            <button
              onClick={handleCancel}
              disabled={isActionLoading || !isOnline}
              className="h-9 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isEn ? "Cancel Order" : "Hủy Lệnh Xuất Kho"}
            </button>
          ) : (
            <div />
          )}

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            {/* Step 1 CTA: Allocate */}
            {actions.canAllocate && (
              <button
                onClick={handleAllocate}
                disabled={isActionLoading || !isOnline}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Boxes className="w-3.5 h-3.5" />
                )}
                <span>{isEn ? "Allocate Pick Task" : "Phân Bổ Lấy Hàng (Allocate)"}</span>
              </button>
            )}

            {/* Step 2 CTA: Full Pick Confirmation Modal Trigger */}
            {actions.canPick && (
              <button
                onClick={() => setShowPickConfirmModal(true)}
                disabled={isActionLoading || !isOnline}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                <span>{isEn ? "Pick Order" : "Lấy Hàng (Pick Order)"}</span>
              </button>
            )}

            {/* Step 3 CTA: Pack */}
            {actions.canPack && (
              <button
                onClick={handlePack}
                disabled={isActionLoading || !isOnline}
                className="h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Package className="w-3.5 h-3.5" />
                )}
                <span>{isEn ? "Confirm Packing (Pack)" : "Xác Nhận Đóng Gói (Pack)"}</span>
              </button>
            )}

            {/* Step 4 CTA: Ship */}
            {actions.canShip && (
              <button
                onClick={handleShip}
                disabled={isActionLoading || !isOnline}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Truck className="w-3.5 h-3.5" />
                )}
                <span>{isEn ? "Dispatch & Ship Order" : "Xuất Kho Giao Vận (Ship)"}</span>
              </button>
            )}

            {/* Terminal State: Shipped */}
            {actions.isReadOnly && currentStatus === "Shipped" && (
              <div className="h-9 flex items-center gap-2 px-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isEn ? "Order Fully Shipped (Terminal State)" : "Đơn Hàng Đã Xuất Kho Hoàn Tất"}</span>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* FULL PICK CONFIRMATION MODAL                             */}
        {/* ======================================================== */}
        {showPickConfirmModal && order && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto enterprise-modal-container">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold font-mono">
                    {isEn ? "Full Pick Confirmation" : "Xác Nhận Lấy Toàn Bộ Hàng"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowPickConfirmModal(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs overflow-y-auto enterprise-modal-body flex-1">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>{isEn ? "Backend B3 Whole-Order Full Pick" : "Quy Trình Lấy Toàn Bộ Đơn Hàng B3"}</span>
                  </p>
                  <p className="text-[11px] text-blue-800">
                    {isEn
                      ? "Direct-pick fulfills all assigned reservations without partial split. Inventory physical deductions will be committed by the backend."
                      : "Lấy toàn bộ hàng theo các chỉ định phân bổ từ ô kệ nguồn. Số lượng vật lý sẽ do máy chủ xử lý."}
                  </p>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">SKUs</span>
                    <span className="text-base font-black text-slate-900 font-mono">
                      {order.items.length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">
                      {isEn ? "Reservations" : "Chỉ định"}
                    </span>
                    <span className="text-base font-black text-indigo-700 font-mono">
                      {allReservations.length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">
                      {isEn ? "Total Units" : "Tổng Đơn Vị"}
                    </span>
                    <span className="text-base font-black text-blue-700 font-mono">
                      {totalReservedUnits}
                    </span>
                  </div>
                </div>

                {/* Read-Only Reservations List */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                      <tr>
                        <th className="py-2 px-3">{isEn ? "SKU" : "Mã Hàng"}</th>
                        <th className="py-2 px-3">{isEn ? "Source Bin" : "Ô Kệ Nguồn"}</th>
                        <th className="py-2 px-3 text-right">{isEn ? "Qty (Read-only)" : "SL Lấy"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allReservations.map((res) => (
                        <tr key={res.id}>
                          <td className="py-2 px-3 font-bold text-slate-800">
                            {order.items.find((i) => i.reservations?.some((r) => r.id === res.id))?.sku || "SKU"}
                          </td>
                          <td className="py-2 px-3 text-indigo-700 font-bold">
                            {res.sourceBinCode || order.binCode || "D2-A02-N02"}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-blue-700">
                            {res.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => setShowPickConfirmModal(false)}
                  disabled={isActionLoading}
                  className="h-9 px-4 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy Bỏ"}
                </button>
                <button
                  onClick={handleExecutePick}
                  disabled={isActionLoading || !isOnline}
                  className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  {isActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isEn ? "Confirm Full Pick" : "Xác nhận lấy toàn bộ hàng"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
