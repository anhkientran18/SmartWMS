/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Layers,
  Boxes,
  TrendingUp,
  TrendingDown,
  Equal,
  ShieldAlert,
  FileCheck2,
} from "lucide-react";
import {
  CycleCountSheet,
  CycleCountVarianceSummary,
  ConfirmCycleCountRequest,
} from "../../services/cycleCount/types";

export interface ConfirmCycleCountModalProps {
  isOpen: boolean;
  sheet: CycleCountSheet;
  summary: CycleCountVarianceSummary;
  onClose: () => void;
  onConfirm: (req: ConfirmCycleCountRequest) => Promise<void>;
  isOnline: boolean;
  isMockMode: boolean;
  currentUser?: string;
}

export default function ConfirmCycleCountModal({
  isOpen,
  sheet,
  summary,
  onClose,
  onConfirm,
  isOnline,
  isMockMode,
  currentUser = "Manager",
}: ConfirmCycleCountModalProps) {
  const { t } = useTranslation();
  const [reconcileNotes, setReconcileNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmSubmit = async () => {
    setErrorMsg(null);
    if (!isOnline && !isMockMode) {
      setErrorMsg(
        t(
          "cycleCounting.offlineNotice",
          "Thiết bị đang ngoại tuyến. Vui lòng kết nối mạng để hoàn tất xác nhận kiểm kê."
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      const request: ConfirmCycleCountRequest = {
        requestData: {
          cycleCountId: sheet.id,
          confirmedBy: currentUser,
          reconcileNotes: reconcileNotes.trim() || undefined,
        },
      };
      await onConfirm(request);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          t("cycleCounting.errors.confirmFailed", "Không thể hoàn tất xác nhận kiểm kê.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 enterprise-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-count-title"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck2 className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 id="confirm-count-title" className="text-base font-semibold text-slate-900">
                {t("cycleCounting.confirmModal.title", "Xác Nhận Kết Quả Kiểm Kê")}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {sheet.sheetNumber} • {sheet.warehouseName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4.5 enterprise-modal-body flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Critical WMS Inventory Impact Warning Callout */}
          <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300/80 text-amber-900 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">
                {t("cycleCounting.confirmModal.warningTitle", "Cảnh Báo Điều Chỉnh Tồn Kho")}
              </p>
              <p className="text-amber-800 leading-relaxed">
                {t(
                  "cycleCounting.confirmModal.warningMessage",
                  "Sau khi xác nhận, tồn kho thực tế của các ô kệ trong phạm vi có thể được backend tự động điều chỉnh theo kết quả kiểm kê. Mọi phiếu chênh lệch sẽ được lưu lại nhật ký đối soát (Audit Trail)."
                )}
              </p>
            </div>
          </div>

          {/* Scope and Document Specs */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200/70 p-3.5 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">
                {t("cycleCounting.confirmModal.warehouseScope", "Nhà kho & Phân khu:")}
              </span>
              <span className="font-semibold text-slate-900">
                {sheet.warehouseCode} — {sheet.zoneName}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">
                {t("cycleCounting.confirmModal.binScope", "Phạm vi ô kệ:")}
              </span>
              <span className="font-semibold text-slate-900">
                {sheet.binScope === "ALL"
                  ? t("cycleCounting.confirmModal.allBins", "Toàn bộ phân khu")
                  : `${sheet.selectedBinCodes?.length || 0} ${t("cycleCounting.confirmModal.binsSelected", "ô kệ cụ thể")}`}
              </span>
            </div>
          </div>

          {/* Reconcile Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">
                {t("cycleCounting.confirmModal.totalSkus", "Tổng SKU")}
              </span>
              <span className="text-base font-bold text-slate-900 mt-1 block">
                {summary.totalLines}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[11px] text-emerald-700 font-medium block flex items-center justify-center gap-1">
                <Equal className="w-3 h-3 text-emerald-600" />
                {t("cycleCounting.confirmModal.matchedSkus", "SKU Khớp")}
              </span>
              <span className="text-base font-bold text-emerald-700 mt-1 block">
                {summary.matchedLines}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[11px] text-emerald-700 font-medium block flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                {t("cycleCounting.confirmModal.surplusSkus", "Thừa (+)")}
              </span>
              <span className="text-base font-bold text-emerald-700 mt-1 block">
                {summary.surplusLines}{" "}
                <span className="text-xs font-normal">
                  (+
                  {sheet.items
                    .filter((i) => i.varianceQty > 0)
                    .reduce((sum, i) => sum + i.varianceQty, 0)}
                  )
                </span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
              <span className="text-[11px] text-rose-700 font-medium block flex items-center justify-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-600" />
                {t("cycleCounting.confirmModal.shortageSkus", "Thiếu (-)")}
              </span>
              <span className="text-base font-bold text-rose-700 mt-1 block">
                {summary.shortageLines}{" "}
                <span className="text-xs font-normal">
                  (
                  {sheet.items
                    .filter((i) => i.varianceQty < 0)
                    .reduce((sum, i) => sum + i.varianceQty, 0)}
                  )
                </span>
              </span>
            </div>
          </div>

          {/* Variance items quick breakdown if any */}
          {summary.hasVariance && (
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-100/70 px-3 py-2 font-semibold text-slate-700 flex justify-between items-center">
                <span>{t("cycleCounting.confirmModal.varianceListTitle", "Các mặt hàng có chênh lệch:")}</span>
                <span className="text-rose-600 font-medium text-[11px]">
                  {summary.surplusLines + summary.shortageLines} SKU
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
                {sheet.items
                  .filter((i) => i.varianceQty !== 0)
                  .map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-slate-800">{item.sku}</span>
                        <span className="text-slate-500 ml-2 text-[11px]">({item.binCode})</span>
                        <p className="text-[11px] text-slate-500 truncate max-w-[280px]">
                          {item.productName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            item.varianceQty > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty}{" "}
                          {item.unit}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Hệ thống: {item.systemQty} → Thực đếm: {item.countedQty}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Reconcile Audit Notes Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t(
                "cycleCounting.confirmModal.reconcileNotes",
                "Ý kiến phê duyệt & Ghi chú đối soát của Quản lý"
              )}
            </label>
            <textarea
              rows={2}
              value={reconcileNotes}
              onChange={(e) => setReconcileNotes(e.target.value)}
              placeholder={t(
                "cycleCounting.confirmModal.reconcileNotesPlaceholder",
                "vd: Đã kiểm tra lại vị trí kệ phụ, chấp thuận cân bằng số tồn kho..."
              )}
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 resize-none font-medium"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 px-4 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            {t("common.buttons.cancel", "Hủy bỏ")}
          </button>
          <button
            type="button"
            onClick={handleConfirmSubmit}
            disabled={submitting || (!isOnline && !isMockMode)}
            className="h-9 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("cycleCounting.confirmModal.confirming", "Đang xác nhận...")}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {t("cycleCounting.confirmModal.confirmBtn", "Xác Nhận & Cân Bằng Tồn")}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
