/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  ClipboardList,
  Building2,
  Layers,
  Grid3X3,
  Calendar,
  User,
  FileText,
  AlertCircle,
  WifiOff,
  CheckCircle2,
} from "lucide-react";
import { CreateCycleCountSheetRequest } from "../../services/cycleCount/types";

export interface CreateCountSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (req: CreateCycleCountSheetRequest) => Promise<void>;
  isOnline: boolean;
  isMockMode: boolean;
  warehouses: Array<{ id: string; code: string; name: any }>;
  zones: Array<{ id: string; warehouseId: string; name: any; code?: string; type?: string }>;
  availableBins?: Array<{ id: string; code: string; zoneId: string }>;
  currentUserName?: string;
}

export default function CreateCountSheetModal({
  isOpen,
  onClose,
  onSubmit,
  isOnline,
  isMockMode,
  warehouses,
  zones,
  availableBins = [],
  currentUserName = "Trần Anh Kiện (Staff)",
}: CreateCountSheetModalProps) {
  const { t } = useTranslation();

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || "wh-01");
  const filteredZones = zones.filter((z) => !z.warehouseId || z.warehouseId === warehouseId);
  const [zoneId, setZoneId] = useState(filteredZones[0]?.id || "zone-a");
  const [binScope, setBinScope] = useState<"ALL" | "SELECTED">("ALL");
  const [selectedBins, setSelectedBins] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [assignedOperator, setAssignedOperator] = useState(currentUserName);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAvailableBins = availableBins.filter(
    (b) => !b.zoneId || b.zoneId === zoneId
  );

  const toggleBinSelection = (code: string) => {
    setSelectedBins((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleWarehouseChange = (newWhId: string) => {
    setWarehouseId(newWhId);
    const newZones = zones.filter((z) => !z.warehouseId || z.warehouseId === newWhId);
    if (newZones.length > 0) {
      setZoneId(newZones[0].id);
    }
    setSelectedBins([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isOnline && !isMockMode) {
      setErrorMsg(
        t(
          "cycleCounting.offlineNotice",
          "Thiết bị đang ngoại tuyến. Vui lòng kết nối mạng để tạo phiếu kiểm kê."
        )
      );
      return;
    }

    if (!warehouseId) {
      setErrorMsg(t("cycleCounting.errors.warehouseRequired", "Vui lòng chọn nhà kho."));
      return;
    }
    if (!zoneId) {
      setErrorMsg(t("cycleCounting.errors.zoneRequired", "Vui lòng chọn phân khu kho."));
      return;
    }
    if (binScope === "SELECTED" && selectedBins.length === 0) {
      setErrorMsg(
        t(
          "cycleCounting.errors.binsRequired",
          "Vui lòng chọn ít nhất 1 vị trí ô kệ khi chọn phạm vi tùy chỉnh."
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      // Contract wrapper pattern: { requestData: { ... } }
      const request: CreateCycleCountSheetRequest = {
        requestData: {
          warehouseId,
          zoneId,
          binScope,
          selectedBinCodes: binScope === "SELECTED" ? selectedBins : undefined,
          scheduledDate,
          assignedOperator,
          notes: notes.trim() || undefined,
        },
      };

      await onSubmit(request);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || t("cycleCounting.errors.createFailed", "Không thể tạo phiếu kiểm kê."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 enterprise-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-count-sheet-title"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
              <ClipboardList className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 id="create-count-sheet-title" className="text-base font-semibold text-slate-900">
                {t("cycleCounting.createModal.title", "Tạo Phiếu Kiểm Kê Chu Kỳ")}
              </h3>
              <p className="text-xs text-slate-500">
                {t(
                  "cycleCounting.createModal.subtitle",
                  "Khởi tạo đợt kiểm đếm hàng hóa thực tế theo phạm vi kho & phân khu"
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            aria-label={t("common.buttons.close", "Đóng")}
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 enterprise-modal-body">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {!isOnline && !isMockMode && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {t("cycleCounting.offlineNoticeTitle", "Cảnh báo Ngoại Tuyến")}
                </p>
                <p className="text-amber-700 mt-0.5">
                  {t(
                    "cycleCounting.offlineCreateDisabled",
                    "Thao tác tạo mới yêu cầu kết nối mạng khi ở chế độ Production API."
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Warehouse select */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                {t("cycleCounting.createModal.warehouse", "Nhà kho")}
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                disabled={submitting}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 transition-all cursor-pointer font-medium"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {typeof w.name === "object" ? w.name.vi || w.name.en : w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Zone select */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                {t("cycleCounting.createModal.zone", "Phân khu")}
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={zoneId}
                onChange={(e) => {
                  setZoneId(e.target.value);
                  setSelectedBins([]);
                }}
                disabled={submitting}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 transition-all cursor-pointer font-medium"
              >
                {filteredZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {typeof z.name === "object" ? z.name.vi || z.name.en : z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scope selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5 text-blue-600" />
              {t("cycleCounting.createModal.binScope", "Phạm vi vị trí ô kệ")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBinScope("ALL")}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  binScope === "ALL"
                    ? "bg-blue-50/70 border-blue-400 text-blue-900 shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    binScope === "ALL" ? "border-blue-600 bg-blue-600" : "border-slate-300"
                  }`}
                >
                  {binScope === "ALL" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-semibold">
                    {t("cycleCounting.createModal.allBins", "Toàn bộ phân khu")}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t(
                      "cycleCounting.createModal.allBinsDesc",
                      "Kiểm kê tất cả các ô kệ hiện có trong khu vực"
                    )}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBinScope("SELECTED")}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  binScope === "SELECTED"
                    ? "bg-blue-50/70 border-blue-400 text-blue-900 shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    binScope === "SELECTED" ? "border-blue-600 bg-blue-600" : "border-slate-300"
                  }`}
                >
                  {binScope === "SELECTED" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-semibold">
                    {t("cycleCounting.createModal.selectedBins", "Chọn vị trí cụ thể")}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t(
                      "cycleCounting.createModal.selectedBinsDesc",
                      "Chỉ định từng dãy kệ hoặc ô khoang cần kiểm"
                    )}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Selected Bins Picker if binScope === 'SELECTED' */}
          {binScope === "SELECTED" && (
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>{t("cycleCounting.createModal.pickBins", "Danh sách ô kệ khả dụng:")}</span>
                <span className="text-blue-600 font-mono text-[11px]">
                  {selectedBins.length}{" "}
                  {t("cycleCounting.createModal.binsSelectedCount", "ô đã chọn")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                {(currentAvailableBins.length > 0
                  ? currentAvailableBins
                  : [
                      { id: "b1", code: "A1-01-01", zoneId },
                      { id: "b2", code: "A1-01-02", zoneId },
                      { id: "b3", code: "A1-02-01", zoneId },
                      { id: "b4", code: "A1-02-02", zoneId },
                    ]
                ).map((bin) => {
                  const isChecked = selectedBins.includes(bin.code);
                  return (
                    <button
                      type="button"
                      key={bin.id}
                      onClick={() => toggleBinSelection(bin.code)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-mono font-medium border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {bin.code}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date & Operator */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                {t("cycleCounting.createModal.scheduledDate", "Ngày kiểm kê dự kiến")}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                disabled={submitting}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                {t("cycleCounting.createModal.assignedOperator", "Nhân sự phụ trách kiểm đếm")}
              </label>
              <input
                type="text"
                value={assignedOperator}
                onChange={(e) => setAssignedOperator(e.target.value)}
                placeholder="vd: Trần Anh Kiện (Staff)"
                disabled={submitting}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 font-medium"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              {t("cycleCounting.createModal.notes", "Ghi chú & Chỉ dẫn")}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(
                "cycleCounting.createModal.notesPlaceholder",
                "Nhập lý do kiểm kê, mục tiêu đối soát, ca làm việc..."
              )}
              disabled={submitting}
              className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 font-medium resize-none"
            />
          </div>

          {/* Footer inside dialog */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {t("common.buttons.cancel", "Hủy bỏ")}
            </button>
            <button
              type="submit"
              disabled={submitting || (!isOnline && !isMockMode)}
              className="h-9 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t("cycleCounting.createModal.submitting", "Đang tạo phiếu...")}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t("cycleCounting.createModal.submitBtn", "Tạo Phiếu Kiểm Kê")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
