/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Calendar,
  Download,
  User,
  ScrollText,
  PackagePlus,
  ArrowRightLeft,
  Boxes,
  KeyRound,
  ListFilter,
  Eye,
  Copy,
  Check,
  Layers,
  Network,
  Ban,
  Clock,
  FileCode,
  AlertTriangle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuditLog } from "../../types/index";
import { useTranslation } from "react-i18next";

interface AuditLogsProps {
  logs: AuditLog[]; // Local fallback & initial seed
}

type CategoryType = "all" | "putaway" | "transfer" | "mdm" | "security";

// Unified category classifier ensuring each event belongs to exactly one primary category:
// putaway + transfer + mdm + security === total (no accidental double-counting)
export const getAuditLogCategory = (
  log: AuditLog
): "putaway" | "transfer" | "mdm" | "security" => {
  const api = (log.apiPath || "").toLowerCase();
  const action = (
    log.action && typeof log.action === "object"
      ? `${(log.action as any).vi || ""} ${(log.action as any).en || ""}`
      : String(log.action || "")
  ).toLowerCase();

  // 1. Security & Authentication
  if (
    log.isAnomaly ||
    api.includes("auth") ||
    api.includes("login") ||
    action.includes("đăng nhập") ||
    action.includes("login") ||
    action.includes("xác thực") ||
    action.includes("mật khẩu") ||
    action.includes("bảo mật") ||
    action.includes("tường lửa")
  ) {
    return "security";
  }

  // 2. Transfer & Replenishment
  if (
    api.includes("transfer") ||
    api.includes("replenish") ||
    action.includes("điều chuyển") ||
    action.includes("châm hàng") ||
    action.includes("transfer") ||
    action.includes("replenish")
  ) {
    return "transfer";
  }

  // 3. Master Data Management (MDM) & Database Initializations
  if (
    api === "init" ||
    api.includes("mdm") ||
    api.includes("products") ||
    api.includes("vendors") ||
    api.includes("warehouses") ||
    api.includes("zones") ||
    action.includes("khởi tạo") ||
    action.includes("danh mục") ||
    action.includes("kiến tạo phân khu") ||
    action.includes("sản phẩm mới")
  ) {
    return "mdm";
  }

  // 4. Default to Warehouse Inbound / Outbound / Put-away / Picking
  return "putaway";
};

export default function AuditLogs({ logs }: AuditLogsProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en-US" || i18n.language?.startsWith("en");

  // Controlled Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter conditions state
  const [filters, setFilters] = useState({
    searchKeyword: "",
    userRole: "",
    isAnomalyOnly: false,
    fromDate: "",
    toDate: "",
    category: "all" as CategoryType,
  });

  // Slide-over Inspector Drawer state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [blacklistedIps, setBlacklistedIps] = useState<Record<string, boolean>>({});
  const [blacklistToast, setBlacklistToast] = useState<string | null>(null);

  // Local search debouncing state
  const [searchInput, setSearchInput] = useState(filters.searchKeyword);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedLog) {
        setSelectedLog(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLog]);

  // Sync search input with filter debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.searchKeyword !== searchInput) {
          return { ...prev, searchKeyword: searchInput };
        }
        return prev;
      });
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Role localizer
  const localizeRole = (role: string) => {
    if (isEn) {
      if (role === "AI-Agent") return "System";
      return role;
    }
    switch (role) {
      case "Admin":
        return "Quản trị viên";
      case "Manager":
        return "Quản lý";
      case "Staff":
        return "Nhân viên";
      case "Operator":
        return "Vận hành";
      case "Lead":
        return "Trưởng nhóm";
      case "AI-Agent":
        return "Hệ thống";
      default:
        return role;
    }
  };

  // Format operator name to display only user name (role is displayed exclusively in the role badge below)
  const formatOperatorName = (operator: string) => {
    if (!operator) return isEn ? "Unknown user" : "Người dùng không xác định";
    const trimmed = operator.trim();
    if (
      trimmed.toLowerCase().includes("hacker") ||
      trimmed.toLowerCase().includes("unknown") ||
      trimmed.toLowerCase().includes("người dùng không xác định")
    ) {
      return isEn ? "Unknown user" : "Người dùng không xác định";
    }

    // Strip out role annotations in parentheses like (Admin), (Manager), (Staff), (Quản trị viên), (Quản lý), (Nhân viên), etc.
    const cleaned = trimmed
      .replace(
        /\s*\((?:Admin|Manager|Staff|Lead|Operator|AI-Agent|System|Quản trị viên|Quản lý|Nhân viên|Trưởng nhóm|Vận hành|Hệ thống)\)\s*$/gi,
        ""
      )
      .trim();

    return cleaned || (isEn ? "Unknown user" : "Người dùng không xác định");
  };

  const getLocalStr = (val: any) => {
    if (typeof val === "object" && val !== null) {
      return val[isEn ? "en" : "vi"] || val.en || val.vi || "";
    }
    return val || "";
  };

  // Action/intent normalizer
  const formatActionTitle = (log: AuditLog) => {
    const rawTitle = getLocalStr(log.intent) || log.action || "";
    const lower = rawTitle.toLowerCase();

    if (
      lower.includes("cảnh báo đăng nhập sai") ||
      lower.includes("ai chặn") ||
      lower.includes("brute-force") ||
      lower.includes("đăng nhập thất bại")
    ) {
      return isEn ? "Multiple failed login attempts" : "Đăng nhập thất bại nhiều lần";
    }
    if (lower.includes("đăng nhập hệ thống") || lower.includes("system login")) {
      return isEn ? "System login" : "Đăng nhập hệ thống";
    }
    if (
      lower.includes("điều chuyển nội bộ") ||
      lower.includes("internal bin transfer") ||
      lower.includes("điều chuyển")
    ) {
      return isEn ? "Internal stock transfer" : "Điều chuyển hàng nội bộ";
    }
    if (
      lower.includes("xác nhận cất hàng") ||
      lower.includes("confirm put-away") ||
      lower.includes("putaway") ||
      lower.includes("cất hàng")
    ) {
      return isEn ? "Confirm put-away" : "Xác nhận cất hàng";
    }
    if (lower.includes("bắt đầu lấy hàng") || lower.includes("started picking")) {
      return isEn ? "Start picking wave" : "Bắt đầu lấy hàng";
    }
    if (
      lower.includes("khởi tạo hệ thống") ||
      lower.includes("database architecture initialized") ||
      lower.includes("khởi tạo")
    ) {
      return isEn ? "System initialization" : "Khởi tạo hệ thống";
    }

    return rawTitle;
  };

  // Detail normalizer to remove fake AI/firewall/JWT claims
  const normalizeDetail = (details: any) => {
    let text = getLocalStr(details);
    if (!text) return "";

    if (
      text.includes("AI Tường Lửa") ||
      text.includes("AI Autonomous Firewall") ||
      text.includes("Thâm Quyến") ||
      text.includes("Shenzhen")
    ) {
      return isEn
        ? "Access blocked after multiple failed authentication attempts from this IP address."
        : "Truy cập bị chặn sau nhiều lần xác thực không thành công từ địa chỉ IP này.";
    }

    if (text.includes("JWT") || text.includes("dưới JWT")) {
      return isEn
        ? "Session created after successful authentication."
        : "Phiên làm việc được tạo sau khi xác thực thành công.";
    }

    if (text.includes("cô lập")) {
      text = text.replace(/cô lập/g, "tạm khóa");
    }

    return text;
  };

  // Anomaly reason normalizer
  const normalizeAnomalyReason = (reason?: string) => {
    if (!reason) return "";
    if (
      reason.includes("geo-location") ||
      reason.includes("quarantine") ||
      reason.includes("Shenzhen") ||
      reason.includes("xung đột địa lý")
    ) {
      return isEn
        ? "Repeated failed authentications resulted in temporary restriction."
        : "Nhiều lần xác thực không thành công dẫn tới tạm khóa tài khoản.";
    }
    return reason;
  };

  // Query with API and fallback to local filtering
  const { data: pagedLogsData, isLoading } = useQuery({
    queryKey: ["auditLogs", currentPage, itemsPerPage, filters],
    queryFn: async () => {
      try {
        const urlParams = new URLSearchParams({
          pageIndex: currentPage.toString(),
          pageSize: itemsPerPage.toString(),
        });

        if (filters.searchKeyword)
          urlParams.append("searchKeyword", filters.searchKeyword);
        if (filters.userRole) urlParams.append("userRole", filters.userRole);
        if (filters.isAnomalyOnly) urlParams.append("isAiAnomaly", "true");
        if (filters.category && filters.category !== "all")
          urlParams.append("category", filters.category);
        if (filters.fromDate) urlParams.append("fromDate", filters.fromDate);
        if (filters.toDate) urlParams.append("toDate", filters.toDate);

        const res = await fetch(`/api/v1/audit-logs?${urlParams.toString()}`);
        if (!res.ok) throw new Error("Network response was not ok");
        return await res.json();
      } catch {
        // Fallback local filtering for offline/mock resiliency
        let filteredLogs = [...logs];

        if (filters.searchKeyword) {
          const keyword = filters.searchKeyword.toLowerCase();
          filteredLogs = filteredLogs.filter((log) => {
            const op = formatOperatorName(log.operator || "").toLowerCase();
            const act = formatActionTitle(log).toLowerCase();
            const det = normalizeDetail(log.details).toLowerCase();
            const ip = (log.ip || "").toLowerCase();
            const api = (log.apiPath || "").toLowerCase();
            return (
              op.includes(keyword) ||
              act.includes(keyword) ||
              det.includes(keyword) ||
              ip.includes(keyword) ||
              api.includes(keyword)
            );
          });
        }

        if (filters.userRole) {
          filteredLogs = filteredLogs.filter(
            (log) => log.role === filters.userRole
          );
        }

        if (filters.isAnomalyOnly) {
          filteredLogs = filteredLogs.filter((log) => log.isAnomaly);
        }

        if (filters.category && filters.category !== "all") {
          filteredLogs = filteredLogs.filter(
            (log) => getAuditLogCategory(log) === filters.category
          );
        }

        if (filters.fromDate) {
          const from = new Date(filters.fromDate).getTime();
          filteredLogs = filteredLogs.filter(
            (log) => new Date(log.timestamp).getTime() >= from
          );
        }

        if (filters.toDate) {
          const to = new Date(filters.toDate).getTime() + 86400000;
          filteredLogs = filteredLogs.filter(
            (log) => new Date(log.timestamp).getTime() <= to
          );
        }

        filteredLogs.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const start = (currentPage - 1) * itemsPerPage;
        const paginatedLogs = filteredLogs.slice(start, start + itemsPerPage);

        return {
          items: paginatedLogs,
          pageIndex: currentPage,
          pageSize: itemsPerPage,
          totalCount: filteredLogs.length,
          totalPages: Math.ceil(filteredLogs.length / itemsPerPage),
          hasPreviousPage: currentPage > 1,
          hasNextPage:
            currentPage < Math.ceil(filteredLogs.length / itemsPerPage),
        };
      }
    },
  });

  // KPI Calculations normalized from genuine `logs` dataset
  const kpiStats = useMemo(() => {
    const total = logs.length;
    const anomalyCount = logs.filter((l) => l.isAnomaly).length;

    // Counts for quick category pills using unified classifier
    let putawayCount = 0;
    let transferCount = 0;
    let mdmCount = 0;
    let securityCount = 0;

    logs.forEach((l) => {
      const cat = getAuditLogCategory(l);
      if (cat === "putaway") putawayCount++;
      else if (cat === "transfer") transferCount++;
      else if (cat === "mdm") mdmCount++;
      else if (cat === "security") securityCount++;
    });

    // Operational activities: Inbound/outbound + Replenishment/transfers + MDM
    const operationalCount = putawayCount + transferCount + mdmCount;

    // Distinct active users/actors
    const usersSet = new Set<string>();
    logs.forEach((l) => {
      const op = (l.operator || "").trim();
      if (
        op &&
        !op.toLowerCase().includes("không xác định") &&
        !op.toLowerCase().includes("unknown")
      ) {
        usersSet.add(op);
      }
    });
    const activeUsersCount = usersSet.size || 1;

    return {
      total,
      operationalCount,
      anomalyCount,
      activeUsersCount,
      putawayCount,
      transferCount,
      mdmCount,
      securityCount,
    };
  }, [logs]);

  // Date formatter (bilingual)
  const formatDate = (dateString: string, includeMs: boolean = false) => {
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      const ms = String(d.getMilliseconds()).padStart(3, "0");

      if (isEn) {
        let h = d.getHours();
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        const timePart = `${String(h).padStart(2, "0")}:${minutes}:${seconds}${
          includeMs ? `.${ms}` : ""
        } ${ampm}`;
        return `${month}/${day}/${year} ${timePart}`;
      }
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}${
        includeMs ? `.${ms}` : ""
      }`;
    } catch {
      return dateString;
    }
  };

  // CSV Export utility with UTF-8 BOM
  const handleExportCSV = () => {
    const exportItems = pagedLogsData?.items || logs;
    if (!exportItems || exportItems.length === 0) return;

    const headers = [
      "ID",
      isEn ? "Time" : "Thời gian",
      isEn ? "Operator" : "Người thao tác",
      isEn ? "Role" : "Vai trò",
      isEn ? "Activity" : "Hoạt động",
      isEn ? "Details" : "Chi tiết",
      isEn ? "IP Address" : "Địa chỉ IP",
      isEn ? "Endpoint" : "Endpoint",
      isEn ? "Status" : "Trạng thái",
      isEn ? "Notes" : "Ghi chú",
    ];

    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = exportItems.map((log: any) => {
      const timeStr = formatDate(log.timestamp);
      const opStr = formatOperatorName(log.operator || "");
      const roleStr = localizeRole(log.role || "");
      const actStr = formatActionTitle(log);
      const detailStr = normalizeDetail(log.details);
      const statusStr = log.isAnomaly
        ? isEn
          ? "Warning"
          : "Cảnh báo"
        : isEn
        ? "Normal"
        : "An toàn";
      const reasonStr = normalizeAnomalyReason(log.anomalyReason);

      return [
        escapeCSV(log.id),
        escapeCSV(timeStr),
        escapeCSV(opStr),
        escapeCSV(roleStr),
        escapeCSV(actStr),
        escapeCSV(detailStr),
        escapeCSV(log.ip || ""),
        escapeCSV(log.apiPath === "INIT" ? (isEn ? "System event" : "Hệ thống") : log.apiPath || ""),
        escapeCSV(statusStr),
        escapeCSV(reasonStr),
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const nowStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    link.setAttribute("href", url);
    link.setAttribute("download", `wms-audit-logs-${nowStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Highlight warehouse identifiers (e.g., C1-A01-N01, POS-Q01, COCA-320, MILK-VNM, Wave-001)
  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const identifierRegex =
      /(\b(?:[A-Z][0-9]-[A-Z0-9]+-[A-Z0-9]+|POS-[A-Z0-9]+|WAVE-[0-9]+|Wave-[0-9]+|OUT-[0-9]+|IN-[0-9]+|MILK-[A-Z0-9]+|COCA-[A-Z0-9]+|NOODLE-[A-Z0-9]+|SKU-[A-Z0-9-]+|VEN-[A-Z0-9-]+)\b)/g;

    const parts = text.split(identifierRegex);
    return parts.map((part, index) => {
      if (part.match(identifierRegex)) {
        return (
          <span
            key={index}
            className="inline-block px-1.5 py-0.5 mx-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-[11px] rounded border border-blue-200/80 shadow-2xs"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Helper for Role Avatar and Colors
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "Admin":
        return {
          badge: "bg-purple-50 text-purple-700 border-purple-200",
          avatarBg: "bg-purple-100 text-purple-700 border-purple-200",
          initials: "AD",
        };
      case "Manager":
        return {
          badge: "bg-blue-50 text-blue-700 border-blue-200",
          avatarBg: "bg-blue-100 text-blue-700 border-blue-200",
          initials: "MG",
        };
      case "Staff":
        return {
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
          avatarBg: "bg-emerald-100 text-emerald-700 border-emerald-200",
          initials: "ST",
        };
      case "AI-Agent":
        return {
          badge: "bg-slate-100 text-slate-700 border-slate-200",
          avatarBg: "bg-slate-100 text-slate-600 border-slate-200",
          initials: "SYS",
        };
      default:
        return {
          badge: "bg-slate-100 text-slate-700 border-slate-200",
          avatarBg: "bg-slate-100 text-slate-600 border-slate-200",
          initials: "US",
        };
    }
  };

  // Helper for Intent Category Icon & Badge
  const getIntentVisual = (log: AuditLog) => {
    const text = `${log.apiPath || ""} ${
      typeof log.intent === "object"
        ? log.intent.vi + " " + log.intent.en
        : log.intent || ""
    } ${log.action || ""}`.toLowerCase();

    if (log.isAnomaly) {
      return {
        icon: ShieldAlert,
        color: "bg-rose-50 text-rose-700 border-rose-200",
        label: isEn ? "Security warning" : "Cảnh báo bảo mật",
      };
    }
    if (text.includes("putaway") || text.includes("cất hàng")) {
      return {
        icon: PackagePlus,
        color: "bg-sky-50 text-sky-700 border-sky-200",
        label: isEn ? "Put-away storage" : "Cất hàng vào kệ",
      };
    }
    if (text.includes("transfer") || text.includes("điều chuyển")) {
      return {
        icon: ArrowRightLeft,
        color: "bg-cyan-50 text-cyan-700 border-cyan-200",
        label: isEn ? "Stock transfer" : "Điều chuyển hàng",
      };
    }
    if (text.includes("wave") || text.includes("lấy hàng")) {
      return {
        icon: Boxes,
        color: "bg-indigo-50 text-indigo-700 border-indigo-200",
        label: isEn ? "Wave picking" : "Lấy hàng theo đợt",
      };
    }
    if (text.includes("auth") || text.includes("login") || text.includes("đăng nhập")) {
      return {
        icon: KeyRound,
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        label: isEn ? "Authentication" : "Xác thực phiên",
      };
    }
    return {
      icon: ScrollText,
      color: "bg-slate-100 text-slate-700 border-slate-200",
      label: isEn ? "System operation" : "Thao tác hệ thống",
    };
  };

  const handleCopyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleBlacklistIp = (ip: string) => {
    setBlacklistedIps((prev) => ({ ...prev, [ip]: true }));
    const msg = isEn
      ? `IP ${ip} has been added to restricted list.`
      : `Đã đưa địa chỉ IP ${ip} vào danh sách hạn chế truy cập.`;
    setBlacklistToast(msg);
    setTimeout(() => setBlacklistToast(null), 3000);
  };

  return (
    <div className="w-full flex flex-col font-sans space-y-6 animate-fadeIn">
      {/* Toast notification for IP restriction */}
      {blacklistToast && (
        <div className="fixed top-6 right-6 z-60 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Ban className="w-4 h-4 text-rose-500 shrink-0" strokeWidth={1.5} />
          <span>{blacklistToast}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DẢI 4 THẺ KPI CHUẨN DỮ LIỆU THỰC                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng sự kiện */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs border-l-4 border-l-blue-600 flex items-center justify-between transition-all hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isEn ? "Total events" : "Tổng sự kiện"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tracking-tight">
                {kpiStats.total}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {isEn ? "records" : "bản ghi"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isEn ? "All system activity records" : "Tất cả bản ghi trong hệ thống"}
            </p>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <ScrollText className="w-5 h-5" strokeWidth={1.5} />
          </div>
        </div>

        {/* Card 2: Hoạt động vận hành */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs border-l-4 border-l-emerald-500 flex items-center justify-between transition-all hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isEn ? "Operational activities" : "Hoạt động vận hành"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600 tracking-tight">
                {kpiStats.operationalCount}
              </span>
              <span className="text-xs text-emerald-600 font-medium">
                {isEn ? "Actions" : "Thao tác"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isEn
                ? "Inbound, outbound, put-away & transfers"
                : "Nhập xuất, cất hàng & điều chuyển"}
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <PackagePlus className="w-5 h-5" strokeWidth={1.5} />
          </div>
        </div>

        {/* Card 3: Cảnh báo bảo mật (Clickable to Toggle Security Filter) */}
        <div
          onClick={() => {
            setFilters((prev) => ({
              ...prev,
              isAnomalyOnly: !prev.isAnomalyOnly,
            }));
            setCurrentPage(1);
          }}
          className={`p-4 rounded-xl border shadow-xs border-l-4 border-l-rose-500 flex items-center justify-between transition-all cursor-pointer group hover:shadow-sm ${
            filters.isAnomalyOnly
              ? "bg-rose-50/60 border-rose-300 ring-2 ring-rose-400/30"
              : "bg-white border-slate-200/80"
          }`}
          title={
            isEn
              ? "Click to filter security warnings only"
              : "Nhấp để lọc nhanh chỉ các cảnh báo bảo mật"
          }
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 block">
                {isEn ? "Security warnings" : "Cảnh báo bảo mật"}
              </span>
              {filters.isAnomalyOnly && (
                <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-bold rounded-full">
                  {isEn ? "Active" : "Đang lọc"}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-600 tracking-tight">
                {kpiStats.anomalyCount}
              </span>
              <span className="text-xs text-rose-500 font-medium">
                {isEn ? "Alerts" : "Cảnh báo"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isEn
                ? "Failed logins or security alerts"
                : "Lần đăng nhập hoặc truy cập bất thường"}
            </p>
          </div>
          <div
            className={`p-2.5 rounded-xl border transition-colors ${
              filters.isAnomalyOnly
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-100"
            }`}
          >
            <ShieldAlert className="w-5 h-5" strokeWidth={1.5} />
          </div>
        </div>

        {/* Card 4: Người dùng hoạt động */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs border-l-4 border-l-indigo-600 flex items-center justify-between transition-all hover:shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isEn ? "Active operators" : "Người dùng hoạt động"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-700 tracking-tight">
                {kpiStats.activeUsersCount}
              </span>
              <span className="text-xs text-indigo-600 font-medium">
                {isEn ? "Accounts" : "Tài khoản"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isEn ? "Accounts with recorded actions" : "Tài khoản phát sinh thao tác"}
            </p>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <User className="w-5 h-5" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. THANH BỘ LỌC TÌM KIẾM & CÔNG CỤ XUẤT BÁO CÁO (FILTER & EXPORT BAR)      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
        {/* Hàng 1: Search, Security Warning Toggle, Role Dropdown, Date Range & CSV Export */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
          {/* Ô Tìm Kiếm */}
          <div className="relative flex-1 min-w-[260px]">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                isEn
                  ? "Search by operator, bin code, SKU, IP or description..."
                  : "Tìm kiếm theo người thao tác, mã kệ, SKU, IP hoặc mô tả..."
              }
              className="w-full pl-10 pr-9 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-medium transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setFilters((prev) => ({ ...prev, searchKeyword: "" }));
                  setCurrentPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                title={isEn ? "Clear search" : "Xóa tìm kiếm"}
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nút lọc Cảnh báo bảo mật */}
            <button
              type="button"
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  isAnomalyOnly: !prev.isAnomalyOnly,
                }));
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all select-none ${
                filters.isAnomalyOnly
                  ? "bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-500/20 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <ShieldAlert
                className={`w-4 h-4 ${
                  filters.isAnomalyOnly ? "text-rose-600" : "text-slate-400"
                }`}
                strokeWidth={1.5}
              />
              <span>
                {isEn ? "Security warnings only" : "Chỉ hiển thị cảnh báo bảo mật"}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  filters.isAnomalyOnly
                    ? "bg-rose-600 text-white"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {kpiStats.anomalyCount}
              </span>
            </button>

            {/* Dropdown Vai Trò */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <select
                value={filters.userRole}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, userRole: e.target.value }));
                  setCurrentPage(1);
                }}
                className="appearance-none pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="">
                  {isEn ? "All roles" : "Tất cả vai trò"}
                </option>
                <option value="Admin">{isEn ? "Admin" : "Quản trị viên"}</option>
                <option value="Manager">{isEn ? "Manager" : "Quản lý"}</option>
                <option value="Staff">{isEn ? "Staff" : "Nhân viên"}</option>
                <option value="AI-Agent">{isEn ? "System" : "Hệ thống"}</option>
              </select>
              <ChevronDown
                className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.5}
              />
            </div>

            {/* Khoảng Ngày */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <div className="relative flex items-center">
                <Calendar
                  className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="date"
                  title={isEn ? "From date" : "Từ ngày"}
                  value={filters.fromDate}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, fromDate: e.target.value }));
                    setCurrentPage(1);
                  }}
                  className="pl-7 pr-2 py-1 bg-transparent text-xs text-slate-700 focus:outline-none font-medium cursor-pointer"
                />
              </div>
              <span className="text-slate-300 text-xs font-bold">-</span>
              <div className="relative flex items-center">
                <Calendar
                  className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="date"
                  title={isEn ? "To date" : "Đến ngày"}
                  value={filters.toDate}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, toDate: e.target.value }));
                    setCurrentPage(1);
                  }}
                  className="pl-7 pr-2 py-1 bg-transparent text-xs text-slate-700 focus:outline-none font-medium cursor-pointer"
                />
              </div>
              {(filters.fromDate || filters.toDate) && (
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, fromDate: "", toDate: "" }));
                    setCurrentPage(1);
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
                  title={isEn ? "Clear dates" : "Xóa khoảng ngày"}
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Nút Xuất CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold rounded-xl shadow-xs transition-all select-none"
              title={
                isEn
                  ? "Export filtered audit logs as CSV"
                  : "Tải file CSV danh sách nhật ký đang lọc"
              }
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{isEn ? "Export CSV" : "Xuất CSV"}</span>
            </button>
          </div>
        </div>

        {/* Hàng 2: Quick Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 pb-0.5 scrollbar-none">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 shrink-0 mr-1">
            <ListFilter className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
            <span>{isEn ? "Quick filter:" : "Lọc nhanh:"}</span>
          </div>

          {/* Pill 1: Tất cả sự kiện */}
          <button
            onClick={() => {
              setFilters((prev) => ({ ...prev, category: "all" }));
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              filters.category === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{isEn ? "All events" : "Tất cả sự kiện"}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filters.category === "all"
                  ? "bg-slate-800 text-slate-200"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {kpiStats.total}
            </span>
          </button>

          {/* Pill 2: Nhập / Xuất kho */}
          <button
            onClick={() => {
              setFilters((prev) => ({ ...prev, category: "putaway" }));
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              filters.category === "putaway"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{isEn ? "Inbound / Outbound" : "Nhập / Xuất kho"}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filters.category === "putaway"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {kpiStats.putawayCount}
            </span>
          </button>

          {/* Pill 3: Châm hàng & Điều chuyển */}
          <button
            onClick={() => {
              setFilters((prev) => ({ ...prev, category: "transfer" }));
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              filters.category === "transfer"
                ? "bg-cyan-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{isEn ? "Replenishment & Transfer" : "Châm hàng & Điều chuyển"}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filters.category === "transfer"
                  ? "bg-cyan-800 text-cyan-100"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {kpiStats.transferCount}
            </span>
          </button>

          {/* Pill 4: Danh mục (MDM) */}
          <button
            onClick={() => {
              setFilters((prev) => ({ ...prev, category: "mdm" }));
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              filters.category === "mdm"
                ? "bg-purple-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            <Layers className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{isEn ? "Master data (MDM)" : "Danh mục (MDM)"}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filters.category === "mdm"
                  ? "bg-purple-800 text-purple-100"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {kpiStats.mdmCount}
            </span>
          </button>

          {/* Pill 5: Xác thực & Bảo mật */}
          <button
            onClick={() => {
              setFilters((prev) => ({ ...prev, category: "security" }));
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              filters.category === "security"
                ? "bg-rose-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{isEn ? "Auth & Security" : "Xác thực & Bảo mật"}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filters.category === "security"
                  ? "bg-rose-800 text-rose-100"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {kpiStats.securityCount}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BẢNG DỮ LIỆU NHẬT KÝ - TYPOGRAPHY SENTENCE CASE & TRUNCATION FIX      */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium">
              {isEn ? "Loading activity records..." : "Đang tải dữ liệu nhật ký..."}
            </p>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 table-auto sm:table-fixed">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[21%]" />
                  <col className="w-[17%]" />
                  <col className="w-[28%]" />
                  <col className="w-[12%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="text-xs normal-case bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 select-none">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap font-semibold normal-case">
                      {isEn ? "Time" : "Thời gian"}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap font-semibold normal-case">
                      {isEn ? "Operator" : "Người thao tác"}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap font-semibold normal-case">
                      {isEn ? "Activity" : "Hoạt động"}
                    </th>
                    <th className="px-4 py-3 font-semibold normal-case">
                      {isEn ? "Details" : "Chi tiết"}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap font-semibold normal-case">
                      {isEn ? "IP address / Endpoint" : "Địa chỉ IP / Endpoint"}
                    </th>
                    <th className="px-4 py-3 text-center whitespace-nowrap font-semibold normal-case">
                      {isEn ? "Status" : "Trạng thái"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pagedLogsData?.items?.length > 0 ? (
                    pagedLogsData.items.map((log: AuditLog, index: number) => {
                      const isAnomaly = !!log.isAnomaly;
                      const role = log.role || "Staff";
                      const operatorName = formatOperatorName(log.operator || "");
                      const roleMeta = getRoleBadge(role);
                      const intentMeta = getIntentVisual(log);
                      const IntentIcon = intentMeta.icon;
                      const actionTitle = formatActionTitle(log);
                      const detailText = normalizeDetail(log.details);
                      const anomalyText = normalizeAnomalyReason(log.anomalyReason);

                      return (
                        <tr
                          key={log.id || index}
                          onClick={() => setSelectedLog(log)}
                          className={`${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          } hover:bg-blue-50/50 transition-colors cursor-pointer group`}
                        >
                          {/* Cột 1: Thời gian */}
                          <td className="px-4 py-3.5 align-top">
                            <span className="font-mono text-xs font-semibold text-slate-700 block whitespace-nowrap">
                              {formatDate(log.timestamp)}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                              ID: {log.id}
                            </span>
                          </td>

                          {/* Cột 2: Người thao tác (Tối đa 2 dòng: dòng 1 tên đầy đủ, dòng 2 role badge) */}
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] border shrink-0 mt-0.5 ${roleMeta.avatarBg}`}
                              >
                                {roleMeta.initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-slate-900 block line-clamp-2 leading-snug break-words group-hover:text-blue-700 transition-colors">
                                  {operatorName}
                                </span>
                                <div className="mt-1">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${roleMeta.badge}`}
                                  >
                                    {localizeRole(role)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Cột 3: Hoạt động (Fix truncation: line-clamp-2 leading-tight break-words min-w-0) */}
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex flex-col gap-1 items-start min-w-0">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border max-w-full ${intentMeta.color}`}
                              >
                                <IntentIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                                <span className="line-clamp-2 leading-tight break-words min-w-0">
                                  {actionTitle}
                                </span>
                              </span>
                            </div>
                          </td>

                          {/* Cột 4: Chi tiết */}
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-slate-700 text-xs leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                              {renderHighlightedText(detailText)}
                            </p>
                            {isAnomaly && anomalyText && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                                <span className="truncate">{anomalyText}</span>
                              </div>
                            )}
                          </td>

                          {/* Cột 5: IP & Endpoint (INIT displayed as System event) */}
                          <td className="px-4 py-3.5 align-top font-mono">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200/70 font-medium">
                              {log.ip || "192.168.1.1"}
                            </span>
                            <span
                              className="text-[10px] text-slate-400 block truncate mt-1 max-w-[130px]"
                              title={log.apiPath || "/api/v1"}
                            >
                              {log.apiPath === "INIT"
                                ? isEn
                                  ? "System event"
                                  : "Hệ thống"
                                : log.apiPath || "/api/v1"}
                            </span>
                          </td>

                          {/* Cột 6: Trạng thái */}
                          <td className="px-4 py-3.5 align-top text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isAnomaly ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span>{isEn ? "Warning" : "Cảnh báo"}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                                  <span>{isEn ? "Normal" : "An toàn"}</span>
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLog(log);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title={isEn ? "View details" : "Xem chi tiết"}
                              >
                                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <ScrollText className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
                          <p className="font-medium text-xs sm:text-sm">
                            {isEn
                              ? "No audit records matched your filter criteria."
                              : "Không tìm thấy bản ghi nhật ký phù hợp với bộ lọc."}
                          </p>
                          {(filters.searchKeyword ||
                            filters.userRole ||
                            filters.isAnomalyOnly ||
                            filters.category !== "all" ||
                            filters.fromDate ||
                            filters.toDate) && (
                            <button
                              onClick={() => {
                                setSearchInput("");
                                setFilters({
                                  searchKeyword: "",
                                  userRole: "",
                                  isAnomalyOnly: false,
                                  fromDate: "",
                                  toDate: "",
                                  category: "all",
                                });
                                setCurrentPage(1);
                              }}
                              className="text-xs font-semibold text-blue-600 hover:underline pt-1 cursor-pointer"
                            >
                              {isEn ? "Reset all filters" : "Đặt lại toàn bộ bộ lọc"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {pagedLogsData && (
              <div className="w-full flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-slate-200/90 bg-slate-50/70 select-none gap-3">
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                  <span>
                    {isEn ? "Showing" : "Hiển thị"}{" "}
                    <strong className="text-slate-800 font-mono">
                      {pagedLogsData.totalCount === 0
                        ? 0
                        : (currentPage - 1) * itemsPerPage + 1}
                    </strong>{" "}
                    -{" "}
                    <strong className="text-slate-800 font-mono">
                      {Math.min(currentPage * itemsPerPage, pagedLogsData.totalCount)}
                    </strong>{" "}
                    {isEn ? "of" : "trong tổng số"}{" "}
                    <strong className="text-slate-800 font-mono">
                      {pagedLogsData.totalCount}
                    </strong>{" "}
                    {isEn ? "results" : "kết quả"}
                  </span>
                  <div className="border-l border-slate-300 h-3.5" />
                  <div className="relative flex items-center">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="appearance-none border border-slate-200 rounded-lg pl-2.5 pr-6 py-1 text-xs bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    >
                      <option value="10">10 {isEn ? "/ page" : "dòng / trang"}</option>
                      <option value="20">20 {isEn ? "/ page" : "dòng / trang"}</option>
                      <option value="50">50 {isEn ? "/ page" : "dòng / trang"}</option>
                    </select>
                    <ChevronDown
                      className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={!pagedLogsData.hasPreviousPage}
                    onClick={() => setCurrentPage(1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title={isEn ? "First page" : "Trang đầu"}
                  >
                    <ChevronsLeft className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    disabled={!pagedLogsData.hasPreviousPage}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title={isEn ? "Previous page" : "Trang trước"}
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                  </button>

                  <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold font-mono shadow-2xs">
                    {currentPage} / {pagedLogsData.totalPages || 1}
                  </span>

                  <button
                    disabled={!pagedLogsData.hasNextPage}
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(pagedLogsData.totalPages || 1, prev + 1)
                      )
                    }
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title={isEn ? "Next page" : "Trang kế"}
                  >
                    <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    disabled={!pagedLogsData.hasNextPage}
                    onClick={() => setCurrentPage(pagedLogsData.totalPages || 1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title={isEn ? "Last page" : "Trang cuối"}
                  >
                    <ChevronsRight className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. SLIDE-OVER DRAWER CHI TIẾT BẢN GHI                                      */}
      {/* ========================================================================= */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
            onClick={() => setSelectedLog(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 z-50">
            <div className="w-screen max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between transform transition-transform duration-300 ease-out animate-slideInRight">
              {/* Header Drawer */}
              <div className="px-6 py-4.5 border-b border-slate-200/90 bg-slate-50/80 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-200 text-slate-800 border border-slate-300/80 shadow-2xs">
                      {selectedLog.id}
                    </span>
                    {selectedLog.isAnomaly ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>
                          {isEn ? "Security warning" : "Cảnh báo bảo mật"}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                        <span>{isEn ? "Normal" : "Giao dịch bình thường"}</span>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                    title={isEn ? "Close drawer" : "Đóng"}
                  >
                    <X className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
                    {formatDate(selectedLog.timestamp, true)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {isEn ? "Audit record" : "Bản ghi kiểm toán"}
                  </span>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Khối 1: Thông tin Người thực hiện & Phiên */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Network className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                    <h4 className="text-xs font-bold text-slate-800">
                      {isEn
                        ? "1. Operator & Network details"
                        : "1. Thông tin người thực hiện & mạng"}
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">
                        {isEn ? "Operator" : "Người thực hiện"}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-semibold text-slate-900">
                          {formatOperatorName(selectedLog.operator || "")}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                          {localizeRole(selectedLog.role || "Staff")}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">
                        {isEn ? "Locale" : "Ngôn ngữ phiên"}
                      </span>
                      <span className="font-mono text-slate-800 font-semibold block mt-1">
                        {selectedLog.locale || (isEn ? "en-US" : "vi-VN")}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">
                        {isEn ? "IP address" : "Địa chỉ IP nguồn"}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-mono">
                        <span className="font-semibold text-slate-800">
                          {selectedLog.ip || "192.168.1.1"}
                        </span>
                        {blacklistedIps[selectedLog.ip] && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-rose-100 text-rose-700">
                            {isEn ? "Restricted" : "Đã hạn chế"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">
                        {isEn ? "API endpoint" : "Đường dẫn API"}
                      </span>
                      <span className="font-mono text-blue-700 font-semibold block mt-1 truncate">
                        {selectedLog.apiPath === "INIT"
                          ? isEn
                            ? "System event"
                            : "Hệ thống"
                          : selectedLog.apiPath || "/api/v1"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khối 2: Chi tiết hoạt động */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <ScrollText className="w-4 h-4 text-indigo-600" strokeWidth={1.5} />
                    <h4 className="text-xs font-bold text-slate-800">
                      {isEn
                        ? "2. Operational activity details"
                        : "2. Chi tiết hoạt động thao tác"}
                    </h4>
                  </div>

                  {/* Intent block */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-medium text-slate-400 block">
                      {isEn ? "Activity" : "Hoạt động thực hiện"}
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatActionTitle(selectedLog)}
                    </p>
                  </div>

                  {/* Details with warehouse code highlights */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-slate-800 text-xs leading-relaxed space-y-1">
                    <span className="text-[10px] font-medium text-slate-400 block">
                      {isEn ? "Details description" : "Mô tả chi tiết"}
                    </span>
                    <p className="pt-1">
                      {renderHighlightedText(normalizeDetail(selectedLog.details))}
                    </p>
                  </div>

                  {/* Cảnh báo bảo mật nếu có */}
                  {selectedLog.isAnomaly ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                          <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                          <span>
                            {isEn
                              ? "Security warning details"
                              : "Thông tin cảnh báo bảo mật"}
                          </span>
                        </div>
                      </div>

                      <p className="text-rose-900 leading-relaxed font-medium">
                        {normalizeAnomalyReason(selectedLog.anomalyReason) ||
                          (isEn
                            ? "Access blocked following multiple failed credential attempts."
                            : "Truy cập bị chặn sau nhiều lần nhập sai mật khẩu liên tiếp.")}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.5} />
                        <span>
                          {isEn
                            ? "Normal operation recorded"
                            : "Giao dịch hợp lệ đã được ghi nhận"}
                        </span>
                      </div>
                      <p className="text-emerald-800 text-[11px] leading-relaxed">
                        {isEn
                          ? "This transaction has been successfully committed to the activity log."
                          : "Thao tác đã được ghi nhận đầy đủ vào nhật ký hoạt động hệ thống."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Khối 3: Bản ghi JSON */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-slate-700" strokeWidth={1.5} />
                      <h4 className="text-xs font-bold text-slate-800">
                        {isEn ? "3. JSON Event Record" : "3. Dữ liệu bản ghi JSON"}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyJson(selectedLog)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                          <span className="text-emerald-600">
                            {isEn ? "Copied!" : "Đã chép!"}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>{isEn ? "Copy JSON" : "Sao chép JSON"}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="bg-slate-950 text-slate-200 font-mono text-[11px] p-3.5 rounded-xl border border-slate-800 overflow-x-auto max-h-52 leading-relaxed select-all">
                      {JSON.stringify(
                        {
                          id: selectedLog.id,
                          timestamp: selectedLog.timestamp,
                          operator: formatOperatorName(selectedLog.operator || ""),
                          role: selectedLog.role,
                          action: formatActionTitle(selectedLog),
                          details: normalizeDetail(selectedLog.details),
                          apiPath: selectedLog.apiPath,
                          ip: selectedLog.ip,
                          locale: selectedLog.locale,
                          isAnomaly: !!selectedLog.isAnomaly,
                          anomalyReason: normalizeAnomalyReason(selectedLog.anomalyReason) || null,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Footer Drawer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3">
                <div>
                  {selectedLog.isAnomaly && (
                    <button
                      type="button"
                      onClick={() => handleBlacklistIp(selectedLog.ip)}
                      disabled={blacklistedIps[selectedLog.ip]}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                        blacklistedIps[selectedLog.ip]
                          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                          : "bg-rose-600 hover:bg-rose-500 text-white"
                      }`}
                    >
                      {blacklistedIps[selectedLog.ip] ? (
                        <>
                          <ShieldCheck className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                          <span>{isEn ? "IP Restricted" : "Đã hạn chế IP"}</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4" strokeWidth={1.5} />
                          <span>
                            {isEn ? "Restrict IP" : "Hạn chế IP"}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  {isEn ? "Close" : "Đóng"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
