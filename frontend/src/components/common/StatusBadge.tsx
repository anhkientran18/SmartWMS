/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export type StatusVariant =
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "gray"
  | "purple"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface StatusBadgeProps {
  label: React.ReactNode;
  variant?: StatusVariant;
  size?: "sm" | "md";
  showDot?: boolean;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  className?: string;
}

const variantStyles: Record<StatusVariant, { badge: string; dot: string; icon: string }> = {
  purple: {
    badge: "bg-purple-50 text-purple-700 border-purple-200/80",
    dot: "bg-purple-500",
    icon: "text-purple-600",
  },
  blue: {
    badge: "bg-blue-50 text-blue-700 border-blue-200/80",
    dot: "bg-blue-500",
    icon: "text-blue-600",
  },
  info: {
    badge: "bg-blue-50 text-blue-700 border-blue-200/80",
    dot: "bg-blue-500",
    icon: "text-blue-600",
  },
  green: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dot: "bg-emerald-500",
    icon: "text-emerald-600",
  },
  success: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dot: "bg-emerald-500",
    icon: "text-emerald-600",
  },
  amber: {
    badge: "bg-amber-50 text-amber-800 border-amber-200/80",
    dot: "bg-amber-500",
    icon: "text-amber-600",
  },
  warning: {
    badge: "bg-amber-50 text-amber-800 border-amber-200/80",
    dot: "bg-amber-500",
    icon: "text-amber-600",
  },
  red: {
    badge: "bg-rose-50 text-rose-700 border-rose-200/80",
    dot: "bg-rose-500",
    icon: "text-rose-600",
  },
  danger: {
    badge: "bg-rose-50 text-rose-700 border-rose-200/80",
    dot: "bg-rose-500",
    icon: "text-rose-600",
  },
  gray: {
    badge: "bg-slate-100 text-slate-700 border-slate-200/80",
    dot: "bg-slate-400",
    icon: "text-slate-500",
  },
  neutral: {
    badge: "bg-slate-100 text-slate-700 border-slate-200/80",
    dot: "bg-slate-400",
    icon: "text-slate-500",
  },
};

export function StatusBadge({
  label,
  variant = "gray",
  size = "sm",
  showDot = false,
  icon: Icon,
  className = "",
}: StatusBadgeProps) {
  const styles = variantStyles[variant];
  const sizeClasses =
    size === "md"
      ? "text-xs px-2.5 py-1 gap-1.5"
      : "text-[11px] px-2 py-0.5 gap-1";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border tracking-normal leading-none shrink-0 ${sizeClasses} ${styles.badge} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      {Icon && (
        <Icon
          className={`w-3 h-3 shrink-0 ${styles.icon}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
}

export default StatusBadge;
