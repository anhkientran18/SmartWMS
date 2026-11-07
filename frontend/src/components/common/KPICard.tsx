/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export interface KPICardProps {
  label: string;
  value: React.ReactNode;
  supportingText?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  variant?: "default" | "blue" | "green" | "amber" | "red";
  className?: string;
  appearance?: "default" | "inventory";
}

const variantTheme: Record<
  "default" | "blue" | "green" | "amber" | "red",
  { label: string; value: string; icon: string; bg: string; border: string }
> = {
  default: {
    label: "text-slate-500",
    value: "text-slate-900",
    icon: "text-slate-400",
    bg: "bg-white",
    border: "border-slate-200/80",
  },
  blue: {
    label: "text-blue-700",
    value: "text-blue-700",
    icon: "text-blue-500",
    bg: "bg-white",
    border: "border-slate-200/80",
  },
  green: {
    label: "text-emerald-700",
    value: "text-emerald-700",
    icon: "text-emerald-600",
    bg: "bg-white",
    border: "border-slate-200/80",
  },
  amber: {
    label: "text-amber-800",
    value: "text-amber-700",
    icon: "text-amber-600",
    bg: "bg-white",
    border: "border-slate-200/80",
  },
  red: {
    label: "text-rose-700",
    value: "text-rose-700",
    icon: "text-rose-500",
    bg: "bg-white",
    border: "border-slate-200/80",
  },
};

export default function KPICard({
  label,
  value,
  supportingText,
  icon: Icon,
  variant = "default",
  className = "",
  appearance = "default",
}: KPICardProps) {
  const theme = variantTheme[variant];
  const inventory = appearance === "inventory";
  const edge = { default: 'border-l-slate-400', blue: 'border-l-blue-600', green: 'border-l-emerald-500', amber: 'border-l-amber-500', red: 'border-l-rose-500' }[variant];

  return (
    <div
      className={`p-4 rounded-2xl border ${theme.border} ${theme.bg} shadow-2xs flex flex-col justify-between select-none ${inventory ? `border-l-4 ${edge}` : ''} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className={`${inventory ? 'text-xs font-medium leading-5' : 'text-[11px] font-semibold uppercase tracking-wider leading-4'} ${theme.label}`}
        >
          {label}
        </span>
        {Icon && (
          <Icon
            className={`w-4 h-4 shrink-0 ${theme.icon}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
      </div>

      <div className={`text-2xl font-bold font-mono tracking-tight ${theme.value}`}>
        {value}
      </div>

      {supportingText && (
        <div className="text-[11px] text-slate-500 mt-0.5">
          {supportingText}
        </div>
      )}
    </div>
  );
}
