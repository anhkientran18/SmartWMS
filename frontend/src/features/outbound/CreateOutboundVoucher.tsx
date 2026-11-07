/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Box,
  Calendar,
  MapPin,
  Truck,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
  Barcode,
  Clock,
  Layers,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Product, Bin, Warehouse, WarehouseZone } from "../../types/index";
import { outboundService } from "../../services/outboundService";

export interface CreateOutboundVoucherProps {
  products?: Product[];
  bins?: Bin[];
  warehouses?: Warehouse[];
  zones?: WarehouseZone[];
  lang?: string;
  onRefreshData?: () => void | Promise<void>;
  onShowToast?: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    title?: string
  ) => void;
}

interface OutboundItemRow {
  id: number;
  sku: string;
  expectedQty: number;
  unit: string;
  lotNumber: string;
  binCode: string;
}

export default function CreateOutboundVoucher({
  products = [],
  bins = [],
  warehouses = [],
  zones = [],
  lang,
  onRefreshData,
  onShowToast,
}: CreateOutboundVoucherProps) {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);
  const isEn = lang === "en-US" || i18n.language?.startsWith("en");
  const navigate = useNavigate();

  // General Form States
  const [customerName, setCustomerName] = useState("Thế Giới Di Động Group");
  const [warehouseId, setWarehouseId] = useState("WH-01");
  const [expDate, setExpDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [soNumber, setSoNumber] = useState(
    `SO-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`
  );
  const [carrier, setCarrier] = useState("DHL Express");
  const [address, setAddress] = useState(
    "Số 128 Trần Quang Khải, P. Tân Định, Quận 1, TP. HCM"
  );
  const [creator, setCreator] = useState("Admin (Outbound Supervisor)");

  // Dynamic Item Rows
  const [items, setItems] = useState<OutboundItemRow[]>([
    {
      id: 1,
      sku: "IPHONE15",
      expectedQty: 5,
      unit: "Pcs",
      lotNumber: "LOT-2026-P02 (HSD: 10/2027)",
      binCode: "D2-A02-N02",
    },
    {
      id: 2,
      sku: "COCA-320",
      expectedQty: 12,
      unit: "Tray",
      lotNumber: "LOT-2026-CC1 (HSD: 12/2026)",
      binCode: "D2-A02-N01",
    },
  ]);

  // Submission / Loading feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Calculate available stock for SKU in a specific bin accurately
  const getBinStockForSku = (binCode: string, sku: string) => {
    const targetBin = bins.find((b) => b.code === binCode || b.id === binCode);
    if (!targetBin) return 0;
    const found = targetBin.storedSkus?.find((s) => s.sku === sku);
    return found ? found.qty : 0;
  };

  // Helper to calculate total available stock for a given SKU across warehouse
  const getAvailableStockForSku = (sku: string) => {
    const total = bins.reduce((sum, b) => {
      const found = b.storedSkus?.find((s) => s.sku === sku);
      return sum + (found ? found.qty : 0);
    }, 0);
    return total > 0 ? total : 200;
  };

  // Helper to find bin that contains stock for SKU
  const getBinWithStock = (sku: string) => {
    const bin = bins.find((b) =>
      b.storedSkus?.some((s) => s.sku === sku && s.qty > 0)
    );
    if (bin) return bin.code;
    if (sku.startsWith("MILK") || sku.startsWith("COCA")) return "D2-A02-N01";
    return "D2-A02-N02";
  };

  // Unified available picking bin options
  const pickingBinOptions = useMemo(() => {
    const list: { code: string; zoneName: string }[] = [];
    const added = new Set<string>();

    const defaults = [
      {
        code: "D2-A02-N02",
        zoneName: isEn ? "Zone D Dry" : "Khu Khô (Zone D)",
      },
      {
        code: "D2-A02-N01",
        zoneName: isEn ? "Zone D Dry" : "Khu Khô (Zone D)",
      },
      {
        code: "C1-A01-N02",
        zoneName: isEn ? "Zone C Cool" : "Khu Mát (Zone C)",
      },
      {
        code: "C1-A01-N01",
        zoneName: isEn ? "Zone C Cool" : "Khu Mát (Zone C)",
      },
      {
        code: "D2-A03-N01",
        zoneName: isEn ? "Zone D Dry" : "Khu Khô (Zone D)",
      },
    ];

    defaults.forEach((d) => {
      list.push(d);
      added.add(d.code);
    });

    bins.forEach((b) => {
      if (!added.has(b.code)) {
        let zoneName = isEn ? "Zone D Dry" : "Khu Khô (Zone D)";
        if (b.code.startsWith("C")) {
          zoneName = isEn ? "Zone C Cool" : "Khu Mát (Zone C)";
        } else if (b.code.startsWith("POS")) {
          zoneName = isEn ? "Zone POS Retail" : "Quầy Bán Lẻ (Zone POS)";
        }
        list.push({ code: b.code, zoneName });
        added.add(b.code);
      }
    });

    return list;
  }, [bins, isEn]);

  const handleAddItem = () => {
    const fallbackProd = products[0] || {
      sku: "NOODLE-HH",
      name: "Hao Hao Instant Noodles Sour/Spicy (x30)",
      unit: "Box",
    };
    const sourceBin = getBinWithStock(fallbackProd.sku);

    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        sku: fallbackProd.sku,
        expectedQty: 10,
        unit: fallbackProd.unit || "Box",
        lotNumber: `LOT-2026-${fallbackProd.sku.slice(0, 3)} (FEFO)`,
        binCode: sourceBin,
      },
    ]);
  };

  const handleRemoveItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemSkuChange = (id: number, newSku: string) => {
    const matched = products.find((p) => p.sku === newSku);
    const sourceBin = getBinWithStock(newSku);

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            sku: newSku,
            unit: matched?.unit || item.unit,
            binCode: sourceBin,
            lotNumber: `LOT-2026-${newSku.slice(0, 3)} (FEFO)`,
          };
        }
        return item;
      })
    );
  };

  const handleItemFieldChange = (
    id: number,
    field: keyof OutboundItemRow,
    value: any
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // Calculations for summary & cartonization
  const totalOutboundQty = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.expectedQty) || 0), 0),
    [items]
  );

  const allRowsValidStock = useMemo(() => {
    return items.every((it) => {
      const stock = getAvailableStockForSku(it.sku);
      return it.expectedQty <= stock;
    });
  }, [items, bins]);

  // Execute Submission to Node Backend
  const handleSubmitOutboundVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (items.length === 0) {
      setStatusMessage({
        type: "error",
        text: isEn
          ? "Please add at least 1 item to the outbound order."
          : "Vui lòng thêm ít nhất 1 mặt hàng vào lệnh xuất kho.",
      });
      return;
    }

    // Verify stock availability
    for (const item of items) {
      if (item.expectedQty <= 0) {
        const errText = isEn
          ? `Quantity for SKU [${item.sku}] must be greater than 0.`
          : `Số lượng xuất cho SKU [${item.sku}] phải lớn hơn 0.`;
        setStatusMessage({
          type: "error",
          text: errText,
        });
        if (onShowToast) {
          onShowToast(errText, "error", isEn ? "Invalid Quantity" : "Số lượng không hợp lệ");
        }
        return;
      }

      const available = getAvailableStockForSku(item.sku);
      if (item.expectedQty > available) {
        const errText = isEn
          ? `Not enough available stock for SKU [${item.sku}]! Available: ${available}, Requested: ${item.expectedQty}.`
          : `Không đủ tồn kho khả dụng cho SKU [${item.sku}]! Khả dụng: ${available}, Yêu cầu xuất: ${item.expectedQty}.`;
        setStatusMessage({
          type: "error",
          text: errText,
        });
        if (onShowToast) {
          onShowToast(errText, "error", isEn ? "Insufficient Stock" : "Không đủ tồn kho");
        }
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const targetBinId = items[0]?.binCode || "D2-A02-N02";
      const createdOrder = await outboundService.createOutboundOrder({
        orderNumber: soNumber,
        binId: targetBinId,
        customerId: null,
        expectedShipDate: expDate,
        priority: "Normal",
        notes: `Lệnh xuất kho cho khách hàng ${customerName}. Giao qua ${carrier}. Địa chỉ: ${address}.`,
        items: items.map((it) => ({
          productId: it.sku,
          requestedQuantity: Number(it.expectedQty) || 1,
        })),
      });

      // Refresh global applet state
      if (onRefreshData) {
        await onRefreshData();
      }

      const orderCode = createdOrder.orderNumber || createdOrder.id || soNumber;
      const successText = isEn
        ? `Outbound order [${orderCode}] created in Pending status! Awaiting allocation.`
        : `Lệnh xuất kho [${orderCode}] đã tạo thành công ở trạng thái Chờ phân bổ!`;

      setStatusMessage({
        type: "success",
        text: `${successText} ${isEn ? "Redirecting..." : "Đang chuyển hướng..."}`,
      });

      if (onShowToast) {
        onShowToast(successText, "success", isEn ? "Outbound Order Created" : "Lệnh Xuất Đã Tạo");
      }

      setTimeout(() => {
        navigate("/dashboard/orders");
      }, 700);
    } catch (err: any) {
      const errorText =
        err.message ||
        (isEn ? "Error creating outbound order" : "Lỗi khi tạo lệnh xuất kho");
      setStatusMessage({
        type: "error",
        text: errorText,
      });
      if (onShowToast) {
        onShowToast(errorText, "error", isEn ? "Outbound Error" : "Lỗi Xuất Kho");
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col font-sans">
      {/* 1. THANH HEADER CỐ ĐỊNH (STICKY ACTION HEADER - EMERALD ACCENTS) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/dashboard/orders")}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{isEn ? "Back to Orders" : "Quay lại danh sách đơn hàng"}</span>
          </button>

          <div className="h-5 w-px bg-slate-300 hidden sm:block" />

          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {isEn ? "Create Outbound Order" : "Tạo mới lệnh xuất kho"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-300">
              SO-{soNumber.replace(/^SO-/, "") || "2026-081"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/dashboard/orders")}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
          >
            {isEn ? "Cancel" : "Hủy bỏ"}
          </button>
          <button
            type="button"
            onClick={handleSubmitOutboundVoucher}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
            )}
            <span>
              {isSubmitting
                ? isEn
                  ? "Creating Order..."
                  : "Đang tạo lệnh..."
                : isEn
                ? "Create Outbound Order"
                : "Tạo lệnh xuất kho"}
            </span>
          </button>
        </div>
      </header>

      {/* Status Feedback Notification */}
      {statusMessage && (
        <div
          className={`mx-4 sm:mx-6 mt-4 p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs animate-fadeIn ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Content: Focused clean layout for Order Creation */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6 mb-20">
        {/* 1. KHỐI THÔNG TIN CHUNG LỆNH XUẤT */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Box className="w-4 h-4 text-emerald-600" />
              <span>
                {isEn
                  ? "Outbound order information"
                  : "Thông tin lệnh xuất"}
              </span>
            </h2>

            {/* Initial Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-slate-600">{isEn ? "Status after creation:" : "Trạng thái sau khi tạo:"}</span>
              <span className="font-semibold text-amber-800">{isEn ? "Awaiting Allocation" : "Chờ phân bổ"}</span>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4.5">
            {/* Field 1: Customer */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{isEn ? "Customer / Recipient" : "Khách hàng / Đơn vị nhận"}</span>
              </label>
              <select
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer transition shadow-2xs"
              >
                <option value="Thế Giới Di Động Group">
                  Thế Giới Di Động Group (Chuỗi bán lẻ Mobile)
                </option>
                <option value="CoopMart Supermarket Vietnam">
                  CoopMart Supermarket Vietnam (Hệ thống siêu thị)
                </option>
                <option value="WinMart Retail Hanoi">
                  WinMart Retail Hanoi (Cửa hàng tiện lợi)
                </option>
                <option value="Tiki Corporation">
                  Tiki Corporation (Sàn TMĐT)
                </option>
                <option value="Shopee Logistics Hub">
                  Shopee Logistics Hub (Trung tâm phân loại)
                </option>
              </select>
            </div>

            {/* Field 2: Dispatch Warehouse */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{isEn ? "Dispatch warehouse" : "Kho xuất hàng"}</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer transition shadow-2xs"
              >
                <option value="WH-01">
                  {isEn
                    ? "WH-01 - Central Master Warehouse"
                    : "WH-01 - Tổng Kho Trung Tâm (Q9, TP.HCM)"}
                </option>
                <option value="WH-02">
                  {isEn
                    ? "WH-02 - Satellite Hub Binh Duong"
                    : "WH-02 - Kho Vệ Tinh Bình Dương"}
                </option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} -{" "}
                    {typeof w.name === "object"
                      ? isEn
                        ? w.name.en
                        : w.name.vi
                      : w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Field 3: Expected Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{isEn ? "Expected dispatch date" : "Ngày dự kiến xuất"}</span>
              </label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shadow-2xs"
              />
            </div>

            {/* Field 4: SO Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-slate-400" />
                <span>{isEn ? "Sales order (SO)" : "Số đơn hàng xuất (SO)"}</span>
              </label>
              <input
                type="text"
                value={soNumber}
                onChange={(e) => setSoNumber(e.target.value)}
                placeholder="SO-2026-..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shadow-2xs"
              />
            </div>

            {/* Field 5: Carrier */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                <span>{isEn ? "Shipping carrier" : "Đơn vị vận chuyển"}</span>
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer transition shadow-2xs"
              >
                <option value="DHL Express">DHL Express Vietnam</option>
                <option value="Viettel Post">Viettel Post Logistics</option>
                <option value="VNPost">VNPost Giao Hàng Tiết Kiệm</option>
                <option value="Internal Fleet">
                  Đội xe tải kho nội bộ (Internal Fleet)
                </option>
              </select>
            </div>

            {/* Field 6: Delivery Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span>{isEn ? "Delivery address" : "Địa chỉ giao hàng"}</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* 2. BẢNG DANH SÁCH HÀNG HÓA XUẤT KHO */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>
                {isEn
                  ? "Outbound items"
                  : "Hàng hóa xuất kho"}
              </span>
            </h2>

            {/* Add Item Button */}
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              <span>{isEn ? "Add item" : "Thêm mặt hàng"}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-3.5 w-[42%]">
                    {isEn ? "SKU / Product" : "SKU / Sản phẩm"}
                  </th>
                  <th className="py-3 px-3 w-[20%] text-center">
                    {isEn ? "Available stock" : "Tồn khả dụng"}
                  </th>
                  <th className="py-3 px-3 w-[18%] text-center">
                    {isEn ? "Dispatch quantity" : "Số lượng xuất"}
                  </th>
                  <th className="py-3 px-3 w-[12%] text-center">
                    {isEn ? "Unit" : "Đơn vị"}
                  </th>
                  <th className="py-3 px-3 w-[8%] text-center">
                    {isEn ? "Delete" : "Xóa"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const availableStock = getAvailableStockForSku(item.sku);
                  const isExceeding = item.expectedQty > availableStock;

                  const matchedProduct = products.find((p) => p.sku === item.sku);
                  const prodName =
                    matchedProduct
                      ? typeof matchedProduct.name === "string"
                        ? matchedProduct.name
                        : matchedProduct.sku
                      : item.sku === "IPHONE15"
                      ? "iPhone 15 Pro Max 256GB"
                      : item.sku === "COCA-320"
                      ? "Coca-Cola Sleek Can 320ml (x24)"
                      : item.sku === "MILK-VNM"
                      ? "Vinamilk Milk Carton 180ml"
                      : item.sku;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-emerald-50/25 transition-colors"
                    >
                      {/* Column 1: SKU / Product */}
                      <td className="py-2.5 px-3.5">
                        <select
                          value={item.sku}
                          onChange={(e) =>
                            handleItemSkuChange(item.id, e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                        >
                          <option value="IPHONE15">
                            IPHONE15 • iPhone 15 Pro Max 256GB
                          </option>
                          <option value="MILK-VNM">
                            MILK-VNM • Vinamilk Milk 180ml
                          </option>
                          <option value="NOODLE-HH">
                            NOODLE-HH • Hao Hao Instant Noodles
                          </option>
                          <option value="COCA-320">
                            COCA-320 • Coca-Cola Sleek Can 320ml
                          </option>
                          <option value="TV-SONY">
                            TV-SONY • Sony Bravia 55 Inch 4K
                          </option>
                          {products.map((p) => (
                            <option key={p.id} value={p.sku}>
                              {p.sku} •{" "}
                              {typeof p.name === "string" ? p.name : p.sku}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate pl-1">
                          {prodName}
                        </div>
                      </td>

                      {/* Column 2: Available Stock across warehouse */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-mono font-semibold text-xs inline-flex items-center gap-1 border ${
                            isExceeding
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {availableStock} {item.unit}
                        </span>
                      </td>

                      {/* Column 3: Dispatch Quantity */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.expectedQty}
                          onChange={(e) =>
                            handleItemFieldChange(
                              item.id,
                              "expectedQty",
                              Math.max(1, Number(e.target.value))
                            )
                          }
                          className={`w-full max-w-[90px] mx-auto px-2 py-1.5 bg-slate-50 border rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 shadow-2xs ${
                            isExceeding
                              ? "border-rose-400 text-rose-600 bg-rose-50/50 focus:ring-rose-500"
                              : "border-slate-200 text-slate-900 focus:ring-emerald-500"
                          }`}
                        />
                      </td>

                      {/* Column 4: Unit */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 font-semibold rounded-md border border-slate-200 text-[11px]">
                          {item.unit}
                        </span>
                      </td>

                      {/* Column 5: Action */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title={isEn ? "Remove item" : "Xóa"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-10 text-xs text-slate-400 font-medium"
                    >
                      {isEn
                        ? "No items added yet. Click 'Add item' to begin."
                        : "Chưa có mặt hàng nào. Bấm 'Thêm mặt hàng' để thêm."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Outbound Manifest Summary Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">
                  {isEn ? "Total items:" : "Tổng mặt hàng:"}
                </span>
                <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {items.length} {isEn ? (items.length === 1 ? "item" : "items") : "mặt hàng"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">
                  {isEn ? "Total dispatch quantity:" : "Tổng số lượng xuất:"}
                </span>
                <span className="font-semibold text-emerald-700 bg-emerald-50/80 px-2.5 py-0.5 rounded border border-emerald-200">
                  {totalOutboundQty.toLocaleString()} {isEn ? (totalOutboundQty === 1 ? "unit" : "units") : "đơn vị"}
                </span>
              </div>
            </div>

            {/* Stock Verification Status Badge */}
            <div>
              {allRowsValidStock ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {isEn
                      ? "Sufficient stock available"
                      : "Đủ tồn kho khả dụng"}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-medium text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>
                    {isEn
                      ? "Warning: Quantity exceeds available stock"
                      : "Cảnh báo: Số lượng vượt tồn kho khả dụng"}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
