import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Lock } from "lucide-react";

export interface MenuItemType {
  id: string;
  labelVi: string;
  labelEn: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconColor?: string;
  roles: string[];
  subItems?: {
    id: string;
    labelVi: string;
    labelEn: string;
    icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[];
  isSub?: boolean;
}

interface SidebarItemProps {
  key?: React.Key;
  item: MenuItemType;
  currentRole: string;
  currentLang: string;
  currentView: string;
  isCollapsed: boolean;
  onChangeView: (view: string) => void;
  onToggleCollapse: () => void;
}

export default function SidebarItem({
  item,
  currentRole,
  currentLang,
  currentView,
  isCollapsed,
  onChangeView,
  onToggleCollapse,
}: SidebarItemProps) {
  const { t } = useTranslation();
  const hasAccess = item.roles.includes(currentRole);
  const Icon = item.icon;

  // Auto-expand check for parent groups (db, security, etc.)
  const isParentActive = Boolean(
    (item.id === "db" && currentView.startsWith("db")) ||
    (item.id === "security" && currentView.startsWith("security")) ||
    (item.subItems && item.subItems.some((s) => s.id === currentView))
  );

  const [isOpen, setIsOpen] = useState(() => {
    if (!item.subItems) return false;
    if (isParentActive) return true;
    const saved = localStorage.getItem(`smartwms_menu_${item.id}_open`);
    return saved !== null ? saved === "true" : true;
  });

  // Keep open when navigating inside this section
  useEffect(() => {
    if (item.subItems && isParentActive) {
      setIsOpen(true);
    }
  }, [currentView, isParentActive, item.subItems]);

  const toggleSubMenu = () => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem(`smartwms_menu_${item.id}_open`, String(next));
      return next;
    });
  };

  const handleClick = () => {
    if (!hasAccess) return;

    if (item.subItems) {
      if (isCollapsed) {
        // In collapsed mode, navigate to the first sub-item without expanding sidebar
        if (!currentView.startsWith(`${item.id}-`)) {
          onChangeView(item.subItems[0].id);
        }
      } else {
        toggleSubMenu();
        if (!isOpen && !currentView.startsWith(`${item.id}-`)) {
          onChangeView(item.subItems[0].id);
        }
      }
    } else {
      onChangeView(item.id);
    }
  };

  const isItemActive = item.isSub
    ? currentView === item.id
    : item.subItems
    ? isParentActive
    : currentView === item.id;

  // Sub-menu item rendering
  if (item.isSub) {
    return (
      <button
        disabled={!hasAccess}
        onClick={() => hasAccess && onChangeView(item.id)}
        aria-label={currentLang === "en-US" ? item.labelEn : item.labelVi}
        title={isCollapsed ? (currentLang === "en-US" ? item.labelEn : item.labelVi) : undefined}
        className={`group w-full flex items-center ${
          isCollapsed ? "justify-center px-1 py-1.5" : "px-2.5 py-1.5"
        } rounded-md text-[12px] font-medium gap-2 transition-all whitespace-nowrap relative cursor-pointer ${
          isItemActive
            ? "bg-[#1E293B] text-blue-400 font-semibold shadow-xs"
            : "text-[#94A3B8] hover:bg-[#1E293B]/50 hover:text-slate-100"
        }`}
      >
        {isItemActive && !isCollapsed && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3.5 bg-blue-500 rounded-r-sm" />
        )}
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <Icon
              strokeWidth={1.5}
              className={`w-3.5 h-3.5 shrink-0 ${
                isItemActive ? "text-blue-400" : "text-[#94A3B8] group-hover:text-blue-400"
              }`}
            />
          )}
          {!isCollapsed && (
            <span className="leading-tight select-none">
              {currentLang === "en-US" ? item.labelEn : item.labelVi}
            </span>
          )}
        </div>
      </button>
    );
  }

  // Parent menu item rendering
  return (
    <div className="space-y-0.5">
      <button
        disabled={!hasAccess}
        onClick={handleClick}
        aria-label={currentLang === "en-US" ? item.labelEn : item.labelVi}
        title={isCollapsed ? (currentLang === "en-US" ? item.labelEn : item.labelVi) : undefined}
        className={`group w-full flex items-center ${
          isCollapsed ? "justify-center h-10 px-2" : "justify-between px-2.5 py-2"
        } rounded-lg text-[13px] font-medium gap-2 transition-all relative ${
          isItemActive
            ? isCollapsed
              ? "bg-slate-800 text-blue-400"
              : "bg-[#1E293B] text-white font-semibold shadow-xs"
            : hasAccess
            ? isCollapsed
              ? "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 cursor-pointer"
              : "text-[#94A3B8] hover:bg-[#1E293B]/60 hover:text-slate-100 cursor-pointer"
            : "text-slate-600 cursor-not-allowed opacity-40"
        }`}
      >
        {/* Active Vertical Left Indicator */}
        {isItemActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-sm" />
        )}

        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5 min-w-0"}`}>
          {Icon && (
            <Icon
              strokeWidth={1.5}
              className={`${isCollapsed ? "w-5 h-5" : "w-4 h-4"} shrink-0 transition-colors ${
                isItemActive
                  ? "text-blue-400"
                  : isCollapsed
                  ? "text-slate-400 group-hover:text-slate-100"
                  : "text-[#94A3B8] group-hover:text-slate-200"
              }`}
            />
          )}
          {!isCollapsed && (
            <span className="leading-tight select-none truncate">
              {currentLang === "en-US" ? item.labelEn : item.labelVi}
            </span>
          )}
        </div>

        {/* Chevron for items with subItems */}
        {item.subItems && !isCollapsed && hasAccess && (
          <ChevronDown
            strokeWidth={1.5}
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? "rotate-180 text-blue-400" : "group-hover:text-slate-200"
            }`}
          />
        )}

        {/* Locked Badge if no access */}
        {!item.subItems && !isCollapsed && !hasAccess && (
          <span className="text-[9px] font-mono bg-slate-900 text-slate-500 px-1 py-0.5 rounded border border-slate-800 uppercase font-medium shrink-0 inline-flex items-center gap-0.5">
            <Lock className="w-2.5 h-2.5" strokeWidth={1.5} />
            {t("sidebar.locked")}
          </span>
        )}
      </button>

      {/* Sub-menu Accordion Tree Line - strictly non-rendered when collapsed */}
      {item.subItems && !isCollapsed && (
        <div
          className={`grid transition-all duration-200 ease-in-out ${
            isOpen && hasAccess
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="ml-4 pl-2 border-l border-slate-800 space-y-0.5 my-0.5">
              {item.subItems.map((sub) => (
                <SidebarItem
                  key={sub.id}
                  item={{ ...sub, roles: item.roles, isSub: true }}
                  currentRole={currentRole}
                  currentLang={currentLang}
                  currentView={currentView}
                  isCollapsed={isCollapsed}
                  onChangeView={onChangeView}
                  onToggleCollapse={onToggleCollapse}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
