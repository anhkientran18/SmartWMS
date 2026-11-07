/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  CycleCountSheet,
  CycleCountKPIs,
  CreateCycleCountSheetRequest,
} from "../../services/cycleCount/types";
import { cycleCountService } from "../../services/cycleCount/cycleCountService";
import { warehouseService } from "../../services/locations/warehouseService";
import { zoneService } from "../../services/locations/zoneService";
import { binService } from "../../services/locations/binService";
import CycleCountList from "./CycleCountList";
import CycleCountWorkingScreen from "./CycleCountWorkingScreen";
import CreateCountSheetModal from "./CreateCountSheetModal";

export interface CycleCountManagementProps {
  lang?: string;
  onShowToast?: (
    message: string,
    type?: "success" | "warning" | "error" | "info",
    title?: string
  ) => void;
  currentUser?: string;
}

export default function CycleCountManagement({
  lang,
  onShowToast,
  currentUser = "Trần Anh Kiện (Staff)",
}: CycleCountManagementProps) {
  const { t, i18n } = useTranslation();

  if (lang && i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }

  // Network State
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isMockMode = cycleCountService.isMockMode();

  // Data states
  const [sheets, setSheets] = useState<CycleCountSheet[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<CycleCountKPIs>({
    totalSheets: 0,
    draftSheets: 0,
    countingSheets: 0,
    reviewSheets: 0,
    varianceSheets: 0,
    confirmedSheets: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [varianceOnly, setVarianceOnly] = useState(false);

  // Selected Sheet for Working/Detail View
  const [selectedSheet, setSelectedSheet] = useState<CycleCountSheet | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Master Data
  const [warehouses, setWarehouses] = useState<Array<{ id: string; code: string; name: any }>>([]);
  const [zones, setZones] = useState<Array<{ id: string; warehouseId: string; name: any; code?: string; type?: string }>>([]);
  const [availableBins, setAvailableBins] = useState<Array<{ id: string; code: string; zoneId: string }>>([]);

  // Fetch Master Data
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [whList, zList, bList] = await Promise.all([
          warehouseService.getWarehousesList(),
          zoneService.getZonesList(),
          binService.getBinsList(),
        ]);
        setWarehouses(whList);
        setZones(zList);
        setAvailableBins(bList.map((b) => ({ id: b.id, code: b.code, zoneId: b.zoneId })));
      } catch (err) {
        console.error("Failed loading master data for cycle count:", err);
      }
    };
    fetchMasterData();
  }, []);

  // Fetch Cycle Count Sheets & KPIs
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [listResult, kpisResult] = await Promise.all([
        cycleCountService.getCycleCounts({
          searchTerm: searchTerm || undefined,
          warehouseId: selectedWarehouse || undefined,
          zoneId: selectedZone || undefined,
          status: selectedStatus as any,
          varianceOnly: varianceOnly || undefined,
          page: pageIndex,
          pageSize,
        }),
        cycleCountService.getKPIs(),
      ]);

      setSheets(listResult.sheets);
      setTotalCount(listResult.total);
      setKpis(kpisResult);

      // If a sheet is currently open, refresh its data too
      if (selectedSheet) {
        const fresh = await cycleCountService.getCycleCountById(selectedSheet.id);
        if (fresh) setSelectedSheet(fresh);
      }
    } catch (err: any) {
      setError(err.message || t("cycleCounting.errors.loadFailed", "Lỗi tải dữ liệu kiểm kê."));
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedWarehouse, selectedZone, selectedStatus, varianceOnly, pageIndex, pageSize, selectedSheet?.id, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Create Sheet
  const handleCreateSheet = async (req: CreateCycleCountSheetRequest) => {
    const created = await cycleCountService.createCycleCountSheet(req);
    if (onShowToast) {
      onShowToast(
        t(
          "cycleCounting.toast.createdSuccess",
          "Đã tạo phiếu kiểm kê chu kỳ mới: {{number}}",
          { number: created.sheetNumber }
        ),
        "success"
      );
    }
    await loadData();
    // Open newly created sheet immediately
    setSelectedSheet(created);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedWarehouse("");
    setSelectedZone("");
    setSelectedStatus("ALL");
    setVarianceOnly(false);
    setPageIndex(1);
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-screen">
      {selectedSheet ? (
        <CycleCountWorkingScreen
          sheet={selectedSheet}
          onBack={() => {
            setSelectedSheet(null);
            loadData();
          }}
          onRefresh={loadData}
          onShowToast={(msg, type, title) => {
            if (onShowToast) onShowToast(msg, type, title);
          }}
          isOnline={isOnline}
          isMockMode={isMockMode}
          currentUser={currentUser}
        />
      ) : (
        <CycleCountList
          sheets={sheets}
          kpis={kpis}
          totalCount={totalCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={setPageIndex}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPageIndex(1);
          }}
          searchTerm={searchTerm}
          onSearchChange={(val) => {
            setSearchTerm(val);
            setPageIndex(1);
          }}
          selectedWarehouse={selectedWarehouse}
          onWarehouseChange={(val) => {
            setSelectedWarehouse(val);
            setSelectedZone("");
            setPageIndex(1);
          }}
          selectedZone={selectedZone}
          onZoneChange={(val) => {
            setSelectedZone(val);
            setPageIndex(1);
          }}
          selectedStatus={selectedStatus}
          onStatusChange={(val) => {
            setSelectedStatus(val);
            setPageIndex(1);
          }}
          varianceOnly={varianceOnly}
          onVarianceOnlyChange={(val) => {
            setVarianceOnly(val);
            setPageIndex(1);
          }}
          onResetFilters={handleResetFilters}
          warehouses={warehouses}
          zones={zones}
          onSelectSheet={(sheet) => setSelectedSheet(sheet)}
          onCreateSheet={() => setIsCreateModalOpen(true)}
          isLoading={isLoading}
          error={error}
          onRetry={loadData}
          isOnline={isOnline}
          isMockMode={isMockMode}
        />
      )}

      {/* Create Count Sheet Modal */}
      <CreateCountSheetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSheet}
        isOnline={isOnline}
        isMockMode={isMockMode}
        warehouses={warehouses}
        zones={zones}
        availableBins={availableBins}
        currentUserName={currentUser}
      />
    </div>
  );
}
