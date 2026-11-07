/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Database, Plus, Search, Scale, ShieldAlert, Cpu, Edit, Trash2, X, Home,
  Layers, Printer, Package, Edit3, Handshake, Briefcase, ShieldCheck,
  Warehouse as WarehouseIcon, Building2, MapPin, Boxes, ChevronRight,
  CheckCircle2, AlertTriangle, Gauge, RotateCcw, SlidersHorizontal, Check,
  Info, Eye, ArrowRight, Save, Download, Upload, Coins, FileSpreadsheet, FileUp, Filter,
  CircleDollarSign, RefreshCw, FolderTree, Barcode, Sparkles, Box, ChevronLeft,
  Mail, Phone, Truck, Clock, ExternalLink, Lock, Shield, Star,
  QrCode, AlertCircle, Loader2, Globe
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Product, Bin, WarehouseZone, Vendor, Warehouse } from "../../types/index";
import { ProductDto, ParsedBarcodeDto, WarehouseDto, ZoneDto, BinDto, ApiError, SupplierDto, CreateSupplierRequest, UpdateSupplierRequest } from "../../services/api/apiTypes";
import { productService, isProductMutationEnabled, isMockMode, getDataMode, getLocalizedMockProduct } from "../../services/productService";
import { supplierService, isSupplierMutationEnabled } from "../../services/supplierService";
import {
  warehouseService,
  zoneService,
  binService,
  isLocationMutationEnabled,
  isLocationMockMode,
  getLocationDataMode,
  getLocalizedZoneName,
  getLocalizedWarehouseName,
} from "../../services/locations";
import PaginationFooter from "../../components/common/PaginationFooter";
import AdvancedFilterBar, { FilterState } from "../../components/common/AdvancedFilterBar";
import { StatusBadge, ActionButton, KPICard, SharedStateView } from "../../components/common";

interface DBViewerProps {
  products: Product[];
  warehouses: Warehouse[];
  bins: Bin[];
  zones: WarehouseZone[];
  vendors: Vendor[];
  onAddBin: (code: string, zoneId: string, capacity: number) => void;
  onUpdateBin: (id: string, code: string, zoneId: string, maxCapacity: number) => void;
  onDeleteBin: (id: string) => void;
  onAddProduct: (sku: string, barcode: string, name: string, price: number, unit: string, category: string, description: string, extra?: Partial<Product>) => void;
  onUpdateProduct: (id: string, sku: string, barcode: string, name: string, price: number, unit: string, category: string, description: string, extra?: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  onAddVendor: (name: string, email: string, scope: string, preferredLang: string) => void;
  onUpdateVendor: (id: string, name: string, email: string, scope: string, preferredLang: string) => void;
  onDeleteVendor: (id: string) => void;
  onAddWarehouse: (name: string, code: string, location: string, description: string) => void;
  onUpdateWarehouse: (id: string, name: string, code: string, location: string, description: string) => void;
  onDeleteWarehouse: (id: string) => void;
  onAddZone: (name: string, warehouseId: string, type: "Cool" | "Dry" | "Hazardous" | "HighValue" | "RetailCounter", capacity: number) => void;
  onUpdateZone: (id: string, name: string, warehouseId: string, type: "Cool" | "Dry" | "Hazardous" | "HighValue" | "RetailCounter", capacity: number) => void;
  onDeleteZone: (id: string) => void;
  lang: string;
  activeSubTab?: "products" | "bins" | "vendors" | "warehouses_zones";
  onChangeSubTab?: (tab: "products" | "bins" | "vendors" | "warehouses_zones") => void;
}

export interface SuggestedUnit {
  value: string;
  labelVi: string;
  labelEn: string;
}

export const SUGGESTED_UNITS: SuggestedUnit[] = [
  { value: "Pcs", labelVi: "Cái", labelEn: "Pcs" },
  { value: "Can", labelVi: "Lon", labelEn: "Can" },
  { value: "Carton", labelVi: "Thùng", labelEn: "Carton" },
  { value: "Box", labelVi: "Hộp", labelEn: "Box" },
  { value: "Bottle", labelVi: "Chai", labelEn: "Bottle" },
  { value: "Tray", labelVi: "Khay", labelEn: "Tray" },
  { value: "Unit", labelVi: "Đơn vị", labelEn: "Unit" },
];

export const STANDARD_UNITS = ["Pcs", "Can", "Carton", "Box", "Bottle", "Tray", "Unit"] as const;

export function formatLocalizedUnit(unit: string | undefined | null, isEn: boolean): string {
  if (!unit) return "—";
  const norm = unit.trim().toLowerCase();

  const unitMapVi: Record<string, string> = {
    pcs: "Cái",
    piece: "Cái",
    pieces: "Cái",
    can: "Lon",
    cans: "Lon",
    carton: "Thùng",
    cartons: "Thùng",
    box: "Hộp",
    boxes: "Hộp",
    bottle: "Chai",
    bottles: "Chai",
    tray: "Khay",
    trays: "Khay",
    unit: "Đơn vị",
    units: "Đơn vị",
  };

  const unitMapEn: Record<string, string> = {
    pcs: "Pcs",
    piece: "Pcs",
    pieces: "Pcs",
    can: "Can",
    cans: "Can",
    carton: "Carton",
    cartons: "Carton",
    box: "Box",
    boxes: "Box",
    bottle: "Bottle",
    bottles: "Bottle",
    tray: "Tray",
    trays: "Tray",
    unit: "Unit",
    units: "Unit",
  };

  if (!isEn && unitMapVi[norm]) {
    return unitMapVi[norm];
  }
  if (isEn && unitMapEn[norm]) {
    return unitMapEn[norm];
  }
  return unit;
}

export default function DBViewer({
  products,
  warehouses = [],
  bins,
  zones,
  vendors = [],
  onAddBin,
  onUpdateBin,
  onDeleteBin,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
  onAddWarehouse,
  onUpdateWarehouse,
  onDeleteWarehouse,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  lang,
  activeSubTab: propsActiveSubTab,
  onChangeSubTab
}: DBViewerProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('vi') ? 'vi' : 'en';
  const isEn = currentLang === 'en';

  const formatCurrency = (valueInVnd: number) => {
    if (currentLang === 'vi') {
      return `${valueInVnd.toLocaleString('vi-VN')} đ`;
    }
    const valueInUsd = Math.round(valueInVnd / 25000);
    return `$${valueInUsd.toLocaleString('en-US')}`;
  };

  const navigate = useNavigate();
  const [internalSubTab, setInternalSubTab] = useState<"products" | "bins" | "vendors" | "warehouses_zones">("products");

  // SKU Master Data Search & Server-Side Pagination State
  const [prodSearch, setProdSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [prodPageIndex, setProdPageIndex] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(10);
  const prodSearchInputRef = React.useRef<HTMLInputElement | null>(null);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(prodSearch.trim());
      setProdPageIndex(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [prodSearch]);

  // STABLE: Server-side paginated products query (GET /api/v1/Products)
  const {
    data: pagedProductsResult,
    isLoading: isLoadingProducts,
    isError: isProductsError,
    error: productsErrorObj,
    refetch: refetchProducts,
    isFetching: isFetchingProducts,
  } = useQuery({
    queryKey: ["products", prodPageIndex, prodPageSize, debouncedSearch],
    queryFn: () =>
      productService.getProducts({
        pageNumber: prodPageIndex,
        pageSize: prodPageSize,
        searchKeyword: debouncedSearch || undefined,
      }),
  });

  // STABLE: Full product list query for accurate KPI metrics (GET /api/v1/Products/list)
  const {
    data: allProductsList = [],
    isLoading: isLoadingAllProducts,
    refetch: refetchAllProducts,
  } = useQuery({
    queryKey: ["products", "list"],
    queryFn: () => productService.getProductsList(),
  });

  // Feature flag check for unverified product mutations
  const allowProductMutations = isProductMutationEnabled();

  // QR Modal and Action State
  const [qrModalData, setQrModalData] = useState<{ sku: string; name: string; qrSrc: string } | null>(null);
  const [isLoadingQrSku, setIsLoadingQrSku] = useState<string | null>(null);
  const [exportSuccessToast, setExportSuccessToast] = useState(false);

  // Barcode Parser modal state (POST /api/v1/Products/parse-barcode)
  const [isBarcodeParserOpen, setIsBarcodeParserOpen] = useState(false);
  const [rawBarcodeInput, setRawBarcodeInput] = useState("");
  const [parsedBarcodeResult, setParsedBarcodeResult] = useState<ParsedBarcodeDto | null>(null);
  const [isParsingBarcode, setIsParsingBarcode] = useState(false);
  const [parseBarcodeError, setParseBarcodeError] = useState<string | null>(null);

  const handleParseBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawBarcodeInput.trim()) return;
    setIsParsingBarcode(true);
    setParseBarcodeError(null);
    try {
      const res = await productService.parseBarcode(rawBarcodeInput.trim());
      setParsedBarcodeResult(res);
    } catch (err: any) {
      setParseBarcodeError(err.message || (isEn ? "Failed to parse barcode data" : "Không thể phân tích dữ liệu mã vạch"));
    } finally {
      setIsParsingBarcode(false);
    }
  };

  const activeSubTab = propsActiveSubTab !== undefined ? propsActiveSubTab : internalSubTab;

  const setActiveSubTab = (tab: "products" | "bins" | "vendors" | "warehouses_zones") => {
    if (onChangeSubTab) {
      onChangeSubTab(tab);
    } else {
      setInternalSubTab(tab);
    }
  };

  // Modal controllers
  const [activeModal, setActiveModal] = useState<"add_product" | "edit_product" | "edit_bin" | "add_vendor" | "edit_vendor" | null>(null);

  const [selectedProductDto, setSelectedProductDto] = useState<ProductDto | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductDto | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [productSubmitError, setProductSubmitError] = useState<string | null>(null);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // Product Form states according to CreateProductRequest & UpdateProductRequest
  const [prodSku, setProdSku] = useState("");
  const [prodBarcode, setProdBarcode] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodUnit, setProdUnit] = useState("Pcs");
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnitText, setCustomUnitText] = useState("");
  const [prodWidth, setProdWidth] = useState<number>(0);
  const [prodHeight, setProdHeight] = useState<number>(0);
  const [prodDepth, setProdDepth] = useState<number>(0);

  const [binCode, setBinCode] = useState("");
  const [binZoneId, setBinZoneId] = useState("");
  const [binMaxCap, setBinMaxCap] = useState(100);

  // Vendor Form states
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorScope, setVendorScope] = useState("National");
  const [vendorLang, setVendorLang] = useState("vi");
  const [vendorPageSize, setVendorPageSize] = useState<number>(10);
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  const [vendorLangFilter, setVendorLangFilter] = useState("all");
  const [viewingVendor, setViewingVendor] = useState<any | null>(null);

  const getVendorDetails = (v: any) => {
    const isVi = (v.preferredLang || "vi").toUpperCase().startsWith("VI");
    return {
      displayCode: v.id,
      name: v.name,
      email: v.email || "—",
      scope: typeof v.scope === "object" ? (isEn ? v.scope.en : v.scope.vi) : (v.scope || (isEn ? "National" : "Toàn quốc")),
      preferredLang: v.preferredLang || "vi",
      langBadge: isVi ? "VI-VN" : "EN-US",
      langTheme: isVi ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-blue-50 text-blue-700 border-blue-200",
      rawVendor: v,
    };
  };

  const filteredVendors = useMemo(() => {
    return (vendors || []).filter((v) => {
      const matchSearch = vendorSearchQuery
        ? v.name?.toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
          v.id?.toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
          v.email?.toLowerCase().includes(vendorSearchQuery.toLowerCase())
        : true;
      const matchLang =
        vendorLangFilter === "all"
          ? true
          : (v.preferredLang || "").toUpperCase() === vendorLangFilter.toUpperCase() ||
            (vendorLangFilter.toUpperCase() === "VI-VN" && (v.preferredLang || "").toUpperCase().startsWith("VI")) ||
            (vendorLangFilter.toUpperCase() === "EN-US" && (v.preferredLang || "").toUpperCase().startsWith("EN"));
      return matchSearch && matchLang;
    });
  }, [vendors, vendorSearchQuery, vendorLangFilter]);

  const totalVendorsCount = (vendors || []).length;
  const vendorsWithEmailCount = (vendors || []).filter((v) => v.email && v.email.trim().length > 0).length;
  const vendorsViCount = (vendors || []).filter((v) => (v.preferredLang || "vi").toUpperCase().startsWith("VI")).length;
  const vendorsEnCount = (vendors || []).filter((v) => (v.preferredLang || "").toUpperCase().startsWith("EN")).length;
  const openAddVendor = () => {
    setSelectedVendor(null);
    setVendorName("");
    setVendorEmail("");
    setVendorScope("Toàn quốc");
    setVendorLang("vi");
    setActiveModal("add_vendor");
  };
  const openEditVendor = (v: any) => {
    setSelectedVendor(v);
    setVendorName(v.name);
    setVendorEmail(v.email);
    setVendorScope(typeof v.scope === "object" ? v.scope.vi : (v.scope || "Toàn quốc"));
    setVendorLang(v.preferredLang || "vi");
    setActiveModal("edit_vendor");
  };

  // Supplier Form states (Strict Backend Contract: code, name, email, phone, address)
  const [supCode, setSupCode] = useState("");
  const [supName, setSupName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDto | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierDto | null>(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);
  const [supplierSubmitError, setSupplierSubmitError] = useState<string | null>(null);

  // Supplier Data Table & Pagination states
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState("");
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [supplierPageIndex, setSupplierPageIndex] = useState<number>(1);
  const [supplierPageSize, setSupplierPageSize] = useState<number>(10);
  const [viewingSupplier, setViewingSupplier] = useState<SupplierDto | null>(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSupplierSearch(supplierSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [supplierSearchQuery]);

  // STABLE: Paginated suppliers query (GET /api/v1/Suppliers)
  const {
    data: pagedSuppliersResult,
    isLoading: isLoadingSuppliers,
    isError: isSuppliersError,
    error: suppliersErrorObj,
    refetch: refetchSuppliers,
    isFetching: isFetchingSuppliers,
  } = useQuery({
    queryKey: ["suppliers", supplierPageIndex, supplierPageSize, debouncedSupplierSearch],
    queryFn: () =>
      supplierService.getSuppliers({
        pageNumber: supplierPageIndex,
        pageSize: supplierPageSize,
        searchKeyword: debouncedSupplierSearch || undefined,
      }),
  });

  // STABLE: Full supplier list query for KPI metrics (GET /api/v1/Suppliers/list)
  const {
    data: allSuppliersList = [],
    isLoading: isLoadingAllSuppliers,
    refetch: refetchAllSuppliers,
  } = useQuery({
    queryKey: ["suppliers", "list"],
    queryFn: () => supplierService.getSuppliersList(),
  });

  // Derived KPI metrics strictly from real backend SupplierDto fields
  const totalSuppliersCount = allSuppliersList.length;
  const suppliersWithEmailCount = allSuppliersList.filter((s) => s.email && s.email.trim().length > 0).length;
  const suppliersWithPhoneCount = allSuppliersList.filter((s) => s.phone && s.phone.trim().length > 0).length;
  const suppliersMissingContactCount = allSuppliersList.filter((s) => !s.email?.trim() || !s.phone?.trim()).length;
  const allowSupplierMutations = isSupplierMutationEnabled();

  // Current page items
  const currentSuppliers: SupplierDto[] = pagedSuppliersResult?.items || [];

  // Bulk select handlers for suppliers
  const isAllSuppliersSelected = currentSuppliers.length > 0 && currentSuppliers.every(s => selectedSupplierIds.includes(s.id));
  const toggleSelectAllSuppliers = () => {
    if (isAllSuppliersSelected) {
      setSelectedSupplierIds([]);
    } else {
      setSelectedSupplierIds(currentSuppliers.map(s => s.id));
    }
  };

  const toggleSelectSupplier = (id: string) => {
    setSelectedSupplierIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };


  // Open modal prefill helpers
  const openAddProduct = () => {
    setSelectedProductDto(null);
    setProductSubmitError(null);
    setProdSku("");
    setProdBarcode("");
    setProdName("");
    setProdDesc("");
    setProdUnit("Pcs");
    setIsCustomUnit(false);
    setCustomUnitText("");
    setProdWidth(0);
    setProdHeight(0);
    setProdDepth(0);
    setActiveModal("add_product");
  };

  const openEditProduct = (p: ProductDto) => {
    setSelectedProductDto(p);
    setProductSubmitError(null);
    setProdSku(p.sku);
    setProdBarcode(p.barcode || "");
    setProdName(p.name);
    setProdDesc(p.description || "");
    const matchingSuggested = SUGGESTED_UNITS.find(
      (u) => u.value.toLowerCase() === (p.unit || "").trim().toLowerCase()
    );
    if (matchingSuggested) {
      setProdUnit(matchingSuggested.value);
      setIsCustomUnit(false);
      setCustomUnitText("");
    } else {
      setProdUnit(p.unit || "");
      setIsCustomUnit(true);
      setCustomUnitText(p.unit || "");
    }
    setProdWidth(0);
    setProdHeight(0);
    setProdDepth(0);
    setActiveModal("edit_product");
  };

  // QR Code Action: loads base64 PNG data URI from backend
  const handleViewQrCode = async (product: ProductDto) => {
    setIsLoadingQrSku(product.sku);
    try {
      const qrDataUri = await productService.getProductQrCode(product.sku);
      const localized = getLocalizedMockProduct(product, currentLang);
      setQrModalData({
        sku: localized.sku,
        name: localized.name,
        qrSrc: qrDataUri,
      });
    } catch (err: any) {
      alert(
        isEn
          ? `Failed to load QR code: ${err.message || "Error"}`
          : `Không thể tải mã QR: ${err.message || "Lỗi máy chủ"}`
      );
    } finally {
      setIsLoadingQrSku(null);
    }
  };

  const openEditBin = (b: Bin) => {
    setSelectedBin(b);
    setBinCode(b.code);
    setBinZoneId(b.zoneId);
    setBinMaxCap(b.maxCapacity);
    setActiveModal("edit_bin");
  };

  const openAddSupplier = () => {
    setSelectedSupplier(null);
    setSupCode(`SUP-${new Date().getFullYear()}-${String(totalSuppliersCount + 1).padStart(3, "0")}`);
    setSupName("");
    setSupEmail("");
    setSupPhone("");
    setSupAddress("");
    setSupplierSubmitError(null);
    setActiveModal("add_supplier" as any);
  };

  const openEditSupplier = (s: SupplierDto) => {
    setSelectedSupplier(s);
    setSupCode(s.code);
    setSupName(s.name);
    setSupEmail(s.email);
    setSupPhone(s.phone);
    setSupAddress(s.address);
    setSupplierSubmitError(null);
    setActiveModal("edit_supplier" as any);
  };

  // Warehouse and Zone management states (strictly conforming to backend DTO contracts)
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseDto | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneDto | null>(null);

  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");
  const [whLocation, setWhLocation] = useState(""); // maps to address

  const [zoneCode, setZoneCode] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [zoneWarehouseId, setZoneWarehouseId] = useState("");

  // Open helpers
  const openAddWarehouse = () => {
    setSelectedWarehouse(null);
    setWhName("");
    setWhCode("");
    setWhLocation("");
    setActiveModal("add_warehouse" as any);
  };

  const getName = (nameObj: any) => {
    if (!nameObj) return "";
    if (typeof nameObj === "string") return nameObj;
    return nameObj[currentLang] || nameObj.vi || nameObj.en || "";
  };

  // Enterprise WMS: Filter & Search states for Warehouses & Zones
  const [whFilterSearch, setWhFilterSearch] = useState("");
  const [whDebouncedSearch, setWhDebouncedSearch] = useState("");
  const [selectedMasterWarehouseId, setSelectedMasterWarehouseId] = useState<string>("");

  // Debounce search input for warehouses (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setWhDebouncedSearch(whFilterSearch.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [whFilterSearch]);

  // STABLE: Server-side queried warehouses list (GET /api/v1/Warehouses/list)
  const {
    data: queriedWarehousesList,
    isLoading: isLoadingWarehouses,
    isError: isWarehousesError,
    error: warehousesErrorObj,
    refetch: refetchWarehouses,
  } = useQuery({
    queryKey: ["warehouses", whDebouncedSearch],
    queryFn: () => warehouseService.getWarehousesList(whDebouncedSearch || undefined),
  });

  const activeWarehouses: WarehouseDto[] = useMemo(() => {
    return queriedWarehousesList || [];
  }, [queriedWarehousesList]);

  // Auto-select first warehouse when list is loaded
  useEffect(() => {
    if (activeWarehouses.length > 0) {
      const exists = activeWarehouses.some((w) => w.id === selectedMasterWarehouseId);
      if (!exists && selectedMasterWarehouseId !== "all") {
        setSelectedMasterWarehouseId(activeWarehouses[0].id);
      }
    }
  }, [activeWarehouses, selectedMasterWarehouseId]);

  // STABLE: Server-side queried zones by warehouse (GET /api/v1/Zones/warehouse/{warehouseId})
  const {
    data: queriedZonesList,
    isLoading: isLoadingZones,
    isError: isZonesError,
    error: zonesErrorObj,
    refetch: refetchZones,
  } = useQuery({
    queryKey: ["zones", selectedMasterWarehouseId],
    queryFn: () => {
      if (selectedMasterWarehouseId && selectedMasterWarehouseId !== "all") {
        return zoneService.getZonesByWarehouse(selectedMasterWarehouseId);
      }
      return zoneService.getZonesList();
    },
    enabled: selectedMasterWarehouseId !== undefined,
  });

  // Query all zones across the system for metrics derivation
  const {
    data: allZonesList,
  } = useQuery({
    queryKey: ["allZonesList"],
    queryFn: () => zoneService.getZonesList(),
  });

  const activeZonesList: ZoneDto[] = useMemo(() => {
    return queriedZonesList || [];
  }, [queriedZonesList]);

  // Bins queried for frontend-derived metrics
  const {
    data: allBinsList,
  } = useQuery({
    queryKey: ["allBinsList"],
    queryFn: () => binService.getBinsList(),
  });

  // Master-detail selected warehouse entity
  const activeWarehouseObj = useMemo(() => {
    if (selectedMasterWarehouseId === "all") return null;
    return (
      activeWarehouses.find(
        (w) => w.id === selectedMasterWarehouseId
      ) || activeWarehouses[0] || null
    );
  }, [activeWarehouses, selectedMasterWarehouseId]);

  const filteredWarehouses = activeWarehouses;
  const filteredZones = useMemo(() => {
    if (!whDebouncedSearch) return activeZonesList;
    const q = whDebouncedSearch.toLowerCase();
    return activeZonesList.filter(
      (z) => z.code.toLowerCase().includes(q) || z.name.toLowerCase().includes(q)
    );
  }, [activeZonesList, whDebouncedSearch]);

  // Derived KPI Stats from active contracts
  const totalWarehousesCount = activeWarehouses.length;
  const totalZonesCount = (allZonesList || []).length;
  const totalOccupancy = (allBinsList || []).reduce((sum, b) => sum + (b.currentOccupancy || 0), 0);
  const totalCapacity = (allBinsList || []).reduce((sum, b) => sum + (b.maxCapacity || 0), 0);
  const avgOccupancyRate = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 1000) / 10 : 0;
  const nearFullBinsCount = (allBinsList || []).filter((b) => {
    const cap = b.maxCapacity || 0;
    const occ = b.currentOccupancy || 0;
    if (cap <= 0) return false;
    const pct = (occ / cap) * 100;
    return pct >= 80 && pct < 100;
  }).length;

  const openEditWarehouse = (w: WarehouseDto) => {
    setSelectedWarehouse(w);
    setWhName(w.name);
    setWhCode(w.code);
    setWhLocation(w.address);
    setActiveModal("edit_warehouse" as any);
  };

  const openAddZone = () => {
    setSelectedZone(null);
    setZoneCode("");
    setZoneName("");
    setZoneWarehouseId(
      selectedMasterWarehouseId && selectedMasterWarehouseId !== "all"
        ? selectedMasterWarehouseId
        : (activeWarehouses[0]?.id || "")
    );
    setActiveModal("add_zone" as any);
  };

  const openEditZone = (z: ZoneDto) => {
    setSelectedZone(z);
    setZoneCode(z.code);
    setZoneName(z.name);
    setZoneWarehouseId(z.warehouseId);
    setActiveModal("edit_zone" as any);
  };

  const handleWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim() || !whLocation.trim()) {
      alert(isEn ? "Warehouse Code, Name, and Location are required." : "Vui lòng nhập đầy đủ Mã Nhà Kho, Tên Nhà Kho và Vị Trí / Địa Chỉ.");
      return;
    }

    if (!isLocationMockMode() && !isLocationMutationEnabled()) {
      alert(
        isEn
          ? "⚠️ Backend warehouse mutations are pending retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false).\nRequest was NOT submitted to the server."
          : "⚠️ Chức năng thay đổi dữ liệu nhà kho đang chờ kiểm thử lại (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false).\nYêu cầu KHÔNG được gửi đến máy chủ backend."
      );
      return;
    }

    try {
      if (!selectedWarehouse) {
        await warehouseService.createWarehouse({
          code: whCode.trim().toUpperCase(),
          name: whName.trim(),
          address: whLocation.trim(),
        });
      } else {
        await warehouseService.updateWarehouse(selectedWarehouse.id, {
          id: selectedWarehouse.id,
          code: whCode.trim().toUpperCase(),
          name: whName.trim(),
          address: whLocation.trim(),
        });
      }
      refetchWarehouses();
      setActiveModal(null);
    } catch (err: any) {
      alert(err.message || (isEn ? "Operation failed" : "Thao tác thất bại"));
    }
  };

  const handleZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim() || !zoneCode.trim() || !zoneWarehouseId) {
      alert(isEn ? "Zone Code, Name and Warehouse are required." : "Vui lòng nhập đầy đủ mã phân khu, tên phân khu và chọn nhà kho.");
      return;
    }

    if (!isLocationMockMode() && !isLocationMutationEnabled()) {
      alert(
        isEn
          ? "⚠️ Backend zone mutations are pending retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false).\nRequest was NOT submitted to the server."
          : "⚠️ Chức năng thay đổi dữ liệu phân khu đang chờ kiểm thử lại (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false).\nYêu cầu KHÔNG được gửi đến máy chủ backend."
      );
      return;
    }

    try {
      if (!selectedZone) {
        await zoneService.createZone({
          code: zoneCode.trim().toUpperCase(),
          name: zoneName.trim(),
          warehouseId: zoneWarehouseId,
        });
      } else {
        await zoneService.updateZone(selectedZone.id, {
          id: selectedZone.id,
          code: zoneCode.trim().toUpperCase(),
          name: zoneName.trim(),
        });
      }
      refetchZones();
      setActiveModal(null);
    } catch (err: any) {
      alert(err.message || (isEn ? "Operation failed" : "Thao tác thất bại"));
    }
  };

  // Submit action triggers for Product Master Data
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodSku.trim() || !prodName.trim() || !prodUnit.trim()) {
      setProductSubmitError(t("products.createModal.validationRequired", isEn ? "Please fill in all required fields (*)" : "Vui lòng nhập đầy đủ các thông tin bắt buộc (*)"));
      return;
    }

    // Gate unverified mutations when in API mode
    if (!isMockMode() && !allowProductMutations) {
      return;
    }

    setIsSubmittingProduct(true);
    setProductSubmitError(null);

    try {
      if (activeModal === "add_product") {
        await productService.createProduct({
          sku: prodSku.trim().toUpperCase(),
          barcode: prodBarcode.trim(),
          name: prodName.trim(),
          description: prodDesc.trim(),
          unit: prodUnit.trim(),
          width: Number(prodWidth) || 0,
          height: Number(prodHeight) || 0,
          depth: Number(prodDepth) || 0,
        });
      } else if (activeModal === "edit_product" && selectedProductDto) {
        await productService.updateProduct(selectedProductDto.id, {
          id: selectedProductDto.id,
          sku: prodSku.trim().toUpperCase(),
          barcode: prodBarcode.trim(),
          name: prodName.trim(),
          description: prodDesc.trim(),
          unit: prodUnit.trim(),
        });
      }

      refetchProducts();
      refetchAllProducts();
      setActiveModal(null);
    } catch (err: any) {
      setProductSubmitError(err.message || (isEn ? "Operation failed" : "Thao tác thất bại"));
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleBinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!binCode || !binZoneId) {
      alert(isEn ? "Please fill in all fields" : "Vui lòng nhập đầy đủ thông tin");
      return;
    }
    if (activeModal === "edit_bin" && selectedBin) {
      onUpdateBin(selectedBin.id, binCode, binZoneId, binMaxCap);
    }
    setActiveModal(null);
  };

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName || !vendorEmail) {
      alert(isEn ? "Please fill in all required fields" : "Vui lòng nhập đầy đủ các thông tin bắt buộc");
      return;
    }
    if (activeModal === "add_vendor") {
      onAddVendor(vendorName, vendorEmail, vendorScope, vendorLang);
    } else if (activeModal === "edit_vendor" && selectedVendor) {
      onUpdateVendor(selectedVendor.id, vendorName, vendorEmail, vendorScope, vendorLang);
    }
    setActiveModal(null);
  };

  // Product delete action triggers confirmation modal
  const handleDeleteProduct = (p: ProductDto) => {
    if (!isMockMode() && !allowProductMutations) {
      return;
    }
    setProductToDelete(p);
  };

  // Keyboard shortcut Ctrl+K / Cmd+K to focus SKU search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (activeSubTab === "products") {
          e.preventDefault();
          prodSearchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSubTab]);

  // Product KPI metrics truthfully derived from ProductDto[] (GET /api/v1/Products/list)
  const totalSkusCount = allProductsList.length;
  const skusWithBarcodeCount = allProductsList.filter(
    (p) => p.barcode && p.barcode.trim().length > 0
  ).length;
  const distinctUnitsCount = new Set(
    allProductsList.map((p) => (p.unit || "").trim()).filter(Boolean)
  ).size;
  const skusMissingBarcodeCount = allProductsList.filter(
    (p) => !p.barcode || p.barcode.trim().length === 0
  ).length;

  // Export CSV Handler (Client-side frontend utility from GET /api/v1/Products/list)
  const handleExportCsv = async () => {
    try {
      const list = allProductsList.length > 0 ? allProductsList : await productService.getProductsList();
      if (list.length === 0) {
        alert(isEn ? "No products available to export." : "Không có dữ liệu sản phẩm để xuất tệp.");
        return;
      }

      const headers = [
        "SKU",
        isEn ? "Barcode" : "Mã vạch",
        isEn ? "Product Name" : "Tên sản phẩm",
        isEn ? "Unit" : "Đơn vị tính",
        isEn ? "Weight (kg)" : "Trọng lượng (kg)",
        isEn ? "Description" : "Mô tả",
      ];

      const rows = list.map((rawP) => {
        const p = getLocalizedMockProduct(rawP, currentLang);
        return [
          p.sku,
          p.barcode || "",
          `"${(p.name || "").replace(/"/g, '""')}"`,
          p.unit || "",
          p.weight ?? 0,
          `"${(p.description || "").replace(/"/g, '""')}"`,
        ];
      });

      const csvContent =
        "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `SmartWMS_Products_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccessToast(true);
      setTimeout(() => setExportSuccessToast(false), 3500);
    } catch (err: any) {
      alert(isEn ? `Export failed: ${err.message}` : `Xuất tệp thất bại: ${err.message}`);
    }
  };

  const handleSafeDeleteBin = (b: Bin) => {
    const hasItems = b.currentOccupancy > 0 || (b.storedSkus && b.storedSkus.some(s => s.qty > 0));
    if (hasItems) {
      const itemsSummary = (b.storedSkus || [])
        .filter(s => s.qty > 0)
        .map(s => `${s.sku} (x${s.qty})`)
        .join(", ");
      alert(
        isEn
          ? `⚠️ Cannot delete bin ${b.code}!\nThis bin currently holds ${b.currentOccupancy} items (${itemsSummary || "active stock"}).\nPlease transfer all goods to another location before deleting this bin.`
          : `⚠️ Không thể xóa ô kệ ${b.code}!\nÔ kệ này đang chứa ${b.currentOccupancy} sản phẩm (${itemsSummary || "có hàng tồn"}).\nVui lòng luân chuyển toàn bộ hàng hóa sang ô kệ khác trước khi xóa vị trí này.`
      );
      return;
    }
    if (confirm(isEn ? `Are you sure you want to delete bin ${b.code}?` : `Bạn chắc chắn muốn xóa kệ ${b.code}?`)) {
      onDeleteBin(b.id);
    }
  };

  const handleSafeDeleteWarehouse = async (w: WarehouseDto) => {
    if (!isLocationMockMode() && !isLocationMutationEnabled()) {
      alert(
        isEn
          ? `⚠️ Cannot delete warehouse [${w.code}]: Backend mutations are pending retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false).`
          : `⚠️ Không thể xóa nhà kho [${w.code}]: Thao tác xóa đang chờ kiểm thử lại từ backend (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false).`
      );
      return;
    }

    const childZones = (allZonesList || []).filter(z => z.warehouseId === w.id);
    if (childZones.length > 0) {
      const zoneNames = childZones.map(z => z.name).join(", ");
      alert(
        isEn
          ? `⚠️ Cannot delete warehouse "${w.name}"!\nIt currently contains ${childZones.length} active zone(s): ${zoneNames}.\nPlease reassign or delete these zones first to prevent orphaned records.`
          : `⚠️ Không thể xóa nhà kho "${w.name}"!\nKho này đang chứa ${childZones.length} phân khu đang hoạt động: ${zoneNames}.\nVui lòng xóa hoặc di chuyển các phân khu trước để tránh mồ côi dữ liệu.`
      );
      return;
    }
    if (confirm(isEn ? `Are you sure you want to delete warehouse ${w.name}?` : `Bạn chắc chắn muốn xóa nhà kho ${w.name}?`)) {
      try {
        await warehouseService.deleteWarehouse(w.id);
        refetchWarehouses();
        if (isLocationMockMode()) {
          alert(isEn ? "Deleted preview item (UI Preview Only)" : "Đã cập nhật dữ liệu preview");
        }
      } catch (err: any) {
        alert(err.message || (isEn ? "Delete failed" : "Lỗi khi xóa nhà kho"));
      }
    }
  };

  const handleSafeDeleteZone = async (z: ZoneDto) => {
    if (!isLocationMockMode() && !isLocationMutationEnabled()) {
      alert(
        isEn
          ? `⚠️ Cannot delete zone [${z.code}]: Backend mutations are pending retest (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false).`
          : `⚠️ Không thể xóa phân khu [${z.code}]: Thao tác xóa đang chờ kiểm thử lại từ backend (VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS=false).`
      );
      return;
    }

    const childBins = (allBinsList || []).filter(b => b.zoneId === z.id);
    if (childBins.length > 0) {
      const binCodes = childBins.map(b => b.code).slice(0, 5).join(", ");
      alert(
        isEn
          ? `⚠️ Cannot delete zone "${z.name}"!\nIt currently contains ${childBins.length} storage bin(s) (${binCodes}${childBins.length > 5 ? "..." : ""}).\nPlease remove or reassign all bins first.`
          : `⚠️ Không thể xóa phân khu "${z.name}"!\nPhân khu này đang chứa ${childBins.length} ô kệ (${binCodes}${childBins.length > 5 ? "..." : ""}).\nVui lòng xóa hoặc luân chuyển toàn bộ các ô kệ trước.`
      );
      return;
    }
    if (confirm(isEn ? `Are you sure you want to delete zone ${z.name}?` : `Bạn chắc chắn muốn xóa phân khu ${z.name}?`)) {
      try {
        await zoneService.deleteZone(z.id);
        refetchZones();
        if (isLocationMockMode()) {
          alert(isEn ? "Deleted preview item (UI Preview Only)" : "Đã cập nhật dữ liệu preview");
        }
      } catch (err: any) {
        alert(err.message || (isEn ? "Delete failed" : "Lỗi khi xóa phân khu"));
      }
    }
  };

  // Create new bin simulation state
  const [newBinCode, setNewBinCode] = useState("D2-A03-N03");
  const [newBinZone, setNewBinZone] = useState("z2");
  const [binWidthCm, setBinWidthCm] = useState(120);
  const [binHeightCm, setBinHeightCm] = useState(80);
  const [binDepthCm, setBinDepthCm] = useState(100);

  // Suggested Capacity AI calculation
  const calculatedCapacityPieces = Math.round((binWidthCm * binHeightCm * binDepthCm) / 6000);

  const handleCreateBin = () => {
    onAddBin(newBinCode, newBinZone, calculatedCapacityPieces);
    setNewBinCode(`D2-A03-N${Math.floor(Math.random() * 90 + 10)}`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">

      {/* Sub menu controls when rendered without explicit activeSubTab */}
      {!propsActiveSubTab && (
        <div className="flex border-b border-slate-200 gap-4 text-sm font-semibold select-none">
          <button
            onClick={() => setActiveSubTab("products")}
            className={`pb-2.5 transition border-b-2 flex items-center ${
              activeSubTab === "products" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Package className="w-4 h-4 mr-1.5 text-blue-500" strokeWidth={1.75} />
            <span>{isEn ? "Registered SKUs Product Catalog" : "Danh Mục Sản Phẩm (SKU)"}</span>
          </button>
          <button
            onClick={() => setActiveSubTab("bins")}
            className={`pb-2.5 transition border-b-2 flex items-center ${
              activeSubTab === "bins" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MapPin className="w-4 h-4 mr-1.5 text-amber-500" strokeWidth={1.75} />
            <span>{isEn ? "Shelf Locations (Bins Layout)" : "Vị Trí Lưu Kho (Kệ/Bin)"}</span>
          </button>
          <button
            onClick={() => setActiveSubTab("vendors")}
            className={`pb-2.5 transition border-b-2 flex items-center ${
              activeSubTab === "vendors" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Handshake className="w-5 h-5 text-amber-500 mr-2" /> {isEn ? "Supplier Vendors" : "Đối Tác Cung Ứng (Vendors)"}
          </button>
          <button
            onClick={() => setActiveSubTab("warehouses_zones")}
            className={`pb-2.5 transition border-b-2 flex items-center ${
              activeSubTab === "warehouses_zones" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <WarehouseIcon className="w-5 h-5 text-blue-500 mr-2" /> {isEn ? "Warehouses & Zones" : "Quản Lý Nhà Kho & Phân Khu"}
          </button>
        </div>
      )}

      {/* ENTERPRISE WMS HEADER & KPI BAR FOR WAREHOUSES & ZONES */}
      {activeSubTab === "warehouses_zones" && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          {/* 1. Page Title Header (Content starts directly without duplicate breadcrumb) */}
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight leading-snug">
              {isEn ? "Warehouses & Storage Zones" : "Nhà Kho & Phân Khu"}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              {isEn
                ? "Manage warehouse structures, storage zones, and capacity utilization."
                : "Quản lý cấu trúc nhà kho, phân khu và mức sử dụng sức chứa."}
            </p>
          </div>

          {/* 2. KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Thẻ 1: TỔNG SỐ NHÀ KHO */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {isEn ? "Total Warehouses" : "Tổng số nhà kho"}
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">
                    {totalWarehousesCount} <span className="text-xs font-normal text-slate-500">{isEn ? "facilities" : "nhà kho"}</span>
                  </h3>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100/80">
                  <WarehouseIcon className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                <span>
                  {isEn ? `${totalWarehousesCount} warehouses in the system` : `${totalWarehousesCount} nhà kho trong hệ thống`}
                </span>
              </div>
            </div>

            {/* Thẻ 2: TỔNG SỐ PHÂN KHU */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {isEn ? "Total Storage Zones" : "Tổng số phân khu"}
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">
                    {totalZonesCount} <span className="text-xs font-normal text-slate-500">{isEn ? "zones" : "phân khu"}</span>
                  </h3>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100/80">
                  <Layers className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                <span>
                  {isEn ? `${totalZonesCount} zones configured` : `${totalZonesCount} phân khu thiết lập`}
                </span>
              </div>
            </div>

            {/* Thẻ 3: MỨC SỬ DỤNG TRUNG BÌNH */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {isEn ? "Avg Occupancy Rate" : "Mức sử dụng trung bình"}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-bold text-slate-900 font-sans">
                      {avgOccupancyRate}%
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                      avgOccupancyRate < 80
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                        : avgOccupancyRate < 100
                        ? "bg-amber-50 text-amber-700 border-amber-200/80"
                        : "bg-rose-50 text-rose-700 border-rose-200/80"
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {avgOccupancyRate < 80 ? (isEn ? "Available" : "Khả dụng") : avgOccupancyRate < 100 ? (isEn ? "Near Full" : "Sắp đầy") : (isEn ? "Full" : "Đầy")}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100/80">
                  <Gauge className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      avgOccupancyRate < 80 ? "bg-emerald-500" : avgOccupancyRate < 100 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(100, avgOccupancyRate)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>{isEn ? "Occupancy: " : "Đang sử dụng: "}{totalOccupancy.toLocaleString()} / {totalCapacity.toLocaleString()}</span>
                  <span>{avgOccupancyRate}%</span>
                </div>
              </div>
            </div>

            {/* Thẻ 4: Ô KỆ SẮP ĐẦY (>= 80% & < 100%) */}
            <div className="bg-white rounded-xl p-4 border border-amber-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    {isEn ? "Near-Full Bins" : "Ô kệ sắp đầy"}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-bold text-amber-700 font-sans">
                      {nearFullBinsCount} <span className="text-xs font-normal text-amber-600">{isEn ? "bins" : "ô kệ"}</span>
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                      {nearFullBinsCount} / {(allBinsList || []).length}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200/80">
                  <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-amber-100 flex items-center gap-1.5 text-xs text-amber-700 font-sans">
                <span className="font-normal truncate">
                  {isEn ? "Utilization >= 80% and < 100%" : "Tỷ lệ lấp đầy từ 80% đến dưới 100%"}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Thanh Lọc & Tìm Kiếm Nhanh (Filter Bar) */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col gap-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Left filter controls: Search & Master Warehouse */}
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Ô tìm kiếm nhanh */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={whFilterSearch}
                    onChange={(e) => setWhFilterSearch(e.target.value)}
                    placeholder={isEn ? "Search warehouse code, zone name, address..." : "Tìm mã kho, tên phân khu hoặc địa chỉ..."}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:bg-white text-xs pl-9 pr-8 py-2 rounded-lg outline-none transition font-sans"
                  />
                  {whFilterSearch && (
                    <button
                      onClick={() => setWhFilterSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown chọn nhà kho (Master Selector) */}
                <div className="w-full sm:w-auto min-w-[240px]">
                  <select
                    value={selectedMasterWarehouseId}
                    onChange={(e) => setSelectedMasterWarehouseId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 text-xs px-3 py-2 rounded-lg outline-none transition font-sans cursor-pointer font-medium"
                  >
                    <option value="all">{isEn ? "All Warehouses" : "Tất cả nhà kho trong hệ thống"}</option>
                    {activeWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {getLocalizedWarehouseName(w.name, isEn)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reset button when filters are active */}
              {(whFilterSearch || (selectedMasterWarehouseId && selectedMasterWarehouseId !== "all")) && (
                <button
                  onClick={() => {
                    setWhFilterSearch("");
                    setSelectedMasterWarehouseId("all");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer shrink-0 border border-slate-200 bg-white"
                  title={isEn ? "Reset filters" : "Đặt lại bộ lọc"}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isEn ? "Reset" : "Đặt lại"}</span>
                </button>
              )}
            </div>

            {/* Trạng thái bộ lọc */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 text-slate-600 font-sans">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span className="font-medium text-slate-700">
                  {selectedMasterWarehouseId === "all"
                    ? (isEn ? "All warehouses" : "Tất cả nhà kho")
                    : (activeWarehouseObj
                        ? `${getLocalizedWarehouseName(activeWarehouseObj.name, isEn)} (${activeWarehouseObj.code})`
                        : (isEn ? "Selected warehouse" : "Nhà kho đã chọn"))}
                </span>
              </div>

              <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                <span>{filteredWarehouses.length} {isEn ? "warehouses" : "nhà kho"}</span>
                <span>·</span>
                <span>{filteredZones.length} {isEn ? "zones" : "phân khu"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ENTERPRISE WMS HEADER, 4 KPI CARDS & SEARCH/FILTER TOOLBAR FOR SKU MASTER DATA */}
      {activeSubTab === "products" && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          {/* 1. Page Header (No duplicate breadcrumbs) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-[18px] font-bold text-slate-900 tracking-tight leading-snug">
                {t("products.header.title")}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-sans">
                {t("products.header.subtitle")}
              </p>
            </div>
          </div>

          {/* 2. 4 Summary KPI Cards truthfully derived from ProductDto[] */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 select-none">
            {/* Card 1: Tổng SKU */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition duration-150 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-slate-500 block">
                  {t("products.kpi.totalSkus")}
                </span>
                <div className="text-2xl font-bold text-slate-900 leading-tight">
                  {isLoadingAllProducts ? "..." : `${totalSkusCount} SKU`}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
                <Package className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>

            {/* Card 2: SKU Có Mã Vạch */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition duration-150 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-slate-500 block">
                  {t("products.kpi.withBarcode")}
                </span>
                <div className="text-2xl font-bold text-slate-900 leading-tight">
                  {isLoadingAllProducts ? "..." : `${skusWithBarcodeCount} SKU`}
                </div>
                <div className="text-xs text-slate-500 font-sans pt-0.5 truncate">
                  {t("products.kpi.withBarcodeCoverage", {
                    rate: totalSkusCount > 0 ? Math.round((skusWithBarcodeCount / totalSkusCount) * 100) : 0,
                  })}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shrink-0">
                <Barcode className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>

            {/* Card 3: Đơn Vị Tính Đang Dùng */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition duration-150 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-slate-500 block">
                  {t("products.kpi.activeUnits")}
                </span>
                <div className="text-2xl font-bold text-slate-900 leading-tight">
                  {isLoadingAllProducts ? "..." : `${distinctUnitsCount} ${isEn ? "Units" : "đơn vị tính"}`}
                </div>
                <div className="text-xs text-slate-500 font-sans pt-0.5 truncate">
                  {t("products.kpi.activeUnitsSub")}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
                <Layers className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>

            {/* Card 4: SKU Thiếu Mã Vạch */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition duration-150 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-slate-500 block">
                  {t("products.kpi.missingBarcode")}
                </span>
                <div className={`text-2xl font-bold leading-tight ${skusMissingBarcodeCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {isLoadingAllProducts ? "..." : `${skusMissingBarcodeCount} SKU`}
                </div>
                <div className="text-xs text-slate-500 font-sans pt-0.5 truncate">
                  {skusMissingBarcodeCount === 0
                    ? t("products.kpi.allBarcodesOk")
                    : t("products.kpi.requiresBarcode")}
                </div>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                skusMissingBarcodeCount > 0
                  ? "bg-rose-50 border-rose-200/80 text-rose-600"
                  : "bg-emerald-50 border-emerald-200/80 text-emerald-600"
              }`}>
                <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>
          </div>

          {/* 3. Toolbar: Search, Refresh, Parse Barcode, Export CSV, Add Product */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
                </div>
                <input
                  ref={prodSearchInputRef}
                  type="text"
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder={t("products.toolbar.searchPlaceholder")}
                  className="w-full pl-9 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-inner-2xs"
                />
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
                  {prodSearch && (
                    <button
                      onClick={() => {
                        setProdSearch("");
                        setProdPageIndex(1);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      title={t("products.toolbar.clearSearch")}
                      aria-label={t("products.toolbar.clearSearch")}
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  )}
                  <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs select-none">
                    Ctrl+K
                  </kbd>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                {/* Refresh Button */}
                <button
                  onClick={() => {
                    refetchProducts();
                    refetchAllProducts();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={t("products.toolbar.refresh")}
                >
                  <RefreshCw className={`w-3.5 h-3.5 stroke-[1.75] ${isFetchingProducts ? "animate-spin text-blue-600" : ""}`} />
                  <span>{t("products.toolbar.refresh")}</span>
                </button>

                {/* Parse Barcode Button */}
                <button
                  onClick={() => {
                    setRawBarcodeInput("");
                    setParsedBarcodeResult(null);
                    setParseBarcodeError(null);
                    setIsBarcodeParserOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={t("products.toolbar.parseBarcode")}
                >
                  <Barcode className="w-3.5 h-3.5 text-indigo-600" strokeWidth={1.75} />
                  <span>{t("products.toolbar.parseBarcode")}</span>
                </button>

                {/* Export CSV Button */}
                <button
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={t("products.toolbar.exportCsv")}
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
                  <span>{t("products.toolbar.exportCsv")}</span>
                </button>

                {/* Add Product Button */}
                <button
                  onClick={openAddProduct}
                  disabled={!isMockMode() && !allowProductMutations}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition duration-150 shadow-sm cursor-pointer active:scale-95"
                  title={!isMockMode() && !allowProductMutations ? t("products.table.actions.actionUnavailable") : undefined}
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>{t("products.toolbar.addProduct")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Enterprise Product Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Table Header Top Bar */}
            <div className="p-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2.5">
                <Package className="h-4 w-4 text-blue-600" strokeWidth={1.75} />
                <h3 className="font-sans font-bold text-slate-800 text-xs">
                  {t("products.table.title")}
                </h3>
                {isFetchingProducts && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                )}
              </div>
              <span className="text-[11px] font-mono font-medium text-slate-500">
                {debouncedSearch
                  ? t("products.toolbar.matchingSearch", { count: pagedProductsResult?.totalCount ?? 0 })
                  : t("products.toolbar.totalInSystem", { count: pagedProductsResult?.totalCount ?? 0 })}
              </span>
            </div>

            {/* Enterprise Grid Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-sans text-[11px] font-semibold border-b border-slate-200">
                    {/* Column 1: SKU */}
                    <th className="py-3 px-4 whitespace-nowrap">
                      {t("products.table.headers.sku")}
                    </th>

                    {/* Column 2: BARCODE */}
                    <th className="py-3 px-4 whitespace-nowrap">
                      {t("products.table.headers.barcode")}
                    </th>

                    {/* Column 3: TÊN SẢN PHẨM & MÔ TẢ */}
                    <th className="py-3 px-4 min-w-[260px]">
                      {t("products.table.headers.nameDesc")}
                    </th>

                    {/* Column 4: ĐƠN VỊ TÍNH */}
                    <th className="py-3 px-4 text-center whitespace-nowrap">
                      {t("products.table.headers.unit")}
                    </th>

                    {/* Column 5: TRỌNG LƯỢNG */}
                    <th className="py-3 px-4 text-right whitespace-nowrap">
                      {t("products.table.headers.weight")}
                    </th>

                    {/* Column 6: THAO TÁC */}
                    <th className="py-3 px-4 text-right whitespace-nowrap">
                      {t("products.table.headers.actions")}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* Loading State: Skeletons */}
                  {isLoadingProducts && (
                    <>
                      {[...Array(6)].map((_, i) => (
                        <tr key={`skeleton-${i}`} className="animate-pulse">
                          <td className="py-4 px-4">
                            <div className="w-20 h-5 bg-slate-200 rounded" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-28 h-4 bg-slate-200 rounded" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-48 h-4 bg-slate-200 rounded mb-1.5" />
                            <div className="w-32 h-3 bg-slate-100 rounded" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="w-12 h-4 bg-slate-200 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="w-14 h-4 bg-slate-200 rounded ml-auto" />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="w-20 h-6 bg-slate-200 rounded ml-auto" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Error State */}
                  {!isLoadingProducts && isProductsError && (
                    <tr>
                      <td colSpan={6} className="py-12 px-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                          <AlertCircle className="w-6 h-6" strokeWidth={1.75} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">
                          {(productsErrorObj as any)?.isAuthError
                            ? t("products.states.error401")
                            : (productsErrorObj as any)?.isForbidden
                            ? t("products.states.error403")
                            : t("products.states.errorTitle")}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                          {t("products.states.errorSubtitle")}
                        </p>
                        <button
                          onClick={() => {
                            refetchProducts();
                            refetchAllProducts();
                          }}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{t("products.states.retry")}</span>
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Empty State */}
                  {!isLoadingProducts && !isProductsError && (pagedProductsResult?.items.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Package className="w-9 h-9 text-slate-300" strokeWidth={1.5} />
                          <p className="text-sm font-semibold text-slate-700">
                            {debouncedSearch
                              ? t("products.states.emptySearch")
                              : t("products.states.empty")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {debouncedSearch
                              ? t("products.states.emptySearchSub", { keyword: debouncedSearch })
                              : t("products.states.emptySub")}
                          </p>
                          {debouncedSearch && (
                            <button
                              onClick={() => {
                                setProdSearch("");
                                setProdPageIndex(1);
                              }}
                              className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                            >
                              {t("products.toolbar.clearSearch")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Populated Data Rows */}
                  {!isLoadingProducts &&
                    !isProductsError &&
                    (pagedProductsResult?.items || []).map((rawP: ProductDto) => {
                      const p = getLocalizedMockProduct(rawP, currentLang);

                      return (
                        <tr
                          key={p.id}
                          className="transition-colors border-b border-slate-100/80 hover:bg-slate-50/70"
                        >
                          {/* SKU */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center font-mono font-bold text-xs px-2.5 py-1 rounded bg-slate-100/90 text-blue-700 border border-slate-200/90 shadow-2xs tracking-wide">
                              {p.sku}
                            </span>
                          </td>

                          {/* BARCODE */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {p.barcode ? (
                              <span className="font-mono text-slate-700 font-semibold text-xs tracking-normal">
                                {p.barcode}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
                                {t("products.table.noBarcode")}
                              </span>
                            )}
                          </td>

                          {/* TÊN SẢN PHẨM & MÔ TẢ */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[13px] text-slate-900 leading-snug">
                              {p.name}
                            </div>
                            <div className="text-[12px] text-slate-500 mt-0.5 leading-normal line-clamp-1">
                              {p.description || t("products.table.emptyDescription")}
                            </div>
                          </td>

                          {/* ĐƠN VỊ TÍNH */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono font-semibold text-slate-700 text-xs">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/80 text-slate-700">
                              {formatLocalizedUnit(p.unit, isEn)}
                            </span>
                          </td>

                          {/* TRỌNG LƯỢNG */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono text-slate-700 text-xs font-medium">
                            {p.weight !== undefined && p.weight !== null ? `${p.weight} kg` : "—"}
                          </td>

                          {/* THAO TÁC */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Xem mã QR */}
                              <button
                                onClick={() => handleViewQrCode(p)}
                                disabled={isLoadingQrSku === p.sku}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                                title={t("products.table.actions.viewQr")}
                                aria-label={t("products.table.actions.viewQr")}
                              >
                                {isLoadingQrSku === p.sku ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                ) : (
                                  <QrCode className="w-4 h-4" strokeWidth={1.75} />
                                )}
                              </button>

                              {/* In tem mã vạch */}
                              <button
                                onClick={() => {
                                  navigate("/dashboard/mdm/print-labels", { state: { selectedSku: p.sku } });
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-lg transition-all cursor-pointer"
                                title={t("products.table.actions.printLabels")}
                                aria-label={t("products.table.actions.printLabels")}
                              >
                                <Printer className="w-4 h-4" strokeWidth={1.75} />
                              </button>

                              {/* Chỉnh sửa sản phẩm */}
                              <button
                                onClick={() => openEditProduct(p)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-lg transition-all cursor-pointer"
                                title={t("products.table.actions.edit")}
                                aria-label={t("products.table.actions.edit")}
                              >
                                <Edit3 className="w-4 h-4" strokeWidth={1.75} />
                              </button>

                              {/* Xóa sản phẩm */}
                              {!isMockMode() && !allowProductMutations ? (
                                <button
                                  disabled
                                  className="p-1.5 text-slate-300 rounded-lg cursor-not-allowed opacity-50"
                                  title={t("products.table.actions.actionUnavailable")}
                                  aria-label={t("products.table.actions.delete")}
                                >
                                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDeleteProduct(p)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg transition-all cursor-pointer"
                                  title={t("products.table.actions.delete")}
                                  aria-label={t("products.table.actions.delete")}
                                >
                                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Server-Side Pagination Footer */}
            <PaginationFooter
              pageIndex={pagedProductsResult?.pageIndex || prodPageIndex}
              pageSize={pagedProductsResult?.pageSize || prodPageSize}
              totalCount={pagedProductsResult?.totalCount || 0}
              totalPages={pagedProductsResult?.totalPages || 1}
              onPageChange={(page) => setProdPageIndex(page)}
              onPageSizeChange={(size) => {
                setProdPageSize(size);
                setProdPageIndex(1);
              }}
            />
          </div>
        </div>
      )}

      {/* SUB-PANEL: BINS SETUP */}
      {activeSubTab === "bins" && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          {/* 1. Breadcrumb & Page Header */}
          <div className="flex flex-col gap-2">
            <nav className="flex items-center gap-1.5 text-xs text-slate-500 select-none">
              <button
                onClick={() => navigate("/dashboard")}
                className="hover:text-blue-600 transition flex items-center gap-1 text-slate-500 hover:underline cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>{isEn ? "System" : "Hệ thống"}</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                onClick={() => navigate("/dashboard/mdm/warehouses_zones")}
                className="hover:text-blue-600 transition text-slate-500 hover:underline cursor-pointer"
              >
                {isEn ? "System Master Data" : "Danh Mục Hệ Thống"}
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800">
                {isEn ? "Storage Bins & Shelf Locations" : "Vị Trí Ô Kệ & Điểm Lưu Kho"}
              </span>
            </nav>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-1">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-[18px] font-bold text-slate-900 tracking-tight leading-snug">
                    {isEn ? "Storage Bins & Shelf Locations Management" : "Quản Lý Vị Trí Ô Kệ & Điểm Lưu Kho"}
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
                    {isEn ? `${bins.length} Shelf Bins` : `${bins.length} Ô Kệ`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-sans">
                  {isEn
                    ? "Manage physical storage rack bins, calculate piece capacity, and monitor rack fill rate."
                    : "Quản lý hệ thống ô kệ vật lý, tính toán sức chứa định mức và giám sát tỷ lệ lấp đầy theo phân khu."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* List (Left) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-7 animate-fadeIn enterprise-table">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <span className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider block">
                  {isEn ? "Physical Bin grid allocations" : "Vị Trí Kệ Hàng Bin Quy Trình"}
                </span>
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {bins.length} {isEn ? "locations" : "vị trí"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-sans text-[11px] font-bold border-b border-slate-200 uppercase tracking-wider">
                      <th className="py-3 px-4 font-bold">{isEn ? "Bin Code" : "Mã kệ"}</th>
                      <th className="py-3 px-4 font-bold">{isEn ? "Zone" : "Phân khu"}</th>
                      <th className="py-3 px-4 font-bold text-right">{isEn ? "Max Capacity" : "Sức chứa tối đa"}</th>
                      <th className="py-3 px-4 font-bold text-right">{isEn ? "Occupancy" : "Độ lấp đầy"}</th>
                      <th className="py-3 px-4 font-bold text-center">{isEn ? "Status" : "Trạng thái"}</th>
                      <th className="py-3 px-4 font-bold text-right">{isEn ? "Actions" : "Thao tác"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {bins.map(b => {
                      const zone = zones.find(z => z.id === b.zoneId);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-blue-600 font-mono">{b.code}</td>
                          <td className="py-3 px-4 text-slate-600 font-sans">{zone ? getName(zone.name) : (b.zoneId || "—")}</td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">{b.maxCapacity} pcs</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">{b.currentOccupancy} pcs</td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge
                              variant={b.status === "empty" ? "success" : b.status === "full" ? "danger" : "warning"}
                              label={b.status === "empty" ? (isEn ? "Empty" : "Trống") : b.status === "full" ? (isEn ? "Full" : "Đầy") : (isEn ? "Partial" : "Có hàng")}
                              size="sm"
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditBin(b)}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-lg transition cursor-pointer"
                                title={isEn ? "Edit" : "Sửa"}
                                aria-label={isEn ? "Edit Bin" : "Sửa Ô Kệ"}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSafeDeleteBin(b)}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg transition cursor-pointer"
                                title={isEn ? "Delete" : "Xóa"}
                                aria-label={isEn ? "Delete Bin" : "Xóa Ô Kệ"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          {/* Smart AI suggested bin creator (Right) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500" />
                <h3 className="font-sans font-bold text-slate-800 text-sm">
                  {isEn ? "Add Layout Location (Smart Calculator)" : "Thêm Vị Trí Kệ (Nhập Thả Thước Đo)"}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed text-justify">
                {isEn
                  ? "When configuring a new rack location, the AI agent calculates the optimal safety weight capacity based on actual cubic space measurements."
                  : "Thiết lập Bin mới có thể ước tính dung lượng chứa hàng tối đa dựa vào thước đo vật lý dài x rộng x cao, tránh sập kệ hoặc quá tải."}
              </p>
            </div>

            <div className="space-y-3 text-xs font-sans">

              <div>
                <label className="text-[10px] font-mono text-slate-500 font-bold uppercase block mb-1">
                  {isEn ? "Bin Code" : "Mã định danh ô kệ"}
                </label>
                <input
                  type="text"
                  value={newBinCode}
                  onChange={(e) => setNewBinCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-500 font-bold uppercase block mb-1">
                  {isEn ? "Storage Zone" : "Chỉ định phân khu"}
                </label>
                <select
                  value={newBinZone}
                  onChange={(e) => setNewBinZone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono outline-none"
                >
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{getName(z.name)}</option>
                  ))}
                </select>
              </div>

              {/* Physical Dimension inputs */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-1">{isEn ? "Width (cm)" : "Chiều rộng (cm)"}</label>
                  <input
                    type="number"
                    value={binWidthCm}
                    onChange={(e) => setBinWidthCm(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 font-mono text-center outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-1">{isEn ? "Height (cm)" : "Chiều cao (cm)"}</label>
                  <input
                    type="number"
                    value={binHeightCm}
                    onChange={(e) => setBinHeightCm(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 font-mono text-center outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-1">{isEn ? "Depth (cm)" : "Chiều sâu (cm)"}</label>
                  <input
                    type="number"
                    value={binDepthCm}
                    onChange={(e) => setBinDepthCm(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 font-mono text-center outline-none"
                  />
                </div>
              </div>

              {/* suggested output container */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-blue-850 font-semibold font-sans">
                  <Scale className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  <span>{isEn ? "Optimal Piece Capacity suggested by AI:" : "Đóng góp tối ưu dung lượng chứa (AI gợi ý):"}</span>
                </div>
                <span className="font-mono font-bold text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded text-sm">
                  {calculatedCapacityPieces} {isEn ? "pcs" : "cái"}
                </span>
              </div>

              <button
                onClick={handleCreateBin}
                disabled={!isLocationMockMode() && !isLocationMutationEnabled()}
                title={!isLocationMockMode() && !isLocationMutationEnabled() ? (isEn ? "Feature is being synchronized with the server" : "Chức năng đang được đồng bộ hóa với máy chủ") : undefined}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? "Add Location" : "Tạo ô kệ mới"}</span>
              </button>

            </div>

          </div>
        </div>
      </div>
    )}

      {/* SUB-PANEL: SUPPLIER VENDORS (ENTERPRISE DATA TABLE) */}
      {activeSubTab === "vendors" && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          {/* 1. Page Header (No local breadcrumb) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-[18px] font-bold text-slate-900 tracking-tight leading-snug">
                {isEn ? "Suppliers" : "Nhà cung cấp"}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-sans">
                {isEn
                  ? "Manage contact information, distribution scope, and communication languages for suppliers."
                  : "Quản lý thông tin liên hệ, phạm vi cung ứng và ngôn ngữ giao tiếp của nhà cung cấp."}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={openAddVendor}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition duration-150 shadow-sm cursor-pointer active:scale-95 h-9"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                <span>{isEn ? "Add supplier" : "Thêm nhà cung cấp"}</span>
              </button>
            </div>
          </div>

          {/* 2. Summary KPI Cards for Vendors (Only real fields) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 select-none">
            {/* Card 1: Tổng nhà cung cấp */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition duration-150 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-slate-500 block">
                  {isEn ? "Total suppliers" : "Tổng nhà cung cấp"}
                </span>
                <div className="text-2xl font-bold text-slate-900 leading-tight">
                  {totalVendorsCount} {isEn ? "suppliers" : "nhà cung cấp"}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
                <Handshake className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>

            {/* Card 2: Có email liên hệ */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition duration-150 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-slate-500 block">
                  {isEn ? "With contact email" : "Có email liên hệ"}
                </span>
                <div className="text-2xl font-bold text-slate-900 leading-tight">
                  {vendorsWithEmailCount} {isEn ? "suppliers" : "nhà cung cấp"}
                </div>
                <div className="text-xs text-slate-500 font-sans pt-0.5 truncate">
                  {isEn ? "Direct communication email" : "Email trao đổi trực tiếp"}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
                <Mail className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>

            {/* Card 3: Ngôn ngữ giao tiếp VI-VN */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition duration-150 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-slate-500 block">
                  {isEn ? "Vietnamese (VI-VN)" : "Giao tiếp VI-VN"}
                </span>
                <div className="text-2xl font-bold text-slate-900 leading-tight">
                  {vendorsViCount} {isEn ? "suppliers" : "nhà cung cấp"}
                </div>
                <div className="text-xs text-slate-500 font-sans pt-0.5 truncate">
                  {isEn ? `EN-US: ${vendorsEnCount} ${vendorsEnCount === 1 ? "supplier" : "suppliers"}` : `EN-US: ${vendorsEnCount} nhà cung cấp`}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                <Globe className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>
          </div>

          {/* 3. Toolbar: Search & Language Filter */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
                </div>
                <input
                  type="text"
                  value={vendorSearchQuery}
                  onChange={(e) => setVendorSearchQuery(e.target.value)}
                  placeholder={isEn ? "Search by supplier code, name or email..." : "Tìm mã nhà cung cấp, tên hoặc email..."}
                  className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-inner-2xs"
                />
                {vendorSearchQuery && (
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center">
                    <button
                      onClick={() => setVendorSearchQuery("")}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                      title={isEn ? "Clear search" : "Xóa tìm kiếm"}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Language Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={vendorLangFilter}
                  onChange={(e) => setVendorLangFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-500 cursor-pointer font-medium"
                >
                  <option value="all">{isEn ? "All languages" : "Tất cả ngôn ngữ"}</option>
                  <option value="VI-VN">VI - Tiếng Việt</option>
                  <option value="EN-US">EN - English</option>
                </select>

                {(vendorSearchQuery || vendorLangFilter !== "all") && (
                  <button
                    onClick={() => {
                      setVendorSearchQuery("");
                      setVendorLangFilter("all");
                    }}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer text-xs font-semibold flex items-center gap-1"
                    title={isEn ? "Reset filters" : "Làm mới bộ lọc"}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isEn ? "Reset" : "Làm mới"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4. Main Data Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col enterprise-table">
            {/* Table Top Bar */}
            <div className="p-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                  <Handshake className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-800 text-xs">
                    {isEn ? "Supplier List" : "Danh sách nhà cung cấp"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">
                    {isEn
                      ? "Supplier directory currently managed in the system."
                      : "Thông tin nhà cung cấp đang được quản lý trong hệ thống."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                  {isEn ? `${filteredVendors.length} suppliers` : `${filteredVendors.length} nhà cung cấp`}
                </span>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 font-sans text-[11px] font-semibold border-b border-slate-200/80 select-none">
                    {/* Cột 1: Mã nhà cung cấp */}
                    <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">
                      {isEn ? "Supplier Code" : "Mã nhà cung cấp"}
                    </th>

                    {/* Cột 2: Nhà cung cấp */}
                    <th className="py-3 px-4 min-w-[200px]">
                      {isEn ? "Supplier Name" : "Nhà cung cấp"}
                    </th>

                    {/* Cột 3: Email */}
                    <th className="py-3 px-4 min-w-[200px]">
                      {isEn ? "Email" : "Email"}
                    </th>

                    {/* Cột 4: Phạm vi cung ứng */}
                    <th className="py-3 px-4 min-w-[180px]">
                      {isEn ? "Supply Scope" : "Phạm vi cung ứng"}
                    </th>

                    {/* Cột 5: Ngôn ngữ */}
                    <th className="py-3 px-4 text-center min-w-[110px]">
                      {isEn ? "Language" : "Ngôn ngữ"}
                    </th>

                    {/* Cột 6: Thao tác */}
                    <th className="py-3 px-4 text-right min-w-[100px]">
                      {isEn ? "Actions" : "Thao tác"}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredVendors.map((v) => {
                    const d = getVendorDetails(v);

                    return (
                      <tr
                        key={v.id}
                        className="transition-colors duration-150 hover:bg-slate-50/80 border-b border-slate-100"
                      >
                        {/* Cột 1: Mã nhà cung cấp */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200/90 shadow-2xs">
                            {d.displayCode}
                          </span>
                        </td>

                        {/* Cột 2: Nhà cung cấp */}
                        <td className="py-3.5 px-4">
                          <span className="font-sans font-semibold text-[13px] text-slate-900 leading-snug">
                            {d.name}
                          </span>
                        </td>

                        {/* Cột 3: Email */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                            <span className="hover:text-blue-600 select-all">{d.email}</span>
                          </div>
                        </td>

                        {/* Cột 4: Phạm vi cung ứng */}
                        <td className="py-3.5 px-4">
                          <span className="text-slate-700 text-xs font-medium leading-relaxed block max-w-xs">
                            {d.scope}
                          </span>
                        </td>

                        {/* Cột 5: Ngôn ngữ */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold tracking-wider border shadow-2xs ${d.langTheme}`}>
                            {d.langBadge}
                          </span>
                        </td>

                        {/* Cột 6: Thao tác */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewingVendor(d)}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-lg transition cursor-pointer"
                              title={isEn ? "View Supplier Profile" : "Xem chi tiết"}
                              aria-label={isEn ? "View Supplier Profile" : "Xem chi tiết"}
                            >
                              <Eye className="w-4 h-4" strokeWidth={1.5} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditVendor(v)}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-lg transition cursor-pointer"
                              title={isEn ? "Edit Supplier" : "Chỉnh sửa"}
                              aria-label={isEn ? "Edit Supplier" : "Chỉnh sửa"}
                            >
                              <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(isEn ? `Are you sure you want to delete supplier [${d.name}]?` : `Bạn chắc chắn muốn xóa nhà cung cấp [${d.name}]?`)) {
                                  onDeleteVendor(v.id);
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg transition cursor-pointer"
                              title={isEn ? "Delete Supplier" : "Xóa"}
                              aria-label={isEn ? "Delete Supplier" : "Xóa"}
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredVendors.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                        <Handshake className="w-8 h-8 text-slate-300 mx-auto mb-2" strokeWidth={1.5} />
                        <p className="text-xs font-medium text-slate-600">
                          {isEn ? "No suppliers matching search criteria" : "Không tìm thấy nhà cung cấp nào phù hợp"}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {isEn ? "Try adjusting search keyword or language filter" : "Thử thay đổi từ khóa tìm kiếm hoặc làm mới bộ lọc"}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setVendorSearchQuery("");
                            setVendorLangFilter("all");
                          }}
                          className="mt-3 text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          {isEn ? "Reset all filters" : "Xem tất cả nhà cung cấp"}
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Phân Trang */}
            <div className="px-4 py-3 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-sans select-none">
              <div className="text-slate-500 text-xs">
                {isEn
                  ? `Showing 1 to ${filteredVendors.length} of ${filteredVendors.length} results`
                  : `Hiển thị 1 đến ${filteredVendors.length} trong tổng số ${filteredVendors.length} kết quả`}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <select
                    value={vendorPageSize}
                    onChange={(e) => setVendorPageSize(parseInt(e.target.value) || 10)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-blue-500 cursor-pointer font-medium"
                  >
                    <option value={10}>10 / {isEn ? "page" : "trang"}</option>
                    <option value={20}>20 / {isEn ? "page" : "trang"}</option>
                    <option value={50}>50 / {isEn ? "page" : "trang"}</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={true}
                    className="px-2 py-1 rounded border border-slate-200 text-slate-300 cursor-not-allowed text-xs font-mono font-semibold"
                    title={isEn ? "First page" : "Đầu trang"}
                  >
                    &lt;&lt;
                  </button>
                  <button
                    disabled={true}
                    className="px-2 py-1 rounded border border-slate-200 text-slate-300 cursor-not-allowed text-xs font-mono font-semibold"
                    title={isEn ? "Previous page" : "Trang trước"}
                  >
                    &lt;
                  </button>
                  <button
                    className="px-2.5 py-1 rounded border border-blue-600 bg-blue-600 text-white font-bold text-xs"
                  >
                    1
                  </button>
                  <button
                    disabled={true}
                    className="px-2 py-1 rounded border border-slate-200 text-slate-300 cursor-not-allowed text-xs font-mono font-semibold"
                    title={isEn ? "Next page" : "Trang sau"}
                  >
                    &gt;
                  </button>
                  <button
                    disabled={true}
                    className="px-2 py-1 rounded border border-slate-200 text-slate-300 cursor-not-allowed text-xs font-mono font-semibold"
                    title={isEn ? "Last page" : "Cuối trang"}
                  >
                    &gt;&gt;
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Slide-out Drawer: HỒ SƠ NHÀ CUNG CẤP (SUPPLIER PROFILE - ONLY REAL FIELDS) */}
          {viewingVendor && (
            <div className="fixed inset-0 z-50 overflow-hidden flex justify-end font-sans">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
                onClick={() => setViewingVendor(null)}
              />

              {/* Drawer Container */}
              <div className="relative w-full max-w-lg bg-white shadow-2xl h-full flex flex-col z-10 animate-slideLeft border-l border-slate-200">
                {/* Header Drawer */}
                <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0 mt-0.5">
                      <Handshake className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-sans font-bold text-slate-900 text-base leading-snug truncate">
                          {viewingVendor.name}
                        </h2>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/90 shadow-2xs">
                          {viewingVendor.displayCode}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${viewingVendor.langTheme}`}>
                          {viewingVendor.langBadge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-sans">
                        {isEn ? "Supplier Information" : "Hồ sơ nhà cung cấp"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingVendor(null)}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer shrink-0 ml-3"
                    title={isEn ? "Close Drawer" : "Đóng"}
                  >
                    <X className="w-4.5 h-4.5" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Body Drawer */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700 font-sans">
                  <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5">
                      <Building2 className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                      <h3 className="font-bold text-slate-900 text-xs">
                        {isEn ? "Supplier Information" : "Thông tin nhà cung cấp"}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">
                          {isEn ? "Supplier Code" : "Mã nhà cung cấp"}
                        </span>
                        <span className="font-mono font-bold text-slate-800 text-sm">
                          {viewingVendor.displayCode}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">
                          {isEn ? "Preferred Language" : "Ngôn ngữ giao tiếp"}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${viewingVendor.langTheme}`}>
                          {viewingVendor.langBadge}
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">
                          {isEn ? "Supplier Name" : "Tên nhà cung cấp"}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {viewingVendor.name}
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">
                          {isEn ? "Contact Email" : "Email liên hệ"}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-slate-800 text-xs">
                          <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" strokeWidth={1.5} />
                          <span className="select-all font-medium">{viewingVendor.email}</span>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">
                          {isEn ? "Supply Scope" : "Phạm vi cung ứng"}
                        </span>
                        <span className="text-slate-800 text-xs font-medium block">
                          {viewingVendor.scope}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Drawer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewingVendor(null)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer shadow-2xs"
                  >
                    {isEn ? "Close" : "Đóng"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const raw = viewingVendor.rawVendor;
                      setViewingVendor(null);
                      if (raw) {
                        openEditVendor(raw);
                      }
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                    <span>{isEn ? "Edit Supplier" : "Chỉnh sửa"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-PANEL: WAREHOUSES & ZONES MANAGEMENT */}
      {activeSubTab === "warehouses_zones" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fadeIn">

          {/* LEFT COLUMN: WAREHOUSES MASTER SELECTION PANEL */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
            {/* 1. Header Cột & Nút Thêm Mới */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-blue-600" />
                <h3 className="font-sans font-bold text-slate-900 text-xs">
                  {isEn ? "Warehouses" : "Danh sách nhà kho"}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                  {filteredWarehouses.length}
                </span>
              </div>
              <button
                onClick={openAddWarehouse}
                disabled={!isLocationMockMode() && !isLocationMutationEnabled()}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title={!isLocationMockMode() && !isLocationMutationEnabled() ? (isEn ? "Feature is being synchronized with the server" : "Chức năng đang được đồng bộ hóa với máy chủ") : undefined}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isEn ? "Add Warehouse" : "Thêm Nhà Kho"}</span>
              </button>
            </div>

            {/* 2. Danh sách Thẻ Nhà Kho tương tác (Warehouse Interactive Cards) */}
            <div className="p-4 space-y-3">
              {isLoadingWarehouses && (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <p className="text-xs font-medium">{isEn ? "Loading warehouses..." : "Đang tải danh sách nhà kho..."}</p>
                </div>
              )}

              {isWarehousesError && !isLoadingWarehouses && (
                <div className="p-5 text-center text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
                  <p className="text-xs font-semibold mb-2">
                    {warehousesErrorObj instanceof Error ? warehousesErrorObj.message : (isEn ? "Failed to load warehouses" : "Lỗi khi tải danh sách nhà kho")}
                  </p>
                  <button
                    onClick={() => refetchWarehouses()}
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer"
                  >
                    {isEn ? "Retry" : "Thử lại"}
                  </button>
                </div>
              )}

              {!isLoadingWarehouses && !isWarehousesError && filteredWarehouses.map(w => {
                const childZones = (allZonesList || []).filter(z => z.warehouseId === w.id);
                const zonesCount = childZones.length;
                const childZoneIds = new Set(childZones.map(z => z.id));
                const childBins = (allBinsList || []).filter(b => childZoneIds.has(b.zoneId));
                const binsCount = childBins.length;
                const maxCap = childBins.reduce((sum, b) => sum + (b.maxCapacity || 0), 0);
                const curOcc = childBins.reduce((sum, b) => sum + (b.currentOccupancy || 0), 0);
                const utilPct = maxCap > 0 ? Math.round((curOcc / maxCap) * 100) : 0;
                const isSelected = selectedMasterWarehouseId === w.id;

                return (
                  <div
                    key={w.id}
                    onClick={() => setSelectedMasterWarehouseId(w.id)}
                    className={`p-3.5 rounded-xl transition duration-150 relative cursor-pointer ${
                      isSelected
                        ? "border border-blue-500 bg-blue-50/50 shadow-2xs"
                        : "border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-2xs"
                    }`}
                  >
                    {/* Dòng 1: Badge mã kho, Tên kho, Icon Chỉnh sửa & Xóa */}
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded border uppercase bg-blue-50 text-blue-700 border-blue-200/80">
                          {w.code}
                        </span>
                        <h4 className="font-sans font-bold text-slate-900 text-sm leading-snug">
                          {getLocalizedWarehouseName(w.name, isEn)}
                        </h4>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" strokeWidth={2.5} />
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditWarehouse(w)}
                          disabled={!isLocationMockMode() && !isLocationMutationEnabled()}
                          className="p-1.5 text-slate-500 hover:text-blue-600 disabled:opacity-40 disabled:hover:text-slate-400 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title={!isLocationMockMode() && !isLocationMutationEnabled() ? (isEn ? "Feature is being synchronized with the server" : "Chức năng đang được đồng bộ hóa với máy chủ") : (isEn ? "Edit" : "Chỉnh sửa")}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleSafeDeleteWarehouse(w)}
                          disabled={!isLocationMockMode() && !isLocationMutationEnabled()}
                          className="p-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-40 disabled:hover:text-slate-400 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title={!isLocationMockMode() && !isLocationMutationEnabled() ? (isEn ? "Feature is being synchronized with the server" : "Chức năng đang được đồng bộ hóa với máy chủ") : (isEn ? "Delete" : "Xóa")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Dòng 2: Địa chỉ nhà kho (address) */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans mb-2.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{w.address || (isEn ? "No address specified" : "Chưa có địa chỉ")}</span>
                    </div>

                    {/* Dòng 3: Thông tin vận hành */}
                    <div className="border-t border-slate-100 pt-2 mt-1 flex flex-wrap items-center justify-between gap-y-1 gap-x-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2 font-sans">
                        <span>{zonesCount} {isEn ? "zones" : "phân khu"}</span>
                        <span className="text-slate-300">·</span>
                        <span>{binsCount} {isEn ? "bins" : "ô kệ"}</span>
                      </div>

                      <div className="font-mono text-[11px] text-slate-700">
                        <span className="text-slate-400 font-sans">{isEn ? "Capacity: " : "Sức chứa: "}</span>
                        {curOcc.toLocaleString()} / {maxCap.toLocaleString()} ({utilPct}%)
                      </div>
                    </div>
                  </div>
                );
              })}

              {!isLoadingWarehouses && !isWarehousesError && filteredWarehouses.length === 0 && (
                <div className="py-12 text-center text-slate-400 font-sans text-xs">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
                  <p>{isEn ? "No warehouses found." : "Chưa có nhà kho nào trong hệ thống."}</p>
                  {whFilterSearch && (
                    <button
                      onClick={() => setWhFilterSearch("")}
                      className="mt-2 text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      {isEn ? "Clear search" : "Xóa tìm kiếm"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: ZONES CONTAINER */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
            {/* 1. Header Cột & Nút Thêm Phân Khu */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Layers size={16} className="text-blue-600" />
                <h3 className="font-sans font-bold text-slate-900 text-xs">
                  {isEn ? "Zones" : "Phân khu"}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                  {filteredZones.length}
                </span>
                {selectedMasterWarehouseId !== "all" && activeWarehouseObj && (
                  <span className="text-xs text-slate-500 font-normal">
                    ({isEn ? `In ${activeWarehouseObj.code}` : `Thuộc ${activeWarehouseObj.code}`})
                  </span>
                )}
              </div>
              <button
                disabled={activeWarehouses.length === 0 || (!isLocationMockMode() && !isLocationMutationEnabled())}
                onClick={openAddZone}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title={!isLocationMockMode() && !isLocationMutationEnabled() ? (isEn ? "Feature is being synchronized with the server" : "Chức năng đang được đồng bộ hóa với máy chủ") : undefined}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isEn ? "Add Zone" : "Thêm Phân Khu"}</span>
              </button>
            </div>

            {/* 2. Danh sách Thẻ Phân Khu (Zone Cards) */}
            <div className="p-4 space-y-3">
              {isLoadingZones && (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <p className="text-xs font-medium">{isEn ? "Loading zones..." : "Đang tải phân khu..."}</p>
                </div>
              )}

              {isZonesError && !isLoadingZones && (
                <div className="p-5 text-center text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
                  <p className="text-xs font-semibold mb-2">
                    {zonesErrorObj instanceof Error ? zonesErrorObj.message : (isEn ? "Failed to load zones" : "Lỗi khi tải phân khu")}
                  </p>
                  <button
                    onClick={() => refetchZones()}
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer"
                  >
                    {isEn ? "Retry" : "Thử lại"}
                  </button>
                </div>
              )}

              {!isLoadingZones && !isZonesError && filteredZones.map(z => {
                const parentWarehouse = activeWarehouses.find(w => w.id === z.warehouseId);
                const zoneBins = (allBinsList || []).filter(b => b.zoneId === z.id);
                const binCount = zoneBins.length;
                const zoneMaxCap = zoneBins.reduce((sum, b) => sum + (b.maxCapacity || 0), 0);
                const zoneCurOcc = zoneBins.reduce((sum, b) => sum + (b.currentOccupancy || 0), 0);
                const zoneUtilPct = zoneMaxCap > 0 ? Math.round((zoneCurOcc / zoneMaxCap) * 100) : 0;

                const barColor =
                  zoneCurOcc === 0
                    ? "bg-slate-300"
                    : zoneUtilPct >= 100
                    ? "bg-rose-500"
                    : zoneUtilPct >= 80
                    ? "bg-amber-500"
                    : "bg-emerald-500";

                const badgeBg =
                  zoneCurOcc === 0
                    ? "bg-slate-100 text-slate-600 border-slate-200"
                    : zoneUtilPct >= 100
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : zoneUtilPct >= 80
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200";

                return (
                  <div
                    key={z.id}
                    className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs hover:border-slate-300 transition duration-150 flex flex-col gap-2.5"
                  >
                    {/* Header Thẻ: Mã phân khu, Tên, Nút Edit/Delete */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200 uppercase">
                            {z.code}
                          </span>
                          <h4 className="font-sans font-bold text-slate-900 text-sm leading-snug">
                            {getLocalizedZoneName(z.name, isEn)}
                          </h4>
                        </div>
                        {/* Dòng phụ: Trực thuộc */}
                        <p className="text-xs text-slate-500 font-sans mt-1">
                          <span className="text-slate-400">{isEn ? "Belongs to: " : "Trực thuộc: "}</span>
                          <span className="font-medium text-slate-700">
                            {parentWarehouse ? `${getLocalizedWarehouseName(parentWarehouse.name, isEn)} (${parentWarehouse.code})` : z.warehouseId}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditZone(z)}
                          disabled={!isLocationMockMode() && !isLocationMutationEnabled()}
                          className="p-1.5 text-slate-500 hover:text-blue-600 disabled:opacity-40 disabled:hover:text-slate-400 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title={!isLocationMockMode() && !isLocationMutationEnabled() ? (isEn ? "Feature is being synchronized with the server" : "Chức năng đang được đồng bộ hóa với máy chủ") : (isEn ? "Edit" : "Chỉnh sửa")}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleSafeDeleteZone(z)}
                          disabled={!isLocationMockMode() && !isLocationMutationEnabled()}
                          className="p-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-40 disabled:hover:text-slate-400 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title={!isLocationMockMode() && !isLocationMutationEnabled() ? (isEn ? "Feature is being synchronized with the server" : "Chức năng đang được đồng bộ hóa với máy chủ") : (isEn ? "Delete" : "Xóa")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Khối Chỉ số Sức chứa & Tải lượng */}
                    <div className="space-y-1.5 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                      <div className="flex justify-between items-center text-xs font-sans">
                        <span className="text-slate-600 font-normal">
                          {isEn ? "Occupancy: " : "Sức chứa: "}
                          <span className="font-mono font-medium text-slate-800">{zoneCurOcc} / {zoneMaxCap}</span> {isEn ? "slots" : "vị trí"}
                        </span>
                        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border ${badgeBg}`}>
                          {zoneUtilPct}%
                        </span>
                      </div>

                      {/* Thanh Progress Bar */}
                      <div className="w-full h-1 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${Math.min(100, zoneUtilPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Số ô kệ & Nút chuyển tiếp sang Ô Kệ */}
                    <div className="flex items-center justify-between gap-2 pt-1 text-xs text-slate-600 font-sans border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Boxes className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {binCount} {isEn ? "linked bins" : "ô kệ phụ thuộc"}
                        </span>
                      </div>

                      {/* Direct Navigation to Bins Layout */}
                      <button
                        type="button"
                        onClick={() => {
                          const whParam = z.warehouseId || activeWarehouseObj?.id || "";
                          navigate(`/dashboard/mdm/bins?warehouseId=${encodeURIComponent(whParam)}&zoneId=${encodeURIComponent(z.id)}`);
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition cursor-pointer"
                        title={isEn ? "View Bins in this zone" : "Xem sơ đồ ô kệ phân khu này"}
                      >
                        <span>{isEn ? "View Bins" : "Xem sơ đồ ô kệ"}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!isLoadingZones && !isZonesError && filteredZones.length === 0 && (
                <div className="py-12 text-center text-slate-400 font-sans text-xs">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
                  <p>{isEn
                    ? `No zones registered for ${activeWarehouseObj ? getLocalizedWarehouseName(activeWarehouseObj.name, isEn) : "selected warehouse"}.`
                    : `Chưa có phân khu nào thuộc ${activeWarehouseObj ? activeWarehouseObj.name : "nhà kho đang chọn"}.`}
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <button
                      onClick={() => {
                        setSelectedMasterWarehouseId("all");
                      }}
                      className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      {isEn ? "Show all zones" : "Xem tất cả phân khu"}
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      onClick={openAddZone}
                      className="text-xs text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      {isEn ? "Add new zone" : "Thêm phân khu mới"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL (CONFORMING TO SMARTWMS BACKEND CONTRACT) */}
      {(activeModal === "add_product" || activeModal === "edit_product") && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden animate-zoomIn flex flex-col max-h-[90vh] enterprise-modal-container">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs mt-0.5 shrink-0">
                  <Package className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-sans font-bold text-slate-900 text-base tracking-tight leading-snug">
                    {activeModal === "add_product"
                      ? t("products.createModal.title")
                      : t("products.editModal.title")}
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    {activeModal === "add_product"
                      ? t("products.createModal.subtitle")
                      : t("products.editModal.subtitle")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer shrink-0 ml-3"
                title={t("products.createModal.btnCancel")}
                aria-label={t("products.createModal.btnCancel")}
              >
                <X className="w-4.5 h-4.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Form Body - Single unified form without tabs */}
            <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 font-sans enterprise-modal-body">
              {productSubmitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>{productSubmitError}</span>
                </div>
              )}

              {/* SECTION 1: THÔNG TIN CƠ BẢN */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                  <Package className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    {t("products.createModal.sectionBasic")}
                  </span>
                </div>

                {/* Row 1: SKU & Barcode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                      {t("products.createModal.skuLabel")}
                    </label>
                    <input
                      type="text"
                      required
                      value={prodSku}
                      disabled={activeModal === "edit_product"}
                      onChange={(e) => setProdSku(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                      placeholder={t("products.createModal.skuPlaceholder")}
                      className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono font-bold tracking-wider text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs transition text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block font-sans">
                      {t("products.createModal.skuHint")}
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                      {t("products.createModal.barcodeLabel")}
                    </label>
                    <div className="relative">
                      <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                      <input
                        type="text"
                        value={prodBarcode}
                        onChange={(e) => setProdBarcode(e.target.value)}
                        placeholder={t("products.createModal.barcodePlaceholder")}
                        className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-2.5 pl-9 pr-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-slate-800 shadow-2xs transition text-xs"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block font-sans">
                      {t("products.createModal.barcodeHint")}
                    </span>
                  </div>
                </div>

                {/* Row 2: Name & Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                      {t("products.createModal.nameLabel")}
                    </label>
                    <input
                      type="text"
                      required
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder={t("products.createModal.namePlaceholder")}
                      className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 shadow-2xs transition text-xs font-medium"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {t("products.createModal.nameHint")}
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                      {t("products.createModal.unitLabel")}
                    </label>
                    <div className="space-y-2">
                      <select
                        value={isCustomUnit ? "__custom__" : prodUnit}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__custom__") {
                            setIsCustomUnit(true);
                            setProdUnit(customUnitText);
                          } else {
                            setIsCustomUnit(false);
                            setProdUnit(val);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 shadow-2xs transition text-xs font-semibold cursor-pointer"
                      >
                        {SUGGESTED_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {isEn ? u.labelEn : u.labelVi}
                          </option>
                        ))}
                        <option value="__custom__">
                          {isEn ? "Other (Custom unit)..." : "Khác (Nhập đơn vị tùy chỉnh)..."}
                        </option>
                      </select>

                      {isCustomUnit && (
                        <input
                          type="text"
                          required
                          value={customUnitText}
                          onChange={(e) => {
                            setCustomUnitText(e.target.value);
                            setProdUnit(e.target.value);
                          }}
                          placeholder={isEn ? "Enter custom unit (e.g. Kg, Pack, Roll)..." : "Nhập đơn vị tính (vd: Kg, Gói, Cuộn)..."}
                          className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 shadow-2xs transition text-xs font-medium"
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {t("products.createModal.unitHint")}
                    </span>
                  </div>
                </div>

                {/* Row 3: Description */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    {t("products.createModal.descLabel")}
                  </label>
                  <textarea
                    value={prodDesc}
                    rows={2}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder={t("products.createModal.descPlaceholder")}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 shadow-2xs transition text-xs font-sans resize-none"
                  />
                </div>
              </div>

              {/* SECTION 2: KÍCH THƯỚC (CreateProductRequest: width, height, depth) */}
              {activeModal === "add_product" && (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                    <Boxes className="w-4 h-4 text-indigo-600" strokeWidth={1.5} />
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      {t("products.createModal.sectionDimensions")}
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      (cm)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                        {t("products.createModal.widthLabel")}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={prodWidth}
                        onChange={(e) => setProdWidth(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-slate-800 shadow-2xs transition text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                        {t("products.createModal.heightLabel")}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={prodHeight}
                        onChange={(e) => setProdHeight(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-slate-800 shadow-2xs transition text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                        {t("products.createModal.depthLabel")}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={prodDepth}
                        onChange={(e) => setProdDepth(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-slate-800 shadow-2xs transition text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer (Pinned, only [ Hủy ] [ Lưu ]) */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  disabled={isSubmittingProduct}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  {t("products.createModal.btnCancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProduct || (!isMockMode() && !allowProductMutations)}
                  title={!isMockMode() && !allowProductMutations ? t("products.table.actions.actionUnavailable") : undefined}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {isSubmittingProduct ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" strokeWidth={1.75} />
                  )}
                  <span>{t("products.createModal.btnSave")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-zoomIn flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" strokeWidth={1.75} />
                <h3 className="font-bold text-slate-900 text-sm">
                  {t("products.deleteModal.title")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                aria-label={t("products.deleteModal.cancel")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                {t("products.deleteModal.confirmMessage", { sku: productToDelete.sku })}
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-blue-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  [{productToDelete.sku}]
                </span>
                <span className="text-xs text-slate-700 font-medium truncate">
                  {productToDelete.name}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeletingProduct}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {t("products.deleteModal.cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!productToDelete) return;
                  setIsDeletingProduct(true);
                  try {
                    await productService.deleteProduct(productToDelete.id);
                    refetchProducts();
                    refetchAllProducts();
                    setProductToDelete(null);
                  } catch (err: any) {
                    alert(err.message || (isEn ? "Failed to delete product" : "Lỗi khi xóa sản phẩm"));
                  } finally {
                    setIsDeletingProduct(false);
                  }
                }}
                disabled={isDeletingProduct}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t("products.deleteModal.confirm")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SHELF BIN MODAL */}
      {activeModal === "edit_bin" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-zoomIn flex flex-col max-h-[90vh] enterprise-modal-container">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">
                {isEn ? `Edit Shelf Settings: ${binCode}` : `Điều chỉnh thông số Kệ hàng: ${binCode}`}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition cursor-pointer"
                title={isEn ? "Close" : "Đóng"}
                aria-label={isEn ? "Close" : "Đóng"}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleBinSubmit} className="p-6 space-y-4 font-sans text-xs overflow-y-auto flex-1 enterprise-modal-body">
              <div>
                <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {isEn ? "Physical Identifier Location Code" : "Mã kệ vị trí"}
                </label>
                <input
                  type="text"
                  required
                  value={binCode}
                  onChange={(e) => setBinCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {isEn ? "Warehouse Zone Location Group" : "Khu vực lưu chứa (Zone)"}
                </label>
                <select
                  value={binZoneId}
                  onChange={(e) => setBinZoneId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none font-mono"
                >
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{getName(z.name)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {isEn ? "Max Safety Unit Storage Capacity" : "Dung lượng chứa tối đa (pcs)"}
                </label>
                <input
                  type="number"
                  required
                  value={binMaxCap}
                  onChange={(e) => setBinMaxCap(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy bỏ"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-550 text-white font-bold rounded-lg shadow transition cursor-pointer"
                >
                  {isEn ? "Save Rack" : "Cập nhật kệ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT SUPPLIER VENDOR MODAL */}
      {(activeModal === "add_vendor" || activeModal === "edit_vendor") && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-zoomIn flex flex-col max-h-[90vh] enterprise-modal-container">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">
                {activeModal === "add_vendor"
                  ? (isEn ? "Add Supplier Vendor Partner" : "Thêm Đối Tác Cung Ứng mới")
                  : (isEn ? `Edit Vendor: ${selectedVendor?.id}` : `Chỉnh sửa thông tin đối tác: ${selectedVendor?.id}`)}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition cursor-pointer"
                title={isEn ? "Close" : "Đóng"}
                aria-label={isEn ? "Close" : "Đóng"}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleVendorSubmit} className="p-6 space-y-4 font-sans text-xs overflow-y-auto flex-1 enterprise-modal-body">
              <div>
                <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {isEn ? "Supplier Corporate Name" : "Doanh nghiệp đối tác"}
                </label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder={t('masterData.vendorModal.placeholders.name')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {isEn ? "Corporate Email" : "Email giao dịch"}
                </label>
                <input
                  type="email"
                  required
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                  placeholder={t('masterData.vendorModal.placeholders.email')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {isEn ? "Fulfillment Scope / Categories" : "Hành lang phân phối"}
                </label>
                <input
                  type="text"
                  value={vendorScope}
                  onChange={(e) => setVendorScope(e.target.value)}
                  placeholder={t('masterData.vendorModal.placeholders.corridor')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {isEn ? "Preferred Language Profile" : "Ngôn ngữ giao tiếp gốc"}
                </label>
                <select
                  value={vendorLang}
                  onChange={(e) => setVendorLang(e.target.value as "vi-VN" | "en-US")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none font-mono"
                >
                  <option value="vi-VN">vi-VN (Vietnamese)</option>
                  <option value="en-US">en-US (English)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                >
                  {isEn ? "Cancel" : "Hủy bỏ"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-550 text-white font-bold rounded-lg shadow transition"
                >
                  {isEn ? "Save Partner" : "Lưu đối tác"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. MODAL FORM: THÊM / CHỈNH SỬA NHÀ KHO MỚI (STRICT DTO CONTRACT) */}
      {(activeModal as any === "add_warehouse" || activeModal as any === "edit_warehouse") && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-zoomIn flex flex-col max-h-[92vh]">

            {/* Modal Header */}
            <div className="p-5 sm:px-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/80">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 border border-blue-200/60">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-900 text-base leading-tight">
                    {activeModal as any === "add_warehouse"
                      ? (isEn ? "Initialize New Warehouse" : "Khởi Tạo Nhà Kho Mới")
                      : (isEn ? `Edit Warehouse: ${selectedWarehouse?.code}` : `Chỉnh Sửa Nhà Kho: ${selectedWarehouse?.code}`)}
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    {isEn
                      ? "Enter warehouse details conforming to SmartWMS backend schema."
                      : "Nhập thông tin kho hàng theo chuẩn dữ liệu SmartWMS."}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/70 transition cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleWarehouseSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 font-sans text-xs">

              <div className="space-y-4">
                {/* Mã Nhà Kho * (Auto-Uppercase) */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    {isEn ? "Warehouse Code" : "Mã Nhà Kho"} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={whCode}
                    disabled={activeModal as any === "edit_warehouse"}
                    onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                    placeholder="WH-01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono font-bold uppercase tracking-wider outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:opacity-60 disabled:bg-slate-100"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">{isEn ? "Unique alphanumeric warehouse ID" : "Mã định danh kho viết hoa duy nhất"}</p>
                </div>

                {/* Tên Nhà Kho * */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    {isEn ? "Warehouse Name" : "Tên Nhà Kho"} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder={isEn ? "Central Warehouse" : "Kho Tổng Trung Tâm"}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">{isEn ? "Official operational center name" : "Tên gọi chính thức của cơ sở lưu trữ"}</p>
                </div>

                {/* Vị Trí Địa Lý / Địa Chỉ * */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    {isEn ? "Geographic Address" : "Địa Chỉ Nhà Kho"} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={whLocation}
                      onChange={(e) => setWhLocation(e.target.value)}
                      placeholder={isEn ? "Warehouse street address, city, country..." : "Địa chỉ số nhà, đường, khu công nghiệp, quận/huyện..."}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy bỏ"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isEn ? "Save Warehouse" : "Lưu Nhà Kho"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL FORM: THÊM / CHỈNH SỬA PHÂN KHU MỚI (STRICT DTO CONTRACT) */}
      {(activeModal as any === "add_zone" || activeModal as any === "edit_zone") && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-zoomIn flex flex-col max-h-[92vh]">

            {/* Modal Header */}
            <div className="p-5 sm:px-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/80">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200/60">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-900 text-base leading-tight">
                    {activeModal as any === "add_zone"
                      ? (isEn ? "Configure New Storage Zone" : "Thiết Lập Phân Khu Mới")
                      : (isEn ? `Edit Storage Zone: ${selectedZone?.name}` : `Chỉnh Sửa Phân Khu: ${selectedZone?.name}`)}
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    {isEn
                      ? "Configure storage zone code, name, and parent warehouse."
                      : "Cấu hình mã, tên và nhà kho trực thuộc của phân khu."}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/70 transition cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleZoneSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 font-sans text-xs">

              <div className="space-y-4">
                {/* Mã Phân Khu * */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    {isEn ? "Zone Code" : "Mã Phân Khu"} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneCode}
                    onChange={(e) => setZoneCode(e.target.value.toUpperCase())}
                    placeholder="ZONE-A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono font-bold uppercase tracking-wider outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">{isEn ? "Uppercase code (e.g., ZONE-A, ZONE-B)" : "Mã phân khu viết hoa (vd: ZONE-A, ZONE-B)"}</p>
                </div>

                {/* Tên Phân Khu * */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    {isEn ? "Zone Name" : "Tên Phân Khu"} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder={isEn ? "Standard Storage Area A" : "Phân khu tiêu chuẩn A"}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">{isEn ? "Descriptive name for warehouse operators" : "Tên hiển thị trực quan cho nhân viên kho"}</p>
                </div>

                {/* Thuộc Nhà Kho * */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    {isEn ? "Belongs to Warehouse" : "Thuộc Nhà Kho"} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    value={zoneWarehouseId}
                    disabled={activeModal as any === "edit_zone"}
                    onChange={(e) => setZoneWarehouseId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition font-medium disabled:opacity-60"
                  >
                    {activeWarehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">{isEn ? "Parent warehouse facility" : "Cơ sở kho cha quản lý trực tiếp"}</p>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy bỏ"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isEn ? "Save Zone" : "Lưu Phân Khu"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {exportSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" strokeWidth={2} />
          <div className="text-xs font-medium">
            {isEn ? "Export complete! CSV file generated successfully." : "Xuất dữ liệu thành công! Đã tạo tệp CSV chứa danh sách SKU."}
          </div>
        </div>
      )}

      {/* QR CODE MODAL (GET /api/v1/Products/{sku}/qrcode) */}
      {qrModalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-sm overflow-hidden animate-zoomIn flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <h3 className="font-sans font-bold text-slate-800 text-sm">
                  {t("products.qrModal.title")}
                </h3>
              </div>
              <button
                onClick={() => setQrModalData(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/70 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 text-center space-y-4">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner flex items-center justify-center inline-block mx-auto">
                <img
                  src={qrModalData.qrSrc}
                  alt={`QR code for ${qrModalData.sku}`}
                  className="w-48 h-48 object-contain"
                />
              </div>
              <div>
                <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md inline-block">
                  {qrModalData.sku}
                </span>
                <p className="text-xs font-semibold text-slate-800 mt-2">{qrModalData.name}</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <a
                href={qrModalData.qrSrc}
                download={`QR_${qrModalData.sku}.png`}
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl text-center shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t("products.qrModal.download")}</span>
              </a>
              <button
                onClick={() => setQrModalData(null)}
                className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                {t("products.qrModal.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE PARSER MODAL (POST /api/v1/Products/parse-barcode) */}
      {isBarcodeParserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden animate-zoomIn flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-indigo-600" />
                <h3 className="font-sans font-bold text-slate-800 text-sm">
                  {isEn ? "Parse Barcode Data" : "Phân tích mã vạch"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsBarcodeParserOpen(false);
                  setParsedBarcodeResult(null);
                  setParseBarcodeError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/70 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleParseBarcode} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5 text-xs font-sans">
                  {isEn ? "Raw Barcode Data *" : "Dữ liệu mã vạch *"}
                </label>
                <textarea
                  required
                  rows={3}
                  value={rawBarcodeInput}
                  onChange={(e) => setRawBarcodeInput(e.target.value)}
                  placeholder={isEn ? "Paste raw scanner output or GS1 barcode string..." : "Dán dữ liệu thô từ máy quét hoặc chuỗi mã vạch GS1..."}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-mono text-xs text-slate-800 shadow-2xs resize-none"
                />
              </div>

              {parseBarcodeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parseBarcodeError}</span>
                </div>
              )}

              {parsedBarcodeResult && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span>{isEn ? "Parsed Result" : "Kết quả phân tích"}</span>
                    <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {parsedBarcodeResult.stockStatus || "OK"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block font-mono">SKU:</span>
                      <span className="font-bold font-mono text-blue-700">{parsedBarcodeResult.sku}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-mono">Lot Number:</span>
                      <span className="font-semibold text-slate-800">{parsedBarcodeResult.lotNumber || "—"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block font-mono">Product Name:</span>
                      <span className="font-semibold text-slate-800">{parsedBarcodeResult.productName}</span>
                    </div>
                    {parsedBarcodeResult.expirationDate && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block font-mono">Expiration Date:</span>
                        <span className="font-semibold text-slate-800">{parsedBarcodeResult.expirationDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsBarcodeParserOpen(false);
                    setParsedBarcodeResult(null);
                    setParseBarcodeError(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  {isEn ? "Close" : "Đóng"}
                </button>
                <button
                  type="submit"
                  disabled={isParsingBarcode || !rawBarcodeInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isParsingBarcode && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isEn ? "Parse Barcode" : "Phân Tích"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
