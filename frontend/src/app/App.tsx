/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

import {
  Bin,
  Product,
  InboundReceipt,
  OutboundOrder,
  SystemNotification,
  AuditLog,
  WavePicking,
  WarehouseZone,
  Vendor,
  Warehouse,
} from "../types/index";
import SidebarNav from "../layouts/SidebarNav";
import WebDashboard from "../features/dashboard/WebDashboard";
import MobileApp from "../features/mobile-demo/MobileApp";
import AdminPanel from "../features/audit/AdminPanel";
import DBViewer from "../features/master-data/DBViewer";
import RBACManagement from "../features/auth/RBACManagement";
import SystemSettings from "../features/settings/SystemSettings";
import AIChatBot from "../features/ai/AIChatBot";
import LoginScreen from "../features/auth/LoginScreen";
import OrderManagement from "../features/orders/OrderManagement";
import CreateInboundVoucher from "../features/inbound/CreateInboundVoucher";
import CreateOutboundVoucher from "../features/outbound/CreateOutboundVoucher";
import RealCreateOutbound from "../features/outbound/RealCreateOutbound";
import WarehouseManagement from "../features/master-data/WarehouseManagement";
import CounterReplenishment from "../features/replenishment/CounterReplenishment";
import Header from "../layouts/Header";
import StaffMobileAppPortal from "../features/mobile-demo/StaffMobileAppPortal";
import ProfileScreen from "../features/auth/ProfileScreen";
import AccountOverview from '../features/auth/AccountOverview';
import OperationalDashboard from '../features/dashboard/OperationalDashboard';
import LocationAdministration from '../features/administration/LocationAdministration';
import SupplierAdministration from '../features/administration/SupplierAdministration';
import ReceiptCreation from '../features/inbound/ReceiptCreation';
import UserAdministration from '../features/administration/UserAdministration';
import AuditLogWorkspace from '../features/administration/AuditLogWorkspace';
import StockVisibility from "../features/inventory/StockVisibility";
import CycleCountManagement from "../features/cycle-count/CycleCountManagement";
import AssignedCycleCounts from "../features/cycle-count/AssignedCycleCounts";
import KittingWorkspace from '../features/kitting/KittingWorkspace';
import ProductWorkspace from '../features/products/ProductWorkspace';

import { isDemoMode } from './dataMode';
import { Session, Role, sessionStore } from '../features/auth/session';
import { logout } from '../features/auth/authApi';
import InventorySummary from '../features/inventory/InventorySummary';
import RealReplenishment from '../features/replenishment/RealReplenishment';


export interface ToastNotification {
  id: string;
  type: "success" | "warning" | "error" | "info";
  message: string;
  title?: string;
}

export default function App() {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
  const isLoggedIn = !!session;
  const loggedInUser = session?.username ?? '';
  const currentRole: Role = session?.role ?? 'Staff';
  const setCurrentRole = (role: Role) => {
    if (isDemoMode && session) sessionStore.set({ ...session, role });
  };
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem("ui_lang") || "vi-VN";
  });
  const isEn = currentLang === "en-US";
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Modern Toast Notification System State
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const showToast = (
    message: string,
    type: "success" | "warning" | "error" | "info" = "success",
    title?: string,
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  // Update localStorage whenever language changes
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLang(lng);
      localStorage.setItem("ui_lang", lng);
    };
    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n]);

  useEffect(() => {
    i18n.changeLanguage(currentLang);
  }, [currentLang, i18n]);

  const currentView =
    location.pathname === "/dashboard" || location.pathname === "/"
      ? "dashboard"
      : location.pathname.includes("mobile")
        ? "mobile"
        : location.pathname.startsWith("/dashboard/inventory")
          ? "inventory"
          : location.pathname.startsWith("/dashboard/replenishment")
            ? "replenishment"
          : location.pathname.startsWith('/dashboard/products')
            ? 'products'
          : location.pathname.startsWith('/dashboard/kitting')
            ? 'kitting'
          : location.pathname.startsWith("/dashboard/cycle-counting")
            ? "cycle-counting"
          : location.pathname.startsWith("/dashboard/orders")
            ? "orders"
            : location.pathname.startsWith("/dashboard/security/rbac")
              ? "security-rbac"
              : location.pathname.startsWith("/dashboard/security/audit-logs")
                ? "security-audit-logs"
                : location.pathname.startsWith("/dashboard/security/monitor")
                  ? "security-monitor"
                  : location.pathname.startsWith("/dashboard/security")
                    ? "security"
                    : location.pathname.startsWith("/dashboard/mdm/products")
                      ? "db-products"
                      : location.pathname.startsWith("/dashboard/mdm/bins")
                        ? "db-bins"
                        : location.pathname.startsWith("/dashboard/mdm/vendors")
                          ? "db-vendors"
                          : location.pathname.startsWith(
                                "/dashboard/mdm/warehouses",
                              )
                            ? "db-warehouses_zones"
                            : location.pathname.startsWith(
                                  "/dashboard/mdm/print-labels",
                                )
                              ? "db-print-labels"
                              : location.pathname.startsWith("/dashboard/mdm")
                                ? "db"
                                : location.pathname.startsWith("/dashboard/settings")
                                  ? "settings"
                                  : location.pathname.startsWith('/dashboard/profile')
                                    ? 'profile'
                                  : "dashboard";

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("smartwms_sidebar_collapsed") === "true";
  });
  const [isOpenSidebar, setIsOpenSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("smartwms_sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleLoginSuccess = (_session: Session) => {
    setToasts([]);
    navigate(isDemoMode && _session.role === 'Staff' ? '/mobile' : '/dashboard', { replace: true });
  };
  const handleLogout = async () => {
    setToasts([]);
    navigate('/login', { replace: true });
    if (isDemoMode) sessionStore.set(null, 'logout');
    else {
      try { await logout(); }
      catch { showToast(t('f1.logoutOffline'), 'warning'); }
    }
  };
  useEffect(() => {
    if (!session && location.pathname !== '/login') navigate('/login', { replace: true });
  }, [session, location.pathname, navigate]);

  // In-memory synced database states
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [inbounds, setInbounds] = useState<InboundReceipt[]>([]);
  const [outbounds, setOutbounds] = useState<OutboundOrder[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [waves, setWaves] = useState<WavePicking[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [loading, setLoading] = useState(isDemoMode);

  // Initialize and Fetch Initial Data from Node express server
  const fetchAllData = async (retries = 3) => {
    try {
      const res = await fetch("/api/wms/all-data");
      if (!res.ok) throw new Error(`HTTP Error Status: ${res.status}`);
      const data = await res.json();
      setProducts(data.products || []);
      setWarehouses(data.warehouses || []);
      setBins(data.bins || []);
      setZones(data.zones || []);
      setInbounds(data.inbounds || []);
      setOutbounds(data.outbounds || []);
      setNotifications(data.notifications || []);
      setAuditLogs(data.auditLogs || []);
      setWaves(data.waves || []);
      setVendors(data.vendors || []);
      setLoading(false);
    } catch (e) {
      console.error("Failure pulling static warehouse sync data: ", e);
      if (retries > 0) {
        console.log(`Retrying fetchAllData... (${retries} attempts left)`);
        setTimeout(() => fetchAllData(retries - 1), 1500);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isDemoMode) fetchAllData();
  }, []);

  // Update specific Bin item quantities completely on the server-side
  const handleUpdateBinQty = async (
    binCode: string,
    sku: string,
    qty: number,
    action: "ADD" | "SUBTRACT",
  ) => {
    try {
      const res = await fetch("/api/wms/bins/update-qty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          binCode,
          sku,
          qty,
          action,
          operator: `Staff-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Quantity constraint violated");
      }

      // Sync fresh data from response to guarantee single source of truth
      setBins(data.bins);
      setAuditLogs(data.auditLogs);
      setNotifications(data.notifications);

      showToast(
        t("toast.messages.bin_qty_updated", isEn ? "Inventory quantity updated successfully!" : "Đã cập nhật số lượng tồn kho thành công!"),
        "success"
      );
    } catch (err: any) {
      showToast(
        err.message || (isEn ? "Failed updating warehouse quantity limits." : "Cập nhật số lượng kho thất bại."),
        "error"
      );
    }
  };

  // Turn signal alerts resolve (approve PO auto mail creations)
  const handleResolveNotif = async (
    id: string,
    approved: boolean,
    extraData?: {
      vendorEmail?: string;
      emailBodyEn?: string;
      emailBodyVi?: string;
      subjectEn?: string;
      subjectVi?: string;
    },
  ) => {
    try {
      const res = await fetch("/api/wms/notifications/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          approved,
          operator: `Manager-${currentRole}`,
          extraData,
        }),
      });
      const data = await res.json();

      setNotifications(data.notifications);
      setAuditLogs(data.auditLogs);
      setInbounds(data.inbounds);

      showToast(
        t("toast.messages.notif_resolved", isEn ? "Notification alert resolved!" : "Đã giải quyết cảnh báo hệ thống!"),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed to resolve notification." : "Không thể xử lý thông báo."), "error");
    }
  };

  const handleMarkAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast(
      t("header.notifications.markAllRead", isEn ? "All notifications marked as read." : "Đã đánh dấu đã đọc tất cả thông báo."),
      "info"
    );
  };

  // Perform Wave picking path step updates
  const handleUpdateWaveStep = async (waveId: string, step: number) => {
    try {
      const res = await fetch("/api/wms/waves/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waveId,
          step,
          operator: `Staff-${currentRole}`,
        }),
      });
      const data = await res.json();

      setWaves(data.waves);
      setBins(data.bins);
      setAuditLogs(data.auditLogs);
    } catch (err: any) {
      showToast(err.message || "Failed updating wave step.", "error");
    }
  };

  // Create new layouts location (bin) via MDM panel
  const handleAddBin = async (
    code: string,
    zoneId: string,
    capacity: number,
  ) => {
    try {
      const res = await fetch("/api/wms/bins/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          zoneId,
          capacity,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setBins(data.bins);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.bin_added", isEn ? `Storage bin [${code}] created!` : `Đã tạo ô kệ mới [${code}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed creating new shelf." : "Lỗi khi tạo ô kệ mới."), "error");
    }
  };

  const handleUpdateBin = async (
    id: string,
    code: string,
    zoneId: string,
    maxCapacity: number,
  ) => {
    try {
      const res = await fetch(`/api/wms/bins/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          zoneId,
          maxCapacity,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setBins(data.bins);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.bin_updated", isEn ? `Storage bin [${code}] updated!` : `Đã cập nhật ô kệ [${code}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed updating shelf." : "Lỗi khi cập nhật ô kệ."), "error");
    }
  };

  const handleDeleteBin = async (id: string) => {
    try {
      const res = await fetch(
        `/api/wms/bins/${id}?operator=Admin-${currentRole}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setBins(data.bins);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.bin_deleted", isEn ? "Storage bin removed from layout!" : "Đã xóa ô kệ khỏi sơ đồ!"),
        "warning"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed deleting shelf." : "Lỗi khi xóa ô kệ."), "error");
    }
  };

  // Bin Multi-SKU Internal Transfer Handler
  const handleTransferBinStock = async (
    sourceBinCode: string,
    targetBinCode: string,
    sku: string,
    qty: number,
    reason: string
  ) => {
    try {
      const res = await fetch("/api/wms/bins/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceBinCode,
          targetBinCode,
          sku,
          qty,
          operator: `Staff-${currentRole}`,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Luân chuyển thất bại");
      }
      setBins(data.bins);
      if (data.zones) setZones(data.zones);
      if (data.auditLogs) setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.stock_transferred", isEn ? `Transferred ${qty}x [${sku}] from ${sourceBinCode} to ${targetBinCode}!` : `Đã chuyển ${qty}x [${sku}] từ [${sourceBinCode}] sang [${targetBinCode}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Transfer failed." : "Lỗi luân chuyển hàng hóa."), "error");
      throw err;
    }
  };

  // Product CRUD Handlers
  const handleAddProduct = async (
    sku: string,
    barcode: string,
    name: string,
    price: number,
    unit: string,
    category: string,
    description: string,
    extra?: Partial<Product>,
  ) => {
    try {
      const res = await fetch("/api/wms/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          barcode,
          name,
          price,
          unit,
          category,
          description,
          ...extra,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setProducts(data.products);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.product_added", isEn ? `Product [${sku}] added to catalog!` : `Đã thêm sản phẩm [${sku}] vào danh mục!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed adding product." : "Lỗi khi thêm sản phẩm."), "error");
    }
  };

  const handleUpdateProduct = async (
    id: string,
    sku: string,
    barcode: string,
    name: string,
    price: number,
    unit: string,
    category: string,
    description: string,
    extra?: Partial<Product>,
  ) => {
    try {
      const res = await fetch(`/api/wms/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          barcode,
          name,
          price,
          unit,
          category,
          description,
          ...extra,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setProducts(data.products);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.product_updated", isEn ? `Product [${sku}] updated!` : `Đã cập nhật sản phẩm [${sku}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed updating product." : "Lỗi khi cập nhật sản phẩm."), "error");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const res = await fetch(
        `/api/wms/products/${id}?operator=Admin-${currentRole}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setProducts(data.products);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.product_deleted", isEn ? "Product deleted from catalog!" : "Đã xóa sản phẩm khỏi danh mục!"),
        "warning"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed deleting product." : "Lỗi khi xóa sản phẩm."), "error");
    }
  };

  // Vendor CRUD Handlers
  const handleAddVendor = async (
    name: string,
    email: string,
    scope: string,
    preferredLang: "vi-VN" | "en-US",
  ) => {
    try {
      const res = await fetch("/api/wms/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          scope,
          preferredLang,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setVendors(data.vendors);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.vendor_added", isEn ? `Supplier [${name}] added!` : `Đã thêm nhà cung cấp [${name}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed adding supplier." : "Lỗi khi thêm nhà cung cấp."), "error");
    }
  };

  const handleUpdateVendor = async (
    id: string,
    name: string,
    email: string,
    scope: string,
    preferredLang: "vi-VN" | "en-US",
  ) => {
    try {
      const res = await fetch(`/api/wms/vendors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          scope,
          preferredLang,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setVendors(data.vendors);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.vendor_updated", isEn ? `Supplier [${name}] updated!` : `Đã cập nhật nhà cung cấp [${name}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed updating supplier." : "Lỗi khi cập nhật nhà cung cấp."), "error");
    }
  };

  const handleDeleteVendor = async (id: string) => {
    try {
      const res = await fetch(
        `/api/wms/vendors/${id}?operator=Admin-${currentRole}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setVendors(data.vendors);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.vendor_deleted", isEn ? "Supplier removed!" : "Đã xóa nhà cung cấp!"),
        "warning"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed deleting supplier." : "Lỗi khi xóa nhà cung cấp."), "error");
    }
  };

  // Warehouse CRUD Handlers
  const handleAddWarehouse = async (
    name: string,
    code: string,
    location: string,
    description: string,
  ) => {
    try {
      const res = await fetch("/api/wms/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          location,
          description,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setWarehouses(data.warehouses);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.warehouse_added", isEn ? `Warehouse [${name}] created!` : `Đã tạo nhà kho mới [${name}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed adding warehouse." : "Lỗi khi thêm nhà kho."), "error");
    }
  };

  const handleUpdateWarehouse = async (
    id: string,
    name: string,
    code: string,
    location: string,
    description: string,
  ) => {
    try {
      const res = await fetch(`/api/wms/warehouses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          location,
          description,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setWarehouses(data.warehouses);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.warehouse_updated", isEn ? `Warehouse [${name}] updated!` : `Đã cập nhật thông tin kho [${name}]!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed updating warehouse." : "Lỗi khi cập nhật nhà kho."), "error");
    }
  };

  const handleDeleteWarehouse = async (id: string) => {
    try {
      const res = await fetch(
        `/api/wms/warehouses/${id}?operator=Admin-${currentRole}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setWarehouses(data.warehouses);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.warehouse_deleted", isEn ? "Warehouse deleted!" : "Đã xóa nhà kho thành công!"),
        "warning"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed deleting warehouse." : "Lỗi khi xóa nhà kho."), "error");
    }
  };

  // Zone CRUD Handlers
  const handleAddZone = async (
    name: string,
    warehouseId: string,
    type: "Cool" | "Dry" | "Hazardous" | "HighValue" | "RetailCounter",
    capacity: number,
  ) => {
    try {
      const res = await fetch("/api/wms/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          warehouseId,
          type,
          capacity,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setZones(data.zones);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.zone_added", isEn ? `Zone [${name}] created!` : `Đã thêm phân khu [${name}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed adding zone." : "Lỗi khi thêm phân khu."), "error");
    }
  };

  const handleUpdateZone = async (
    id: string,
    name: string,
    warehouseId: string,
    type: "Cool" | "Dry" | "Hazardous" | "HighValue" | "RetailCounter",
    capacity: number,
  ) => {
    try {
      const res = await fetch(`/api/wms/zones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          warehouseId,
          type,
          capacity,
          operator: `Admin-${currentRole}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setZones(data.zones);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.zone_updated", isEn ? `Zone [${name}] updated!` : `Đã cập nhật phân khu [${name}] thành công!`),
        "success"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed updating zone." : "Lỗi khi cập nhật phân khu."), "error");
    }
  };

  const handleDeleteZone = async (id: string) => {
    try {
      const res = await fetch(
        `/api/wms/zones/${id}?operator=Admin-${currentRole}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setZones(data.zones);
      setAuditLogs(data.auditLogs);

      showToast(
        t("toast.messages.zone_deleted", isEn ? "Zone deleted!" : "Đã xóa phân khu thành công!"),
        "warning"
      );
    } catch (err: any) {
      showToast(err.message || (isEn ? "Failed deleting zone." : "Lỗi khi xóa phân khu."), "error");
    }
  };

  // Append customized Audit Log anomalous entry for demo firewalls
  const handleTriggerAuditLog = (action: string, details: string) => {
    const freshLog: AuditLog = {
      id: `h-log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operator: "Unknown Guest",
      role: "Staff",
      action,
      details,
      ip: "159.20.142.1",
      apiPath: "/api/auth/jwt-handshake",
      locale: currentLang,
      isAnomaly: true,
    };
    setAuditLogs((prev) => [freshLog, ...prev]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-slate-100 select-none">
        <div className="h-12 w-12 rounded-xl border-4 border-t-blue-500 border-slate-700 animate-spin mb-4" />
        <h2 className="font-sans font-bold text-lg">
          {t("app.loading", isEn ? "Loading SmartWMS Enterprise..." : "Đang khởi động SmartWMS...")}
        </h2>
        <p className="text-xs text-slate-500 mt-2">
          {t("app.initializing", isEn ? "Synchronizing digital twin operational matrices..." : "Đồng bộ mô thức rà soát kho thời gian thực...")}
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="relative">
        {sessionStore.getReason() === 'expired' && <p role="alert" className="fixed top-2 left-0 right-0 text-center text-amber-300 z-50">{t('f1.expired')}</p>}
        <LoginScreen
          currentLang={currentLang}
          onChangeLang={(lang) => setCurrentLang(lang)}
          onLoginSuccess={handleLoginSuccess}
        />
        {/* Floating Toast Notification Container for Login Page */}
        {toasts.length > 0 && (
          <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
            {toasts.map((toast) => {
              const isSuccess = toast.type === "success";
              const isError = toast.type === "error";
              const isWarning = toast.type === "warning";
              return (
                <div
                  key={toast.id}
                  className={`pointer-events-auto p-3.5 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md transition-all animate-fadeIn ${
                    isSuccess
                      ? "bg-slate-900/95 border-emerald-500/50 text-white"
                      : isError
                      ? "bg-slate-900/95 border-rose-500/50 text-white"
                      : isWarning
                      ? "bg-slate-900/95 border-amber-500/50 text-white"
                      : "bg-slate-900/95 border-blue-500/50 text-white"
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isSuccess && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" strokeWidth={1.5} />}
                    {isError && <AlertCircle className="w-4.5 h-4.5 text-rose-400" strokeWidth={1.5} />}
                    {isWarning && <AlertTriangle className="w-4.5 h-4.5 text-amber-400" strokeWidth={1.5} />}
                    {!isSuccess && !isError && !isWarning && <Info className="w-4.5 h-4.5 text-blue-400" strokeWidth={1.5} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-xs leading-tight">
                      {toast.title || (isSuccess ? t("toast.titles.success", "Thành công") : isError ? t("toast.titles.error", "Lỗi") : isWarning ? t("toast.titles.warning", "Cảnh báo") : t("toast.titles.info", "Thông tin"))}
                    </h5>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug break-words">
                      {toast.message}
                    </p>
                  </div>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Render floating toast notifications container
  const renderToastContainer = () => {
    if (toasts.length === 0) return null;
    return (
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";
          const isWarning = toast.type === "warning";
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md transition-all animate-fadeIn ${
                isSuccess
                  ? "bg-slate-900/95 border-emerald-500/50 text-white"
                  : isError
                  ? "bg-slate-900/95 border-rose-500/50 text-white"
                  : isWarning
                  ? "bg-slate-900/95 border-amber-500/50 text-white"
                  : "bg-slate-900/95 border-blue-500/50 text-white"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" strokeWidth={1.5} />}
                {isError && <AlertCircle className="w-4.5 h-4.5 text-rose-400" strokeWidth={1.5} />}
                {isWarning && <AlertTriangle className="w-4.5 h-4.5 text-amber-400" strokeWidth={1.5} />}
                {!isSuccess && !isError && !isWarning && <Info className="w-4.5 h-4.5 text-blue-400" strokeWidth={1.5} />}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-xs leading-tight">
                  {toast.title || (isSuccess ? t("toast.titles.success", "Thành công") : isError ? t("toast.titles.error", "Lỗi") : isWarning ? t("toast.titles.warning", "Cảnh báo") : t("toast.titles.info", "Thông tin"))}
                </h5>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug break-words">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // Full-screen voucher/receipt forms intercept
  if (isDemoMode && location.pathname === "/dashboard/orders/inbound/create") {
    return (
      <div className="relative min-h-screen">
        <CreateInboundVoucher
          products={products}
          bins={bins}
          warehouses={warehouses}
          zones={zones}
          vendors={vendors}
          lang={currentLang}
          onRefreshData={fetchAllData}
          onShowToast={showToast}
        />
        {renderToastContainer()}
      </div>
    );
  }
  if (isDemoMode && location.pathname === "/dashboard/orders/outbound/create") {
    return (
      <div className="relative min-h-screen">
        <CreateOutboundVoucher
          products={products}
          bins={bins}
          warehouses={warehouses}
          zones={zones}
          lang={currentLang}
          onRefreshData={fetchAllData}
          onShowToast={showToast}
        />
        {renderToastContainer()}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-50 flex overflow-hidden font-sans antialiased text-slate-900">
      {/* Smart Side Menu Bar */}
      {isOpenSidebar && (
        <button type="button" aria-label={t('ui.closeNavigation')}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpenSidebar(false)}
        />
      )}
      <SidebarNav
        className={`${isOpenSidebar ? "flex" : "hidden"} md:flex`}
        currentRole={currentRole}
        currentLang={currentLang}
        currentView={currentView}
        onChangeRole={(role) => {
          setCurrentRole(role);
          showToast(
            isEn ? `Switched clearance tier to ${role}` : `Đã chuyển sang cấp độ quyền ${role}`,
            "info"
          );
          if (role === "Staff") {
            navigate("/mobile");
          } else if (currentView.startsWith("security") && role !== "Admin") {
            navigate("/dashboard");
          }
        }}
        onChangeView={(view) => {
          if (view === "dashboard") navigate("/dashboard");
          else if (view === "mobile")
            navigate(currentRole === "Staff" ? "/mobile" : "/dashboard/mobile-devices");
          else if (view === "inventory") navigate("/dashboard/inventory");
          else if (view === "orders") navigate("/dashboard/orders");
          else if (view === "replenishment")
            navigate("/dashboard/replenishment");
          else if (view === "cycle-counting")
            navigate("/dashboard/cycle-counting");
          else if (view === 'kitting') navigate('/dashboard/kitting');
          else if (view === 'products') navigate('/dashboard/products');
          else if (view.startsWith("security-")) {
            const sub = view.replace("security-", "");
            navigate(`/dashboard/security/${sub}`);
          } else if (view === "security")
            navigate("/dashboard/security/monitor");
          else if (view.startsWith("db-")) {
            const sub = view.replace("db-", "");
            navigate(`/dashboard/mdm/${sub}`);
          } else if (view === "db") {
            navigate("/dashboard/mdm/warehouses_zones");
          } else if (view === "settings") {
            navigate("/dashboard/settings");
          }
          setIsOpenSidebar(false);
        }}
        isCollapsed={!isMobile && isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Primary Dynamic Main Content Render Board */}
      <main
        className={`w-full ${!isMobile && isSidebarCollapsed ? "md:pl-16" : "md:pl-[260px]"} flex flex-col min-h-screen bg-slate-50 overflow-y-auto overflow-x-hidden relative transition-all duration-200 ease-in-out`}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white md:hidden sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-sans font-bold text-white text-base shrink-0">
              W
            </div>
            <span className="font-bold tracking-tight">SmartWMS</span>
          </div>
          <button type="button" aria-label={t('ui.openNavigation')} aria-expanded={isOpenSidebar} onClick={() => setIsOpenSidebar(true)} className="p-2 rounded-lg hover:bg-slate-800"><Menu className="w-6 h-6" /></button>
        </div>

        {/* Professional Theme Header */}
        <Header
          currentLang={currentLang}
          loggedInUser={loggedInUser}
          currentRole={currentRole}
          onLogout={handleLogout}
          onChangeLang={setCurrentLang}
          notifications={notifications}
          onResolveNotif={handleResolveNotif}
          onMarkAllNotifsRead={handleMarkAllNotifsRead}
        />

        {/* Scrollable View Area */}
        <div className="flex-1 flex flex-col relative w-full h-auto">
          {!isDemoMode ? <Routes>
            <Route path="/dashboard/profile" element={<AccountOverview onLogout={handleLogout} />} />
            <Route path="/dashboard/settings" element={<AccountOverview settings onLogout={handleLogout} />} />
            <Route path="/dashboard/mdm/warehouses_zones" element={<LocationAdministration />} />
            <Route path="/dashboard/mdm/bins" element={<LocationAdministration binsView />} />
            <Route path="/dashboard/mdm/vendors" element={<SupplierAdministration />} />
            <Route path="/dashboard/orders/inbound/create" element={<ReceiptCreation />} />
            <Route path="/dashboard/security/rbac" element={<UserAdministration />} />
            <Route path="/dashboard/security/audit-logs" element={<AuditLogWorkspace />} />
            <Route path="/dashboard" element={<OperationalDashboard />} />
            <Route path="/dashboard/inventory" element={<StockVisibility />} />
            <Route path="/dashboard/replenishment" element={<RealReplenishment />} />
            <Route path="/dashboard/orders" element={<OrderManagement />} />
            <Route path="/dashboard/orders/outbound/create" element={<RealCreateOutbound />} />
            <Route path="/dashboard/cycle-counting/*" element={<AssignedCycleCounts />} />
            <Route path="/dashboard/kitting" element={<KittingWorkspace />} />
            <Route path="/dashboard/products" element={<ProductWorkspace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes> : <Routes>
            <Route
              path="/"
              element={
                <Navigate
                  to={currentRole === "Staff" ? "/mobile" : "/dashboard"}
                  replace
                />
              }
            />

            <Route
              path="/dashboard"
              element={
                <WebDashboard
                  bins={bins}
                  products={products}
                  inbounds={inbounds}
                  outbounds={outbounds}
                  notifications={notifications}
                  zones={zones}
                  onUpdateBinQty={handleUpdateBinQty}
                  onTransfer={handleTransferBinStock}
                  onTriggerAuditLog={handleTriggerAuditLog}
                  onRefreshData={fetchAllData}
                  onResolveNotif={handleResolveNotif}
                  lang={currentLang}
                />
              }
            />

            <Route
              path="/dashboard/inventory"
              element={
                <StockVisibility
                  lang={currentLang}
                  onShowToast={showToast}
                />
              }
            />
            <Route
              path="/dashboard/stock"
              element={<Navigate to="/dashboard/inventory" replace />}
            />

            <Route
              path="/dashboard/replenishment"
              element={
                <CounterReplenishment
                  bins={bins}
                  products={products}
                  zones={zones}
                  onUpdateBinQty={handleUpdateBinQty}
                  onRefreshData={fetchAllData}
                  lang={currentLang}
                />
              }
            />

            <Route
              path="/dashboard/cycle-counting/*"
              element={
                <CycleCountManagement
                  lang={currentLang}
                  onShowToast={showToast}
                  currentUser={loggedInUser ? `${loggedInUser} (${currentRole})` : `Trần Anh Kiện (${currentRole})`}
                />
              }
            />

            <Route
              path="/dashboard/orders"
              element={
                <OrderManagement
                  lang={currentLang}
                  onRefreshData={fetchAllData}
                  bins={bins}
                  products={products}
                  onShowToast={showToast}
                />
              }
            />
            <Route
              path="/dashboard/orders/inbound/create"
              element={
                <CreateInboundVoucher
                  products={products}
                  bins={bins}
                  warehouses={warehouses}
                  zones={zones}
                  vendors={vendors}
                  lang={currentLang}
                  onRefreshData={fetchAllData}
                  onShowToast={showToast}
                />
              }
            />
            <Route
              path="/dashboard/orders/outbound/create"
              element={
                <CreateOutboundVoucher
                  products={products}
                  bins={bins}
                  warehouses={warehouses}
                  zones={zones}
                  lang={currentLang}
                  onRefreshData={fetchAllData}
                  onShowToast={showToast}
                />
              }
            />

            <Route path="/dashboard/settings" element={<SystemSettings />} />
            <Route
              path="/dashboard/profile"
              element={
                <div className="p-4 flex justify-center w-full">
                  <ProfileScreen
                    onLogout={handleLogout}
                    currentRole={currentRole}
                    lang={currentLang}
                  />
                </div>
              }
            />
            <Route
              path="/profile"
              element={
                <div className="p-4 flex justify-center w-full">
                  <ProfileScreen
                    onLogout={handleLogout}
                    currentRole={currentRole}
                    lang={currentLang}
                  />
                </div>
              }
            />
            <Route
              path="/dashboard/mobile-devices"
              element={<StaffMobileAppPortal />}
            />

            <Route
              path="/mobile"
              element={
                <MobileApp
                  products={products}
                  bins={bins}
                  waves={waves}
                  onUpdateBinQty={handleUpdateBinQty}
                  onUpdateWaveStep={handleUpdateWaveStep}
                  lang={currentLang}
                  onLogout={handleLogout}
                />
              }
            />

            <Route
              path="/dashboard/security/*"
              element={
                <Routes>
                  <Route
                    path="audit-logs"
                    element={
                      <AdminPanel
                        logs={auditLogs}
                        onTriggerAuditLog={handleTriggerAuditLog}
                        lang={currentLang}
                        products={products}
                        bins={bins}
                        activeSubTab="audit-logs"
                      />
                    }
                  />
                  <Route
                    path="monitor"
                    element={
                      <AdminPanel
                        logs={auditLogs}
                        onTriggerAuditLog={handleTriggerAuditLog}
                        lang={currentLang}
                        products={products}
                        bins={bins}
                        activeSubTab="monitor"
                      />
                    }
                  />
                  <Route path="rbac" element={<RBACManagement />} />
                  <Route
                    path="*"
                    element={<Navigate to="audit-logs" replace />}
                  />
                </Routes>
              }
            />

            <Route
              path="/dashboard/mdm/*"
              element={
                <Routes>
                  <Route
                    path="products"
                    element={
                      <DBViewer
                        products={products}
                        warehouses={warehouses}
                        bins={bins}
                        zones={zones}
                        vendors={vendors}
                        activeSubTab="products"
                        onChangeSubTab={(subTab) =>
                          navigate(`/dashboard/mdm/${subTab}`)
                        }
                        onAddBin={handleAddBin}
                        onUpdateBin={handleUpdateBin}
                        onDeleteBin={handleDeleteBin}
                        onAddProduct={handleAddProduct}
                        onUpdateProduct={handleUpdateProduct}
                        onDeleteProduct={handleDeleteProduct}
                        onAddVendor={handleAddVendor}
                        onUpdateVendor={handleUpdateVendor}
                        onDeleteVendor={handleDeleteVendor}
                        onAddWarehouse={handleAddWarehouse}
                        onUpdateWarehouse={handleUpdateWarehouse}
                        onDeleteWarehouse={handleDeleteWarehouse}
                        onAddZone={handleAddZone}
                        onUpdateZone={handleUpdateZone}
                        onDeleteZone={handleDeleteZone}
                        lang={currentLang}
                      />
                    }
                  />
                  <Route
                    path="bins"
                    element={
                      <WarehouseManagement
                        warehouses={warehouses}
                        zones={zones}
                        bins={bins}
                        products={products}
                        onTransfer={handleTransferBinStock}
                        lang={currentLang}
                      />
                    }
                  />
                  <Route
                    path="vendors"
                    element={
                      <DBViewer
                        products={products}
                        warehouses={warehouses}
                        bins={bins}
                        zones={zones}
                        vendors={vendors}
                        activeSubTab="vendors"
                        onChangeSubTab={(subTab) =>
                          navigate(`/dashboard/mdm/${subTab}`)
                        }
                        onAddBin={handleAddBin}
                        onUpdateBin={handleUpdateBin}
                        onDeleteBin={handleDeleteBin}
                        onAddProduct={handleAddProduct}
                        onUpdateProduct={handleUpdateProduct}
                        onDeleteProduct={handleDeleteProduct}
                        onAddVendor={handleAddVendor}
                        onUpdateVendor={handleUpdateVendor}
                        onDeleteVendor={handleDeleteVendor}
                        onAddWarehouse={handleAddWarehouse}
                        onUpdateWarehouse={handleUpdateWarehouse}
                        onDeleteWarehouse={handleDeleteWarehouse}
                        onAddZone={handleAddZone}
                        onUpdateZone={handleUpdateZone}
                        onDeleteZone={handleDeleteZone}
                        lang={currentLang}
                      />
                    }
                  />
                  <Route
                    path="warehouses_zones"
                    element={
                      <DBViewer
                        products={products}
                        warehouses={warehouses}
                        bins={bins}
                        zones={zones}
                        vendors={vendors}
                        activeSubTab="warehouses_zones"
                        onChangeSubTab={(subTab) =>
                          navigate(`/dashboard/mdm/${subTab}`)
                        }
                        onAddBin={handleAddBin}
                        onUpdateBin={handleUpdateBin}
                        onDeleteBin={handleDeleteBin}
                        onAddProduct={handleAddProduct}
                        onUpdateProduct={handleUpdateProduct}
                        onDeleteProduct={handleDeleteProduct}
                        onAddVendor={handleAddVendor}
                        onUpdateVendor={handleUpdateVendor}
                        onDeleteVendor={handleDeleteVendor}
                        onAddWarehouse={handleAddWarehouse}
                        onUpdateWarehouse={handleUpdateWarehouse}
                        onDeleteWarehouse={handleDeleteWarehouse}
                        onAddZone={handleAddZone}
                        onUpdateZone={handleUpdateZone}
                        onDeleteZone={handleDeleteZone}
                        lang={currentLang}
                      />
                    }
                  />
                  <Route
                    path="print-labels"
                    element={
                      <AdminPanel
                        logs={auditLogs}
                        onTriggerAuditLog={handleTriggerAuditLog}
                        lang={currentLang}
                        products={products}
                        bins={bins}
                        zones={zones}
                        activeSubTab="labels"
                      />
                    }
                  />
                  <Route
                    path="*"
                    element={<Navigate to="products" replace />}
                  />
                </Routes>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>}
        </div>

        {/* Floating AI RAG Conversational Agent Overlay */}
        {isDemoMode && <AIChatBot lang={currentLang} />}

        {/* Floating Toast Notification Container (Top Right) */}
        {toasts.length > 0 && (
          <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
            {toasts.map((toast) => {
              const isSuccess = toast.type === "success";
              const isError = toast.type === "error";
              const isWarning = toast.type === "warning";
              return (
                <div
                  key={toast.id}
                  className={`pointer-events-auto p-3.5 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md transition-all animate-fadeIn ${
                    isSuccess
                      ? "bg-slate-900/95 border-emerald-500/50 text-white"
                      : isError
                      ? "bg-slate-900/95 border-rose-500/50 text-white"
                      : isWarning
                      ? "bg-slate-900/95 border-amber-500/50 text-white"
                      : "bg-slate-900/95 border-blue-500/50 text-white"
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isSuccess && (
                      <CheckCircle2
                        className="w-4.5 h-4.5 text-emerald-400"
                        strokeWidth={1.5}
                      />
                    )}
                    {isError && (
                      <AlertCircle
                        className="w-4.5 h-4.5 text-rose-400"
                        strokeWidth={1.5}
                      />
                    )}
                    {isWarning && (
                      <AlertTriangle
                        className="w-4.5 h-4.5 text-amber-400"
                        strokeWidth={1.5}
                      />
                    )}
                    {!isSuccess && !isError && !isWarning && (
                      <Info
                        className="w-4.5 h-4.5 text-blue-400"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-xs leading-tight">
                      {toast.title ||
                        (isSuccess
                          ? t("toast.titles.success", "Thành công")
                          : isError
                          ? t("toast.titles.error", "Lỗi")
                          : isWarning
                          ? t("toast.titles.warning", "Cảnh báo")
                          : t("toast.titles.info", "Thông tin"))}
                    </h5>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug break-words">
                      {toast.message}
                    </p>
                  </div>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
