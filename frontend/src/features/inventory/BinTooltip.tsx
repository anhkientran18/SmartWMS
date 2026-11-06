/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BinDto } from "../../services/api/apiTypes";
import { Package, Gauge } from "lucide-react";

interface BinTooltipProps {
  bin: BinDto | { id: string; code: string; maxCapacity: number; currentOccupancy: number };
  isEn?: boolean;
  t?: (key: string, defaultText?: string) => string;
}

export default function BinTooltip({ bin, isEn = false }: BinTooltipProps) {
  const maxCap = bin.maxCapacity || 0;
  const currentOcc = bin.currentOccupancy || 0;
  const availableCap = Math.max(0, maxCap - currentOcc);
  const fillPercent = maxCap > 0 ? Math.min(100, Math.max(0, Math.round((currentOcc / maxCap) * 100))) : 0;

  const getStatusText = () => {
    if (currentOcc === 0) return isEn ? "Empty (0%)" : "Trống (0%)";
    if (fillPercent >= 100) return isEn ? "Full (100%)" : "Đầy (100%)";
    if (fillPercent >= 80) return isEn ? `Near Full (${fillPercent}%)` : `Sắp đầy (${fillPercent}%)`;
    return isEn ? `Normal (${fillPercent}%)` : `Bình thường (${fillPercent}%)`;
  };

  const getStatusBadgeStyle = () => {
    if (currentOcc === 0) return "bg-slate-800 text-slate-300 border-slate-700";
    if (fillPercent >= 100) return "bg-rose-900/60 text-rose-300 border-rose-600";
    if (fillPercent >= 80) return "bg-amber-900/60 text-amber-300 border-amber-600";
    return "bg-emerald-900/60 text-emerald-300 border-emerald-600";
  };

  const getProgressColor = () => {
    if (currentOcc === 0) return "bg-slate-600";
    if (fillPercent >= 100) return "bg-rose-500";
    if (fillPercent >= 80) return "bg-amber-400";
    return "bg-emerald-400";
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-56 bg-slate-950 text-white p-3 rounded-xl opacity-0 scale-95 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 shadow-2xl z-50 text-xs flex flex-col gap-2 border border-slate-800 ring-1 ring-white/10 font-sans">
      {/* Header: Bin Code & Status Badge */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Package className="w-4 h-4 text-blue-400 shrink-0" strokeWidth={1.5} />
          <span className="font-mono font-bold text-xs text-blue-300 truncate">
            {bin.code}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border truncate shrink-0 ${getStatusBadgeStyle()}`}
        >
          {getStatusText()}
        </span>
      </div>

      {/* Metrics Row: Occupancy & Available */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-slate-400 text-[10px] block">
            {isEn ? "Occupancy:" : "Đang sử dụng:"}
          </span>
          <span className="font-mono font-bold text-white">
            {currentOcc} / {maxCap}{" "}
            <span className="text-[9px] text-slate-400 font-normal">
              {isEn ? "pcs" : "cái"}
            </span>
          </span>
        </div>

        <div className="text-right">
          <span className="text-slate-400 text-[10px] block">
            {isEn ? "Available:" : "Còn trống:"}
          </span>
          <span className="font-mono font-bold text-emerald-400">
            {availableCap}{" "}
            <span className="text-[9px] text-slate-400 font-normal">
              {isEn ? "pcs" : "cái"}
            </span>
          </span>
        </div>
      </div>

      {/* Mini Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${Math.min(100, fillPercent)}%` }}
        />
      </div>

      {/* Triangle pointer */}
      <div className="absolute -bottom-[5px] left-6 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-950" />
    </div>
  );
}
