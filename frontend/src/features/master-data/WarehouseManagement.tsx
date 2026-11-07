/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Grid3X3,
  LayoutGrid,
  List,
  ChevronDown,
  Building2,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Package,
  RotateCcw,
  X,
  CircleDashed,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Maximize2,
  Layers,
  Save,
  Check,
  Eye,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { WarehouseDto, ZoneDto, BinDto, CreateBinRequest, UpdateBinRequest } from "../../services/api/apiTypes";
import {
  warehouseService,
  zoneService,
  binService,
  isLocationMutationEnabled,
  isLocationMockMode,
  getLocalizedZoneName,
  getLocalizedWarehouseName,
} from "../../services/locations";
import BinDetailModal from "../inventory/BinDetailModal";
import BinTooltip from "../inventory/BinTooltip";
import PaginationFooter from "../../components/common/PaginationFooter";

export interface WarehouseManagementProps {
  warehouses?: any[];
  zones?: any[];
  bins?: any[];
  products?: any[];
  onTransfer?: any;
  lang?: string;
}

export default function WarehouseManagement({ lang }: WarehouseManagementProps) {
  const { t, i18n } = useTranslation();
  if (lang) {
    i18n.language = lang;
  }
  const isEn = i18n.language?.startsWith("en");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // URL Query Sync
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(() => searchParams.get("warehouseId") || "");
  const [selectedZoneId, setSelectedZoneId] = useState(() => searchParams.get("zoneId") || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeThresholdFilter, setActiveThresholdFilter] = useState<"all" | "empty" | "normal" | "near_full" | "full">("all");

  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Detail Modal & CRUD Modals
  const [selectedBinForDetail, setSelectedBinForDetail] = useState<BinDto | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [isAddBinModalOpen, setIsAddBinModalOpen] = useState(false);
  const [isEditBinModalOpen, setIsEditBinModalOpen] = useState(false);
  const [binToEdit, setBinToEdit] = useState<BinDto | null>(null);

  // Delete Bin Modal state
  const [binToDelete, setBinToDelete] = useState<BinDto | null>(null);
  const [isDeletingBin, setIsDeletingBin] = useState(false);

  // Form states for Create Bin
  const [createBinCode, setCreateBinCode] = useState("");
  const [createBinZoneId, setCreateBinZoneId] = useState("");
  const [createBinWidth, setCreateBinWidth] = useState<number>(50);
  const [createBinHeight, setCreateBinHeight] = useState<number>(50);
  const [createBinDepth, setCreateBinDepth] = useState<number>(50);
  const [createBinMaxCap, setCreateBinMaxCap] = useState<number>(100);

  // Form states for Update Bin
  const [editBinCode, setEditBinCode] = useState("");
  const [editBinMaxCap, setEditBinMaxCap] = useState<number>(100);

  const mutationEnabled = isLocationMockMode() || isLocationMutationEnabled();
  const mutationDisabledTooltip = isEn
    ? "This action is currently unavailable."
    : "Chức năng này hiện chưa khả dụng.";

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPageIndex(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync external search params
  useEffect(() => {
    const wh = searchParams.get("warehouseId");
    const z = searchParams.get("zoneId");
    if (wh !== null) setSelectedWarehouseId(wh);
    if (z !== null) setSelectedZoneId(z);
  }, [searchParams]);

  // Query Warehouses
  const {
    data: warehousesList = [],
    isLoading: isLoadingWarehouses,
  } = useQuery<WarehouseDto[]>({
    queryKey: ["locations", "warehouses"],
    queryFn: () => warehouseService.getWarehousesList(),
  });

  // Query Zones (cascaded by selectedWarehouseId)
  const {
    data: zonesList = [],
    isLoading: isLoadingZones,
  } = useQuery<ZoneDto[]>({
    queryKey: ["locations", "zones", selectedWarehouseId],
    queryFn: () => {
      if (selectedWarehouseId) {
        return zoneService.getZonesByWarehouse(selectedWarehouseId);
      }
      return zoneService.getZonesList();
    },
  });

  // Query All Bins (for KPI stats calculation)
  const {
    data: allBinsForStats = [],
    refetch: refetchBinsStats,
  } = useQuery<BinDto[]>({
    queryKey: ["locations", "allBinsStats", selectedZoneId],
    queryFn: () => binService.getBinsList({ zoneId: selectedZoneId || undefined }),
  });

  // Query Paginated Bins
  const {
    data: pagedBinsResult,
    isLoading: isLoadingBins,
    isError: isBinsError,
    error: binsErrorObj,
    refetch: refetchBins,
    isFetching: isFetchingBins,
  } = useQuery({
    queryKey: [
      "locations",
      "pagedBins",
      selectedZoneId,
      debouncedSearch,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      binService.getBins({
        pageNumber: pageIndex,
        pageSize,
        zoneId: selectedZoneId || undefined,
        searchTerm: debouncedSearch || undefined,
      }),
  });

  // Selected warehouse & zone objects for breadcrumb
  const currentWarehouse = useMemo(() => {
    if (!selectedWarehouseId) return null;
    return warehousesList.find((w) => w.id === selectedWarehouseId) || null;
  }, [warehousesList, selectedWarehouseId]);

  const currentZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return zonesList.find((z) => z.id === selectedZoneId) || null;
  }, [zonesList, selectedZoneId]);

  // Derived KPI Stats from BinDto
  const stats = useMemo(() => {
    let emptyCount = 0;
    let normalCount = 0;
    let nearFullCount = 0;
    let fullCount = 0;

    allBinsForStats.forEach((b) => {
      const occ = b.currentOccupancy || 0;
      const max = b.maxCapacity || 0;
      const rate = max > 0 ? (occ / max) * 100 : 0;

      if (occ === 0) {
        emptyCount++;
      } else if (rate >= 100) {
        fullCount++;
      } else if (rate >= 80) {
        nearFullCount++;
      } else {
        normalCount++;
      }
    });

    return {
      total: allBinsForStats.length,
      empty: emptyCount,
      normal: normalCount,
      nearFull: nearFullCount,
      full: fullCount,
    };
  }, [allBinsForStats]);

  // Filter items in current page by threshold filter if active
  const displayedBins = useMemo(() => {
    const rawItems = pagedBinsResult?.items || [];
    if (activeThresholdFilter === "all") return rawItems;

    return rawItems.filter((b) => {
      const occ = b.currentOccupancy || 0;
      const max = b.maxCapacity || 0;
      const rate = max > 0 ? (occ / max) * 100 : 0;

      if (activeThresholdFilter === "empty") return occ === 0;
      if (activeThresholdFilter === "normal") return occ > 0 && rate < 80;
      if (activeThresholdFilter === "near_full") return rate >= 80 && rate < 100;
      if (activeThresholdFilter === "full") return rate >= 100;
      return true;
    });
  }, [pagedBinsResult?.items, activeThresholdFilter]);

  // Segmented presentation threshold tabs (Rule 10)
  const segmentedTabs = [
    {
      key: "all" as const,
      label: isEn ? "All" : "Tất cả",
      count: stats.total,
      icon: Grid3X3,
      badgeBg: "bg-slate-200 text-slate-700",
      activeBadgeBg: "bg-slate-900 text-white",
    },
    {
      key: "empty" as const,
      label: isEn ? "Empty (0%)" : "Trống (0%)",
      count: stats.empty,
      icon: CircleDashed,
      badgeBg: "bg-slate-100 text-slate-600 border border-slate-200",
      activeBadgeBg: "bg-slate-700 text-white",
    },
    {
      key: "normal" as const,
      label: isEn ? "Normal (1-79%)" : "Bình thường (1-79%)",
      count: stats.normal,
      icon: CheckCircle2,
      badgeBg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      activeBadgeBg: "bg-emerald-600 text-white",
    },
    {
      key: "near_full" as const,
      label: isEn ? "Near Full (80-99%)" : "Sắp đầy (80-99%)",
      count: stats.nearFull,
      icon: AlertTriangle,
      badgeBg: "bg-amber-50 text-amber-700 border border-amber-200",
      activeBadgeBg: "bg-amber-600 text-white",
    },
    {
      key: "full" as const,
      label: isEn ? "Full (>=100%)" : "Đầy (>=100%)",
      count: stats.full,
      icon: AlertCircle,
      badgeBg: "bg-rose-50 text-rose-700 border border-rose-200",
      activeBadgeBg: "bg-rose-600 text-white",
    },
  ];

  const handleResetFilters = () => {
    setSelectedWarehouseId("");
    setSelectedZoneId("");
    setSearchTerm("");
    setDebouncedSearch("");
    setActiveThresholdFilter("all");
    setPageIndex(1);
  };

  // Open Create Bin Modal
  const openCreateBin = () => {
    setCreateBinCode("");
    setCreateBinZoneId(selectedZoneId || (zonesList[0]?.id || ""));
    setCreateBinWidth(50);
    setCreateBinHeight(50);
    setCreateBinDepth(50);
    setCreateBinMaxCap(100);
    setIsAddBinModalOpen(true);
  };

  // Open Edit Bin Modal
  const openEditBin = (bin: BinDto) => {
    setBinToEdit(bin);
    setEditBinCode(bin.code);
    setEditBinMaxCap(bin.maxCapacity);
    setIsEditBinModalOpen(true);
  };

  // Execute Create Bin
  const handleExecuteCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createBinCode.trim() || !createBinZoneId) {
      alert(isEn ? "Bin Code and Zone are required." : "Vui lòng nhập mã ô kệ và chọn phân khu.");
      return;
    }

    try {
      const request: CreateBinRequest = {
        code: createBinCode.trim().toUpperCase(),
        zoneId: createBinZoneId,
        width: Number(createBinWidth) || 0,
        height: Number(createBinHeight) || 0,
        depth: Number(createBinDepth) || 0,
        maxCapacity: Number(createBinMaxCap) || 100,
      };

      await binService.createBin(request);
      setIsAddBinModalOpen(false);
      refetchBins();
      refetchBinsStats();
    } catch (err: any) {
      alert(err.message || (isEn ? "Failed to create bin." : "Không thể tạo ô kệ."));
    }
  };

  // Execute Update Bin
  const handleExecuteUpdateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binToEdit || !editBinCode.trim()) return;

    try {
      const request: UpdateBinRequest = {
        id: binToEdit.id,
        code: editBinCode.trim().toUpperCase(),
        maxCapacity: Number(editBinMaxCap) || 0,
      };

      await binService.updateBin(binToEdit.id, request);
      setIsEditBinModalOpen(false);
      refetchBins();
      refetchBinsStats();
    } catch (err: any) {
      alert(err.message || (isEn ? "Failed to update bin." : "Không thể cập nhật ô kệ."));
    }
  };

  // Request Delete Bin (triggers modal)
  const handleRequestDeleteBin = (bin: BinDto) => {
    if (!mutationEnabled) return;
    setBinToDelete(bin);
  };

  // Execute Delete Bin after modal confirmation
  const handleConfirmDeleteBin = async () => {
    if (!binToDelete || !mutationEnabled) return;
    setIsDeletingBin(true);
    try {
      await binService.deleteBin(binToDelete.id);
      setBinToDelete(null);
      refetchBins();
      refetchBinsStats();
    } catch (err: any) {
      alert(err.message || (isEn ? "Failed to delete bin." : "Không thể xóa ô kệ."));
    } finally {
      setIsDeletingBin(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 animate-fadeIn">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-2xs mt-0.5 shrink-0">
            <Grid3X3 className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight leading-snug">
                {isEn ? "Storage Bins" : "Sơ đồ ô kệ"}
              </h2>
              {currentWarehouse && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  {currentWarehouse.code}
                </span>
              )}
              {currentZone && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {currentZone.code}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-sans mt-1">
              {isEn
                ? "Manage rack capacity, monitor utilization rates, and coordinate storage locations."
                : "Quản lý không gian kệ, giám sát tỷ lệ lấp đầy và điều phối vị trí lưu trữ hàng hóa."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={openCreateBin}
            disabled={!mutationEnabled}
            title={!mutationEnabled ? mutationDisabledTooltip : (isEn ? "Add Bin" : "Thêm ô kệ")}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            <span>{isEn ? "Add Bin" : "Thêm ô kệ"}</span>
          </button>

          {/* View mode toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-blue-50 text-blue-600 shadow-2xs border border-blue-100"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{isEn ? "Grid" : "Ma trận"}</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-blue-50 text-blue-600 shadow-2xs border border-blue-100"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <List className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{isEn ? "Table" : "Danh sách"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng số ô kệ */}
        <div
          onClick={() => setActiveThresholdFilter("all")}
          className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-xs transition duration-150 cursor-pointer flex flex-col justify-between ${
            activeThresholdFilter === "all" ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 font-sans">
              {isEn ? "Total Managed Bins" : "Tổng ô kệ quản lý"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Grid3X3 className="w-4 h-4" strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.total} <span className="text-xs font-semibold text-slate-500">{isEn ? "Bins" : "Ô kệ"}</span>
            </div>
            <p className="text-xs text-slate-500 font-sans mt-1">
              {isEn ? "All storage locations" : "Toàn bộ vị trí lưu kho"}
            </p>
          </div>
        </div>

        {/* Card 2: Ô kệ khả dụng */}
        <div
          onClick={() => setActiveThresholdFilter("normal")}
          className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-xs transition duration-150 cursor-pointer flex flex-col justify-between ${
            activeThresholdFilter === "normal" ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 font-sans">
              {isEn ? "Normal (1-79%)" : "Bình thường (1-79%)"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              {stats.normal} <span className="text-xs font-semibold text-emerald-700">{isEn ? "Bins" : "Ô kệ"}</span>
            </div>
            <p className="text-xs text-emerald-700 font-sans mt-1">
              {isEn ? "Ready for inbound receiving" : "Khả dụng tiếp nhận hàng"}
            </p>
          </div>
        </div>

        {/* Card 3: Ô kệ sắp đầy */}
        <div
          onClick={() => setActiveThresholdFilter("near_full")}
          className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-xs transition duration-150 cursor-pointer flex flex-col justify-between ${
            activeThresholdFilter === "near_full" ? "border-amber-500 ring-2 ring-amber-500/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-700 font-sans">
              {isEn ? "Near Full (80-99%)" : "Sắp đầy (80-99%)"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 tracking-tight">
              {stats.nearFull} <span className="text-xs font-semibold text-amber-700">{isEn ? "Bins" : "Ô kệ"}</span>
            </div>
            <p className="text-xs text-amber-700 font-sans mt-1">
              {isEn ? "High occupancy threshold" : "Ngưỡng tải trọng cao"}
            </p>
          </div>
        </div>

        {/* Card 4: Ô kệ đã đầy */}
        <div
          onClick={() => setActiveThresholdFilter("full")}
          className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-xs transition duration-150 cursor-pointer flex flex-col justify-between ${
            activeThresholdFilter === "full" ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-rose-700 font-sans">
              {isEn ? "Full (>=100%)" : "Đầy (>=100%)"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-600 tracking-tight">
              {stats.full} <span className="text-xs font-semibold text-rose-700">{isEn ? "Bins" : "Ô kệ"}</span>
            </div>
            <p className="text-xs text-rose-700 font-sans mt-1">
              {isEn ? "At or above capacity" : "Đạt hoặc vượt sức chứa"}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Search & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          {/* Search box */}
          <div className="md:col-span-6 relative">
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5 font-sans">
              <Search className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
              <span>{isEn ? "Search bins" : "Tìm kiếm ô kệ"}</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isEn ? "Search bin code (e.g. C1-A01-N01)..." : "Tìm mã kệ (vd: C1-A01-N01, D2-A02-N01)..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 font-medium text-slate-800 text-xs rounded-xl py-2.5 pl-10 pr-20 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs transition placeholder:text-slate-400"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs select-none">
                  Ctrl+K
                </kbd>
              </div>
            </div>
          </div>

          {/* Warehouse Dropdown */}
          <div className="md:col-span-3 relative">
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5 font-sans">
              <Building2 className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
              <span>{isEn ? "Warehouse" : "Nhà kho"}</span>
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 border border-slate-200 font-medium text-slate-800 text-xs rounded-xl py-2.5 pl-3.5 pr-9 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 appearance-none shadow-2xs cursor-pointer"
                value={selectedWarehouseId}
                onChange={(e) => {
                  setSelectedWarehouseId(e.target.value);
                  setSelectedZoneId("");
                  setPageIndex(1);
                }}
              >
                <option value="">{isEn ? "All Warehouses" : "Tất cả nhà kho"}</option>
                {warehousesList.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {getLocalizedWarehouseName(wh.name, isEn)} ({wh.code})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Zone Dropdown */}
          <div className="md:col-span-3 relative">
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5 font-sans">
              <Layers className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
              <span>{isEn ? "Zone" : "Phân khu"}</span>
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 border border-slate-200 font-medium text-slate-800 text-xs rounded-xl py-2.5 pl-3.5 pr-9 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 appearance-none shadow-2xs cursor-pointer disabled:opacity-50"
                value={selectedZoneId}
                onChange={(e) => {
                  setSelectedZoneId(e.target.value);
                  setPageIndex(1);
                }}
                disabled={zonesList.length === 0}
              >
                <option value="">{isEn ? "All Zones" : "Tất cả phân khu"}</option>
                {zonesList.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {getLocalizedZoneName(zone.name, isEn)} ({zone.code})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>

        {/* Presentation threshold filter tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
            {segmentedTabs.map((tab) => {
              const isActive = activeThresholdFilter === tab.key;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveThresholdFilter(tab.key);
                    setPageIndex(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-white text-slate-900 shadow-2xs font-bold border border-slate-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50 font-medium"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0 opacity-80" strokeWidth={1.5} />
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                      isActive ? tab.activeBadgeBg : tab.badgeBg
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {(selectedWarehouseId || selectedZoneId || searchTerm || activeThresholdFilter !== "all") && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.5} />
              <span>{isEn ? "Reset Filters" : "Đặt lại bộ lọc"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Main Bins Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[420px] overflow-hidden">
        {/* Container Top Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center px-5 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Grid3X3 className="w-[18px] h-[18px] text-blue-600" strokeWidth={1.5} />
            <h3 className="font-bold text-slate-900 text-xs">
              {viewMode === "grid"
                ? (isEn ? "Storage Bin Matrix" : "Ma trận ô kệ")
                : (isEn ? "Storage Bin List" : "Danh sách ô kệ")}
            </h3>
            {isFetchingBins && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 ml-1" strokeWidth={1.5} />}
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {pagedBinsResult?.totalCount || 0} {isEn ? "bins total" : "ô kệ tổng cộng"}
          </span>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 bg-slate-50 flex-1 relative min-h-[320px]">
          {/* Loading State */}
          {isLoadingBins && (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" strokeWidth={1.5} />
              <p className="text-xs font-medium text-slate-600">
                {isEn ? "Loading bins..." : "Đang tải dữ liệu ô kệ..."}
              </p>
            </div>
          )}

          {/* Error State */}
          {!isLoadingBins && isBinsError && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-600">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-rose-700">
                {(binsErrorObj as any)?.message || (isEn ? "Error loading bins." : "Lỗi khi tải dữ liệu ô kệ.")}
              </p>
              <button
                type="button"
                onClick={() => refetchBins()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{isEn ? "Retry" : "Thử lại"}</span>
              </button>
            </div>
          )}

          {/* Grid View */}
          {!isLoadingBins && !isBinsError && viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {displayedBins.map((bin) => {
                const max = bin.maxCapacity || 0;
                const occ = bin.currentOccupancy || 0;
                const available = Math.max(0, max - occ);
                const util = max > 0 ? Math.round((occ / max) * 100) : 0;

                // Threshold styles
                let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                let badgeText = isEn ? `Normal (${util}%)` : `Bình thường (${util}%)`;
                let barColor = "bg-emerald-500";
                let statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />;

                if (max <= 0) {
                  badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                  badgeText = isEn ? "Capacity not configured" : "Chưa cấu hình sức chứa";
                  barColor = "bg-slate-200";
                  statusIcon = <CircleDashed className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />;
                } else if (occ === 0) {
                  badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                  badgeText = isEn ? "Empty (0%)" : "Trống (0%)";
                  barColor = "bg-slate-300";
                  statusIcon = <CircleDashed className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />;
                } else if (util >= 100) {
                  badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                  badgeText = isEn ? `Full (${util}%)` : `Đầy (${util}%)`;
                  barColor = "bg-rose-500";
                  statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-500" strokeWidth={1.5} />;
                } else if (util >= 80) {
                  badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                  badgeText = isEn ? `Near Full (${util}%)` : `Sắp đầy (${util}%)`;
                  barColor = "bg-amber-500";
                  statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />;
                }

                const parentZone = zonesList.find((z) => z.id === bin.zoneId);
                const zoneFullName =
                  getLocalizedZoneName(parentZone?.name, isEn) ||
                  parentZone?.code ||
                  bin.zoneId;

                return (
                  <div
                    key={bin.id}
                    onClick={() => {
                      setSelectedBinForDetail(bin);
                      setIsDetailModalOpen(true);
                    }}
                    className="group relative flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:shadow-md hover:border-slate-300 transition duration-150 cursor-pointer"
                  >
                    {/* Tooltip on hover */}
                    <BinTooltip bin={bin} isEn={isEn} />

                    {/* Top Tag Header */}
                    <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-start justify-between gap-1.5 min-w-0">
                      <span
                        className="text-xs font-semibold text-slate-700 line-clamp-2 leading-snug break-words min-w-[75px] flex-1"
                        title={zoneFullName}
                      >
                        {zoneFullName}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ml-auto ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          {bin.code}
                        </span>
                        <div>{statusIcon}</div>
                      </div>

                      {/* Numeric values */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-medium">
                            {isEn ? "Occupied" : "Đang dùng"}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {occ} / {max}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {isEn ? "pcs" : "cái"}
                            </span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block font-medium">
                            {isEn ? "Available" : "Còn trống"}
                          </span>
                          <span className={`font-mono font-bold ${max <= 0 ? "text-slate-500" : "text-emerald-600"}`}>
                            {available}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {isEn ? "pcs" : "cái"}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div
                        className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBinForDetail(bin);
                            setIsDetailModalOpen(true);
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>{isEn ? "View Details" : "Xem chi tiết"}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditBin(bin)}
                            disabled={!mutationEnabled}
                            title={!mutationEnabled ? mutationDisabledTooltip : (isEn ? "Edit" : "Sửa")}
                            className="p-1.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteBin(bin)}
                            disabled={!mutationEnabled}
                            title={!mutationEnabled ? mutationDisabledTooltip : (isEn ? "Delete" : "Xóa")}
                            className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1 bg-slate-100 overflow-hidden">
                      <div
                        className={`h-1 transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.min(100, Math.max(0, util))}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {displayedBins.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
                  <Package className="h-10 w-10 mb-2 text-slate-300" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-slate-600">
                    {isEn ? "No storage bins match your filters." : "Không có vị trí kệ nào khớp với bộ lọc."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Table View */}
          {!isLoadingBins && !isBinsError && viewMode === "table" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">{isEn ? "Bin Code" : "Mã ô kệ"}</th>
                      <th className="px-4 py-3">{isEn ? "Zone" : "Phân khu"}</th>
                      <th className="px-4 py-3 text-right">{isEn ? "Max Capacity" : "Sức chứa tối đa"}</th>
                      <th className="px-4 py-3 text-right">{isEn ? "Occupied" : "Đang sử dụng"}</th>
                      <th className="px-4 py-3 text-right">{isEn ? "Available" : "Còn trống"}</th>
                      <th className="px-4 py-3 text-center">{isEn ? "Utilization" : "Tỷ lệ"}</th>
                      <th className="px-4 py-3 text-center">{isEn ? "Threshold Status" : "Trạng thái"}</th>
                      <th className="px-4 py-3 text-right">{isEn ? "Actions" : "Thao tác"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedBins.map((bin) => {
                      const max = bin.maxCapacity || 0;
                      const occ = bin.currentOccupancy || 0;
                      const available = Math.max(0, max - occ);
                      const util = max > 0 ? Math.round((occ / max) * 100) : 0;
                      const parentZone = zonesList.find((z) => z.id === bin.zoneId);

                      let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      let badgeText = isEn ? "Normal" : "Bình thường";
                      if (max <= 0) {
                        badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                        badgeText = isEn ? "Not configured" : "Chưa cấu hình";
                      } else if (occ === 0) {
                        badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                        badgeText = isEn ? "Empty" : "Trống";
                      } else if (util >= 100) {
                        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                        badgeText = isEn ? "Full" : "Đầy";
                      } else if (util >= 80) {
                        badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                        badgeText = isEn ? "Near Full" : "Sắp đầy";
                      }

                      return (
                        <tr key={bin.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {bin.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {getLocalizedZoneName(parentZone?.name, isEn) || bin.zoneId}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {max}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {occ}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                            {available}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">
                            {util}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass}`}>
                              {badgeText}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBinForDetail(bin);
                                  setIsDetailModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span>{isEn ? "Details" : "Chi tiết"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditBin(bin)}
                                disabled={!mutationEnabled}
                                title={!mutationEnabled ? mutationDisabledTooltip : (isEn ? "Edit" : "Sửa")}
                                className="p-1.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteBin(bin)}
                                disabled={!mutationEnabled}
                                title={!mutationEnabled ? mutationDisabledTooltip : (isEn ? "Delete" : "Xóa")}
                                className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {displayedBins.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                          {isEn ? "No storage bins match your filters." : "Không có vị trí kệ nào khớp với bộ lọc."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 6. Pagination Footer */}
        {pagedBinsResult && pagedBinsResult.totalPages > 1 && (
          <div className="p-4 bg-white border-t border-slate-200">
            <PaginationFooter
              pageIndex={pagedBinsResult.pageIndex}
              pageSize={pagedBinsResult.pageSize}
              totalPages={pagedBinsResult.totalPages}
              totalCount={pagedBinsResult.totalCount}
              onPageChange={(page) => setPageIndex(page)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPageIndex(1);
              }}
            />
          </div>
        )}
      </div>

      {/* 7. Bin Detail Drawer Modal */}
      <BinDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBinForDetail(null);
        }}
        selectedBin={selectedBinForDetail}
        isEn={isEn}
      />

      {/* 8. Add Bin Modal (CreateBinRequest: code, zoneId, width, height, depth, maxCapacity) */}
      {isAddBinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-zoomIn flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                <h3 className="font-bold text-slate-900 text-sm">
                  {isEn ? "Create Storage Bin" : "Thêm mới ô kệ"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleExecuteCreateBin} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    {isEn ? "Bin Code *" : "Mã ô kệ *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={createBinCode}
                    onChange={(e) => setCreateBinCode(e.target.value.toUpperCase())}
                    placeholder="vd: C1-A01-N03"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    {isEn ? "Belongs to Zone *" : "Phân khu trực thuộc *"}
                  </label>
                  <select
                    value={createBinZoneId}
                    onChange={(e) => setCreateBinZoneId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 cursor-pointer"
                  >
                    {zonesList.map((z) => (
                      <option key={z.id} value={z.id}>
                        {getLocalizedZoneName(z.name, isEn)} ({z.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                  {isEn ? "Max Capacity (pcs) *" : "Sức chứa tối đa (cái) *"}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={createBinMaxCap}
                  onChange={(e) => setCreateBinMaxCap(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    {isEn ? "Width (cm)" : "Chiều rộng (cm)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createBinWidth}
                    onChange={(e) => setCreateBinWidth(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    {isEn ? "Height (cm)" : "Chiều cao (cm)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createBinHeight}
                    onChange={(e) => setCreateBinHeight(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    {isEn ? "Depth (cm)" : "Chiều sâu (cm)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createBinDepth}
                    onChange={(e) => setCreateBinDepth(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddBinModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" strokeWidth={1.5} />
                  <span>{isEn ? "Save Bin" : "Lưu ô kệ"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Edit Bin Modal (UpdateBinRequest: id, code, maxCapacity) */}
      {isEditBinModalOpen && binToEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-zoomIn flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                <h3 className="font-bold text-slate-900 text-sm">
                  {isEn ? `Edit Bin: ${binToEdit.code}` : `Chỉnh sửa ô kệ: ${binToEdit.code}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditBinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleExecuteUpdateBin} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                  {isEn ? "Bin Code *" : "Mã ô kệ *"}
                </label>
                <input
                  type="text"
                  required
                  value={editBinCode}
                  onChange={(e) => setEditBinCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                  {isEn ? "Max Capacity (pcs) *" : "Sức chứa tối đa (cái) *"}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editBinMaxCap}
                  onChange={(e) => setEditBinMaxCap(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditBinModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" strokeWidth={1.5} />
                  <span>{isEn ? "Update Bin" : "Cập nhật ô kệ"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Delete Bin Confirmation Modal */}
      {binToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-zoomIn flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-4 h-4 text-rose-600" strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {isEn ? "Confirm Delete Bin" : "Xác nhận xóa ô kệ"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBinToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 text-sm">
                {isEn ? (
                  <>
                    Are you sure you want to permanently delete bin{" "}
                    <span className="font-mono font-bold text-slate-900">
                      {binToDelete.code}
                    </span>
                    ? This action cannot be undone.
                  </>
                ) : (
                  <>
                    Bạn có chắc chắn muốn xóa vị trí ô kệ{" "}
                    <span className="font-mono font-bold text-slate-900">
                      {binToDelete.code}
                    </span>
                    ? Thao tác này không thể hoàn tác.
                  </>
                )}
              </p>

              {(binToDelete.currentOccupancy || 0) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>
                    {isEn
                      ? `Warning: This bin currently has ${binToDelete.currentOccupancy} items stored.`
                      : `Cảnh báo: Ô kệ này hiện đang có ${binToDelete.currentOccupancy} sản phẩm lưu trữ.`}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setBinToDelete(null)}
                  disabled={isDeletingBin}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy bỏ"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteBin}
                  disabled={isDeletingBin}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeletingBin ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  )}
                  <span>{isEn ? "Delete Bin" : "Xóa ô kệ"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
