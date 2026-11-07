/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  User,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  Trash2,
  Globe,
  Smartphone,
  BatteryCharging,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Edit3,
  Save,
  X,
  Activity,
  MapPin,
  Sparkles,
  Sliders,
  ChevronRight,
  Zap,
  Phone,
  Download,
  Mail,
  Layers,
  Lock,
  Check
} from "lucide-react";
import { changeAppLanguage } from "../../i18n/index";

export interface ProfileScreenProps {
  onLogout?: () => void;
  onClose?: () => void;
  currentRole?: string;
  lang?: string;
}

interface QueuedAction {
  id: string;
  type: "scan" | "wave" | "bin";
  summary: string;
  timestamp: string;
  payload: {
    sku?: string;
    qty?: number;
    bin?: string;
    waveId?: string;
    step?: number;
    [key: string]: unknown;
  };
}

export default function ProfileScreen({
  onLogout,
  onClose,
  currentRole = "Staff",
  lang = "vi-VN"
}: ProfileScreenProps) {
  const { t, i18n } = useTranslation();

  // ----------------------------------------------------
  // 1. Offline-First Architecture & Network Detection
  // ----------------------------------------------------
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const effectiveOnline = isOnline && !isSimulatedOffline;

  // Offline queue state (persisted locally)
  const [syncQueue, setSyncQueue] = useState<QueuedAction[]>(() => {
    try {
      const saved = localStorage.getItem("smartwms_offline_queue");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse offline queue", e);
    }
    // Realistic initial sample queue items for offline demo
    return [
      {
        id: "Q-101",
        type: "scan",
        summary: "SKU-BEV-001 (x24) -> D2-A02-N01",
        timestamp: "10:17:25 PM",
        payload: { sku: "SKU-BEV-001", qty: 24, bin: "D2-A02-N01" }
      },
      {
        id: "Q-102",
        type: "wave",
        summary: "Wave #WP-2026-08 (Step 2 Picked)",
        timestamp: "10:12:10 PM",
        payload: { waveId: "WP-2026-08", step: 2 }
      }
    ];
  });

  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem("smartwms_last_sync") || "10:17:25 PM";
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloadingDb, setIsDownloadingDb] = useState(false);
  const [dbDownloaded, setDbDownloaded] = useState<boolean>(() => {
    return localStorage.getItem("smartwms_offline_db_ready") === "true";
  });
  const [cacheSizeMb, setCacheSizeMb] = useState<number>(4.2);
  const [showQueueDetails, setShowQueueDetails] = useState(false);

  // Status banners / toast alerts
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const showNotification = useCallback((text: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  // Save offline queue whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("smartwms_offline_queue", JSON.stringify(syncQueue));
    } catch (e) {
      console.warn("Failed to persist offline queue", e);
    }
  }, [syncQueue]);

  // Network online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showNotification(t("profile.network.connectedMessage"), "success");
      // Auto-sync if enabled
      if (localStorage.getItem("smartwms_auto_sync") !== "false") {
        handleTriggerSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showNotification(t("profile.alerts.offlineWarning"), "info");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [t]);

  // ----------------------------------------------------
  // 2. User Profile Info & Preferences
  // ----------------------------------------------------
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fullName] = useState(() => {
    return localStorage.getItem("smartwms_staff_name") || "";
  });
  const [employeeId] = useState(() => {
    return localStorage.getItem("smartwms_staff_empid") || "";
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem("smartwms_staff_email") || "";
  });
  const [phone, setPhone] = useState(() => {
    return localStorage.getItem("smartwms_staff_phone") || "";
  });
  const [warehouse, setWarehouse] = useState(() => {
    return localStorage.getItem("smartwms_staff_wh") || "";
  });
  const [assignedZones, setAssignedZones] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("smartwms_staff_zones");
      if (saved) return JSON.parse(saved);
    } catch {}
    return ["Zone A", "Zone C"];
  });
  const [shift, setShift] = useState(() => {
    return localStorage.getItem("smartwms_staff_shift") || "";
  });

  const displayedName = fullName || t("profile.personalInfo.defaultName", "Trần Anh Kiện");
  const displayedPhone = phone || t("profile.personalInfo.defaultPhone", "0908 123 456");
  const displayedEmail = email || t("profile.personalInfo.defaultEmail", "anhkiennhox18@gmail.com");
  const displayedEmpId = employeeId || t("profile.personalInfo.defaultEmployeeId", "EMP-2026-88");
  const displayedWarehouse = warehouse || "WH-HCM-01";
  const displayedShift = shift || "Ca 1 (06:00 - 14:00)";

  // Edit form states in modal
  const [editEmail, setEditEmail] = useState(displayedEmail);
  const [editPhone, setEditPhone] = useState(displayedPhone);
  const [editWarehouse, setEditWarehouse] = useState(displayedWarehouse);
  const [editZones, setEditZones] = useState<string[]>(assignedZones);
  const [editShift, setEditShift] = useState(displayedShift);

  // Device hardware preferences
  const [soundFeedback, setSoundFeedback] = useState<boolean>(() => {
    return localStorage.getItem("smartwms_pref_sound") !== "false";
  });
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(() => {
    return localStorage.getItem("smartwms_pref_haptic") !== "false";
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem("smartwms_pref_contrast") === "true";
  });
  const [autoFocusCamera, setAutoFocusCamera] = useState<boolean>(() => {
    return localStorage.getItem("smartwms_pref_autofocus") !== "false";
  });
  const [autoSyncOnReconnect, setAutoSyncOnReconnect] = useState<boolean>(() => {
    return localStorage.getItem("smartwms_auto_sync") !== "false";
  });

  // Modal Dialogs
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);

  // ----------------------------------------------------
  // 3. Actions & Handlers
  // ----------------------------------------------------
  const handleOpenEditModal = () => {
    setEditEmail(email || displayedEmail);
    setEditPhone(phone || displayedPhone);
    setEditWarehouse(warehouse || displayedWarehouse);
    setEditZones(assignedZones);
    setEditShift(shift || displayedShift);
    setIsEditModalOpen(true);
  };

  const handleSaveFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    setEmail(editEmail);
    setPhone(editPhone);
    setWarehouse(editWarehouse);
    setAssignedZones(editZones);
    setShift(editShift);

    localStorage.setItem("smartwms_staff_email", editEmail);
    localStorage.setItem("smartwms_staff_phone", editPhone);
    localStorage.setItem("smartwms_staff_wh", editWarehouse);
    localStorage.setItem("smartwms_staff_zones", JSON.stringify(editZones));
    localStorage.setItem("smartwms_staff_shift", editShift);

    setIsEditModalOpen(false);
    showNotification(t("profile.alerts.profileUpdated"), "success");
  };

  const handleTriggerSync = async () => {
    if (!effectiveOnline) {
      showNotification(t("profile.alerts.syncFailed"), "error");
      return;
    }

    if (syncQueue.length === 0) {
      showNotification(t("profile.offlineSync.noPending"), "info");
      return;
    }

    setIsSyncing(true);
    try {
      // Simulate pushing queued actions to server
      await new Promise((resolve) => setTimeout(resolve, 1400));
      const pushedCount = syncQueue.length;
      setSyncQueue([]);
      const nowStr = new Date().toLocaleTimeString(i18n.language?.startsWith("vi") ? "vi-VN" : "en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(nowStr);
      localStorage.setItem("smartwms_last_sync", nowStr);
      showNotification(t("profile.alerts.syncSuccess", { count: pushedCount }), "success");
    } catch {
      showNotification(t("profile.alerts.syncFailed"), "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadOfflineDb = async () => {
    setIsDownloadingDb(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      setDbDownloaded(true);
      localStorage.setItem("smartwms_offline_db_ready", "true");
      setCacheSizeMb((prev) => +(prev + 3.8).toFixed(1));
      showNotification(t("profile.offlineSync.dbDownloaded"), "success");
    } finally {
      setIsDownloadingDb(false);
    }
  };

  const handleClearCache = () => {
    setCacheSizeMb(0.8);
    setDbDownloaded(false);
    localStorage.removeItem("smartwms_offline_db_ready");
    setShowClearCacheModal(false);
    showNotification(t("profile.offlineSync.cacheCleared"), "success");
  };

  const handleToggleLanguage = async (newLang: "vi-VN" | "en-US") => {
    await changeAppLanguage(newLang);
  };

  const isCurrentEn = (i18n.language || lang).startsWith("en");

  // Localized role string helper
  const localizedRole =
    currentRole.toLowerCase() === "admin"
      ? t("roles.admin")
      : currentRole.toLowerCase() === "manager"
      ? t("roles.manager")
      : currentRole.toLowerCase() === "staff"
      ? t("roles.staff")
      : t(`roles.${currentRole.toLowerCase()}`, currentRole);

  const getLocalizedShift = (s: string) => {
    if (!s || s.includes("Ca 1") || s.includes("Shift 1") || s.includes("06:00")) {
      return t("profile.shifts.shift1Display", "Ca 1 (06:00 - 14:00)");
    }
    if (s.includes("Ca 2") || s.includes("Shift 2") || s.includes("14:00")) {
      return t("profile.shifts.shift2Display", "Ca 2 (14:00 - 22:00)");
    }
    if (s.includes("Ca 3") || s.includes("Shift 3") || s.includes("22:00")) {
      return t("profile.shifts.shift3Display", "Ca 3 (22:00 - 06:00)");
    }
    return s;
  };

  const getLocalizedWarehouse = (wh: string) => {
    if (!wh || wh.includes("WH-HCM-01")) return t("profile.warehouses.hcmShort", "WH-HCM-01 (TP. HCM)");
    if (wh.includes("WH-HN-02")) return t("profile.warehouses.hnShort", "WH-HN-02 (Hà Nội)");
    if (wh.includes("WH-DN-03")) return t("profile.warehouses.dnShort", "WH-DN-03 (Đà Nẵng)");
    return wh;
  };

  const getLocalizedZone = (z: string) => {
    if (z.includes("Zone A") || z === "Zone A") return t("profile.zones.zoneA", "Zone A (Khô)");
    if (z.includes("Zone B") || z === "Zone B") return t("profile.zones.zoneB", "Zone B (Lạnh)");
    if (z.includes("Zone C") || z === "Zone C") return t("profile.zones.zoneC", "Zone C (Mát)");
    if (z.includes("Zone D") || z === "Zone D") return t("profile.zones.zoneD", "Zone D (Hóa chất)");
    return z;
  };

  const getInitials = (name: string) => {
    const parts = (name || "").trim().split(/\s+/);
    if (parts.length >= 3) {
      return (parts[0][0] + parts[1][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name || "").slice(0, 3).toUpperCase() || "TAK";
  };

  const getLocalizedSummary = (item: QueuedAction) => {
    if (item.type === "wave" && item.payload?.waveId) {
      return t("profile.offlineSync.waveSummaryFormat", {
        waveId: item.payload.waveId,
        step: item.payload.step
      });
    }
    if (item.type === "scan" && item.payload?.sku) {
      return t("profile.offlineSync.scanSummaryFormat", {
        sku: item.payload.sku,
        qty: item.payload.qty,
        bin: item.payload.bin
      });
    }
    if (item.type === "bin" && item.payload?.bin) {
      return t("profile.offlineSync.binSummaryFormat", {
        sku: item.payload.sku || "",
        bin: item.payload.bin
      });
    }
    return item.summary;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 font-sans relative antialiased select-none text-slate-900">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div
          className={`fixed top-4 inset-x-4 max-w-md mx-auto z-50 p-3.5 rounded-xl shadow-2xl border text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-emerald-500/10"
              : toastMessage.type === "error"
              ? "bg-rose-50 border-rose-300 text-rose-800 shadow-rose-500/10"
              : "bg-blue-50 border-blue-300 text-blue-800 shadow-blue-500/10"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : toastMessage.type === "error" ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Zap className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="truncate">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-slate-200/50 rounded-lg text-slate-500 hover:text-slate-800"
            aria-label={t("profile.actions.cancel")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {t("profile.title")}
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold uppercase">
                {localizedRole}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{t("profile.subtitle")}</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition self-start sm:self-auto cursor-pointer"
            aria-label={t("profile.actions.cancel")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Two-Column Grid Layout: Cột Trái (~35%) & Cột Phải (~65%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ==================================================== */}
        {/* CỘT TRÁI (~35%): THÔNG TIN NHÂN SỰ & HIỆU SUẤT      */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-6">

          {/* Card 1: THÔNG TIN NHÂN SỰ & CA LÀM VIỆC */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                {t("profile.personalInfo.title")}
              </span>
              <button
                onClick={handleOpenEditModal}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                aria-label={t("profile.actions.editProfile")}
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>{t("profile.actions.editProfile")}</span>
              </button>
            </div>

            <div className="p-5 flex flex-col items-center text-center border-b border-slate-100">
              <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-200/80 flex items-center justify-center text-blue-700 font-extrabold text-2xl shadow-inner mb-3">
                {getInitials(displayedName)}
              </div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {displayedName}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-center">
                <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  {displayedEmpId}
                </span>
                <span className="text-[11px] font-bold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200/80 uppercase">
                  {localizedRole}
                </span>
              </div>
            </div>

            {/* Icon List thông tin nhân sự */}
            <div className="p-4 sm:p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {t("profile.personalInfo.email")}
                </span>
                <span className="font-mono text-slate-700 font-medium truncate max-w-[180px]">{displayedEmail}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {t("profile.personalInfo.phone")}
                </span>
                <span className="font-mono text-slate-700 font-medium">{displayedPhone}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  {t("profile.personalInfo.assignedWarehouse")}
                </span>
                <span className="font-mono text-slate-800 font-semibold">{getLocalizedWarehouse(displayedWarehouse)}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  {t("profile.personalInfo.assignedZone")}
                </span>
                <span className="text-slate-700 font-medium text-right">
                  {assignedZones.map((z) => getLocalizedZone(z)).join(t("profile.zones.separator", " & "))}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  {t("profile.personalInfo.shift")}
                </span>
                <span className="font-mono text-slate-700 font-medium">{getLocalizedShift(displayedShift)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: HIỆU SUẤT CA LÀM VIỆC HÔM NAY (Nằm dưới khối Nhân sự ở Cột Trái) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider mb-3.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              {t("profile.shiftStats.title")}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 block truncate">{t("profile.shiftStats.itemsScanned")}</span>
                <span className="text-xl font-bold font-mono text-blue-600 mt-1 block">
                  {t("profile.shiftStats.itemsScannedValue", "142")}
                </span>
              </div>
              <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 block truncate">{t("profile.shiftStats.wavesCompleted")}</span>
                <span className="text-xl font-bold font-mono text-emerald-600 mt-1 block">
                  {t("profile.shiftStats.wavesCompletedValue", "18")}
                </span>
              </div>
              <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 block truncate">{t("profile.shiftStats.accuracyRate")}</span>
                <span className="text-xl font-bold font-mono text-indigo-600 mt-1 block">
                  {t("profile.shiftStats.accuracyRateValue", "99.8%")}
                </span>
              </div>
              <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 block truncate">{t("profile.shiftStats.activeHours")}</span>
                <span className="text-xl font-bold font-mono text-orange-600 mt-1 block">
                  {t("profile.shiftStats.activeHoursFormatted", { hours: 5, mins: 40 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* CỘT PHẢI (~65%): PANEL ĐỒNG BỘ NGOẠI TUYẾN & CÀI ĐẶT */}
        {/* ==================================================== */}
        <div className="lg:col-span-8 xl:col-span-8 space-y-6">

          {/* -------------------------------------------------- */}
          {/* NỬA TRÊN CỘT PHẢI: PANEL ĐIỀU KHIỂN CHUẨN KỸ THUẬT */}
          {/* Card: TRẠNG THÁI KẾT NỐI & ĐỒNG BỘ MÁY CHỦ         */}
          {/* -------------------------------------------------- */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">

            {/* 1. Header: Trạng thái hiện tại & Toggle Switch Chế độ Offline */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  {t("profile.serverSyncTitle")}
                </span>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <span className="relative flex h-3 w-3">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        effectiveOnline ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 ${
                        effectiveOnline ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    ></span>
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {effectiveOnline ? t("profile.badgeOnline") : t("profile.badgeOffline")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {effectiveOnline ? t("profile.network.connectedMessage") : t("profile.network.disconnectedMessage")}
                </p>
              </div>

              {/* Nút Toggle Switch gạt sang "Chế độ Offline (Kiểm thử)" đặt ở góc phải */}
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 px-3.5 py-2 rounded-xl self-start sm:self-auto">
                <span className="text-xs font-semibold text-slate-700">
                  {t("profile.network.forceOffline")}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isSimulatedOffline}
                  onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isSimulatedOffline ? "bg-amber-500" : "bg-slate-300"
                  }`}
                  aria-label={t("profile.network.forceOffline")}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isSimulatedOffline ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 2. Khu vực Hàng Đợi Đồng Bộ (Sync Queue) */}
            <div className="space-y-3">
              {/* Banner mờ (Màu xanh dương nhạt #EFF6FF) */}
              <div className="bg-[#EFF6FF] border border-blue-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                    <Activity className="w-5 h-5 animate-pulse text-blue-600" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-blue-950 block">
                      {syncQueue.length > 0
                        ? t("profile.offlineSync.itemsPending", { count: syncQueue.length })
                        : t("profile.offlineSync.noPending")}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-blue-700/80 mt-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t("profile.offlineSync.lastSynced")}: {lastSyncTime}</span>
                    </div>
                  </div>
                </div>

                {/* Hành động: Nút Đồng Bộ Ngay & Link Xem chi tiết hàng đợi */}
                <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
                  {syncQueue.length > 0 && (
                    <button
                      onClick={() => setShowQueueDetails(!showQueueDetails)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer flex items-center gap-1 px-1 py-1"
                      aria-label={showQueueDetails ? t("profile.offlineSync.hideQueue") : t("profile.offlineSync.viewQueue")}
                    >
                      <span>{showQueueDetails ? t("profile.offlineSync.hideQueue") : t("profile.offlineSync.viewQueue")}</span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showQueueDetails ? "rotate-90" : ""}`} />
                    </button>
                  )}

                  <button
                    onClick={handleTriggerSync}
                    disabled={isSyncing || syncQueue.length === 0 || !effectiveOnline}
                    className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm ${
                      isSyncing || syncQueue.length === 0 || !effectiveOnline
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95 shadow-blue-600/20"
                    }`}
                    aria-label={isSyncing ? t("profile.offlineSync.syncing") : t("profile.offlineSync.syncNow")}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>{isSyncing ? t("profile.offlineSync.syncing") : t("profile.offlineSync.syncNow")}</span>
                  </button>
                </div>
              </div>

              {/* Danh sách chi tiết Hàng đợi (khi mở link) */}
              {showQueueDetails && syncQueue.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  {syncQueue.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-mono shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase shrink-0">
                          {item.type === "scan"
                            ? t("profile.offlineSync.queueItemTypeScan")
                            : item.type === "wave"
                            ? t("profile.offlineSync.queueItemTypeWave")
                            : t("profile.offlineSync.queueItemTypeBin")}
                        </span>
                        <span className="text-slate-800 font-medium truncate">{getLocalizedSummary(item)}</span>
                      </div>
                      <span className="text-slate-400 text-[11px] shrink-0 font-mono">{item.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Khu vực Quản Trị Dữ Liệu Ngoại Tuyến (Offline Database) */}
            <div className="pt-4 border-t border-slate-100">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-3">
                {t("profile.offlineSync.title")}
              </span>

              {/* 2 cột nhỏ bên trong khu vực này */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Cột 1 (Tải CSDL) */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block mb-1">
                      {t("profile.offlineSync.downloadDb")}
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                      {t("profile.offlineSync.subtitle")}
                    </p>
                  </div>

                  <div>
                    <button
                      onClick={handleDownloadOfflineDb}
                      disabled={isDownloadingDb}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                      aria-label={
                        isDownloadingDb
                          ? t("profile.offlineSync.downloadingDb")
                          : dbDownloaded
                          ? t("profile.offlineSync.reDownload")
                          : t("profile.offlineSync.downloadDb")
                      }
                    >
                      {isDownloadingDb ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <Download className="w-4 h-4 text-blue-600" />
                      )}
                      <span>
                        {isDownloadingDb
                          ? t("profile.offlineSync.downloadingDb")
                          : dbDownloaded
                          ? t("profile.offlineSync.reDownload")
                          : t("profile.offlineSync.downloadDb")}
                      </span>
                    </button>
                    {dbDownloaded && (
                      <span className="text-[10px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        {t("profile.offlineSync.dbDownloaded")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cột 2 (Quản lý Cache) */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        {t("profile.offlineSync.cacheIndexedDB", "Dung lượng bộ nhớ đệm IndexedDB")}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {t("profile.offlineSync.cacheCapacityMb", {
                          used: cacheSizeMb,
                          max: 64,
                          defaultValue: `${cacheSizeMb} MB / 64 MB`
                        })}
                      </span>
                    </div>

                    {/* Thanh Progress Bar cực mỏng */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden my-2.5">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (cacheSizeMb / 64) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {t("profile.offlineSync.cacheCapacity", { used: cacheSizeMb, max: 64 })}
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setShowClearCacheModal(true)}
                      className="w-full px-3 py-2 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      aria-label={t("profile.offlineSync.clearCache")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t("profile.offlineSync.clearCache")}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Checkbox "Tự động đồng bộ khi có mạng" chuyển thành dạng Toggle Switch (Công tắc gạt) màu xanh lá */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {t("profile.offlineSync.autoSync")}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {t("profile.offlineSync.autoSyncDesc")}
                  </span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={autoSyncOnReconnect}
                  onClick={() => {
                    const nextVal = !autoSyncOnReconnect;
                    setAutoSyncOnReconnect(nextVal);
                    localStorage.setItem("smartwms_auto_sync", String(nextVal));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoSyncOnReconnect ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  aria-label={t("profile.offlineSync.autoSync")}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      autoSyncOnReconnect ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------- */}
          {/* NỬA DƯỚI CỘT PHẢI: CẤU HÌNH TRẢI NGHIỆM & PHẦN CỨNG */}
          {/* -------------------------------------------------- */}

          {/* 1. Card "CẤU HÌNH TRẢI NGHIỆM KIỂM KHO" */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                {t("profile.preferences.title")}
              </h3>
            </div>

            {/* Ngôn ngữ giao diện: Segmented Control liền kề [VI | EN] */}
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{t("profile.preferences.language")}</span>
                  <span className="text-[11px] text-slate-500 block">
                    {!isCurrentEn ? t("profile.preferences.vietnamese") : t("profile.preferences.english")}
                  </span>
                </div>
              </div>

              {/* Segmented Control dạng nút bấm liền kề [VI | EN] */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleToggleLanguage("vi-VN")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    !isCurrentEn
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title={t("profile.preferences.vietnamese")}
                  aria-label={t("profile.preferences.vietnamese")}
                >
                  {t("profile.preferences.vietnameseShort")}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleLanguage("en-US")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    isCurrentEn
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title={t("profile.preferences.english")}
                  aria-label={t("profile.preferences.english")}
                >
                  {t("profile.preferences.englishShort")}
                </button>
              </div>
            </div>

            {/* Danh sách cài đặt dạng List item với Toggle Switch bên phải */}
            <div className="divide-y divide-slate-100">
              {/* Item 1: Âm báo âm thanh (Beep) */}
              <div className="flex items-center justify-between py-3.5">
                <div className="pr-4">
                  <span className="text-xs font-bold text-slate-900 block">
                    {t("profile.preferences.soundFeedback")}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {t("profile.preferences.soundFeedbackDesc")}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundFeedback}
                  onClick={() => {
                    const nextVal = !soundFeedback;
                    setSoundFeedback(nextVal);
                    localStorage.setItem("smartwms_pref_sound", String(nextVal));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    soundFeedback ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  aria-label={t("profile.preferences.soundFeedback")}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      soundFeedback ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Item 2: Rung phản hồi (Haptic) */}
              <div className="flex items-center justify-between py-3.5">
                <div className="pr-4">
                  <span className="text-xs font-bold text-slate-900 block">
                    {t("profile.preferences.hapticFeedback")}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {t("profile.preferences.hapticFeedbackDesc")}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hapticFeedback}
                  onClick={() => {
                    const nextVal = !hapticFeedback;
                    setHapticFeedback(nextVal);
                    localStorage.setItem("smartwms_pref_haptic", String(nextVal));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    hapticFeedback ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  aria-label={t("profile.preferences.hapticFeedback")}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      hapticFeedback ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Item 3: Chế độ tương phản cao */}
              <div className="flex items-center justify-between py-3.5">
                <div className="pr-4">
                  <span className="text-xs font-bold text-slate-900 block">
                    {t("profile.preferences.highContrast")}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {t("profile.preferences.highContrastDesc")}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={highContrast}
                  onClick={() => {
                    const nextVal = !highContrast;
                    setHighContrast(nextVal);
                    localStorage.setItem("smartwms_pref_contrast", String(nextVal));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    highContrast ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  aria-label={t("profile.preferences.highContrast")}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      highContrast ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Item 4: Tự động lấy nét camera */}
              <div className="flex items-center justify-between py-3.5">
                <div className="pr-4">
                  <span className="text-xs font-bold text-slate-900 block">
                    {t("profile.preferences.autoFocusCamera")}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {t("profile.preferences.autoFocusCameraDesc")}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoFocusCamera}
                  onClick={() => {
                    const nextVal = !autoFocusCamera;
                    setAutoFocusCamera(nextVal);
                    localStorage.setItem("smartwms_pref_autofocus", String(nextVal));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoFocusCamera ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  aria-label={t("profile.preferences.autoFocusCamera")}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      autoFocusCamera ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Card "THÔNG TIN PHẦN CỨNG PDA" (Nằm dưới cùng) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-3.5">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                {t("profile.deviceInfo.title")}
              </h3>
            </div>

            {/* Bảng thông số mỏng (Table list) nền xám siêu nhạt #F8FAFC */}
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-200/70 text-xs">
              <div className="p-3 sm:px-4 flex items-center justify-between">
                <span className="text-slate-600 font-medium">{t("profile.deviceInfo.deviceId")}</span>
                <span className="font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded text-xs shadow-2xs">
                  {t("profile.deviceInfo.defaultDeviceId", "SmartWMS-PDA-09")}
                </span>
              </div>

              <div className="p-3 sm:px-4 flex items-center justify-between">
                <span className="text-slate-600 font-medium">{t("profile.deviceInfo.batteryLevel")}</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1.5 font-mono">
                  <BatteryCharging className="w-4 h-4 text-emerald-500" />
                  {t("profile.deviceInfo.batteryStatus", {
                    percent: 92,
                    status: t("profile.deviceInfo.batteryNormal")
                  })}
                </span>
              </div>

              <div className="p-3 sm:px-4 flex items-center justify-between">
                <span className="text-slate-600 font-medium">{t("profile.deviceInfo.appVersion")}</span>
                <span className="font-mono text-slate-800 font-semibold bg-white border border-slate-200 px-2.5 py-0.5 rounded text-xs">
                  {t("profile.deviceInfo.appVersionValue", "v2.4.1-pda-build")}
                </span>
              </div>

              <div className="p-3 sm:px-4 flex items-center justify-between">
                <span className="text-slate-600 font-medium">{t("profile.deviceInfo.firmware")}</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {t("profile.deviceInfo.firmwareValue")}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Nút Đăng Xuất (Dưới cùng cột phải, rộng ngang full-width) */}
          {onLogout && (
            <div>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="w-full py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98 shadow-2xs cursor-pointer"
                aria-label={t("profile.actions.logout")}
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>{t("profile.actions.logout")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* EDIT PROFILE MODAL (ENTERPRISE FORM - GRID 2 CỘT)    */}
      {/* ==================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">

            {/* 1. Header Pop-up */}
            <div className="p-5 sm:px-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {t("profile.editModal.title")}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t("profile.editModal.subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                aria-label={t("profile.editModal.cancel")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Nội dung Form (Grid 2 cột) */}
            <form onSubmit={handleSaveFromModal} className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Hàng 1 (Read-only/Khóa): [Họ và tên] | [Mã nhân viên] */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      {t("profile.editModal.fullName")}
                    </label>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                      <Lock className="w-3 h-3" />
                      {t("profile.editModal.locked")}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={displayedName}
                    disabled
                    readOnly
                    className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      {t("profile.editModal.employeeId")}
                    </label>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                      <Lock className="w-3 h-3" />
                      {t("profile.editModal.locked")}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={displayedEmpId}
                    disabled
                    readOnly
                    className="w-full bg-slate-100 text-slate-500 font-mono border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold cursor-not-allowed select-none"
                  />
                </div>

                {/* Hàng 2: [Email công vụ *] | [Số điện thoại *] */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    {t("profile.editModal.email")}
                  </label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder={t("profile.editModal.emailPlaceholder")}
                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    {t("profile.editModal.phone")}
                  </label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder={t("profile.editModal.phonePlaceholder")}
                    className="w-full bg-white text-slate-900 font-mono border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  />
                </div>

                {/* Hàng 3: [Kho phụ trách] | [Phân khu hoạt động] */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    {t("profile.editModal.warehouse")}
                  </label>
                  <select
                    value={editWarehouse}
                    onChange={(e) => setEditWarehouse(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition cursor-pointer"
                  >
                    <option value="WH-HCM-01">{t("profile.warehouses.hcm")}</option>
                    <option value="WH-HN-02">{t("profile.warehouses.hn")}</option>
                    <option value="WH-DN-03">{t("profile.warehouses.dn")}</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      {t("profile.editModal.assignedZone")}
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {t("profile.editModal.zonesHint")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      { id: "Zone A", label: t("profile.zones.zoneA") },
                      { id: "Zone B", label: t("profile.zones.zoneB") },
                      { id: "Zone C", label: t("profile.zones.zoneC") },
                      { id: "Zone D", label: t("profile.zones.zoneD") },
                    ].map((zone) => {
                      const isSelected = editZones.includes(zone.id);
                      return (
                        <button
                          key={zone.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (editZones.length > 1) {
                                setEditZones(editZones.filter((z) => z !== zone.id));
                              }
                            } else {
                              setEditZones([...editZones, zone.id]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 shrink-0" />}
                          <span>{zone.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hàng 4: [Ca làm việc mặc định] */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    {t("profile.editModal.defaultShift")}
                  </label>
                  <select
                    value={editShift}
                    onChange={(e) => setEditShift(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition cursor-pointer"
                  >
                    <option value="Ca 1 (06:00 - 14:00)">{t("profile.shifts.shift1")}</option>
                    <option value="Ca 2 (14:00 - 22:00)">{t("profile.shifts.shift2")}</option>
                    <option value="Ca 3 (22:00 - 06:00)">{t("profile.shifts.shift3")}</option>
                  </select>
                </div>
              </div>

              {/* 3. Footer Pop-up */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  {t("profile.editModal.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition cursor-pointer active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t("profile.editModal.save")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CONFIRM LOGOUT MODAL                                 */}
      {/* ==================================================== */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t("profile.actions.logoutConfirmTitle")}</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {t("profile.deviceInfo.deviceId")}: {t("profile.deviceInfo.defaultDeviceId", "SmartWMS-PDA-09")}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{t("profile.actions.logoutConfirm")}</p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                {t("profile.actions.cancel")}
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  onLogout?.();
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {t("profile.actions.logout")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CONFIRM CLEAR CACHE MODAL                            */}
      {/* ==================================================== */}
      {showClearCacheModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t("profile.actions.confirmClearCache")}</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {t("profile.offlineSync.cacheIndexedDB", "Dung lượng bộ nhớ đệm IndexedDB")}: {t("profile.offlineSync.mbFormat", { size: cacheSizeMb, defaultValue: `${cacheSizeMb} MB` })}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{t("profile.actions.clearCacheWarning")}</p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => setShowClearCacheModal(false)}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                {t("profile.actions.cancel")}
              </button>
              <button
                onClick={handleClearCache}
                className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {t("profile.offlineSync.clearCache")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
