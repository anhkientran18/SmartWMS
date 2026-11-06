import { isDemoMode } from '../app/dataMode';
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  Home,
  Check,
} from "lucide-react";
import LanguageDropdown from "./LanguageDropdown";
import { SystemNotification } from "../types/index";

interface HeaderProps {
  currentLang: string;
  loggedInUser: string;
  currentRole: string;
  onLogout: () => void;
  onChangeLang?: (lang: string) => void;
  notifications?: SystemNotification[];
  onResolveNotif?: (id: string, approved: boolean, extraData?: any) => void;
  onMarkAllNotifsRead?: () => void;
}

export default function Header({
  currentLang,
  loggedInUser,
  currentRole,
  onLogout,
  onChangeLang,
  notifications = [],
  onResolveNotif,
  onMarkAllNotifsRead,
}: HeaderProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isEn = currentLang === "en-US";

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    i18n.changeLanguage(currentLang);
  }, [currentLang, i18n]);

  // Handle Ctrl+K shortcut for AI Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openAIChat = (query?: string) => {
    window.dispatchEvent(
      new CustomEvent("open-ai-chat", { detail: query || "" }),
    );
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      openAIChat(searchQuery);
      setSearchQuery("");
    }
  };

  const handleInputClick = () => {
    if (!searchQuery) {
      openAIChat();
    }
  };

  // Build Dynamic Breadcrumbs matching Ant Design / Tailwind UI Pro
  const breadcrumbItems = React.useMemo(() => {
    const path = location.pathname;
    const items: { label: string; path?: string }[] = [];

    // Base System Root
    items.push({
      label: t("breadcrumbs.home"),
      path: "/dashboard",
    });

    if (path === "/" || path === "/dashboard") {
      items.push({
        label: t("breadcrumbs.dashboard"),
      });
    } else if (path.startsWith("/dashboard/inventory")) {
      items.push({
        label: t("breadcrumbs.inventory"),
        path: "/dashboard/inventory",
      });
    } else if (path.startsWith('/dashboard/products')) {
      items.push({ label: t('f8.nav'), path: '/dashboard/products' });
    } else if (path.startsWith('/dashboard/kitting')) {
      items.push({ label: t('f7.nav'), path: '/dashboard/kitting' });
    } else if (path.startsWith("/dashboard/cycle-counting")) {
      items.push({
        label: t("breadcrumbs.cycle_counting"),
        path: "/dashboard/cycle-counting",
      });
    } else if (path.startsWith("/dashboard/replenishment")) {
      items.push({
        label: t("breadcrumbs.dashboard"),
        path: "/dashboard",
      });
      items.push({
        label: t("breadcrumbs.replenishment"),
      });
    } else if (path.startsWith("/dashboard/orders")) {
      items.push({
        label: t("breadcrumbs.orders"),
        path: "/dashboard/orders",
      });
      if (path.includes("inbound/create")) {
        items.push({
          label: isDemoMode ? t("breadcrumbs.inbound_create") : isEn ? "Create inbound receipt" : "Tạo phiếu nhập kho",
        });
      } else if (path.includes("outbound/create")) {
        items.push({
          label: isDemoMode ? t("breadcrumbs.outbound_create") : isEn ? "Create outbound order" : "Tạo lệnh xuất kho",
        });
      }
    } else if (path.startsWith("/dashboard/security")) {
      items.push({
        label: isDemoMode ? t("breadcrumbs.security") : isEn ? "Security & audit" : "Bảo mật & nhật ký",
        path: "/dashboard/security/rbac",
      });
      if (path.includes("rbac")) {
        items.push({
          label: isDemoMode ? t("breadcrumbs.security_rbac") : isEn ? 'User accounts' : 'Tài khoản người dùng',
        });
      } else if (path.includes("audit-logs")) {
        items.push({
          label: isDemoMode ? t("breadcrumbs.security_audit_logs") : isEn ? 'Audit logs' : 'Nhật ký hoạt động',
        });
      } else if (path.includes("monitor")) {
        items.push({
          label: t("breadcrumbs.security_monitor"),
        });
      }
    } else if (path.startsWith("/dashboard/mdm")) {
      items.push({
        label: t("breadcrumbs.mdm"),
        path: isDemoMode ? "/dashboard/mdm/products" : "/dashboard/mdm/warehouses_zones",
      });
      if (path.includes("products")) {
        items.push({
          label: t("breadcrumbs.mdm_products"),
        });
      } else if (path.includes("bins")) {
        items.push({
          label: t("breadcrumbs.mdm_bins"),
        });
      } else if (path.includes("vendors")) {
        items.push({
          label: t("breadcrumbs.mdm_vendors"),
        });
      } else if (path.includes("warehouses")) {
        items.push({
          label: t("breadcrumbs.mdm_warehouses_zones"),
        });
      } else if (path.includes("print-labels")) {
        items.push({
          label: t("breadcrumbs.mdm_print_labels"),
        });
      }
    } else if (path.startsWith('/dashboard/profile')) {
      items.push({ label: isDemoMode ? t('header.profile') : isEn ? 'Account overview' : 'Thông tin tài khoản' });
    } else if (path.startsWith("/dashboard/settings")) {
      items.push({
        label: isDemoMode ? t('breadcrumbs.settings') : isEn ? 'Interface preferences' : 'Tùy chọn giao diện',
      });
    } else if (path.includes("mobile")) {
      items.push({
        label: t("breadcrumbs.mobile"),
      });
    } else {
      items.push({
        label: t("breadcrumbs.dashboard"),
      });
    }

    return items;
  }, [location.pathname, t, isEn]);

  // Unread notification count
  const unreadCount = notifications.filter((n) => !n.read && !n.resolved).length;

  return (
    <header className="min-h-14 py-2 gap-2 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-20 select-none">
      {/* Left: Dynamic Breadcrumbs navigation */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <nav
          className="hidden sm:flex items-center text-[13px] text-slate-500 font-medium truncate"
          aria-label={t("ui.breadcrumb")}
        >
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            return (
              <React.Fragment key={index}>
                {index > 0 && (
                  <span className="text-slate-300 mx-1.5 font-normal select-none">/</span>
                )}
                {isLast ? (
                  <span className="font-semibold text-slate-900 truncate">
                    {item.label}
                  </span>
                ) : item.path ? (
                  <button
                    onClick={() => navigate(item.path!)}
                    className="hover:text-blue-600 transition-colors truncate flex items-center gap-1 cursor-pointer"
                  >
                    {index === 0 && <Home className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />}
                    <span>{item.label}</span>
                  </button>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Global AI Command Bar (macOS / Ant Design Style with Ctrl+K) */}
        {isDemoMode && <div className="flex items-center flex-1 max-w-xs md:max-w-sm relative group ml-auto">
          <Sparkles className="w-3.5 h-3.5 absolute left-3 text-blue-500 pointer-events-none z-10 group-focus-within:text-blue-600 transition-colors" strokeWidth={1.75} />

          <input
            ref={inputRef}
            type="text"
            placeholder={t("f0.text.askAiFindExpiringLotsBinsSkus")}
            className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 rounded-lg py-1.5 pl-8 pr-14 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchSubmit}
            onClick={handleInputClick}
          />

          <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-200/70 border border-slate-300/60 rounded pointer-events-none transition-opacity group-focus-within:opacity-0">
            Ctrl+K
          </kbd>
        </div>}
      </div>

      {/* Right Controls Area: Status, Notification, Language, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 relative shrink-0">
        {/* Status Tag "Hệ Thống Trực Tuyến" with green pulse dot */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px] font-medium shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>{t(isDemoMode ? "f0.demoStatus" : "f1.apiMode")}</span>
        </div>

        {/* Notifications Bell Dropdown */}
        {isDemoMode && <div className="relative">
          <button
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsProfileOpen(false);
            }}
            className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
            title={t("header.notifications.title")}
          >
            <Bell className="w-4 h-4" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold shadow-xs">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover Panel */}
          {isNotifOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsNotifOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 animate-fadeIn origin-top-right overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-blue-600" strokeWidth={2} />
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      {t("header.notifications.title")}
                    </h4>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold font-mono">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {onMarkAllNotifsRead && unreadCount > 0 && (
                    <button
                      onClick={() => onMarkAllNotifsRead()}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" strokeWidth={2} />
                      <span>{t("header.notifications.markAllRead")}</span>
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[380px]">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs px-4">
                      <Bell className="w-7 h-7 mx-auto mb-1.5 text-slate-300" strokeWidth={1.5} />
                      <p className="font-medium">
                        {t("header.notifications.empty")}
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const title = isEn ? notif.titleEn : notif.titleVi;
                      const msg = isEn ? notif.messageEn : notif.messageVi;
                      const isResolved = notif.resolved;

                      return (
                        <div
                          key={notif.id}
                          className={`p-3 transition-colors ${
                            !notif.read && !isResolved ? "bg-blue-50/40" : "bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="p-1 rounded-md shrink-0 mt-0.5 border border-slate-200/80 bg-white">
                              {notif.type === "low_stock" ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" strokeWidth={2} />
                              ) : notif.type === "anomaly" ? (
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" strokeWidth={2} />
                              ) : notif.type === "expiry" ? (
                                <AlertCircle className="w-3.5 h-3.5 text-orange-600" strokeWidth={2} />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h5 className="font-bold text-slate-900 text-xs leading-tight truncate">
                                  {title}
                                </h5>
                                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                  {notif.timestamp.slice(11, 16)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                {msg}
                              </p>

                              {/* Notification action button */}
                              {!isResolved && onResolveNotif && (
                                <div className="mt-2 flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => onResolveNotif(notif.id, true)}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" strokeWidth={2.5} />
                                    <span>{t("header.notifications.actionResolve")}</span>
                                  </button>
                                </div>
                              )}
                              {isResolved && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1">
                                  <Check className="w-3 h-3" strokeWidth={2.5} />
                                  <span>{t("header.notifications.resolved")}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>}

        {/* Language Switcher Dropdown (VN Tiếng Việt) */}
        {onChangeLang && (
          <LanguageDropdown currentLang={currentLang} onChangeLang={onChangeLang} variant="light" />
        )}

        {/* User Avatar & Dropdown ("admin - ADMIN") Minimalist Design */}
        <div className="relative" onKeyDown={e => { if (e.key === "Escape") setIsProfileOpen(false); }}>
          <button
            aria-label={t("ui.account")}
            aria-expanded={isProfileOpen}
            onKeyDown={e => { if (e.key === "Escape") setIsProfileOpen(false); }}
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 hover:bg-slate-100/80 active:bg-slate-200/60 rounded-lg border border-slate-200/70 transition-colors text-left cursor-pointer group shadow-2xs"
          >
            <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {loggedInUser ? loggedInUser.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="hidden md:flex items-center gap-1.5 leading-none">
              <span className="text-xs font-semibold text-slate-800 block truncate max-w-[100px]">
                {loggedInUser || "admin"}
              </span>
              <span className="text-slate-400 font-light">-</span>
              <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200/90 rounded px-1.5 py-0.5">
                {t(`f1.roles.${currentRole}`)}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                isProfileOpen ? "rotate-180 text-blue-600" : ""
              }`}
            />
          </button>

          {/* Profile Dropdown Popover */}
          {isProfileOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 animate-fadeIn origin-top-right text-xs">
                <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    {t("header.systemLevel")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <p className="text-xs font-bold text-slate-800 uppercase font-mono">
                      {t(`f1.roles.${currentRole}`)}
                    </p>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate("/dashboard/profile");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors text-xs font-medium cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isDemoMode ? t('header.profile') : isEn ? 'Account overview' : 'Thông tin tài khoản'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate("/dashboard/settings");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors text-xs font-medium cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isDemoMode ? t('header.settings') : isEn ? 'Interface preferences' : 'Tùy chọn giao diện'}</span>
                  </button>
                </div>

                <div className="pt-1 pb-1 mt-1 border-t border-slate-100 px-1.5">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 font-semibold text-xs rounded-md transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t("header.logout")}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
