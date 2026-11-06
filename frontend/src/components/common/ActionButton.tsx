/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Loader2 } from "lucide-react";

export type ActionButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ActionButtonSize = "sm" | "md";

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  isLoading?: boolean;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }> | React.ReactNode;
  iconPosition?: "left" | "right";
  tooltip?: string;
  isIconOnly?: boolean;
}

const variantClasses: Record<ActionButtonVariant, string> = {
  primary:
    "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold shadow-xs border border-transparent focus:ring-2 focus:ring-blue-500/30",
  secondary:
    "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold border border-slate-300 shadow-2xs focus:ring-2 focus:ring-slate-400/20",
  ghost:
    "bg-transparent hover:bg-slate-100 active:bg-slate-200/70 text-slate-600 hover:text-slate-900 font-medium border border-transparent focus:ring-2 focus:ring-slate-300",
  destructive:
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold shadow-xs border border-transparent focus:ring-2 focus:ring-rose-500/30",
};

export default function ActionButton({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  iconPosition = "left",
  tooltip,
  isIconOnly = false,
  disabled,
  className = "",
  type = "button",
  "aria-label": ariaLabel,
  ...rest
}: ActionButtonProps) {
  const isSm = size === "sm";

  const sizeClasses = isIconOnly
    ? isSm
      ? "w-8 h-8 p-0"
      : "w-9 h-9 p-0"
    : isSm
    ? "h-8 px-3 text-xs gap-1.5"
    : "h-9 px-3.5 text-xs gap-1.5";

  const effectiveAriaLabel = ariaLabel || tooltip || (typeof children === "string" ? children : undefined);

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function") {
      const IconComponent = icon as React.ComponentType<{ className?: string; strokeWidth?: number }>;
      return <IconComponent className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />;
    }
    return null;
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      title={tooltip}
      aria-label={effectiveAriaLabel}
      className={`inline-flex items-center justify-center rounded-xl transition-all select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none ${sizeClasses} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        <>
          {iconPosition === "left" && renderIcon()}
          {children && <span>{children}</span>}
          {iconPosition === "right" && renderIcon()}
        </>
      )}
    </button>
  );
}
