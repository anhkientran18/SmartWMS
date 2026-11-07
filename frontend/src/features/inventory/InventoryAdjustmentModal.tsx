import React, { useState, useEffect } from "react";
import {
  X,
  ShieldAlert,
  PackagePlus,
  PackageMinus,
  Layers,
} from "lucide-react";
import { Bin } from "../../types/index";

export interface InventoryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBin: Bin | null;
  onConfirm: (
    binCode: string,
    sku: string,
    qty: number,
    action: "ADD" | "SUBTRACT",
    reason: string,
  ) => void;
  t: (key: string, defaultText: string) => string;
  isEn: boolean;
}

export default function InventoryAdjustmentModal({
  isOpen,
  onClose,
  selectedBin,
  onConfirm,
  t,
  isEn,
}: InventoryAdjustmentModalProps) {
  const [selectedSku, setSelectedSku] = useState("");
  const [type, setType] = useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const currentStock = 75;

  const reasons = isEn
    ? [
        "Missed during periodic counting",
        "Damaged/Dented goods found",
        "System discrepancy",
      ]
    : [
        "Kiểm kê định kỳ sót",
        "Phát hiện hàng hư hỏng/Móp méo",
        "Sai lệch hệ thống",
      ];

  useEffect(() => {
    if (isOpen && selectedBin) {
      setSelectedSku(selectedBin.storedSkus[0]?.sku || "");
      setType("increase");
      setQuantity("");
      setReason(reasons[0]);
    }
  }, [isOpen, selectedBin]);

  if (!isOpen || !selectedBin) return null;

  const isExceeded =
    type === "decrease" && typeof quantity === "number" && quantity > currentStock;
  const isInvalid = !selectedSku || typeof quantity !== "number" || quantity <= 0 || !reason;

  const expectedStock =
    typeof quantity === "number"
      ? type === "increase"
        ? currentStock + quantity
        : currentStock - quantity
      : currentStock;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid || isExceeded) {
      alert(
        t(
          "inventory.modal.invalid",
          isEn
            ? "Please enter valid details"
            : "Vui lòng nhập thông tin hợp lệ",
        ),
      );
      return;
    }

    onConfirm(
      selectedBin.code,
      selectedSku,
      quantity as number,
      type === "increase" ? "ADD" : "SUBTRACT",
      reason,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn select-none border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 tracking-tight text-[15px]">
                {t(
                  "inventory.modal.title",
                  isEn
                    ? `Location Inventory Adjustment: `
                    : `Điều Chỉnh Tồn Kho Vị Trí: `,
                )}
                <span className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded ml-1 border border-indigo-100">
                  {selectedBin.code}
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* SKU Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              {t(
                "inventory.modal.skuLabel",
                isEn ? "Product SKU" : "Chọn Sản phẩm (SKU)",
              )}
            </label>
            <div className="relative">
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full text-sm font-semibold border border-slate-200 px-3 py-2.5 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 appearance-none"
                required
              >
                {selectedBin.storedSkus.length === 0 ? (
                  <option value="" disabled>
                    {t(
                      "inventory.modal.noSku",
                      isEn ? "No items in bin" : "Không có sản phẩm trong kệ",
                    )}
                  </option>
                ) : (
                  selectedBin.storedSkus.map((s) => (
                    <option key={s.sku} value={s.sku}>
                      {s.sku} -{" "}
                      {t(
                        "inventory.modal.current",
                        isEn ? "Current:" : "Tồn hiện tại:",
                      )}{" "}
                      {currentStock}
                    </option>
                  ))
                )}
                {/* Fallback mock SKUs if the bin is totally empty but we want to allow receiving new stock */}
                {selectedBin.storedSkus.length === 0 && (
                  <>
                    <option value="MILK-VNM">MILK-VNM</option>
                    <option value="COCA-320">COCA-320</option>
                    <option value="AQUA-500">AQUA-500</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Adjustment Type Segmented Control */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              {t(
                "inventory.modal.adjType",
                isEn ? "Adjustment Type" : "Loại điều chỉnh",
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("increase")}
                className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 border-2 text-sm font-bold transition-all ${
                  type === "increase"
                    ? "bg-emerald-50/30 border-emerald-500 text-emerald-600 shadow-sm"
                    : "bg-white border-gray-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <PackagePlus
                  className={`h-4.5 w-4.5 ${type === "increase" ? "text-emerald-600" : "text-slate-400"}`}
                />
                {t(
                  "inventory.modal.add",
                  isEn ? "ADD (Restock)" : "TĂNG (Nhập bù)",
                )}
              </button>
              <button
                type="button"
                onClick={() => setType("decrease")}
                className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 border-2 text-sm font-bold transition-all ${
                  type === "decrease"
                    ? "bg-rose-50/30 border-rose-500 text-rose-600 shadow-sm"
                    : "bg-white border-gray-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <PackageMinus
                  className={`h-4.5 w-4.5 ${type === "decrease" ? "text-rose-600" : "text-slate-400"}`}
                />
                {t(
                  "inventory.modal.subtract",
                  isEn ? "SUBTRACT (Damage/Loss)" : "GIẢM (Xuất hủy/Hao hụt)",
                )}
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              {t(
                "inventory.modal.qty",
                isEn ? "Adjustment Quantity" : "Số lượng điều chỉnh",
              )}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value === "" ? "" : Number(e.target.value))
              }
              min="1"
              placeholder={t(
                "inventory.modal.qtyPlaceholder",
                isEn ? "Enter quantity..." : "Nhập số lượng...",
              )}
              className="w-full text-sm font-mono font-bold border border-slate-200 px-3 py-2.5 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              required
            />
            {isExceeded && (
              <p className="text-xs text-rose-500 font-medium mt-1">
                Số lượng giảm vượt quá lượng tồn khả dụng hiện tại ({currentStock} cái)
              </p>
            )}
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              {t(
                "inventory.modal.reason",
                isEn ? "Adjustment Reason" : "Lý do điều chỉnh",
              )}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-sm font-medium border border-slate-200 px-3 py-2.5 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 appearance-none"
              required
            >
              <option value="" disabled>
                {t(
                  "inventory.modal.selectReason",
                  isEn ? "Select reason..." : "Chọn lý do...",
                )}
              </option>
              {reasons.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Alert Info for Subtraction */}
          {type === "decrease" && (
            <div className="flex items-start gap-2.5 bg-rose-50 p-3 rounded-lg border border-rose-100 text-rose-600">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm font-medium leading-relaxed">
                {t(
                  "inventory.modal.subWarning",
                  isEn
                    ? "Warning: Subtracting inventory will immediately affect stock availability and sync with pending orders via SignalR."
                    : "Cảnh báo: Việc giảm tồn kho sẽ lập tức tác động đến lượng hàng phân bổ và đồng bộ qua SignalR.",
                )}
              </p>
            </div>
          )}

          {/* Expected Stock Preview */}
          <div className="text-[13px] font-medium text-gray-500 pt-1">
            {typeof quantity === "number" && quantity > 0 && !isExceeded && (
              <p>
                {t("inventory.modal.expectedStock", isEn ? "Expected stock after change: " : "Tồn kho dự kiến sau thay đổi: ")}
                {expectedStock} {isEn ? "items" : "cái"}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {t("common.cancel", isEn ? "Cancel" : "Hủy bỏ")}
            </button>
            <button
              type="submit"
              disabled={isExceeded}
              className={`flex-[2] py-2.5 rounded-xl font-bold text-sm text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isExceeded ? "opacity-50 cursor-not-allowed" : ""
              } ${
                type === "increase"
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                  : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
              }`}
            >
              {type === "increase"
                ? t(
                    "inventory.modal.confirmAdd",
                    isEn ? "Confirm Addition" : "Xác nhận Tăng tồn",
                  )
                : t(
                    "inventory.modal.confirmSub",
                    isEn ? "Confirm Subtraction" : "Xác nhận Giảm tồn",
                  )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
