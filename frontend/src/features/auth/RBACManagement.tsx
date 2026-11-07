import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  Users,
  Key,
  Search,
  ChevronDown,
  Check,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Boxes,
  ClipboardCheck,
  ScanLine,
  FileText,
  Building2,
  CheckCircle2,
  Lock,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { rbacApi } from "../../services/api/rbacApi";
import { useQuery } from "@tanstack/react-query";

type TabTypes = "roles" | "matrix" | "users";

export default function RBACManagement() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US" || i18n.language?.startsWith("en");
  const [activeTab, setActiveTab] = useState<TabTypes>("roles");

  const tabs: { id: TabTypes; label: string }[] = [
    { id: "roles", label: t("rbac.tabs.roles", isEn ? "System roles" : "Vai trò hệ thống") },
    { id: "matrix", label: t("rbac.tabs.matrix", isEn ? "Access matrix" : "Ma trận quyền truy cập") },
    { id: "users", label: t("rbac.tabs.users", isEn ? "User roles" : "Vai trò người dùng") },
  ];

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            {t("rbac.title", isEn ? "System role management" : "Quản lý phân quyền hệ thống")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEn
              ? "Review role configurations, effective access permissions, and user roles according to backend policy."
              : "Theo dõi cấu hình vai trò, ma trận quyền truy cập và vai trò người dùng theo chính sách hệ thống."}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-b border-slate-200 mb-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap outline-none ${
                activeTab === tab.id
                  ? "text-blue-600 font-semibold"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              } rounded-t-lg`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabIndicatorRBAC"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {activeTab === "roles" && <RolesTab key="roles" onSelectTab={setActiveTab} />}
            {activeTab === "matrix" && <MatrixTab key="matrix" />}
            {activeTab === "users" && <UsersTab key="users" />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function RolesTab({ onSelectTab }: { onSelectTab?: (tab: TabTypes) => void }) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US" || i18n.language?.startsWith("en");

  // Dynamically derive role counts from authentic user datasource
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: rbacApi.getUsers,
  });

  const roles = [
    {
      id: "admin",
      name: t("rbac.roles.admin", isEn ? "System Administrator" : "Quản trị viên hệ thống"),
      desc: t("rbac.roles.adminDesc", isEn ? "Full administrative control and system configuration privileges." : "Toàn quyền quản trị và thiết lập cấu hình hệ thống."),
      color: "bg-rose-600",
      bgHover: "hover:border-rose-300",
      icon: ShieldCheck,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
    },
    {
      id: "manager",
      name: t("rbac.roles.manager", isEn ? "Warehouse Manager" : "Quản lý kho"),
      desc: t("rbac.roles.managerDesc", isEn ? "Supervise warehouse operations, inventory balancing, and order approvals." : "Điều hành nghiệp vụ kho, kiểm kê và phê duyệt chứng từ."),
      color: "bg-blue-600",
      bgHover: "hover:border-blue-300",
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      id: "staff",
      name: t("rbac.roles.staff", isEn ? "Operations Staff" : "Nhân viên vận hành"),
      desc: t("rbac.roles.staffDesc", isEn ? "Field floor execution, inbound/outbound handling, and handheld barcode scanning." : "Thực thi hiện trường, xuất nhập hàng và quét mã vạch PDA."),
      color: "bg-emerald-600",
      bgHover: "hover:border-emerald-300",
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      {roles.map((role) => {
        const count = users ? users.filter((u) => u.role === role.id).length : null;

        return (
          <div
            key={role.id}
            className={`bg-white rounded-2xl border border-slate-200 p-6 shadow-xs transition-all duration-200 ${role.bgHover} flex flex-col group`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${role.iconBg}`}>
                <role.icon className={`w-6 h-6 ${role.iconColor}`} />
              </div>
              {count !== null && (
                <div className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-2xs ${role.color}`}>
                  {isEn
                    ? `${count} ${count === 1 ? "account" : "accounts"}`
                    : `${count} tài khoản`}
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{role.name}</h3>
            <p className="text-sm text-slate-500 flex-1 mb-6 leading-relaxed">
              {role.desc}
            </p>
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab("matrix")}
              className="w-full flex items-center justify-center gap-2 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-colors"
            >
              <span>{t("rbac.roles.viewMatrixBtn", isEn ? "View access matrix" : "Xem ma trận quyền")}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        );
      })}
    </motion.div>
  );
}

function MatrixTab() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US" || i18n.language?.startsWith("en");

  const { data: matrixData, isLoading } = useQuery({
    queryKey: ["permissionMatrix"],
    queryFn: rbacApi.getPermissionMatrix,
  });

  type RoleKey = "admin" | "manager" | "staff";

  const ROLE_COLUMNS: {
    id: RoleKey;
    title: string;
    subTitle: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    headerColor: string;
    headerBg: string;
  }[] = [
    {
      id: "admin",
      title: isEn ? "Admin" : "Quản trị viên",
      subTitle: isEn ? "Full access" : "Toàn quyền",
      icon: ShieldCheck,
      headerColor: "text-rose-700",
      headerBg: "bg-rose-50/50",
    },
    {
      id: "manager",
      title: isEn ? "Manager" : "Quản lý kho",
      subTitle: isEn ? "Operations" : "Điều hành",
      icon: Users,
      headerColor: "text-blue-700",
      headerBg: "bg-blue-50/50",
    },
    {
      id: "staff",
      title: isEn ? "Staff" : "Nhân viên",
      subTitle: isEn ? "Field staff" : "Hiện trường",
      icon: CheckCircle2,
      headerColor: "text-emerald-700",
      headerBg: "bg-emerald-50/50",
    },
  ];

  const getCategoryMeta = (catKey: string) => {
    switch (catKey) {
      case "warehouse":
        return {
          name: isEn ? "Warehouse operations" : "Quản lý kho & Vận hành",
          desc: isEn
            ? "Stock adjustments, order approvals and barcode scanning"
            : "Kiểm kê, cân đối tồn kho, phê duyệt đơn và quét mã vạch hiện trường",
          icon: Building2,
          iconColor: "text-blue-600 bg-blue-100",
        };
      case "master_data":
        return {
          name: isEn ? "Master data & Storage" : "Danh mục & Vị trí lưu kho",
          desc: isEn
            ? "Catalog management for products, warehouses, zones and storage bins"
            : "Quản trị danh mục sản phẩm, nhà cung cấp, phân khu và vị trí ô kệ",
          icon: Boxes,
          iconColor: "text-amber-600 bg-amber-100",
        };
      case "system":
        return {
          name: isEn ? "System & Audit" : "Hệ thống & Nhật ký",
          desc: isEn
            ? "Audit log access and system-level configuration parameters"
            : "Truy xuất nhật ký hoạt động, giám sát an ninh và cấu hình hệ thống",
          icon: ShieldCheck,
          iconColor: "text-slate-600 bg-slate-200",
        };
      default:
        return {
          name: catKey,
          desc: "",
          icon: Key,
          iconColor: "text-slate-600 bg-slate-100",
        };
    }
  };

  const getPermissionMeta = (permKey: string, fallbackName: string) => {
    switch (permKey) {
      case "manage_inventory":
        return {
          title: isEn ? "Inventory management & stock adjustment" : "Quản lý kiểm kê & điều chỉnh tồn kho",
          desc: isEn
            ? "Reconcile inventory variances and approve count sheets. Field staff can execute assigned cycle counts."
            : "Cân đối chênh lệch tồn kho và phê duyệt kết quả kiểm đếm. Nhân viên có thể thực hiện phiếu kiểm kê được phân công.",
          icon: Boxes,
          iconBg: "bg-blue-50 text-blue-600",
        };
      case "approve_orders":
        return {
          title: isEn ? "Approve warehouse orders" : "Phê duyệt chứng từ Nhập / Xuất",
          desc: isEn
            ? "Approve inbound and outbound warehouse orders"
            : "Phê duyệt các phiếu nhập kho, xuất kho và lệnh điều phối",
          icon: ClipboardCheck,
          iconBg: "bg-blue-50 text-blue-600",
        };
      case "scan_barcodes":
        return {
          title: isEn ? "PDA mobile barcode scanning" : "Quét mã vạch hiện trường (PDA)",
          desc: isEn
            ? "Use mobile scanner for picking, putaway and bin counts"
            : "Sử dụng thiết bị cầm tay quét mã barcode lấy hàng và xếp khoang",
          icon: ScanLine,
          iconBg: "bg-emerald-50 text-emerald-600",
        };
      case "manage_master_data":
        return {
          title: isEn ? "Master data & storage bins" : "Quản lý danh mục sản phẩm & Ô kệ",
          desc: isEn
            ? "Manage products, suppliers, warehouse zones and bin locations"
            : "Thiết lập sản phẩm, nhà cung cấp, phân khu và vị trí ô kệ",
          icon: Boxes,
          iconBg: "bg-amber-50 text-amber-600",
        };
      case "view_audit_logs":
        return {
          title: isEn ? "Activity & security audit logs" : "Truy xuất nhật ký hoạt động & An ninh",
          desc: isEn
            ? "Inspect recorded user actions, warehouse events and security alerts"
            : "Theo dõi các sự kiện người dùng, thao tác kho bãi và cảnh báo an ninh",
          icon: FileText,
          iconBg: "bg-slate-100 text-slate-700",
        };
      case "system_configuration":
        return {
          title: isEn ? "System policy configuration" : "Cấu hình chính sách hệ thống",
          desc: isEn
            ? "Manage core system parameters and authorization policies"
            : "Quản trị tham số hệ thống và phân quyền tập trung",
          icon: Lock,
          iconBg: "bg-slate-100 text-slate-700",
        };
      default:
        return {
          title: fallbackName,
          desc: permKey,
          icon: Key,
          iconBg: "bg-slate-100 text-slate-600",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 bg-white rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-blue-600 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          {isEn ? "Loading access matrix..." : "Đang tải ma trận quyền truy cập..."}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
    >
      {/* Sub-header */}
      <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0">
            <Key className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {isEn ? "Access matrix" : "Ma trận quyền truy cập"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEn
                ? "Effective permissions per user role as defined by backend system policy."
                : "Quyền truy cập có hiệu lực theo vai trò người dùng được xác định bởi chính sách hệ thống."}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>{isEn ? "System policy enforced" : "Chính sách hệ thống áp dụng"}</span>
          </div>
        </div>
      </div>

      {/* Main Table: Read-only Effective Permissions */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-xs">
              <th className="px-6 py-3.5 font-bold text-slate-700 uppercase tracking-wider w-[46%] border-r border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                  <span>{isEn ? "Capability / Permission" : "Danh mục chức năng & Quyền hạn"}</span>
                </div>
              </th>

              {ROLE_COLUMNS.map((role) => {
                const RoleIcon = role.icon;
                return (
                  <th
                    key={role.id}
                    className={`px-4 py-3 text-center w-[18%] border-r border-slate-200/80 last:border-r-0 ${role.headerBg}`}
                  >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <RoleIcon className={`w-4 h-4 ${role.headerColor}`} strokeWidth={1.5} />
                        <span className={`text-sm font-bold ${role.headerColor}`}>
                          {role.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">
                        {role.subTitle}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {matrixData?.categories.map((cat) => {
              const catMeta = getCategoryMeta(cat.categoryName);
              const CatIcon = catMeta.icon;

              return (
                <React.Fragment key={cat.categoryName}>
                  {/* Category Header row */}
                  <tr className="bg-slate-100/70 border-y border-slate-200">
                    <td colSpan={4} className="px-6 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${catMeta.iconColor}`}>
                            <CatIcon className="w-4 h-4" strokeWidth={1.5} />
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-bold text-slate-800">
                              {catMeta.name}
                            </span>
                            <span className="text-xs text-slate-500 hidden md:inline">
                              — {catMeta.desc}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {cat.permissions.length} {isEn ? "permissions" : "quyền"}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Permission row items */}
                  {cat.permissions.map((perm) => {
                    const permMeta = getPermissionMeta(perm.permissionKey, perm.name);
                    const PermIcon = permMeta.icon;

                    return (
                      <tr
                        key={perm.permissionId}
                        className="border-b border-slate-200/70 hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Capability Detail */}
                        <td className="px-6 py-3.5 border-r border-slate-200/80">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${permMeta.iconBg} shrink-0 mt-0.5`}>
                              <PermIcon className="w-4 h-4" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-semibold text-slate-800">
                                {permMeta.title}
                              </span>
                              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                {permMeta.desc}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 3 Role Columns (Read-only status) */}
                        {(["admin", "manager", "staff"] as RoleKey[]).map((roleKey) => {
                          const isAllowed = !!perm.roleAccess[roleKey];
                          const isAdmin = roleKey === "admin";

                          return (
                            <td
                              key={roleKey}
                              className="px-4 py-3.5 text-center border-r border-slate-200/80 last:border-r-0 align-middle"
                            >
                              <div className="flex justify-center items-center">
                                {isAdmin ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                                    <Lock className="w-3 h-3 text-slate-500" strokeWidth={1.5} />
                                    <span>{isEn ? "Always granted" : "Luôn được cấp"}</span>
                                  </div>
                                ) : isAllowed ? (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/80">
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{isEn ? "Granted" : "Được cấp"}</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 px-2 py-1 text-slate-400 text-xs font-medium">
                                    <span className="font-mono text-slate-300 mr-1">—</span>
                                    <span>{isEn ? "Not granted" : "Không có"}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
          <span>
            {isEn
              ? "Administrator privileges and role permissions are enforced by backend authorization policy."
              : "Quyền quản trị viên và các chính sách phân quyền được thực thi tự động theo chính sách hệ thống."}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-500" />
            <span className="text-slate-600">{isEn ? "Always granted" : "Luôn được cấp"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-700 font-medium">{isEn ? "Granted" : "Được cấp quyền"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-slate-400 mr-0.5">—</span>
            <span className="text-slate-400">{isEn ? "Not granted" : "Không có quyền"}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function UsersTab() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US" || i18n.language?.startsWith("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: rbacApi.getUsers,
  });

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {isEn ? "Admin" : "Quản trị viên"}
          </span>
        );
      case "manager":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            {isEn ? "Manager" : "Quản lý kho"}
          </span>
        );
      case "staff":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            {isEn ? "Staff" : "Nhân viên"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            {role}
          </span>
        );
    }
  };

  const filteredUsers = users?.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter ? u.role.toLowerCase() === roleFilter.toLowerCase() : true;
    return matchesSearch && matchesRole;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 bg-white rounded-2xl border border-slate-200">
        <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-blue-600 animate-spin"></div>
      </div>
    );
  }

  const totalCount = filteredUsers?.length || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers?.slice(startIndex, startIndex + itemsPerPage) || [];

  const hasPreviousPage = validCurrentPage > 1;
  const hasNextPage = validCurrentPage < totalPages;

  const startRecord = totalCount === 0 ? 0 : startIndex + 1;
  const endRecord = Math.min(validCurrentPage * itemsPerPage, totalCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-xs relative flex flex-col overflow-hidden"
    >
      {/* Action Bar */}
      <div className="p-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-auto min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t("rbac.users.search", isEn ? "Search by name or email" : "Tìm theo tên hoặc email")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-w-[280px] bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Role Filter & Invite CTA */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-auto">
            <select
              className="w-full sm:w-48 appearance-none pl-4 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">{t("rbac.users.allRoles", isEn ? "All roles" : "Tất cả vai trò")}</option>
              <option value="admin">{t("rbac.roles.admin", isEn ? "Admin" : "Quản trị viên")}</option>
              <option value="manager">{t("rbac.roles.manager", isEn ? "Manager" : "Quản lý kho")}</option>
              <option value="staff">{t("rbac.roles.staff", isEn ? "Staff" : "Nhân viên vận hành")}</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          {/* Member invite button: Disabled per backend policy */}
          <button
            type="button"
            disabled
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-400 font-medium px-4 py-2 rounded-xl border border-slate-200 cursor-not-allowed text-sm whitespace-nowrap shadow-2xs"
            title={isEn ? "User provisioning is governed by backend authorization policy." : "Thao tác thêm tài khoản được quản lý bởi chính sách backend."}
          >
            <UserPlus className="w-4 h-4 text-slate-400" />
            <span>+ {t("rbac.users.inviteBtn", isEn ? "Invite member" : "Mời thành viên")}</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="w-full overflow-x-auto border-t border-slate-200">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-3.5">{t("rbac.users.headers.user", isEn ? "User" : "Nhân viên")}</th>
              <th className="px-6 py-3.5">{t("rbac.users.headers.warehouse", isEn ? "Workspace" : "Kho làm việc")}</th>
              <th className="px-6 py-3.5">{t("rbac.users.headers.role", isEn ? "Current role" : "Vai trò hiện tại")}</th>
              <th className="px-6 py-3.5 text-right">{t("rbac.users.headers.actions", isEn ? "Authorization status" : "Trạng thái phân quyền")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                      {user.avatar || user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">
                        {user.name}
                      </div>
                      <div className="text-slate-500 text-xs truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-3.5 text-sm text-slate-700 font-medium whitespace-nowrap">
                  {user.warehouse}
                </td>

                <td className="px-6 py-3.5 whitespace-nowrap">
                  {getRoleBadge(user.role)}
                </td>

                {/* Action / Mutation Safety: Neutral read-only indicator */}
                <td className="px-6 py-3.5 text-right whitespace-nowrap">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-xs font-medium cursor-not-allowed select-none"
                    title={isEn ? "Current access is determined by backend authorization policy." : "Quyền hiện tại được xác định bởi chính sách backend."}
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isEn ? "Policy governed" : "Theo chính sách"}</span>
                  </div>
                </td>
              </tr>
            ))}
            {totalCount === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium">
                    {isEn ? "No users found matching your criteria." : "Không tìm thấy nhân viên phù hợp với tiêu chí tìm kiếm."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-200 bg-white select-none gap-3">
        <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
          <span>
            {t("common.pagination.display", {
              start: startRecord,
              end: endRecord,
              total: totalCount,
            })}
          </span>
          <div className="border-l border-slate-200 h-4" />
          <div className="relative flex items-center">
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-1 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
            >
              <option value="10">10 {t("common.pagination.perPage", isEn ? "per page" : "/ trang")}</option>
              <option value="20">20 {t("common.pagination.perPage", isEn ? "per page" : "/ trang")}</option>
              <option value="50">50 {t("common.pagination.perPage", isEn ? "per page" : "/ trang")}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPreviousPage}
            onClick={() => hasPreviousPage && setCurrentPage(1)}
            className={`p-1.5 rounded-lg transition-colors ${
              hasPreviousPage
                ? "text-slate-600 hover:text-blue-600 hover:bg-slate-100 cursor-pointer"
                : "text-slate-300 cursor-not-allowed"
            }`}
            title={isEn ? "First page" : "Trang đầu"}
          >
            <ChevronsLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            disabled={!hasPreviousPage}
            onClick={() => hasPreviousPage && setCurrentPage((prev) => Math.max(1, prev - 1))}
            className={`p-1.5 rounded-lg transition-colors ${
              hasPreviousPage
                ? "text-slate-600 hover:text-blue-600 hover:bg-slate-100 cursor-pointer"
                : "text-slate-300 cursor-not-allowed"
            }`}
            title={isEn ? "Previous page" : "Trang trước"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-2xs">
            {validCurrentPage}
          </div>
          <button
            type="button"
            disabled={!hasNextPage}
            onClick={() => hasNextPage && setCurrentPage((prev) => prev + 1)}
            className={`p-1.5 rounded-lg transition-colors ${
              hasNextPage
                ? "text-slate-600 hover:text-blue-600 hover:bg-slate-100 cursor-pointer"
                : "text-slate-300 cursor-not-allowed"
            }`}
            title={isEn ? "Next page" : "Trang sau"}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            disabled={!hasNextPage}
            onClick={() => hasNextPage && setCurrentPage(totalPages)}
            className={`p-1.5 rounded-lg transition-colors ${
              hasNextPage
                ? "text-slate-600 hover:text-blue-600 hover:bg-slate-100 cursor-pointer"
                : "text-slate-300 cursor-not-allowed"
            }`}
            title={isEn ? "Last page" : "Trang cuối"}
          >
            <ChevronsRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
