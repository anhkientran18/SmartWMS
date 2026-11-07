/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Calendar,
  UploadCloud,
  MapPin,
  Check,
  Package,
  Layers,
  Sparkles,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Barcode,
  Clock,
  FileText,
  FileSpreadsheet,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Product, Bin, Warehouse, WarehouseZone, Vendor } from "../../types/index";
import { DetailedOrder } from "../orders/OrderManagement";
import InboundReceivingModal from "./InboundReceivingModal";

export interface CreateInboundVoucherProps {
  products?: Product[];
  bins?: Bin[];
  warehouses?: Warehouse[];
  zones?: WarehouseZone[];
  vendors?: Vendor[];
  lang?: string;
  onRefreshData?: () => void | Promise<void>;
  onShowToast?: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    title?: string
  ) => void;
}

interface InboundItemRow {
  id: number;
  sku: string;
  name: string;
  expectedQty: number;
  unit: string;
  price: number;
  expiry: string;
  batch: string;
}

export default function CreateInboundVoucher({
  products = [],
  bins = [],
  warehouses = [],
  zones = [],
  vendors = [],
  lang,
  onRefreshData,
  onShowToast,
}: CreateInboundVoucherProps) {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);
  const isEn = lang === "en-US" || i18n.language?.startsWith("en");
  const navigate = useNavigate();

  // Form General States
  const [vendorName, setVendorName] = useState("Vinamilk Trade Vietnam");
  const [warehouseId, setWarehouseId] = useState("WH-01");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [poNumber, setPoNumber] = useState(
    `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`
  );
  const [creator, setCreator] = useState("Admin (Logistics Manager)");
  const [notes, setNotes] = useState("");

  // Created receipt context for post-creation receipt detail / receiving
  const [createdReceipt, setCreatedReceipt] = useState<DetailedOrder | null>(null);
  const [showReceivingModal, setShowReceivingModal] = useState<boolean>(false);

  // Dynamic Items list (No Bin assigned at receipt creation)
  const [items, setItems] = useState<InboundItemRow[]>([
    {
      id: 1,
      sku: "MILK-VNM",
      name: "Vinamilk Milk Carton 180ml (x48)",
      expectedQty: 50,
      unit: "Carton",
      price: 345000,
      expiry: "2027-06-30",
      batch: "LOT-2026-M05",
    },
  ]);

  // Submission / Loading feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);



  const handleAddItem = () => {
    const fallbackProd = products[0] || {
      sku: "COCA-320",
      name: "Coca-Cola Sleek Can 320ml Tray (x24)",
      unit: "Tray",
      price: 220000,
    };
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        sku: fallbackProd.sku,
        name:
          typeof fallbackProd.name === "string"
            ? fallbackProd.name
            : fallbackProd.sku,
        expectedQty: 24,
        unit: fallbackProd.unit || "Carton",
        price: fallbackProd.price || 0,
        expiry: "2027-12-31",
        batch: `LOT-${fallbackProd.sku.slice(0, 3)}-${Date.now()
          .toString()
          .slice(-4)}`,
      },
    ]);
  };

  const handleRemoveItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemSkuChange = (id: number, newSku: string) => {
    const matched = products.find((p) => p.sku === newSku);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            sku: newSku,
            name: matched
              ? typeof matched.name === "string"
                ? matched.name
                : matched.sku
              : newSku,
            unit: matched?.unit || item.unit,
            price: matched?.price || item.price,
            batch: `LOT-${newSku.slice(0, 3)}-${Date.now()
              .toString()
              .slice(-4)}`,
          };
        }
        return item;
      })
    );
  };

  const handleItemFieldChange = (
    id: number,
    field: keyof InboundItemRow,
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

  // OCR Invoice simulation with Demo Data
  const runOcrExtraction = (customItems?: InboundItemRow[]) => {
    setIsOcrProcessing(true);
    setStatusMessage(null);

    setTimeout(() => {
      setVendorName("Coca-Cola Beverages Indochina");
      setPoNumber(`PO-OCR-${Date.now().toString().slice(-4)}`);
      setItems(
        customItems || [
          {
            id: Date.now(),
            sku: "COCA-320",
            name: "Coca-Cola Sleek Can 320ml Tray (x24)",
            expectedQty: 48,
            unit: "Tray",
            price: 220000,
            expiry: "2027-11-20",
            batch: "LOT-OCR-CC-2026",
          },
          {
            id: Date.now() + 1,
            sku: "NOODLE-HH",
            name: "Hao Hao Instant Noodles Sour/Spicy (x30)",
            expectedQty: 30,
            unit: "Box",
            price: 111000,
            expiry: "2027-10-15",
            batch: "LOT-OCR-NDL-2026",
          },
        ]
      );
      setIsOcrProcessing(false);
      setStatusMessage({
        type: "success",
        text: isEn
          ? "AI OCR successfully extracted invoice items and auto-filled voucher fields!"
          : "AI OCR đã bóc tách thông tin hóa đơn giao hàng và tự động điền các dòng sản phẩm thành công!",
      });
    }, 900);
  };

  const handleSimulateOcrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    runOcrExtraction();
  };

  // Summary calculations
  const totalInboundQty = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.expectedQty) || 0), 0),
    [items]
  );

  const totalValue = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + (Number(it.expectedQty) || 0) * (it.price || 0),
        0
      ),
    [items]
  );

  // Execute Submission to Backend
  const handleSubmitInboundVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (items.length === 0) {
      setStatusMessage({
        type: "error",
        text: isEn
          ? "Please add at least 1 item to the inbound receipt."
          : "Vui lòng thêm ít nhất 1 mặt hàng vào phiếu nhập kho.",
      });
      return;
    }

    const invalidQty = items.find((it) => it.expectedQty <= 0);
    if (invalidQty) {
      setStatusMessage({
        type: "error",
        text: isEn
          ? `Quantity for SKU [${invalidQty.sku}] must be greater than 0.`
          : `Số lượng nhập cho SKU [${invalidQty.sku}] phải lớn hơn 0.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/wms/inbounds/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName,
          warehouseId,
          poNumber,
          deliveryDate,
          creator,
          notes,
          items: items.map((it) => ({
            sku: it.sku,
            name: it.name,
            expectedQty: it.expectedQty,
            unit: it.unit,
            price: it.price,
            expiry: it.expiry,
            batch: it.batch,
          })),
          status: "Pending",
          putAwayNow: false,
          skipBinUpdate: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create inbound voucher");
      }

      // Refresh global applet state
      if (onRefreshData) {
        await onRefreshData();
      }

      const receiptCode = data.inbound?.id || poNumber;
      const newDetailedReceipt: DetailedOrder = {
        code: receiptCode,
        poNumber: data.inbound?.poNumber || poNumber,
        orderType: "inbound",
        status: "Pending",
        partner: vendorName,
        partnerId: "1",
        skuCount: items.length,
        totalQty: totalInboundQty,
        createdAt: deliveryDate,
        items: items.map((it) => ({
          sku: it.sku,
          name: it.name,
          expectedQty: Number(it.expectedQty) || 0,
          receivedQty: 0,
          lotNumber: it.batch,
          expiryDate: it.expiry,
        })),
      };

      setCreatedReceipt(newDetailedReceipt);

      const successText = isEn
        ? `Inbound receipt [${receiptCode}] created successfully! Status: Waiting for Receiving.`
        : `Tạo phiếu nhập kho [${receiptCode}] thành công! Trạng thái: Chờ nhận hàng.`;

      setStatusMessage({
        type: "success",
        text: successText,
      });

      if (onShowToast) {
        onShowToast(successText, "success", isEn ? "Inbound Receipt Created" : "Phiếu Nhập Đã Tạo");
      }
      setIsSubmitting(false);
    } catch (err: any) {
      const errorText =
        err.message ||
        (isEn ? "Error creating inbound receipt" : "Lỗi khi tạo phiếu nhập kho");
      setStatusMessage({
        type: "error",
        text: errorText,
      });
      if (onShowToast) {
        onShowToast(errorText, "error", isEn ? "Inbound Error" : "Lỗi Nhập Kho");
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col font-sans">
      {/* 1. THANH HEADER CỐ ĐỊNH (STICKY ACTION HEADER) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/dashboard/orders")}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{isEn ? "Back to Orders" : "Quay lại danh sách đơn hàng"}</span>
          </button>

          <div className="h-5 w-px bg-slate-300 hidden sm:block" />

          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {isEn ? "Create Inbound Receipt" : "Tạo mới phiếu nhập kho"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-300">
              ASN-{poNumber.replace(/^PO-/, "") || "2026-081"}
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
            onClick={handleSubmitInboundVoucher}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" strokeWidth={2.5} />
            )}
            <span>
              {isSubmitting
                ? isEn
                  ? "Creating Receipt..."
                  : "Đang tạo phiếu..."
                : isEn
                ? "Create Receipt"
                : "Tạo phiếu nhập"}
            </span>
          </button>
        </div>
      </header>

      {/* Post-Creation Action Banner */}
      {createdReceipt && (
        <div className="mx-4 sm:mx-6 mt-4 p-5 rounded-2xl bg-blue-50 border-2 border-blue-400 shadow-md animate-fadeIn text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-blue-950 font-mono">
                    {createdReceipt.code}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {isEn ? "Pending Receipt" : "Chờ nhận hàng"}
                  </span>
                </div>
                <p className="text-blue-900 mt-0.5">
                  <span className="font-semibold">{createdReceipt.partner}</span> •{" "}
                  <span className="font-mono">{createdReceipt.skuCount} SKUs</span> ({createdReceipt.totalQty} {isEn ? "units" : "đơn vị"})
                </p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  {isEn
                    ? "Receipt created successfully! Stock has NOT been added to bins. Proceed to dock receiving when goods arrive."
                    : "Đã tạo phiếu nhập kho thành công! Hàng hóa CHƯA được cộng vào tồn kho các ô kệ. Tiến hành kiểm nhận tại Dock khi hàng về."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => navigate("/dashboard/orders")}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
              >
                {t("inboundReceiving.buttons.backToList", isEn ? "Back to Inbound Receipts" : "Quay lại danh sách")}
              </button>
              <button
                type="button"
                onClick={() => setShowReceivingModal(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-2"
              >
                <Inbox className="w-4 h-4" />
                <span>{t("inboundReceiving.buttons.startReceiving", isEn ? "Start Receiving" : "Bắt đầu nhận hàng")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Message Feedback */}
      {statusMessage && !createdReceipt && (
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

      {/* Main Content: 7:3 Split layout */}
      <div className="flex-1 flex flex-col xl:flex-row max-w-[1650px] w-full mx-auto p-4 sm:p-6 gap-6 mb-20">
        {/* Left Column (70%) - Manifest Form */}
        <div className="flex-[7] flex flex-col gap-6">
          {/* 2. KHỐI THÔNG TIN CHUNG PHIẾU NHẬP (GENERAL MANIFEST CARD) */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>
                  {isEn
                    ? "Inbound receipt information"
                    : "Thông tin phiếu nhập"}
                </span>
              </h2>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4.5">
              {/* Field 1: Vendor Partner */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isEn ? "Vendor" : "Nhà cung cấp"}</span>
                </label>
                <select
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition shadow-2xs"
                >
                  <option value="Vinamilk Trade Vietnam">
                    Vinamilk Trade Vietnam (Sữa & Thức uống)
                  </option>
                  <option value="Coca-Cola Beverages Indochina">
                    Coca-Cola Beverages Indochina (Nước giải khát)
                  </option>
                  <option value="Apple Logistics APAC">
                    Apple Logistics APAC (Thiết bị điện tử)
                  </option>
                  <option value="Acecook Vietnam JSC">
                    Acecook Vietnam JSC (Mì ăn liền Hảo Hảo)
                  </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 2: Target Warehouse */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isEn ? "Target warehouse" : "Nhà kho tiếp nhận"}</span>
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition shadow-2xs"
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

              {/* Field 3: Delivery Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isEn ? "Inbound date" : "Ngày nhập kho"}</span>
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-2xs"
                />
              </div>

              {/* Field 4: PO Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isEn ? "Purchase order (PO)" : "Số đơn mua hàng (PO)"}</span>
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="PO-2026-..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-2xs"
                />
              </div>

              {/* Field 5: Creator */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>{isEn ? "Created by" : "Người lập phiếu"}</span>
                </label>
                <input
                  type="text"
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-2xs"
                />
              </div>

              {/* Field 6: Standard Initial Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>{isEn ? "Status after creation" : "Trạng thái sau khi tạo"}</span>
                </label>
                <div className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border bg-amber-50 text-amber-800 border-amber-200/90">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="truncate">
                    {isEn ? "Waiting for Receiving" : "Chờ nhận hàng"}
                  </span>
                </div>
              </div>

              {/* Field 7: Notes */}
              <div className="space-y-1.5 md:col-span-3">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isEn ? "Receiving notes" : "Ghi chú nhận hàng"}</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isEn
                      ? "Special receiving instructions, container number, or supplier reference..."
                      : "Ghi chú điều kiện bảo quản, số container, hoặc chứng từ tham chiếu của nhà cung cấp..."
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* 3. BẢNG DANH SÁCH HÀNG HÓA NHẬP KHO (LINE ITEMS TABLE & FOOTER SUMMARY) */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>
                  {isEn ? "Inbound items" : "Hàng hóa nhập kho"}
                </span>
              </h2>

              {/* Add Item Row Button */}
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                <span>{isEn ? "Add item" : "Thêm mặt hàng"}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-3.5 w-[34%]">
                      {isEn ? "SKU / Product" : "SKU / Sản phẩm"}
                    </th>
                    <th className="py-3 px-3 w-[15%] text-center">
                      {isEn ? "Expected quantity" : "Số lượng dự kiến"}
                    </th>
                    <th className="py-3 px-3 w-[12%] text-center">
                      {isEn ? "Unit" : "Đơn vị"}
                    </th>
                    <th className="py-3 px-3 w-[18%]">
                      {isEn ? "Batch / Lot" : "Số lô"}
                    </th>
                    <th className="py-3 px-3 w-[16%]">
                      {isEn ? "Expiry date" : "Hạn sử dụng"}
                    </th>
                    <th className="py-3 px-3 w-[5%] text-center">
                      {isEn ? "Delete" : "Xóa"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      {/* Column 1: SKU Select */}
                      <td className="py-2.5 px-3.5">
                        <select
                          value={item.sku}
                          onChange={(e) =>
                            handleItemSkuChange(item.id, e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                        >
                          <option value="MILK-VNM">
                            MILK-VNM • Vinamilk Milk 180ml
                          </option>
                          <option value="COCA-320">
                            COCA-320 • Coca-Cola Sleek Can 320ml
                          </option>
                          <option value="NOODLE-HH">
                            NOODLE-HH • Hao Hao Instant Noodles
                          </option>
                          <option value="IPHONE15">
                            IPHONE15 • iPhone 15 Pro Max 256GB
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
                          {item.name}
                        </div>
                      </td>

                      {/* Column 2: Expected Quantity */}
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
                          className="w-full max-w-[90px] mx-auto px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-center text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                        />
                      </td>

                      {/* Column 3: Unit */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-md border border-slate-200 text-[11px]">
                          {item.unit}
                        </span>
                      </td>

                      {/* Column 4: Batch / Lot */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) =>
                            handleItemFieldChange(item.id, "batch", e.target.value)
                          }
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                        />
                      </td>

                      {/* Column 5: Expiry Date */}
                      <td className="py-2.5 px-3">
                        <input
                          type="date"
                          value={item.expiry}
                          onChange={(e) =>
                            handleItemFieldChange(
                              item.id,
                              "expiry",
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                        />
                      </td>

                      {/* Column 6: Action */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title={isEn ? "Remove item" : "Xóa dòng"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
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

            {/* Manifest Footer Strip (Thanh tổng kết chân bảng) */}
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
                    {isEn ? "Total expected quantity:" : "Tổng số lượng dự kiến:"}
                  </span>
                  <span className="font-semibold text-blue-700 bg-blue-50/80 px-2.5 py-0.5 rounded border border-blue-200">
                    {totalInboundQty.toLocaleString()} {isEn ? (totalInboundQty === 1 ? "unit" : "units") : "đơn vị"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">
                    {isEn ? "Estimated value:" : "Giá trị ước tính:"}
                  </span>
                  <span className="font-semibold text-emerald-700 font-mono">
                    {totalValue.toLocaleString()} ₫
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-medium text-xs">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {isEn
                      ? "Status: Waiting for Receiving"
                      : "Trạng thái: Chờ nhận hàng"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (30%) - AI Assistant Panel */}
        <div className="flex-[3] flex flex-col gap-6">
          {/* 4.1. KHỐI NHẬP DỮ LIỆU TỪ CHỨNG TỪ */}
          <div className="bg-gradient-to-br from-indigo-50/80 to-violet-50/80 rounded-2xl border border-indigo-100 shadow-xs p-5 space-y-3.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <UploadCloud className="w-24 h-24 text-indigo-700" />
            </div>

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-indigo-950">
                      {isEn ? "Import from document" : "Nhập dữ liệu từ chứng từ"}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                      {isEn ? "Coming soon" : "Sắp có"}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-700 font-medium mt-0.5">
                    {isEn
                      ? "Upload invoice or delivery slip to support data entry."
                      : "Tải hóa đơn hoặc phiếu giao hàng để hỗ trợ nhập thông tin."}
                  </p>
                </div>
              </div>
            </div>

            {/* Dropzone (Disabled / Coming Soon state) */}
            <div className="relative z-10">
              <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-indigo-200 rounded-2xl bg-white/90 text-center space-y-1.5 opacity-80 cursor-not-allowed shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-0.5">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-indigo-950">
                  {isEn
                    ? "Upload invoice or delivery slip"
                    : "Tải lên hóa đơn hoặc phiếu giao hàng"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isEn
                    ? "PDF, PNG, JPG (Feature in development)"
                    : "PDF, PNG, JPG (Tính năng đang hoàn thiện)"}
                </p>
              </div>
            </div>
          </div>

          {/* 4.2. QUY TRÌNH NHẬP KHO */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex-1 relative overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-xl text-white shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    {isEn ? "Inbound workflow" : "Quy trình nhập kho"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEn ? "Workflow from creation to put-away" : "Quy trình từ tạo phiếu đến cất kệ"}
                  </p>
                </div>
              </div>
            </div>

            {/* Workflow Steps Indicator */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1">
                <div className="font-bold text-blue-900 text-xs">
                  <span>{isEn ? "1. Create receipt (Current step)" : "1. Tạo phiếu (Bước hiện tại)"}</span>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  {isEn
                    ? "Specify expected quantities, vendor, and lot/expiry information. Stock is not yet added."
                    : "Khai báo số lượng dự kiến, nhà cung cấp và thông tin lô/HSD. Chưa cộng tồn kho."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
                <div className="font-bold text-amber-900 text-xs">
                  <span>{isEn ? "2. Receive goods" : "2. Nhận hàng"}</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {isEn
                    ? "Verify actual quantities upon arrival at warehouse and record any discrepancies."
                    : "Kiểm đếm và đối chiếu số lượng thực tế khi hàng về kho, ghi nhận chênh lệch."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
                <div className="font-bold text-indigo-900 text-xs">
                  <span>{isEn ? "3. Put away" : "3. Cất kệ"}</span>
                </div>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  {isEn
                    ? "Assign appropriate storage bins with capacity and weight checks."
                    : "Chỉ định ô kệ lưu kho phù hợp và kiểm soát dung tích, tải trọng."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                <div className="font-bold text-emerald-900 text-xs">
                  <span>{isEn ? "4. Complete" : "4. Hoàn tất"}</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  {isEn
                    ? "Inventory is permanently recorded into shelf bins upon put-away confirmation."
                    : "Tồn kho chính thức được cập nhật vào các ô kệ lưu trữ."}
                </p>
              </div>
            </div>

            {/* Manifest Quick Snapshot */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span>{isEn ? "Vendor:" : "Nhà cung cấp:"}</span>
                <span className="font-semibold text-slate-800 truncate max-w-[150px]">{vendorName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>{isEn ? "Warehouse:" : "Kho tiếp nhận:"}</span>
                <span className="font-semibold text-slate-800">{warehouseId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>{isEn ? "Status after creation:" : "Trạng thái sau khi tạo:"}</span>
                <span className="font-semibold text-amber-700">{isEn ? "Waiting for Receiving" : "Chờ nhận hàng"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inbound Receiving Experience Modal for Created Receipt */}
      {createdReceipt && (
        <InboundReceivingModal
          isOpen={showReceivingModal}
          onClose={() => setShowReceivingModal(false)}
          order={createdReceipt}
          products={products}
          bins={bins}
          lang={lang}
          onReceiptUpdated={async () => {
            if (onRefreshData) await onRefreshData();
          }}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
