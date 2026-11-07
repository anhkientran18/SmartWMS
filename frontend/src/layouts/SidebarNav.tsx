import { isDemoMode } from '../app/dataMode';
import React from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  ArrowDownUp,
  RefreshCw,
  Database,
  Building2,
  Grid3X3,
  Package,
  Truck,
  Printer,
  ShieldCheck,
  Activity,
  FileSearch,
  UserCheck,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Radio,
  ClipboardCheck,
} from "lucide-react";
import SidebarItem, { MenuItemType } from "./SidebarItem";

export interface SidebarNavProps {
  currentRole?: "Admin" | "WarehouseManager" | "Staff";
  currentLang: string;
  currentView: string;
  onChangeRole?: (role: "Admin" | "WarehouseManager" | "Staff") => void;
  onChangeView: (view: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export default function SidebarNav({
  currentRole = "Admin",
  currentLang,
  currentView,
  onChangeRole,
  onChangeView,
  isCollapsed,
  onToggleCollapse,
  className = "",
}: SidebarNavProps) {
  const { t } = useTranslation();
  const isEn = currentLang === "en-US";

  const allRoles = ["Admin", "WarehouseManager", "Staff"];

  const menuGroups: {
    id: string;
    titleKey: string;
    items: MenuItemType[];
  }[] = [
    {
      id: "operations",
      titleKey: "sidebar.groupOperations",
      items: [
        {
          id: "dashboard",
          labelVi: t("sidebar.dashboard"),
          labelEn: t("sidebar.dashboard"),
          icon: LayoutDashboard,
          roles: allRoles,
        },
        {
          id: "inventory",
          labelVi: t("sidebar.inventory"),
          labelEn: t("sidebar.inventory"),
          icon: Boxes,
          roles: allRoles,
        },
        {
          id: "orders",
          labelVi: t("sidebar.orders"),
          labelEn: t("sidebar.orders"),
          icon: ArrowDownUp,
          roles: allRoles,
        },
        {
          id: "replenishment",
          labelVi: t("sidebar.replenishment"),
          labelEn: t("sidebar.replenishment"),
          icon: RefreshCw,
          roles: allRoles,
        },
        {
          id: "cycle-counting",
          labelVi: t("sidebar.cycleCounting"),
          labelEn: t("sidebar.cycleCounting"),
          icon: ClipboardCheck,
          roles: allRoles,
        },
        ...(!isDemoMode && currentRole !== 'Staff' ? [{ id: 'kitting', labelVi: t('f7.nav'), labelEn: t('f7.nav'), icon: Package, roles: ['Admin', 'WarehouseManager'] }] : []),
      ],
    },
    {
      id: "mdm",
      titleKey: "sidebar.groupMDM",
      items: [
        ...(!isDemoMode ? [{ id: 'products', labelVi: t('f8.nav'), labelEn: t('f8.nav'), icon: Package, roles: allRoles }] : []),
        {
          id: "db",
          labelVi: t("sidebar.masterData"),
          labelEn: t("sidebar.masterData"),
          icon: Database,
          roles: allRoles,
          subItems: [
            {
              id: "db-warehouses_zones",
              labelVi: t("sidebar.db_warehouses_zones"),
              labelEn: t("sidebar.db_warehouses_zones"),
              icon: Building2,
            },
            {
              id: "db-bins",
              labelVi: t("sidebar.db_bins"),
              labelEn: t("sidebar.db_bins"),
              icon: Grid3X3,
            },
            {
              id: "db-products",
              labelVi: t("sidebar.db_products"),
              labelEn: t("sidebar.db_products"),
              icon: Package,
            },
            {
              id: "db-vendors",
              labelVi: t("sidebar.db_vendors"),
              labelEn: t("sidebar.db_vendors"),
              icon: Truck,
            },
            {
              id: "db-print-labels",
              labelVi: t("sidebar.db_print_labels"),
              labelEn: t("sidebar.db_print_labels"),
              icon: Printer,
            },
          ],
        },
      ],
    },
    {
      id: "governance",
      titleKey: "sidebar.groupGovernance",
      items: [
        {
          id: "security",
          labelVi: isDemoMode ? t("sidebar.security") : "Bảo mật & nhật ký",
          labelEn: isDemoMode ? t("sidebar.security") : "Security & audit",
          icon: ShieldCheck,
          roles: allRoles,
          subItems: [
            {
              id: "security-monitor",
              labelVi: t("sidebar.security_monitor"),
              labelEn: t("sidebar.security_monitor"),
              icon: Activity,
            },
            {
              id: "security-audit-logs",
              labelVi: isDemoMode ? t("sidebar.security_audit_logs") : "Nhật ký hoạt động",
              labelEn: isDemoMode ? t("sidebar.security_audit_logs") : "Audit logs",
              icon: FileSearch,
            },
            {
              id: "security-rbac",
              labelVi: isDemoMode ? t("sidebar.security_rbac") : 'Tài khoản người dùng',
              labelEn: isDemoMode ? t("sidebar.security_rbac") : 'User accounts',
              icon: UserCheck,
            },
          ],
        },
        {
          id: "settings",
          labelVi: isDemoMode ? t('sidebar.settings') : 'Tùy chọn giao diện',
          labelEn: isDemoMode ? t('sidebar.settings') : 'Interface preferences',
          icon: SlidersHorizontal,
          roles: allRoles,
        },
      ],
    },
  ];

  const visibleGroups = isDemoMode ? menuGroups : menuGroups.map(group => ({ ...group,
    items: group.items.filter(item => ['dashboard', 'inventory', 'replenishment', 'orders', 'cycle-counting', 'kitting', 'products', 'db', 'settings', 'security'].includes(item.id))
      .filter(item => item.id !== 'db' || currentRole !== 'Staff')
      .filter(item => item.id !== 'security' || currentRole === 'Admin')
      .map(item => item.id === 'db' ? { ...item, roles: ['Admin', 'WarehouseManager'], subItems: item.subItems?.filter(sub => ['db-warehouses_zones', 'db-bins', 'db-vendors'].includes(sub.id)) } : item.id === 'security' ? { ...item, roles: ['Admin'], subItems: item.subItems?.filter(sub => ['security-rbac', 'security-audit-logs'].includes(sub.id)) } : item),
  })).filter(group => group.items.length);

  return (
    <aside
      className={`h-screen fixed left-0 top-0 z-40 flex flex-col justify-between overflow-hidden border-r border-slate-800 bg-[#0F172A] text-[#94A3B8] shrink-0 select-none transition-all duration-200 ease-in-out ${
        isCollapsed ? "w-[260px] md:w-16" : "w-[260px]"
      } ${className}`}
    >
      {/* Brand Header */}
      {!isCollapsed ? (
        <div className="h-14 px-3.5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-600/30">
              <Boxes className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-white leading-none">
                  SmartWMS
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded">
                  ENTERPRISE
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide block truncate mt-0.5">
                Warehouse OS
              </span>
            </div>
          </div>

          {/* In-header Subtle Utility Collapse Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            id="sidebar-toggle-btn"
            className="w-7 h-7 rounded-md bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            title={t("sidebar.collapse")}
            aria-label={t("sidebar.collapse")}
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <div className="py-2.5 px-2 border-b border-slate-800/80 flex flex-col items-center justify-center gap-2 shrink-0">
          {/* Logo icon centered in 64px rail */}
          <div
            className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-600/30"
            title="SmartWMS Enterprise - Warehouse OS"
            aria-label="SmartWMS Enterprise"
          >
            <Boxes className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>

          {/* Expand button completely inside 64px rail, centered below logo */}
          <button
            type="button"
            onClick={onToggleCollapse}
            id="sidebar-toggle-btn"
            className="w-7 h-7 rounded-md bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            title={t("sidebar.expand")}
            aria-label={t("sidebar.expand")}
          >
            <ChevronRight className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Middle Scrollable Section: Navigation Menu Links */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 scrollbar-none">
        <div className="space-y-1.5 pb-3">
          {visibleGroups.map((group, groupIdx) => {
            return (
              <div key={group.id} className="space-y-0.5">
                {/* Section Header */}
                {!isCollapsed ? (
                  <div
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 px-2.5 pb-1 ${
                      groupIdx === 0 ? "pt-1" : "pt-2.5"
                    }`}
                  >
                    <span>{t(group.titleKey)}</span>
                  </div>
                ) : (
                  groupIdx > 0 && <div className="my-2 border-t border-slate-800/80 mx-2" />
                )}

                {/* Items in group */}
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    currentRole={currentRole}
                    currentLang={currentLang}
                    currentView={currentView}
                    isCollapsed={isCollapsed}
                    onChangeView={onChangeView}
                    onToggleCollapse={onToggleCollapse}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar Footer: Compact Enterprise Role Badge & Connection Status */}
      <div className="p-2.5 border-t border-slate-800/80 bg-[#0c1322] w-full shrink-0">
        {!isCollapsed ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800/60 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" strokeWidth={1.5} />
                <span className="text-slate-300 font-mono text-[10px] uppercase font-bold tracking-wider">
                  {t(`f1.roles.${currentRole}`)}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium font-mono">v2.4</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span className="truncate text-slate-300 font-medium">
                {t(isDemoMode ? "f0.text.demoBackendNotConnected" : "f1.apiMode")}
              </span>
              <Radio className="w-3.5 h-3.5 text-emerald-400/80 shrink-0 ml-auto" strokeWidth={1.5} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            {/* ADMIN Role Icon */}
            <div
              className="w-10 h-10 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center text-blue-400 cursor-default transition-colors hover:bg-slate-800"
              title={t(`f1.roles.${currentRole}`)}
              aria-label={t(`f1.roles.${currentRole}`)}
            >
              <ShieldCheck className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
            </div>

            {/* Connection Status Icon */}
            <div
              className="w-10 h-10 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center cursor-default transition-colors hover:bg-slate-800"
              title={t(isDemoMode ? "f0.text.demoBackendNotConnected" : "f1.apiMode")}
              aria-label={t(isDemoMode ? "f0.text.demoBackendNotConnected" : "f1.apiMode")}
            >
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export { SidebarNav };
