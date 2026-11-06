/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Inbox,
  SearchX,
  AlertCircle,
  ShieldAlert,
  WifiOff,
  RotateCcw,
} from "lucide-react";

export type StateViewType =
  | "loading"
  | "empty"
  | "search-empty"
  | "error"
  | "403"
  | "offline";

export interface SharedStateViewProps {
  type: StateViewType;
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  actionText?: string;
  actionIcon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  onAction?: () => void;
  className?: string;
}

export default function SharedStateView({
  type,
  title,
  subtitle,
  onRetry,
  actionText,
  actionIcon: ActionIcon,
  onAction,
  className = "",
}: SharedStateViewProps) {
  const { t } = useTranslation();
  if (type === "loading") {
    return (
      <div
        className={`bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs space-y-3 ${className}`}
      >
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">
          {title || t("f0.states.loading")}
        </p>
      </div>
    );
  }

  if (type === "error") {
    return (
      <div
        className={`bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-2xs space-y-3 ${className}`}
      >
        <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-5 h-5" strokeWidth={2} />
        </div>
        <h4 className="text-sm font-bold text-rose-950">
          {title || t("f0.states.error")}
        </h4>
        <p className="text-xs text-rose-700 max-w-md mx-auto">
          {subtitle || t("f0.states.errorDetail")}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t("f0.states.retry")}</span>
          </button>
        )}
      </div>
    );
  }

  if (type === "403") {
    return (
      <div
        className={`bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-2xs space-y-3 ${className}`}
      >
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" strokeWidth={2} />
        </div>
        <h4 className="text-sm font-bold text-slate-900">
          {title || t("f0.states.forbidden")}
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {subtitle || t("f0.states.forbiddenDetail")}
        </p>
      </div>
    );
  }

  if (type === "offline") {
    return (
      <div
        className={`p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-3 ${className}`}
      >
        <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-amber-950">
            {title || t("f0.states.offline")}
          </p>
          <p className="text-amber-800">
            {subtitle || t("f0.states.offlineDetail")}
          </p>
        </div>
      </div>
    );
  }

  if (type === "search-empty") {
    return (
      <div
        className={`bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs space-y-3 ${className}`}
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <SearchX className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <h4 className="text-sm font-bold text-slate-800">
          {title || t("f0.states.noResults")}
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {subtitle || t("f0.states.noResultsDetail")}
        </p>
      </div>
    );
  }

  // Default "empty"
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs space-y-3 ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
        <Inbox className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <h4 className="text-sm font-bold text-slate-800">
        {title || t("f0.states.empty")}
      </h4>
      <p className="text-xs text-slate-500 max-w-sm mx-auto">
        {subtitle || t("f0.states.emptyDetail")}
      </p>
      {onAction && actionText && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
        >
          {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
}
