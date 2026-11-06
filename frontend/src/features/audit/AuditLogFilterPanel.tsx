import React, { useState, useEffect, useRef } from "react";
import { Search, ShieldAlert, Calendar, X, User, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface AuditLogFilterState {
  searchKeyword: string;
  userRole: string;
  isAiAnomaly: boolean;
  fromDate: string;
  toDate: string;
}

interface AuditLogFilterPanelProps {
  filters: AuditLogFilterState;
  onFilterChange: (filters: Partial<AuditLogFilterState>) => void;
}

export default function AuditLogFilterPanel({
  filters,
  onFilterChange,
}: AuditLogFilterPanelProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US";

  const [localSearch, setLocalSearch] = useState(filters.searchKeyword);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle debounce for search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (filters.searchKeyword !== localSearch) {
        onFilterChange({ searchKeyword: localSearch });
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [localSearch, filters.searchKeyword, onFilterChange]);

  return (
    <div className="bg-white rounded-t-2xl border border-slate-200/80 shadow-sm mb-0">
      <div className="flex flex-wrap items-center gap-4 bg-white z-10 relative p-4 sm:p-5">
        {/* Search Input */}
        <div className="relative w-full xl:flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white focus:border-blue-500 transition-all text-slate-700 font-medium"
            placeholder={t(
              "auditLogs.searchPlaceholder",
              "Tìm kiếm theo tên tài khoản hoặc mô tả hành vi..."
            )}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch("");
                onFilterChange({ searchKeyword: "" });
              }}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          {/* Active AI Anomaly Switch */}
          <label
            className={`relative flex items-center justify-center gap-2.5 px-4 py-3 border rounded-xl cursor-pointer transition-all duration-300 select-none flex-1 sm:flex-none ${
              filters.isAiAnomaly
                ? "bg-rose-50 border-rose-200 shadow-sm ring-1 ring-rose-500/20 text-rose-700 "
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={filters.isAiAnomaly}
              onChange={(e) =>
                onFilterChange({ isAiAnomaly: e.target.checked })
              }
            />
            <div
              className={`flex items-center justify-center w-8 h-4 bg-slate-200 rounded-full transition-colors relative ${filters.isAiAnomaly ? "!bg-rose-500" : ""}`}
            >
              <div
                className={`absolute w-3 h-3 bg-white rounded-full transition-transform transform shadow-sm ${filters.isAiAnomaly ? "translate-x-2" : "-translate-x-2"}`}
              ></div>
            </div>
            <ShieldAlert
              className={`h-4 w-4 ${filters.isAiAnomaly ? "text-rose-600 animate-pulse-once" : "text-slate-400"}`}
            />
            <span className="text-sm font-semibold whitespace-nowrap">
              {t(
                "auditLogs.filterAI",
                isEn ? "Security warnings only" : "Chỉ hiển thị cảnh báo bảo mật"
              )}
            </span>
          </label>

          {/* User Role Dropdown */}
          <div className="relative flex w-full sm:w-48 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <User className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={filters.userRole}
              onChange={(e) => onFilterChange({ userRole: e.target.value })}
              className="w-full pl-9 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm appearance-none font-medium relative z-0"
            >
              <option value="">
                {t("filters.allRoles", isEn ? "All roles" : "Tất cả vai trò")}
              </option>
              <option value="Admin">{isEn ? "Admin" : "Quản trị viên"}</option>
              <option value="Manager">{isEn ? "Manager" : "Quản lý"}</option>
              <option value="Staff">{isEn ? "Staff" : "Nhân viên"}</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          </div>

          {/* Date Range Group */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-36 shrink-0">
              <input
                type="date"
                title={t("filters.fromDate", isEn ? "From Date" : "Từ ngày")}
                value={filters.fromDate}
                onChange={(e) => onFilterChange({ fromDate: e.target.value })}
                className="w-full pl-3 pr-2 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm font-medium"
              />
            </div>
            <span className="text-slate-400 font-medium">-</span>
            <div className="relative w-full sm:w-36 shrink-0">
              <input
                type="date"
                title={t("filters.toDate", isEn ? "To Date" : "Đến ngày")}
                value={filters.toDate}
                onChange={(e) => onFilterChange({ toDate: e.target.value })}
                className="w-full pl-3 pr-2 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm font-medium"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
