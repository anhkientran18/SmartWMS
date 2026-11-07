/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Inbox,
  FileX,
  Eye,
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  MapPin,
  X,
  Boxes,
  Building2,
  Calendar,
  Zap,
  Search,
  SlidersHorizontal,
  FileText,
  Truck,
  Ban,
  Layers,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bin, Product } from "../../types/index";
import InboundReceivingModal from "../inbound/InboundReceivingModal";
import OutboundDetailModal from "../outbound/OutboundDetailModal";
import { outboundService } from "../../services/outboundService";
import { StatusBadge } from "../../components/common/StatusBadge";
import { isDemoMode } from '../../app/dataMode';
import RealOrders from './RealOrders';

export interface OrderManagementProps {
  lang?: string;
  onRefreshData?: () => void | Promise<void>;
  bins?: Bin[];
  products?: Product[];
  onShowToast?: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    title?: string
  ) => void;
}

export interface DetailedOrderItem {
  sku: string;
  name?: string;
  expectedQty: number;
  receivedQty?: number;
  pickedQty?: number;
  binCode?: string;
  lotNumber?: string;
  expiryDate?: string;
  trackingMode?: "None" | "Lot" | "Serial";
  hasLpn?: boolean;
}

export interface DetailedOrder {
  code: string;
  poNumber?: string;
  soNumber?: string;
  orderType: "inbound" | "outbound";
  status:
    | "Pending"
    | "In Progress"
    | "Processing"
    | "Completed"
    | "Cancelled"
    | "Received"
    | "Partially Received"
    | "Allocated"
    | "Picked"
    | "Packed"
    | "Shipped";
  partner: string;
  partnerId?: string;
  skuCount: number;
  totalQty: number;
  createdAt: string;
  items: DetailedOrderItem[];
}

export type InboundWorkflowStage = "WaitingForReceiving" | "Receiving" | "WaitingForPutaway" | "Completed";

export function getInboundWorkflowStage(order: DetailedOrder): InboundWorkflowStage {
  if (order.status === "Completed") {
    return "Completed";
  }

  const items = order.items || [];
  if (items.length === 0) {
    if (order.status === "Received") return "WaitingForPutaway";
    if (order.status === "Processing" || order.status === "In Progress" || order.status === "Partially Received") {
      return "Receiving";
    }
    return "WaitingForReceiving";
  }

  const totalExpected = items.reduce((acc, it) => acc + (Number(it.expectedQty) || 0), 0);
  const totalReceived = items.reduce((acc, it) => acc + (Number(it.receivedQty) || 0), 0);

  if (totalReceived === 0) {
    return "WaitingForReceiving";
  }
  if (totalReceived < totalExpected) {
    return "Receiving";
  }
  return "WaitingForPutaway";
}

export default function OrderManagement(props: OrderManagementProps) {
  return isDemoMode ? <DemoOrderManagement {...props} /> : <RealOrders />;
}

function DemoOrderManagement({
  lang,
  onRefreshData,
  bins = [],
  products = [],
  onShowToast,
}: OrderManagementProps) {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);
  const isEn = lang === "en-US" || i18n.language?.startsWith("en");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"inbound" | "outbound">("inbound");

  const [orderParams, setOrderParams] = useState({
    pageIndex: 1,
    pageSize: 10,
    orderType: "inbound" as "inbound" | "outbound" | "Inbound" | "Outbound",
    searchKeyword: "",
    status: "",
    fromDate: "",
    toDate: "",
    partnerId: "",
  });

  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  // Action status / feedback
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Selected Order for Details Slide-over Drawer
  const [selectedOrder, setSelectedOrder] = useState<DetailedOrder | null>(null);
  // Selected Inbound Order for Inbound Receiving Experience Modal
  const [receivingOrder, setReceivingOrder] = useState<DetailedOrder | null>(null);
  // Selected Outbound Order for B3 Outbound Detail & Lifecycle Modal
  const [selectedOutboundId, setSelectedOutboundId] = useState<string | null>(null);

  const handleTabChange = (tab: "inbound" | "outbound") => {
    setActiveTab(tab);
    setOrderParams((prev) => ({
      ...prev,
      orderType: tab,
      status: "",
      pageIndex: 1,
    }));
  };

  // Partners Filter Mock List
  const partnersFilterMock = [
    { id: "1", name: "Vinamilk Trade Vietnam" },
    { id: "2", name: "Coca-Cola Beverages Indochina" },
    { id: "3", name: "Apple Logistics APAC" },
    { id: "4", name: "Thế Giới Di Động Group" },
    { id: "5", name: "CoopMart Supermarket Vietnam" },
  ];

  // TanStack Query to fetch and sync orders with backend
  const { data: ordersList = [], isLoading, refetch } = useQuery({
    queryKey: ["orders-all-data"],
    queryFn: async (): Promise<DetailedOrder[]> => {
      try {
        const res = await fetch("/api/wms/all-data");
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();

        const inbounds: DetailedOrder[] = (data.inbounds || []).map((inb: any) => ({
          code: inb.id,
          poNumber: inb.poNumber,
          orderType: "inbound",
          status: inb.status,
          partner: inb.vendorName || "Vinamilk Trade Vietnam",
          partnerId: "1",
          skuCount: inb.items?.length || 0,
          totalQty:
            inb.items?.reduce(
              (acc: number, item: any) =>
                acc + (Number(item.expectedQty) || 0),
              0
            ) || 0,
          createdAt: inb.date || "2026-05-18",
          items: inb.items || [],
        }));

        let outbounds: DetailedOrder[] = [];
        try {
          const serviceOutbounds = await outboundService.getOutboundOrders();
          if (serviceOutbounds && serviceOutbounds.length > 0) {
            outbounds = serviceOutbounds.map((outb) => ({
              code: outb.orderNumber || outb.id,
              soNumber: outb.orderNumber,
              orderType: "outbound" as const,
              status: outb.status as any,
              partner: outb.customerName || "Thế Giới Di Động Group",
              partnerId: "4",
              skuCount: outb.items?.length || 0,
              totalQty: outb.items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0,
              createdAt: outb.createdAt || "2026-05-20",
              items: outb.items?.map((it) => ({
                sku: it.sku || it.productId,
                name: it.productName,
                expectedQty: it.quantity,
                receivedQty: 0,
                pickedQty: it.pickedQuantity,
                binCode: outb.binCode || "D2-A02-N02",
                trackingMode: it.trackingModeSnapshot === 1 ? "Lot" : "None",
              })) || [],
            }));
          }
        } catch (e) {
          console.warn("Could not query outboundService", e);
        }

        if (outbounds.length === 0 && data.outbounds) {
          outbounds = (data.outbounds || []).map((outb: any) => ({
            code: outb.id,
            soNumber: outb.soNumber,
            orderType: "outbound" as const,
            status: outb.status,
            partner: outb.customerName || "Thế Giới Di Động Group",
            partnerId: "4",
            skuCount: outb.items?.length || 0,
            totalQty:
              outb.items?.reduce(
                (acc: number, item: any) =>
                  acc + (Number(item.expectedQty) || 0),
                0
              ) || 0,
            createdAt: outb.date || "2026-05-19",
            items: outb.items || [],
          }));
        }

        return [...inbounds, ...outbounds];
      } catch (err) {
        console.warn("API /api/wms/all-data not available, using fallback.", err);
        return [];
      }
    },
  });

  // Calculate order stats dynamically for activeTab
  const currentTabOrders = useMemo(() => {
    return ordersList.filter(
      (o) => o.orderType.toLowerCase() === activeTab.toLowerCase()
    );
  }, [ordersList, activeTab]);

  const totalInboundCount = useMemo(
    () => ordersList.filter((o) => o.orderType === "inbound").length,
    [ordersList]
  );
  const totalOutboundCount = useMemo(
    () => ordersList.filter((o) => o.orderType === "outbound").length,
    [ordersList]
  );

  const totalVouchers = currentTabOrders.length;
  const totalUnits = currentTabOrders.reduce((sum, o) => sum + (o.totalQty || 0), 0);
  const pendingCount = currentTabOrders.filter((o) => o.status === "Pending").length;
  const inProgressCount = currentTabOrders.filter(
    (o) => o.status === "In Progress" || o.status === "Processing" || o.status === "Allocated" || o.status === "Picked" || o.status === "Packed"
  ).length;
  const completedCount = currentTabOrders.filter(
    (o) => o.status === "Completed" || o.status === "Shipped"
  ).length;
  const completedRate = totalVouchers > 0 ? Math.round((completedCount / totalVouchers) * 100) : 0;

  // Inbound Stage Counts for KPI and filters
  const inboundWaitingReceivingCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "inbound")
      .filter((o) => getInboundWorkflowStage(o) === "WaitingForReceiving").length;
  }, [ordersList]);

  const inboundReceivingCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "inbound")
      .filter((o) => getInboundWorkflowStage(o) === "Receiving").length;
  }, [ordersList]);

  const inboundWaitingPutawayCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "inbound")
      .filter((o) => getInboundWorkflowStage(o) === "WaitingForPutaway").length;
  }, [ordersList]);

  const inboundCompletedCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "inbound")
      .filter((o) => getInboundWorkflowStage(o) === "Completed").length;
  }, [ordersList]);

  // Outbound B3 Stage Counts
  const outboundPendingCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "outbound")
      .filter((o) => o.status === "Pending").length;
  }, [ordersList]);

  const outboundAllocatedCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "outbound")
      .filter((o) => o.status === "Allocated").length;
  }, [ordersList]);

  const outboundPickedCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "outbound")
      .filter((o) => o.status === "Picked").length;
  }, [ordersList]);

  const outboundPackedCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "outbound")
      .filter((o) => o.status === "Packed").length;
  }, [ordersList]);

  const outboundShippedCount = useMemo(() => {
    return ordersList
      .filter((o) => o.orderType === "outbound")
      .filter((o) => o.status === "Shipped" || o.status === "Completed").length;
  }, [ordersList]);

  // Handle Complete Order (Put-away for inbound, Dispatch for outbound)
  const handleCompleteOrder = async (order: DetailedOrder) => {
    setActionLoadingId(order.code);
    setFeedbackMessage(null);

    try {
      const res = await fetch("/api/wms/orders/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.code,
          orderType: order.orderType,
          operator: "Manager",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (t("f0.text.failedToCompleteOrder")));
      }

      // Optimistic cache update for immediate UI/KPI response
      queryClient.setQueryData(["orders-all-data"], (old: DetailedOrder[] | undefined) => {
        if (!old) return old;
        return old.map((o) =>
          o.code === order.code ? { ...o, status: "Completed" as const } : o
        );
      });

      const successMsg = isEn
        ? `${order.orderType === "inbound" ? "Inbound receipt" : "Outbound order"} [${order.code}] completed successfully! Shelf stock updated.`
        : `${order.orderType === "inbound" ? "Phiếu nhập" : "Lệnh xuất"} [${order.code}] đã hoàn tất! Đã cập nhật tồn kho kệ.`;

      setFeedbackMessage({
        type: "success",
        text: successMsg,
      });

      if (onShowToast) {
        onShowToast(successMsg, "success", t("f0.text.orderCompleted"));
      }

      // Refetch queries and trigger app-wide refresh
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["orders-all-data"] });
      if (onRefreshData) {
        await onRefreshData();
      }

      if (selectedOrder && selectedOrder.code === order.code) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: "Completed" } : null));
      }
    } catch (err: any) {
      const errMsg = err.message || (t("f0.text.failedToCompleteOrder2"));
      setFeedbackMessage({
        type: "error",
        text: errMsg,
      });
      if (onShowToast) {
        onShowToast(errMsg, "error", t("f0.text.orderActionFailed"));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Client-side filtration logic
  const filteredOrders = useMemo(() => {
    return ordersList.filter((order) => {
      const matchesType =
        order.orderType.toLowerCase() === orderParams.orderType.toLowerCase();

      const matchesStatus = orderParams.status
        ? order.orderType === "inbound"
          ? getInboundWorkflowStage(order) === orderParams.status ||
            (orderParams.status === "Pending" && getInboundWorkflowStage(order) === "WaitingForReceiving") ||
            (orderParams.status === "Processing" && getInboundWorkflowStage(order) === "Receiving")
          : order.status.toLowerCase() === orderParams.status.toLowerCase() ||
            (orderParams.status === "Shipped" && (order.status === "Completed" || order.status === "Shipped")) ||
            (orderParams.status === "Completed" && (order.status === "Completed" || order.status === "Shipped"))
        : true;

      const matchesPartner = orderParams.partnerId
        ? order.partner.toLowerCase().includes(
            orderParams.partnerId === "1"
              ? "vinamilk"
              : orderParams.partnerId === "2"
              ? "coca"
              : orderParams.partnerId === "3"
              ? "apple"
              : orderParams.partnerId === "4"
              ? "thế giới di động"
              : "coopmart"
          )
        : true;

      const matchesKeyword = orderParams.searchKeyword
        ? order.code.toLowerCase().includes(orderParams.searchKeyword.toLowerCase()) ||
          (order.poNumber &&
            order.poNumber.toLowerCase().includes(orderParams.searchKeyword.toLowerCase())) ||
          (order.soNumber &&
            order.soNumber.toLowerCase().includes(orderParams.searchKeyword.toLowerCase())) ||
          order.partner.toLowerCase().includes(orderParams.searchKeyword.toLowerCase())
        : true;

      const matchesFromDate = orderParams.fromDate
        ? order.createdAt >= orderParams.fromDate
        : true;
      const matchesToDate = orderParams.toDate
        ? order.createdAt <= orderParams.toDate
        : true;

      return (
        matchesType &&
        matchesStatus &&
        matchesPartner &&
        matchesKeyword &&
        matchesFromDate &&
        matchesToDate
      );
    });
  }, [ordersList, orderParams]);

  // Pagination parameters mapping
  const currentPage = orderParams.pageIndex;
  const itemsPerPage = orderParams.pageSize;

  const setCurrentPage = (page: number) => {
    setOrderParams((prev) => ({ ...prev, pageIndex: page }));
  };

  const setItemsPerPage = (size: number) => {
    setOrderParams((prev) => ({ ...prev, pageSize: size, pageIndex: 1 }));
  };

  const totalRecords = filteredOrders.length;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endRecord = Math.min(currentPage * itemsPerPage, totalRecords);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const activeAdvancedCount = [orderParams.partnerId, orderParams.fromDate, orderParams.toDate].filter(Boolean).length;

  const hasActiveFilters = Boolean(
    orderParams.searchKeyword.trim() !== "" ||
    orderParams.status !== "" ||
    orderParams.partnerId !== "" ||
    orderParams.fromDate !== "" ||
    orderParams.toDate !== ""
  );

  const handleResetFilters = () => {
    setOrderParams((prev) => ({
      ...prev,
      searchKeyword: "",
      status: "",
      partnerId: "",
      fromDate: "",
      toDate: "",
      pageIndex: 1,
    }));
  };

  // Helper for Status Badge styling and localized text using unified StatusBadge
  const renderStatusBadge = (orderOrStatus: DetailedOrder | string) => {
    if (typeof orderOrStatus === "object" && orderOrStatus.orderType === "inbound") {
      const stage = getInboundWorkflowStage(orderOrStatus);
      if (stage === "Completed") {
        return (
          <StatusBadge
            variant="green"
            size="sm"
            icon={CheckCircle2}
            label={t("f0.text.completed")}
          />
        );
      }
      if (stage === "WaitingForPutaway") {
        return (
          <StatusBadge
            variant="blue"
            size="sm"
            icon={Boxes}
            label={t("f0.text.waitingForPutAway")}
          />
        );
      }
      if (stage === "Receiving") {
        return (
          <StatusBadge
            variant="blue"
            size="sm"
            icon={RefreshCw}
            label={t("f0.text.receiving")}
          />
        );
      }
      // WaitingForReceiving
      return (
        <StatusBadge
          variant="amber"
          size="sm"
          icon={Clock}
          label={t("f0.text.waitingForReceiving")}
        />
      );
    }

    const status = typeof orderOrStatus === "string" ? orderOrStatus : orderOrStatus.status;
    const isShipped = status === "Completed" || status === "Shipped";
    const isPacked = status === "Packed";
    const isPicked = status === "Picked";
    const isAllocated = status === "Allocated";
    const isCancelled = status === "Cancelled";
    const isPending = status === "Pending";

    const variant = isShipped
      ? "green"
      : isPacked
      ? "purple"
      : isPicked
      ? "blue"
      : isAllocated
      ? "blue"
      : isCancelled
      ? "red"
      : isPending
      ? "amber"
      : "gray";

    const icon = isShipped
      ? CheckCircle2
      : isPacked
      ? Package
      : isPicked
      ? Layers
      : isAllocated
      ? Boxes
      : isCancelled
      ? Ban
      : isPending
      ? Clock
      : undefined;

    const label = isShipped
      ? t("f0.text.shipped")
      : isPacked
      ? t("f0.text.packed")
      : isPicked
      ? t("f0.text.picked")
      : isAllocated
      ? t("f0.text.allocated")
      : isCancelled
      ? t("f0.text.cancelled")
      : isPending
      ? t("f0.text.pendingAllocation")
      : status;

    return (
      <StatusBadge
        variant={variant}
        size="sm"
        icon={icon}
        label={label}
      />
    );
  };

  return (
    <div className="w-full h-auto flex flex-col p-4 sm:p-6 font-sans animate-fadeIn bg-slate-50 min-h-screen">
      {/* 1. Header with Fixed Single Plus Icon */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
            {activeTab === "inbound" ? (
              <Inbox className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <Package className="h-5 w-5" strokeWidth={1.75} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {t("f0.text.inboundOutboundOrderVouchers")}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t("f0.text.centralizedManagementOfInboundReceiptPutAwaysAndCustomer")}
            </p>
          </div>
        </div>

        {/* Action Buttons: Single Plus Icon */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate("/dashboard/orders/inbound/create")}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t("f0.text.newInboundAsn")}</span>
          </button>
          <button
            onClick={() => navigate("/dashboard/orders/outbound/create")}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t("f0.text.newOutboundSo")}</span>
          </button>
        </div>
      </div>

      {/* 2. Order Telemetry KPI Summary Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total Vouchers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-l-4 border-l-blue-600 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-600 block">
              {t("f0.text.totalVouchers")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {totalVouchers}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {t("f0.text.vouchers")}
              </span>
            </div>
            <span className="text-[11px] font-mono text-blue-600 font-semibold block mt-1">
              {totalUnits.toLocaleString()} {t("f0.text.unitsTotal")}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0">
            {activeTab === "inbound" ? (
              <Inbox className="w-5 h-5" strokeWidth={1.8} />
            ) : (
              <Package className="w-5 h-5" strokeWidth={1.8} />
            )}
          </div>
        </div>

        {/* Card 2: Pending / Waiting for Receiving */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-l-4 border-l-amber-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-600 block">
              {activeTab === "inbound"
                ? t("f0.text.waitingForReceiving2")
                : t("f0.text.pendingAllocation2")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-600 font-mono">
                {activeTab === "inbound" ? inboundWaitingReceivingCount : outboundPendingCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {t("f0.text.orders2")}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              {activeTab === "inbound"
                ? t("f0.text.awaitingDockCheckIn")
                : t("f0.text.readyForStockAllocation")}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-5 h-5" strokeWidth={1.8} />
          </div>
        </div>

        {/* Card 3: In Progress / Waiting for Put-away */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-l-4 border-l-indigo-600 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-600 block">
              {activeTab === "inbound"
                ? t("f0.text.waitingForPutAway2")
                : t("f0.text.processing2")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-600 font-mono">
                {activeTab === "inbound"
                  ? inboundWaitingPutawayCount
                  : outboundAllocatedCount + outboundPickedCount + outboundPackedCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {activeTab === "inbound"
                  ? t("f0.text.readyForBins")
                  : t("f0.text.inProgress")}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              {activeTab === "inbound"
                ? t("f0.text.receivedReadyForShelfSlotting")
                : t("f0.text.reservationsLockedInPickPack")}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
            {activeTab === "inbound" ? (
              <Boxes className="w-5 h-5 text-indigo-600" strokeWidth={1.8} />
            ) : (
              <RefreshCw className="w-5 h-5 text-indigo-600" strokeWidth={1.8} />
            )}
          </div>
        </div>

        {/* Card 4: Completed SLA / Shipped */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-600 block">
              {activeTab === "inbound"
                ? t("f0.text.completed")
                : t("f0.text.shipped")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600 font-mono">
                {activeTab === "inbound" ? inboundCompletedCount : outboundShippedCount}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600">
                ({activeTab === "inbound"
                  ? totalVouchers > 0 ? Math.round((inboundCompletedCount / totalVouchers) * 100) : 0
                  : totalOutboundCount > 0 ? Math.round((outboundShippedCount / totalOutboundCount) * 100) : 0}%)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              {activeTab === "inbound"
                ? t("f0.text.goodsSafelySlottedInStorageBins")
                : t("f0.text.dispatchedStockDeducted")}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" strokeWidth={1.8} />
          </div>
        </div>
      </div>

      {/* Action / Success Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`mb-4 p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-fadeIn ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Segmented Tab Switcher & Integrated Enterprise Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs mb-6 overflow-hidden">
        {/* Top Tab Bar & Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Segmented Control with Count Badges */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => handleTabChange("inbound")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "inbound"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Inbox className="w-4 h-4 text-blue-600" />
              <span>{t("f0.text.inboundReceipts")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-700 font-bold">
                {totalInboundCount}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("outbound")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "outbound"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className="w-4 h-4 text-emerald-600" />
              <span>{t("f0.text.outboundOrders")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-700 font-bold">
                {totalOutboundCount}
              </span>
            </button>
          </div>

          {/* Quick Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(activeTab === "inbound"
              ? [
                  { id: "", labelVi: "Tất cả", labelEn: "All", count: currentTabOrders.length },
                  { id: "WaitingForReceiving", labelVi: "Chờ nhận hàng", labelEn: "Waiting for Receiving", count: inboundWaitingReceivingCount },
                  { id: "Receiving", labelVi: "Đang nhận hàng", labelEn: "Receiving", count: inboundReceivingCount },
                  { id: "WaitingForPutaway", labelVi: "Chờ cất kệ", labelEn: "Waiting for Put-away", count: inboundWaitingPutawayCount },
                  { id: "Completed", labelVi: "Hoàn tất", labelEn: "Completed", count: inboundCompletedCount },
                ]
              : [
                  { id: "", labelVi: "Tất cả", labelEn: "All", count: currentTabOrders.length },
                  { id: "Pending", labelVi: "Chờ phân bổ", labelEn: "Pending", count: outboundPendingCount },
                  { id: "Allocated", labelVi: "Đã phân bổ", labelEn: "Allocated", count: outboundAllocatedCount },
                  { id: "Picked", labelVi: "Đã nhặt hàng", labelEn: "Picked", count: outboundPickedCount },
                  { id: "Packed", labelVi: "Đã đóng gói", labelEn: "Packed", count: outboundPackedCount },
                  { id: "Shipped", labelVi: "Đã xuất kho", labelEn: "Shipped", count: outboundShippedCount },
                ]
            ).map((pill) => {
              const isSelected = orderParams.status === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() =>
                    setOrderParams((prev) => ({
                      ...prev,
                      status: pill.id,
                      pageIndex: 1,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                  }`}
                >
                  <span>{isEn ? pill.labelEn : pill.labelVi}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Search Input & Advanced Trigger Bar */}
        <div className="p-4 bg-slate-50/50 flex flex-col md:flex-row items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={orderParams.searchKeyword}
              onChange={(e) =>
                setOrderParams((prev) => ({
                  ...prev,
                  searchKeyword: e.target.value,
                  pageIndex: 1,
                }))
              }
              placeholder={
                activeTab === "inbound"
                  ? t("f0.text.searchReceiptCodePoNumberOrSupplier")
                  : t("f0.text.searchOrderCodeSoNumberOrCustomer")
              }
              className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {orderParams.searchKeyword && (
              <button
                onClick={() =>
                  setOrderParams((prev) => ({ ...prev, searchKeyword: "", pageIndex: 1 }))
                }
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Advanced Filter Toggle & Refresh Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
            <button
              onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isAdvancedFiltersOpen || activeAdvancedCount > 0
                  ? "bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-500/20"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>{t("f0.text.advancedFilter")}</span>
              {activeAdvancedCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-mono flex items-center justify-center font-bold">
                  {activeAdvancedCount}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 transition-colors px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
              >
                <span>{t("f0.text.resetFilters2")}</span>
              </button>
            )}

            <button
              onClick={() => {
                refetch();
                if (onRefreshData) onRefreshData();
              }}
              title={t("f0.text.reload")}
              aria-label={t("f0.text.reload")}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filter Panel */}
        {isAdvancedFiltersOpen && (
          <div className="p-4 border-t border-slate-200/80 bg-slate-50 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Partner Dropdown */}
              <div>
                <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {activeTab === "inbound"
                    ? t("f0.text.vendorPartner")
                    : t("f0.text.customerRecipient")}
                </label>
                <select
                  value={orderParams.partnerId}
                  onChange={(e) =>
                    setOrderParams((prev) => ({
                      ...prev,
                      partnerId: e.target.value,
                      pageIndex: 1,
                    }))
                  }
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="">{t("f0.text.allPartners")}</option>
                  {partnersFilterMock.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {t("f0.text.fromDate")}
                </label>
                <input
                  type="date"
                  value={orderParams.fromDate}
                  onChange={(e) =>
                    setOrderParams((prev) => ({
                      ...prev,
                      fromDate: e.target.value,
                      pageIndex: 1,
                    }))
                  }
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {t("f0.text.toDate")}
                </label>
                <input
                  type="date"
                  value={orderParams.toDate}
                  onChange={(e) =>
                    setOrderParams((prev) => ({
                      ...prev,
                      toDate: e.target.value,
                      pageIndex: 1,
                    }))
                  }
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Clear Filters Link */}
            {activeAdvancedCount > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/60 flex justify-end">
                <button
                  onClick={() =>
                    setOrderParams((prev) => ({
                      ...prev,
                      partnerId: "",
                      fromDate: "",
                      toDate: "",
                      pageIndex: 1,
                    }))
                  }
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold transition cursor-pointer"
                >
                  {t("f0.text.resetAdvancedFilters")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. High-Density Enterprise Table */}
      <div className="w-full flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-16 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <span className="text-xs font-bold text-slate-600">
              {t("f0.text.synchronizingOrders")}
            </span>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap min-w-[900px] text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-600 [&_th]:!normal-case [&_th]:!tracking-normal">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("f0.text.orderCodeReferenceDocument")}
                    </th>
                    <th className="py-3 px-4 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("f0.text.status")}
                    </th>
                    <th className="py-3 px-4 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {activeTab === "inbound"
                        ? t("f0.text.vendorPartner2")
                        : t("f0.text.customerRecipient2")}
                    </th>
                    <th className="py-3 px-4 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("f0.text.itemsQuantityProgress")}
                    </th>
                    <th className="py-3 px-4 font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("f0.text.creationDateOperator")}
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-600 !normal-case !tracking-normal">
                      {t("f0.text.businessActions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {totalRecords === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <FileX className="w-12 h-12 text-slate-300 mb-2 stroke-1" />
                          <p className="text-sm font-semibold">
                            {t("f0.text.noVouchersMatchYourCurrentFilters")}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((item) => {
                      const isPendingOrProgress =
                        item.status === "Pending" ||
                        item.status === "In Progress" ||
                        item.status === "Processing";
                      const isLoadingAction = actionLoadingId === item.code;

                      return (
                        <tr
                          key={item.code}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          {/* Col 1: Code & Reference Badge */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex flex-col">
                              <span className="text-xs font-extrabold text-blue-600 font-mono">
                                {item.code}
                              </span>
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 w-fit mt-1">
                                {item.poNumber || item.soNumber || item.code}
                              </span>
                            </div>
                          </td>

                          {/* Col 2: Status */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(item)}
                          </td>

                          {/* Col 3: Partner & Location */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 text-xs">
                                {item.partner}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {t("f0.text.whHcm01MasterHub")}
                              </span>
                            </div>
                          </td>

                          {/* Col 4: Items & Progress Bar */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 font-mono text-xs">
                                <span className="font-bold text-slate-900">{item.skuCount} SKUs</span>
                                <span className="text-slate-400">•</span>
                                <span className="font-semibold text-slate-600">{item.totalQty} {t("f0.text.units")}</span>
                              </div>
                              {/* Progress mini bar */}
                              <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5 border border-slate-200/60">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    item.orderType === "inbound"
                                      ? getInboundWorkflowStage(item) === "Completed"
                                        ? "bg-emerald-500 w-full"
                                        : getInboundWorkflowStage(item) === "WaitingForPutaway"
                                        ? "bg-indigo-500 w-4/5"
                                        : getInboundWorkflowStage(item) === "Receiving"
                                        ? "bg-blue-500 w-1/2"
                                        : "bg-amber-400 w-1/12"
                                      : item.status === "Completed"
                                      ? "bg-emerald-500 w-full"
                                      : item.status === "Processing" || item.status === "In Progress"
                                      ? "bg-blue-500 w-1/2"
                                      : "bg-amber-400 w-1/12"
                                  }`}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Col 5: Date & Dispatcher */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs text-slate-700 font-medium">
                                {item.createdAt}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                {t("f0.text.dispatcherOperationsLead")}
                              </span>
                            </div>
                          </td>

                          {/* Col 6: Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Inbound Workflow: Open Receiving & Put-away Workspace */}
                              {item.orderType === "inbound" ? (
                                (() => {
                                  const inboundStage = getInboundWorkflowStage(item);
                                  const isCompleted = inboundStage === "Completed";
                                  const isWaitingPutaway = inboundStage === "WaitingForPutaway";
                                  const isReceiving = inboundStage === "Receiving";

                                  const ctaLabel = isCompleted
                                    ? t("f0.text.viewReceipt")
                                    : isWaitingPutaway
                                    ? t("f0.text.putAway")
                                    : isReceiving
                                    ? t("f0.text.continueReceiving")
                                    : t("f0.text.receive");

                                  const btnStyle = isCompleted
                                    ? "bg-slate-700 hover:bg-slate-800 text-white"
                                    : isWaitingPutaway
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                    : "bg-blue-600 hover:bg-blue-700 text-white";

                                  return (
                                    <button
                                      onClick={() => setReceivingOrder(item)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer ${btnStyle}`}
                                      title={
                                        isCompleted
                                          ? t("f0.text.viewReceipt")
                                          : isWaitingPutaway
                                          ? t("f0.text.putAway")
                                          : isReceiving
                                          ? t("f0.text.continueReceiving")
                                          : t("f0.text.receive")
                                      }
                                    >
                                      {isCompleted ? (
                                        <Eye className="w-3.5 h-3.5" />
                                      ) : isWaitingPutaway ? (
                                        <Boxes className="w-3.5 h-3.5" />
                                      ) : (
                                        <Inbox className="w-3.5 h-3.5" />
                                      )}
                                      <span>{ctaLabel}</span>
                                    </button>
                                  );
                                })()
                              ) : (
                                /* Outbound Orders Workflow (B3 Lifecycle) */
                                (() => {
                                  const outboundStatus = item.status || "Pending";
                                  const outboundId = item.soNumber || item.code;

                                  const getOutboundBtnInfo = () => {
                                    switch (outboundStatus) {
                                      case "Pending":
                                        return {
                                          label: t("f0.text.allocate"),
                                          style: "bg-amber-600 hover:bg-amber-700 text-white",
                                          icon: <Boxes className="w-3.5 h-3.5" />,
                                        };
                                      case "Allocated":
                                        return {
                                          label: t("f0.text.pick"),
                                          style: "bg-blue-600 hover:bg-blue-700 text-white",
                                          icon: <Layers className="w-3.5 h-3.5" />,
                                        };
                                      case "Picked":
                                        return {
                                          label: t("f0.text.pack"),
                                          style: "bg-indigo-600 hover:bg-indigo-700 text-white",
                                          icon: <Package className="w-3.5 h-3.5" />,
                                        };
                                      case "Packed":
                                        return {
                                          label: t("f0.text.ship"),
                                          style: "bg-emerald-600 hover:bg-emerald-700 text-white",
                                          icon: <Truck className="w-3.5 h-3.5" />,
                                        };
                                      default:
                                        return {
                                          label: t("f0.text.viewOrder"),
                                          style: "bg-slate-700 hover:bg-slate-800 text-white",
                                          icon: <Eye className="w-3.5 h-3.5" />,
                                        };
                                    }
                                  };

                                  const btn = getOutboundBtnInfo();

                                  return (
                                    <button
                                      onClick={() => setSelectedOutboundId(outboundId)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer ${btn.style}`}
                                      title={btn.label}
                                    >
                                      {btn.icon}
                                      <span>{btn.label}</span>
                                    </button>
                                  );
                                })()
                              )}

                              {/* View Details Button */}
                              <button
                                onClick={() => {
                                  if (item.orderType === "inbound") {
                                    setReceivingOrder(item);
                                  } else {
                                    setSelectedOutboundId(item.soNumber || item.code);
                                  }
                                }}
                                className="border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-slate-600 transition cursor-pointer"
                                title={t("f0.text.viewVoucherDetails")}
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>{t("f0.text.details")}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="border-t border-slate-200 bg-white py-3.5 px-6 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span>
                  {isEn
                    ? `Showing ${startRecord}-${endRecord} of ${totalRecords} results`
                    : `Hiển thị ${startRecord}-${endRecord} trong số ${totalRecords} kết quả`}
                </span>
                <div className="hidden sm:block border-l border-slate-200 h-4" />
                <div className="relative inline-flex items-center shrink-0">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    aria-label={t("f0.text.itemsPerPage")}
                    className="appearance-none h-9 pl-3 pr-8 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-colors shadow-2xs"
                  >
                    <option value="10">10 / {t("f0.text.page")}</option>
                    <option value="20">20 / {t("f0.text.page")}</option>
                    <option value="50">50 / {t("f0.text.page")}</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => currentPage > 1 && setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-mono font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => currentPage < totalPages && setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 5. Slide-Over Drawer for Document Details */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
                  {selectedOrder.orderType === "inbound" ? (
                    <Inbox className="w-5 h-5" />
                  ) : (
                    <Package className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight text-white font-mono">
                      {selectedOrder.code}
                    </h2>
                    {renderStatusBadge(selectedOrder)}
                  </div>
                  <p className="text-xs text-slate-400">
                    {selectedOrder.orderType === "inbound"
                      ? t("f0.text.inboundReceiptDocumentPutAway")
                      : t("f0.text.outboundSalesOrderPicking")}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                aria-label={t("f0.text.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* General Summary Card */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  {t("f0.text.voucherMetadata")}
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      {selectedOrder.orderType === "inbound"
                        ? t("f0.text.poReference")
                        : t("f0.text.soReference")}
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedOrder.poNumber || selectedOrder.soNumber || selectedOrder.code}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      {t("f0.text.warehouse2")}
                    </span>
                    <span className="font-medium text-slate-800 flex items-center gap-1 font-mono">
                      <MapPin className="w-3 h-3 text-red-500" />
                      {t("f0.text.whHcm01CentralWarehouse")}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      {selectedOrder.orderType === "inbound"
                        ? t("f0.text.vendorPartner3")
                        : t("f0.text.customer")}
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedOrder.partner}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      {t("f0.text.creationDate")}
                    </span>
                    <span className="font-mono text-slate-800">
                      {selectedOrder.createdAt}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-blue-600" />
                    <span>{t("f0.text.lineItemsBreakdown")}</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500 font-bold">
                    {selectedOrder.items?.length || selectedOrder.skuCount} SKUs • {selectedOrder.totalQty} {t("f0.text.units")}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">{t("f0.text.skuName")}</th>
                          <th className="py-2.5 px-3">{t("f0.text.targetBin")}</th>
                          <th className="py-2.5 px-3">{t("f0.text.lotExpiry")}</th>
                          <th className="py-2.5 px-3 text-right">{t("f0.text.qty")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedOrder.items || []).map((it, idx) => {
                          const prod = products.find((p) => p.sku === it.sku);
                          const itemName = it.name || prod?.name || it.sku;
                          const binCode =
                            it.binCode ||
                            bins.find((b) => b.storedSkus?.some((s) => s.sku === it.sku))?.code ||
                            "D2-A01-N01";
                          const lotNum = it.lotNumber || `LOT-2026-V0${(idx % 4) + 1}`;
                          const expDate = it.expiryDate || "2027-12-31";

                          return (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="py-3 px-3">
                                <div className="font-mono font-bold text-blue-700">
                                  {it.sku}
                                </div>
                                <div className="text-[11px] text-slate-600 line-clamp-1">
                                  {itemName}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-[11px] font-bold">
                                  <MapPin className="w-3 h-3 text-blue-500" />
                                  {binCode}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                                <div>{lotNum}</div>
                                <div className="text-[10px] text-slate-400">{expDate}</div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                {it.expectedQty} {t("f0.text.pcs")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
              {selectedOrder.orderType === "inbound" ? (
                getInboundWorkflowStage(selectedOrder) === "Completed" ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {t("f0.text.receiptFullyCompletedPutAway")}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const target = selectedOrder;
                      setSelectedOrder(null);
                      setReceivingOrder(target);
                    }}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer ${
                      getInboundWorkflowStage(selectedOrder) === "WaitingForPutaway"
                        ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                    }`}
                  >
                    {getInboundWorkflowStage(selectedOrder) === "WaitingForPutaway" ? (
                      <Boxes className="w-4 h-4" />
                    ) : (
                      <Inbox className="w-4 h-4" />
                    )}
                    <span>
                      {getInboundWorkflowStage(selectedOrder) === "WaitingForPutaway"
                        ? t("f0.text.putAway")
                        : getInboundWorkflowStage(selectedOrder) === "Receiving"
                        ? t("f0.text.continueReceiving")
                        : t("f0.text.receive")}
                    </span>
                  </button>
                )
              ) : selectedOrder.status !== "Shipped" && selectedOrder.status !== "Completed" ? (
                <button
                  onClick={() => {
                    const id = selectedOrder.soNumber || selectedOrder.code;
                    setSelectedOrder(null);
                    setSelectedOutboundId(id);
                  }}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                >
                  <Package className="w-4 h-4" />
                  <span>
                    {t("f0.text.openOutboundOrderLifecycleB3")}
                  </span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    {t("f0.text.orderFullyShippedCompleted")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Dedicated Inbound Receipt Detail & Receiving Experience Modal */}
      {receivingOrder && (
        <InboundReceivingModal
          isOpen={!!receivingOrder}
          onClose={() => setReceivingOrder(null)}
          order={receivingOrder}
          products={products}
          bins={bins}
          lang={lang}
          onReceiptUpdated={async () => {
            await refetch();
            if (onRefreshData) {
              await onRefreshData();
            }
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* 7. Dedicated Outbound B3 Lifecycle Modal (Authoritative GET & Full Pick) */}
      {selectedOutboundId && (
        <OutboundDetailModal
          isOpen={!!selectedOutboundId}
          onClose={() => setSelectedOutboundId(null)}
          orderId={selectedOutboundId}
          lang={lang}
          onOrderUpdated={async () => {
            await refetch();
            if (onRefreshData) {
              await onRefreshData();
            }
          }}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
