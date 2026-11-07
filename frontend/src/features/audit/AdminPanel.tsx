/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SecurityMonitor from "./SecurityMonitor";
import AuditLogs from "./AuditLogs";
import {
  ShieldCheck,
  Eye,
  Terminal,
  Lock,
  AlertTriangle,
  Search,
  ShieldAlert,
  QrCode,
  Printer,
  Check,
  Tag,
  Building,
  Sliders,
  Sparkles,
  LayoutGrid,
  FileText,
  Maximize2,
  Package,
  MapPin,
  Barcode,
  Info,
} from "lucide-react";
import { AuditLog, Product, Bin, WarehouseZone } from "../../types/index";
import { useTranslation } from "react-i18next";

const dict: Record<string, any> = {
  vi: {
    electronics: "Điện tử",
    beverage: "Đồ uống",
    food: "Thực phẩm",
    partial: "Còn chỗ",
    empty: "Trống",
    full: "Đầy",
    pcs: "cái",
    zone: "Phân khu",
  },
  en: {
    electronics: "Electronics",
    beverage: "Beverage",
    food: "Food",
    partial: "Partial",
    empty: "Empty",
    full: "Full",
    pcs: "PCS",
    zone: "Zone",
  },
};

interface AdminPanelProps {
  logs: AuditLog[];
  onTriggerAuditLog: (action: string, details: string) => void;
  lang: string;
  products?: Product[];
  bins?: Bin[];
  zones?: WarehouseZone[];
  activeSubTab?: "audit-logs" | "monitor" | "labels";
}

export default function AdminPanel({
  logs,
  onTriggerAuditLog,
  lang,
  products = [],
  bins = [],
  zones = [],
  activeSubTab = "audit-logs",
}: AdminPanelProps) {
  const { t } = useTranslation();
  const isEn = lang === "en-US";

  const [currentLang, setCurrentLang] = useState<'vi' | 'en'>(lang.includes('vi') ? 'vi' : 'en');
  useEffect(() => {
    setCurrentLang(lang.includes('vi') ? 'vi' : 'en');
  }, [lang]);

  const formatCurrency = (valueInVnd: number) => {
    if (currentLang === 'vi') {
      return `${valueInVnd.toLocaleString('vi-VN')} đ`;
    }
    const valueInUsd = Math.round(valueInVnd / 25000);
    return `$${valueInUsd.toLocaleString('en-US')}`;
  };

  const activeTab: "security" | "labels" =
    activeSubTab === "labels" ? "labels" : "security";
  const [filterText, setFilterText] = useState("");
  const [anomalyOnly, setAnomalyOnly] = useState(false);

  // Label Station State
  const [labelType, setLabelType] = useState<"bin" | "sku">("sku");
  const [selectedBinId, setSelectedBinId] = useState<string>(bins[0]?.id || "");
  const [selectedSkuId, setSelectedSkuId] = useState<string>(
    products[0]?.id || "",
  );
  const [labelSearch, setLabelSearch] = useState("");
  const [labelSize, setLabelSize] = useState<"small" | "medium" | "large">(
    "medium",
  );
  const [includeDate, setIncludeDate] = useState(true);
  const [barcodeStyle, setBarcodeStyle] = useState<"qr" | "barcode">("qr");
  const [customTitle, setCustomTitle] = useState("SmartWMS Label");

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (activeTab === "labels" && location.state?.selectedSku) {
      const targetSku = location.state.selectedSku;
      const product = products.find((p) => p.sku === targetSku);
      if (product) {
        setLabelType("sku");
        setSelectedSkuId(product.id);
      }
    }
  }, [location.state, activeTab, products]);

  const filteredLogs = logs.filter((l) => {
    const detailsStr = typeof l.details === "object" ? (l.details.vi + " " + l.details.en) : l.details;
    const matchTxt =
      l.operator.toLowerCase().includes(filterText.toLowerCase()) ||
      l.action.toLowerCase().includes(filterText.toLowerCase()) ||
      detailsStr.toLowerCase().includes(filterText.toLowerCase());

    if (anomalyOnly) {
      return matchTxt && l.isAnomaly;
    }
    return matchTxt;
  });

  // Label selection helpers
  const activeBin = bins.find((b) => b.id === selectedBinId) || bins[0];
  const activeProduct =
    products.find((p) => p.id === selectedSkuId) || products[0];

  const activeZone = zones.find((z) => z.id === activeBin?.zoneId);
  const activeZoneName = activeZone
    ? typeof activeZone.name === "object"
      ? activeZone.name[currentLang] || activeZone.name.vi || activeZone.name.en
      : activeZone.name
    : activeBin?.zoneId || (isEn ? "Zone Unassigned" : "Chưa gán phân khu");

  const term = labelSearch.toLowerCase();

  const filteredBins = bins.filter((b) => {
    const zoneObj = zones.find((z) => z.id === b.zoneId);
    const zName = zoneObj
      ? typeof zoneObj.name === "object"
        ? (zoneObj.name.vi + " " + zoneObj.name.en).toLowerCase()
        : String(zoneObj.name).toLowerCase()
      : b.zoneId.toLowerCase();
    return b.code.toLowerCase().includes(term) || zName.includes(term);
  });

  const filteredProducts = products.filter((p) => {
    const rawDesc = p.description as unknown;
    const descText =
      typeof rawDesc === "object" && rawDesc !== null
        ? `${(rawDesc as { vi?: string; en?: string }).vi || ""} ${(rawDesc as { vi?: string; en?: string }).en || ""}`.toLowerCase()
        : String(rawDesc || "").toLowerCase();
    return (
      p.sku.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      Boolean(p.barcode && p.barcode.toLowerCase().includes(term)) ||
      p.category.toLowerCase().includes(term) ||
      descText.includes(term)
    );
  });

  const getLabelDimensions = () => {
    switch (labelSize) {
      case "small":
        return "w-[260px] text-[10px]";
      case "large":
        return "w-[360px] text-xs";
      default:
        return "w-[310px] text-[11px]";
    }
  };

  const getLabelSizeLabel = () => {
    switch (labelSize) {
      case "small":
        return '2" x 1"';
      case "large":
        return '4" x 6"';
      default:
        return '3" x 2"';
    }
  };

  const handlePrint = () => {
    onTriggerAuditLog(
      isEn ? "Print Label" : "In Tem Nhãn",
      isEn
        ? `Initiated print for ${labelType === "bin" ? activeBin?.code : activeProduct?.sku} (${getLabelSizeLabel()}).`
        : `Mở hộp thoại in tem nhãn cho ${labelType === "bin" ? activeBin?.code : activeProduct?.sku} (${getLabelSizeLabel()}).`
    );
    window.print();
  };

  const renderSvgBarcode = (value: string) => {
    const bars: { width: number; isSpace: boolean }[] = [];
    bars.push({ width: 3, isSpace: true });
    bars.push({ width: 2, isSpace: false }, { width: 1, isSpace: true }, { width: 2, isSpace: false }, { width: 1, isSpace: true });

    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      const w1 = ((code >> 1) % 3) + 1;
      const w2 = ((code >> 2) % 2) + 1;
      const w3 = ((code >> 3) % 3) + 1;
      bars.push({ width: w1, isSpace: false });
      bars.push({ width: 1, isSpace: true });
      bars.push({ width: w2, isSpace: false });
      bars.push({ width: 1, isSpace: true });
      bars.push({ width: w3, isSpace: false });
      bars.push({ width: 2, isSpace: true });
    }

    bars.push({ width: 2, isSpace: false }, { width: 1, isSpace: true }, { width: 2, isSpace: false });
    bars.push({ width: 3, isSpace: true });

    const totalWidth = bars.reduce((sum, b) => sum + b.width, 0);
    let currentX = 0;

    return (
      <div className="flex flex-col items-center justify-center w-full py-1">
        <svg
          viewBox={`0 0 ${totalWidth} 44`}
          className="h-10 w-full max-w-[220px]"
          preserveAspectRatio="none"
        >
          {bars.map((bar, idx) => {
            const x = currentX;
            currentX += bar.width;
            if (bar.isSpace) return null;
            return (
              <rect
                key={idx}
                x={x}
                y={0}
                width={bar.width}
                height={44}
                fill="#0f172a"
              />
            );
          })}
        </svg>
        <span className="font-mono text-[9px] tracking-wider text-slate-700 mt-1 font-semibold">
          {value}
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
      {/* Dedicated Enterprise Header based on activeSubTab */}
      {activeSubTab === "monitor" ? (
        <div className="flex flex-col border-b border-slate-200 pb-5 gap-1.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-sans font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <ShieldCheck className="h-6 w-6 text-blue-600" strokeWidth={1.5} />
                </div>
                <span>
                  {isEn
                    ? "Security Monitoring"
                    : "Giám sát an ninh"}
                </span>
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            {isEn
              ? "Monitor active sessions, authentication events, and system security activities."
              : "Theo dõi phiên đăng nhập, sự kiện xác thực và hoạt động bảo mật của hệ thống."}
          </p>
        </div>
      ) : activeSubTab === "audit-logs" ? (
        <div className="flex flex-col border-b border-slate-200 pb-5 gap-1.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-sans font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Terminal className="h-6 w-6 text-indigo-600" strokeWidth={1.5} />
                </div>
                <span>
                  {isEn
                    ? "Activity Log"
                    : "Nhật ký hoạt động"}
                </span>
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            {isEn
              ? "Review recorded user actions, system events, and warehouse operations."
              : "Theo dõi các thao tác người dùng, sự kiện hệ thống và hoạt động vận hành được ghi nhận."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col border-b border-slate-200 pb-5 gap-1.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-sans font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Printer className="h-6 w-6 text-blue-600" strokeWidth={1.5} />
                </div>
                <span>
                  {isEn
                    ? "Barcode & QR Label Printing"
                    : "In tem nhãn mã vạch"}
                </span>
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            {isEn
              ? "Select products or bin locations, configure label content, and preview before printing."
              : "Chọn sản phẩm hoặc vị trí ô kệ, cấu hình nội dung nhãn và xem trước trước khi in."}
          </p>
        </div>
      )}

      {/* VIEW A: LABELS PRINTING STATION */}
      {activeTab === "labels" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start font-sans">
          {/* Controls Left Column - Selection & Configuration */}
          <div className="xl:col-span-7 space-y-6">
            {/* Source Database Tab selector */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isEn ? "Select print data" : "Chọn dữ liệu in"}
                  </h3>
                </div>

                {/* Sub toggle: Sku vs Bin */}
                <div className="flex border border-slate-200 p-0.5 rounded-lg text-xs bg-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setLabelType("sku");
                      setLabelSearch("");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-md transition ${
                      labelType === "sku"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    <span>{isEn ? "Product (SKU)" : "Sản phẩm (SKU)"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLabelType("bin");
                      setLabelSearch("");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-md transition ${
                      labelType === "bin"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{isEn ? "Location (Bin)" : "Ô kệ (Bin)"}</span>
                  </button>
                </div>
              </div>

              {/* Search filter input */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3 py-2 text-xs">
                <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder={
                    labelType === "sku"
                      ? isEn
                        ? "Search by SKU, product name, barcode, category..."
                        : "Tìm theo mã SKU, tên sản phẩm, mã vạch, phân loại..."
                      : isEn
                        ? "Search by bin code, zone..."
                        : "Tìm theo vị trí ô kệ, phân khu..."
                  }
                  value={labelSearch}
                  onChange={(e) => setLabelSearch(e.target.value)}
                  className="outline-none w-full text-slate-700 bg-transparent placeholder:text-slate-400"
                />
              </div>

              {/* Render dynamic matching records list */}
              <div className="bg-slate-50 rounded-xl border border-slate-200/70 p-1.5 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {labelType === "sku" ? (
                  filteredProducts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic text-xs">
                      {isEn
                        ? "No products match your search details."
                        : "Không có sản phẩm nào khớp với từ khóa tìm kiếm."}
                    </div>
                  ) : (
                    filteredProducts.map((prod) => {
                      const isSelected = selectedSkuId === prod.id;
                      const rawDesc = prod.description as unknown;
                      const prodDesc: string =
                        typeof rawDesc === "object" && rawDesc !== null
                          ? (rawDesc as { vi?: string; en?: string })[currentLang] ||
                            (rawDesc as { vi?: string; en?: string }).vi ||
                            (rawDesc as { vi?: string; en?: string }).en ||
                            ""
                          : typeof rawDesc === "string"
                            ? rawDesc
                            : "";
                      return (
                        <div
                          key={prod.id}
                          onClick={() => setSelectedSkuId(prod.id)}
                          className={`flex items-center justify-between p-3 cursor-pointer transition rounded-lg ${
                            isSelected
                              ? "bg-blue-50/80 border-l-4 border-blue-600 shadow-2xs"
                              : "hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {prod.sku}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {prod.barcode ? `[${prod.barcode}]` : (isEn ? "[No barcode]" : "[Chưa có barcode]")}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-slate-800 truncate mt-0.5" title={prod.name}>
                              {prod.name}
                            </div>
                            {prodDesc && prodDesc !== prod.name && (
                              <div className="text-[11px] text-slate-500 truncate" title={prodDesc}>
                                {prodDesc}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                              {dict[currentLang]?.[prod.category?.toLowerCase()] || prod.category}
                            </span>
                            <span className="text-[11px] text-slate-900 font-mono font-bold">
                              {formatCurrency(prod.price)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : filteredBins.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic text-xs">
                    {isEn
                      ? "No warehouse bins match your search."
                      : "Không tìm thấy ô kệ nào phù hợp."}
                  </div>
                ) : (
                  filteredBins.map((bin) => {
                    const isSelected = selectedBinId === bin.id;
                    const bZone = zones.find((z) => z.id === bin.zoneId);
                    const bZoneName = bZone
                      ? typeof bZone.name === "object"
                        ? bZone.name[currentLang] || bZone.name.vi || bZone.name.en
                        : bZone.name
                      : bin.zoneId;
                    return (
                      <div
                        key={bin.id}
                        onClick={() => setSelectedBinId(bin.id)}
                        className={`flex items-center justify-between p-3 cursor-pointer transition rounded-lg ${
                          isSelected
                            ? "bg-blue-50/80 border-l-4 border-blue-600 shadow-2xs"
                            : "hover:bg-slate-100/70"
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="font-mono text-xs font-bold text-slate-900">
                            {bin.code}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate mt-0.5" title={bZoneName}>
                            {`${dict[currentLang].zone}: ${bZoneName}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                              bin.status === "empty"
                                ? "bg-slate-100 border-slate-200 text-slate-600"
                                : bin.status === "full"
                                  ? "bg-rose-50 border-rose-200 text-rose-700"
                                  : "bg-amber-50 border-amber-200 text-amber-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                bin.status === "empty"
                                  ? "bg-slate-400"
                                  : bin.status === "full"
                                    ? "bg-rose-500"
                                    : "bg-amber-400"
                              }`}
                            />
                            {dict[currentLang]?.[bin.status.toLowerCase()] || bin.status}
                          </span>
                          <span className="font-mono text-[11px] text-slate-600">
                            {`${bin.currentOccupancy} / ${bin.maxCapacity} ${dict[currentLang].pcs}`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Label Configuration */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sliders className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {isEn ? "Label configuration" : "Cấu hình tem nhãn"}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Size Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    {isEn ? "Label stock / size" : "Kích thước tem nhãn"}
                  </label>
                  <select
                    value={labelSize}
                    onChange={(e) => setLabelSize(e.target.value as any)}
                    className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="large">
                      {isEn ? 'Standard (4" x 6")' : 'Tiêu chuẩn (4" x 6")'}
                    </option>
                    <option value="medium">
                      {isEn ? 'Medium (3" x 2")' : 'Trung bình (3" x 2")'}
                    </option>
                    <option value="small">
                      {isEn ? 'Compact (2" x 1")' : 'Nhỏ (2" x 1")'}
                    </option>
                  </select>
                </div>

                {/* Barcode format */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    {isEn ? "Barcode format" : "Kiểu mã"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBarcodeStyle("qr")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                        barcodeStyle === "qr"
                          ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>QR Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarcodeStyle("barcode")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                        barcodeStyle === "barcode"
                          ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Barcode className="h-3.5 w-3.5" />
                      <span>{isEn ? "Barcode (1D)" : "Mã vạch (1D)"}</span>
                    </button>
                  </div>
                </div>

                {/* Custom Title Input */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    {isEn ? "Label header title" : "Tiêu đề nhãn"}
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="SmartWMS Label"
                    className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>

                {/* Timestamp Checkbox */}
                <div className="sm:col-span-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeDate}
                      onChange={(e) => setIncludeDate(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      {isEn ? "Include timestamp" : "In kèm ngày giờ"}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons & Print Controls */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>{isEn ? "Print / Preview" : "In / Xem trước"}</span>
                </button>

                <button
                  type="button"
                  disabled
                  title={isEn ? "No printer connection configured" : "Chưa cấu hình kết nối máy in"}
                  className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Printer className="h-4 w-4 text-slate-400" />
                  <span>{isEn ? "Direct print — Not connected" : "In trực tiếp — Chưa kết nối"}</span>
                </button>
              </div>

              <div className="flex items-start gap-1.5 text-[11px] text-slate-500 pt-1">
                <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  {isEn
                    ? "Print / Preview triggers your browser printing dialog formatted specifically for thermal labels. Direct print requires a networked printer connection."
                    : "Lệnh In / Xem trước sẽ mở hộp thoại in của trình duyệt được định dạng riêng cho tem nhãn. In trực tiếp yêu cầu kết nối thiết bị máy in nội bộ."}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Label Preview */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isEn ? "Label preview" : "Xem trước tem nhãn"}
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {getLabelSizeLabel()}
                </span>
              </div>

              {/* Physical sticker wrapper */}
              <div
                id="print-label-area"
                className="flex justify-center bg-slate-100 p-6 rounded-xl border border-slate-200/70"
              >
                {/* Sticker Decal container */}
                <div
                  className={`print-label-sticker bg-white border-2 border-slate-900 p-4 rounded-sm shadow-md flex flex-col justify-between text-slate-900 transition-all duration-200 ${getLabelDimensions()}`}
                >
                  <div className="space-y-2.5 font-mono text-[10px] select-none">
                    {/* Header bar */}
                    <div className="border-b-2 border-slate-900 pb-1.5 flex justify-between items-center">
                      <span className="font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5 truncate">
                        <span className={`h-2 w-2 rounded-full inline-block shrink-0 ${labelType === "bin" ? "bg-blue-600" : "bg-indigo-600"}`} />
                        <span className="truncate">
                          {customTitle.trim() || "SmartWMS Label"}
                        </span>
                      </span>
                      <span className="text-[8px] bg-slate-900 text-white px-1.5 py-[1px] font-bold rounded shrink-0">
                        {getLabelSizeLabel()}
                      </span>
                    </div>

                    {labelType === "bin" ? (
                      /* TEM Ô KỆ (STORAGE BIN LABEL) */
                      <div className="space-y-2">
                        {/* 4 Metadata Metrics Grid */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                          <div>
                            <span className="text-slate-500 text-[8px] block uppercase font-bold">
                              {isEn ? "BIN LOCATION:" : "MÃ VỊ TRÍ KỆ:"}
                            </span>
                            <span className="font-extrabold text-blue-700 font-mono text-xs">
                              {activeBin?.code || "BIN-01"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8px] block uppercase font-bold">
                              {isEn ? "STORAGE ZONE:" : "PHÂN KHU:"}
                            </span>
                            <span className="font-bold text-slate-800 text-[10px] truncate block" title={activeZoneName}>
                              {activeZoneName}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8px] block uppercase font-bold">
                              {isEn ? "MAX CAPACITY:" : "SỨC CHỨA TỐI ĐA:"}
                            </span>
                            <span className="font-bold text-slate-800 text-[10px]">
                              {activeBin?.maxCapacity || 0} {dict[currentLang].pcs}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8px] block uppercase font-bold">
                              {isEn ? "CURRENT OCCUPANCY:" : "ĐANG CHỨA:"}
                            </span>
                            <span className="font-bold text-slate-800 text-[10px]">
                              {activeBin?.currentOccupancy || 0} {dict[currentLang].pcs}
                            </span>
                          </div>
                        </div>

                        {/* Location Identifier QR Code or SVG Barcode */}
                        <div className="py-2 flex justify-center items-center bg-white border border-slate-200 rounded-lg">
                          {barcodeStyle === "qr" ? (
                            <div className="p-1.5 bg-white border border-slate-300 rounded">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`BIN:${activeBin?.code}:${activeBin?.zoneId}`)}`}
                                alt="QR Location Identifier"
                                className="h-24 w-24 object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            renderSvgBarcode(activeBin?.code || "BIN-CODE")
                          )}
                        </div>

                        {/* Summary list of stored SKUs */}
                        <div className="border border-slate-200 p-2 rounded bg-slate-50/80">
                          <span className="text-slate-500 text-[8px] block uppercase font-bold mb-0.5">
                            {isEn ? "STORED SKUS:" : "SKU ĐANG LƯU TRỮ:"}
                          </span>
                          <p className="text-[9px] text-slate-800 font-sans font-medium line-clamp-2">
                            {activeBin?.storedSkus && activeBin.storedSkus.filter((s) => s.qty > 0).length > 0
                              ? activeBin.storedSkus
                                  .filter((s) => s.qty > 0)
                                  .map((s) => `${s.sku} (x${s.qty})`)
                                  .join(" • ")
                              : isEn
                                ? "Empty bin"
                                : "Ô kệ trống"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* TEM SẢN PHẨM (PRODUCT SKU LABEL) */
                      <div className="space-y-2">
                        <div className="space-y-1.5 bg-slate-50 p-2 rounded border border-slate-200">
                          <div className="flex justify-between items-start">
                            <span className="text-slate-500 text-[8px] uppercase font-bold">
                              {isEn ? "SKU CODE:" : "MÃ SKU:"}
                            </span>
                            <span className="font-extrabold text-blue-700 font-mono text-xs">
                              {activeProduct?.sku || "SKU-001"}
                            </span>
                          </div>

                          <div className="flex justify-between items-start">
                            <span className="text-slate-500 text-[8px] uppercase font-bold">
                              {isEn ? "BARCODE:" : "MÃ VẠCH:"}
                            </span>
                            <span className="font-bold text-slate-800 font-mono text-[10px]">
                              {activeProduct?.barcode || (isEn ? "No barcode" : "Chưa có barcode")}
                            </span>
                          </div>

                          <div className="border-t border-slate-200/70 pt-1">
                            <span className="text-slate-500 text-[8px] block uppercase font-bold">
                              {isEn ? "PRODUCT NAME:" : "TÊN SẢN PHẨM:"}
                            </span>
                            <p className="font-bold text-slate-900 font-sans text-[10px] leading-tight">
                              {activeProduct?.name}
                            </p>
                            {typeof activeProduct?.description === "object" && activeProduct?.description?.en && activeProduct.description.en !== activeProduct.name && (
                              <p className="text-[9px] text-slate-500 font-sans italic mt-0.5">
                                EN: {activeProduct.description.en}
                              </p>
                            )}
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-200/70 pt-1">
                            <div>
                              <span className="text-slate-500 text-[8px] uppercase font-bold block">
                                {isEn ? "UNIT:" : "ĐƠN VỊ TÍNH:"}
                              </span>
                              <span className="font-bold text-slate-800 text-[10px] uppercase font-mono">
                                {activeProduct?.unit || (isEn ? "Unit" : "Đơn vị")}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-500 text-[8px] uppercase font-bold block">
                                {isEn ? "PRICE:" : "ĐƠN GIÁ:"}
                              </span>
                              <span className="font-extrabold text-emerald-700 text-xs font-mono">
                                {formatCurrency(activeProduct?.price || 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Barcode / QR Code Representation */}
                        <div className="py-2 flex justify-center items-center bg-white border border-slate-200 rounded-lg">
                          {barcodeStyle === "barcode" ? (
                            renderSvgBarcode(activeProduct?.barcode || activeProduct?.sku || "SKU-CODE")
                          ) : (
                            <div className="p-1.5 bg-white border border-slate-300 rounded">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`SKU:${activeProduct?.sku}:${activeProduct?.barcode || ""}`)}`}
                                alt="QR SKU Code"
                                className="h-24 w-24 object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Footer text metadata inside label template */}
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center text-[8px] text-slate-500">
                      <div>
                        {includeDate && (
                          <span>
                            {new Date().toLocaleDateString()}{" "}
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <span className="font-bold tracking-wider text-slate-700 font-sans">
                        SmartWMS
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: SECURITY REINFORCEMENT & SYSTEM AUDITS (PREEXISTING) */}
      {activeTab === "security" && (
        <>
          {activeSubTab === "monitor" && (
            <SecurityMonitor
              logs={logs}
              lang={lang}
              onTriggerAuditLog={onTriggerAuditLog}
              hideHeader={true}
              onNavigateToLogs={() => navigate("/dashboard/security/audit-logs")}
            />
          )}

          {activeSubTab === "audit-logs" && <AuditLogs logs={logs} />}
        </>
      )}
    </div>
  );
}
