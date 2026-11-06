/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Package,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Maximize2,
  Gauge,
  RotateCcw,
} from "lucide-react";
import { BinContentHeaderDto, BinDto } from "../../services/api/apiTypes";
import { Bin } from "../../types/index";
import { binService } from "../../services/locations/binService";
import {
  InventoryStatus,
  normalizeInventoryStatus,
  getInventoryStatusLabel,
} from "../../services/inventory/types";
import { StatusBadge, ActionButton, StatusVariant } from "../../components/common";

export interface BinDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBin: BinDto | Bin | { id: string; code: string } | null;
  isEn?: boolean;
  // Optional legacy props maintained for interface compatibility without using legacy fallback
  allBins?: any[];
  zones?: any[];
  products?: any[];
  onTransfer?: any;
  initialMode?: string;
  initialSku?: string;
}

export interface DisplayBinItem {
  sku: string;
  productName: string;
  lotNumber: string;
  expirationDate: string;
  quantity: number;
  status: string | number;
}

export interface DisplayBinContent {
  binCode: string;
  maxCapacity: number;
  currentOccupancy: number;
  availableCapacity: number;
  utilizationPercentage: number;
  items: DisplayBinItem[];
}

export function isLegacyBin(bin: any): bin is Bin {
  return (
    bin !== null &&
    typeof bin === "object" &&
    "storedSkus" in bin &&
    Array.isArray((bin as Bin).storedSkus)
  );
}

function formatExpirationDate(dateStr?: string): string {
  if (!dateStr || dateStr.trim() === "") return "—";
  if (dateStr.includes("/")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return dateStr;
}

function getItemStatusMeta(status?: string | number, isEn = false): { label: string; variant: StatusVariant } {
  const norm = normalizeInventoryStatus(status);
  const label = getInventoryStatusLabel(norm, isEn);

  switch (norm) {
    case InventoryStatus.Available:
      return { label, variant: "success" };
    case InventoryStatus.Reserved:
      return { label, variant: "info" };
    case InventoryStatus.QCHold:
      return { label, variant: "warning" };
    case InventoryStatus.Damaged:
      return { label, variant: "danger" };
    case InventoryStatus.Expired:
      return { label, variant: "neutral" };
    default:
      return { label, variant: "neutral" };
  }
}

export default function BinDetailModal({
  isOpen,
  onClose,
  selectedBin,
  isEn = false,
}: BinDetailModalProps) {
  const [content, setContent] = useState<DisplayBinContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCanonicalContents = useCallback(async () => {
    if (!selectedBin?.id) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await binService.getBinContents(selectedBin.id);
      const max = data.maxCapacity ?? 0;
      const occ = data.currentOccupancy ?? 0;
      const avail = Math.max(0, max - occ);
      const util =
        data.utilizationPercentage ??
        (max > 0 ? Math.round((occ / max) * 100) : 0);
      const items: DisplayBinItem[] = (data.items || []).map((it) => ({
        sku: it.sku,
        productName: it.productName || it.sku,
        lotNumber: it.lotNumber || "—",
        expirationDate: it.expirationDate || "—",
        quantity: it.quantity,
        status: it.status,
      }));

      setContent({
        binCode: data.binCode || selectedBin.code,
        maxCapacity: max,
        currentOccupancy: occ,
        availableCapacity: avail,
        utilizationPercentage: util,
        items,
      });
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (isEn
            ? "Failed to load bin contents."
            : "Không thể tải chi tiết ô kệ.")
      );
    } finally {
      setLoading(false);
    }
  }, [selectedBin, isEn]);

  useEffect(() => {
    if (!isOpen || !selectedBin) {
      setContent(null);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    if (isLegacyBin(selectedBin)) {
      setLoading(false);
      setErrorMessage(null);
      const max = selectedBin.maxCapacity ?? 0;
      const occ = selectedBin.currentOccupancy ?? 0;
      const avail = Math.max(0, max - occ);
      const util = max > 0 ? Math.round((occ / max) * 100) : 0;
      const items: DisplayBinItem[] = (selectedBin.storedSkus || []).map((s) => ({
        sku: s.sku,
        productName: s.name || s.sku,
        lotNumber: s.lotNumber || "—",
        expirationDate: s.expirationDate || "—",
        quantity: s.qty,
        status: s.status || "Available",
      }));

      setContent({
        binCode: selectedBin.code,
        maxCapacity: max,
        currentOccupancy: occ,
        availableCapacity: avail,
        utilizationPercentage: util,
        items,
      });
    } else {
      fetchCanonicalContents();
    }
  }, [isOpen, selectedBin, fetchCanonicalContents]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !selectedBin) return null;

  const binCode = content?.binCode || selectedBin.code;
  const maxCapacity = content?.maxCapacity ?? 0;
  const currentOccupancy = content?.currentOccupancy ?? 0;
  const availableCapacity = Math.max(0, maxCapacity - currentOccupancy);
  const utilizationRate =
    content?.utilizationPercentage ??
    (maxCapacity > 0 ? Math.round((currentOccupancy / maxCapacity) * 100) : 0);

  // UI presentation threshold color
  const getProgressColor = (util: number) => {
    if (util === 0) return "bg-slate-300";
    if (util < 80) return "bg-emerald-500";
    if (util < 100) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Background backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-out Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-12 z-50 pointer-events-auto">
        <div className="w-screen max-w-3xl bg-white shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col h-full transform transition-all duration-300 ease-in-out animate-in slide-in-from-right font-sans">
          {/* Header */}
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
                <Package className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h3
                  id="modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate flex items-center gap-2"
                >
                  <span>{isEn ? "Bin Details:" : "Chi tiết ô kệ:"}</span>
                  <span className="font-mono text-blue-600 font-extrabold">{binCode}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
                  {isEn
                    ? "Stored inventory, occupancy metrics, and SKU lots"
                    : "Danh sách hàng tồn, sức chứa và các lô sản phẩm"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title={isEn ? "Close" : "Đóng"}
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-20 flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" strokeWidth={1.5} />
              <p className="text-xs font-medium">
                {isEn ? "Loading bin details..." : "Đang nạp dữ liệu chi tiết ô kệ..."}
              </p>
            </div>
          )}

          {/* Error State */}
          {!loading && errorMessage && (
            <div className="p-6 flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-rose-700 text-center max-w-md">
                {errorMessage}
              </p>
              <ActionButton
                variant="primary"
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={fetchCanonicalContents}
              >
                {isEn ? "Retry" : "Thử lại"}
              </ActionButton>
            </div>
          )}

          {/* Content Body */}
          {!loading && !errorMessage && content && (
            <>
              {/* Summary Cards */}
              <div className="p-4 sm:p-5 bg-slate-50/90 border-b border-slate-200 shrink-0 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Card 1: Sức chứa tối đa */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <span>{isEn ? "Total Capacity" : "Sức chứa tối đa"}</span>
                      <Maximize2 className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {maxCapacity}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {isEn ? "pcs" : "cái"}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Đang sử dụng */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <span>{isEn ? "Occupied" : "Đang sử dụng"}</span>
                      <Gauge className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {currentOccupancy}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {isEn ? "pcs" : "cái"}
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Còn trống */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <span>{isEn ? "Available" : "Còn trống"}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="font-mono text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                        {availableCapacity}
                      </span>
                      <span className="text-[11px] font-medium text-emerald-700">
                        {isEn ? "pcs" : "cái"}
                      </span>
                    </div>
                  </div>

                  {/* Card 4: Tỷ lệ sử dụng */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <span>{isEn ? "Utilization" : "Tỷ lệ sử dụng"}</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.5} />
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="font-mono text-xl sm:text-2xl font-black text-blue-600 tracking-tight">
                        {utilizationRate}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getProgressColor(
                      utilizationRate
                    )}`}
                    style={{ width: `${Math.min(100, Math.max(0, utilizationRate))}%` }}
                  />
                </div>
              </div>

              {/* Table of items */}
              <div className="p-4 sm:p-6 space-y-3 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                    {isEn ? "Stored Inventory Items" : "Danh sách hàng trong ô kệ"}
                  </h4>
                  <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                    {content.items.length} {isEn ? "SKUs" : "Mặt hàng"}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs enterprise-table">
                  {content.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3">{isEn ? "SKU" : "Mã SKU"}</th>
                            <th className="px-4 py-3">{isEn ? "Product Name" : "Tên sản phẩm"}</th>
                            <th className="px-4 py-3">{isEn ? "Lot Number" : "Số lô"}</th>
                            <th className="px-4 py-3">{isEn ? "Expiration Date" : "Hạn sử dụng"}</th>
                            <th className="px-4 py-3 text-right">{isEn ? "Quantity" : "Số lượng"}</th>
                            <th className="px-4 py-3 text-center">{isEn ? "Status" : "Trạng thái"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {content.items.map((item, idx) => (
                            <tr
                              key={`${item.sku}-${item.lotNumber}-${idx}`}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {item.sku}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800">
                                {item.productName || "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-700">
                                {item.lotNumber || "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">
                                {formatExpirationDate(item.expirationDate)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                {item.quantity}{" "}
                                <span className="text-slate-400 font-normal font-sans">
                                  {isEn ? "pcs" : "cái"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {(() => {
                                  const meta = getItemStatusMeta(item.status, isEn);
                                  return (
                                    <StatusBadge
                                      variant={meta.variant}
                                      label={meta.label}
                                      size="sm"
                                    />
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 px-4">
                      <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
                      <p className="font-semibold text-slate-700 text-sm">
                        {isEn ? "This storage bin is currently empty." : "Ô kệ hiện chưa có hàng."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
                <ActionButton
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                >
                  {isEn ? "Close" : "Đóng"}
                </ActionButton>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
