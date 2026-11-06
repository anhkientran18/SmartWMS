/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Boxes,
  Smartphone,
  Sparkles,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { isDemoMode } from '../../app/dataMode';
import { login } from './authApi';
import { Role, Session, sessionStore } from './session';
import LanguageDropdown from "../../layouts/LanguageDropdown";

interface LoginScreenProps {
  currentLang: string;
  onChangeLang: (lang: string) => void;
  onLoginSuccess: (session: Session) => void;
}

export default function LoginScreen({
  currentLang,
  onChangeLang,
  onLoginSuccess,
}: LoginScreenProps) {
  const { t } = useTranslation();
  const isEn = currentLang === "en-US";

  // Form state
  const [username, setUsername] = useState(isDemoMode ? "admin" : "");
  const [password, setPassword] = useState(isDemoMode ? "admin123" : "");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDemoRole, setSelectedDemoRole] = useState<"Admin" | "WarehouseManager" | "Staff" | null>(isDemoMode ? "Admin" : null);

  // Quick Demo Account configuration
  const demoAccounts: {
    role: "Admin" | "WarehouseManager" | "Staff";
    user: string;
    pass: string;
    label: string;
    desc: string;
    badge: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    color: string;
  }[] = [
    {
      role: "Admin",
      user: "admin",
      pass: "admin123",
      label: t("roles.admin", isEn ? "Administrator" : "Quản trị viên (Admin)"),
      desc: t("roles.adminDesc", isEn ? "Full system access & security config" : "Toàn quyền hệ thống & cấu hình"),
      badge: "ROOT ACCESS",
      icon: ShieldCheck,
      color: "border-purple-500/40 hover:border-purple-400 bg-purple-950/30 text-purple-300",
    },
    {
      role: "WarehouseManager",
      user: "manager",
      pass: "manager123",
      label: t("roles.manager", isEn ? "Warehouse Manager" : "Quản lý kho"),
      desc: t("roles.managerDesc", isEn ? "Inbound/outbound & inventory ops" : "Điều hành nhập xuất & tồn kho"),
      badge: "OPERATIONS",
      icon: Boxes,
      color: "border-blue-500/40 hover:border-blue-400 bg-blue-950/30 text-blue-300",
    },
    {
      role: "Staff",
      user: "staff",
      pass: "staff123",
      label: t("roles.staff", isEn ? "Field Operator" : "Nhân viên kho (Staff)"),
      desc: t("roles.staffDesc", isEn ? "Mobile PDA picker & barcode scanner" : "Thao tác bốc hàng & quét mã"),
      badge: "MOBILE PDA",
      icon: Smartphone,
      color: "border-amber-500/40 hover:border-amber-400 bg-amber-950/30 text-amber-300",
    },
  ];

  const establishDemo = (role: Role, user: string) => {
    if (!isDemoMode) return;
    const session: Session = { token: '', username: user, role };
    sessionStore.set(session);
    onLoginSuccess(session);
  };
  const handleSelectDemoAccount = (acc: typeof demoAccounts[0], autoLogin = false) => {
    if (!isDemoMode || isSubmitting) return;
    setUsername(acc.user); setPassword(acc.pass); setSelectedDemoRole(acc.role); setErrorMessage('');
    if (autoLogin) establishDemo(acc.role, acc.user);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');
    if (!username.trim()) { setErrorMessage(t('login.errors.missing_user')); return; }
    if (!password) { setErrorMessage(t('login.errors.missing_pass')); return; }
    setIsSubmitting(true);
    try {
      if (isDemoMode) {
        const account = demoAccounts.find(acc => acc.user === username.trim() && acc.pass === password);
        if (!account) { setErrorMessage(t('f1.errors.demoCredentials')); return; }
        establishDemo(account.role, account.user);
      } else onLoginSuccess(await login({ username: username.trim(), password }));
    } catch (error) {
      const status = (error as { status?: number }).status;
      setErrorMessage(t(`f1.errors.${status === undefined ? 'network' : [400, 401, 403, 404, 409].includes(status) ? String(status) : 'server'}`));
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none">
      {/* Decorative Cyber Grid Background Layer */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

      {/* Ambient Color Accents */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div
        id="login-container"
        className="w-full max-w-lg bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl shadow-blue-500/5 relative z-10 overflow-hidden backdrop-blur-md p-6 sm:p-8 ring-1 ring-white/5"
      >
        {/* Brand & Language Switcher Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center font-sans font-extrabold text-white text-lg shadow-lg shadow-blue-600/20">
              <Boxes className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-sans font-bold text-base tracking-tight text-white leading-none">
                  SmartWMS
                </h1>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1 py-0.2 text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded">
                  <Sparkles className="w-2.5 h-2.5" strokeWidth={1.5} />
                  PRO
                </span>
              </div>
              <p className="text-[10px] font-mono font-medium tracking-wider text-slate-400 uppercase mt-0.5">
                {t("ui.brandDescriptor")}
              </p>
            </div>
          </div>

          <LanguageDropdown currentLang={currentLang} onChangeLang={onChangeLang} variant="dark" />
        </div>

        {/* Title and Intro */}
        <div className="mb-5">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {t("login.title", isEn ? "Smart Warehouse Management System" : "Hệ Thống Quản Lý Kho Thông Minh")}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t("login.subtitle", isEn ? "Sign in to access enterprise logistics operations" : "Đăng nhập để truy cập cổng điều hành logistics Enterprise")}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div role="alert" className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" strokeWidth={1.5} />
            <span className="font-medium text-[11px]">{errorMessage}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form aria-busy={isSubmitting} onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label htmlFor="login-username" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              {t("login.username", isEn ? "Username / Staff ID" : "Tên đăng nhập / Mã NV")}
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 text-slate-500 w-4 h-4" strokeWidth={1.5} />
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                aria-label={t("login.username")}
                disabled={isSubmitting}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isDemoMode ? t("login.username_placeholder", isEn ? "Enter username (e.g. admin)" : "Nhập tên tài khoản (VD: admin)") : (isEn ? "Enter username" : "Nhập tên đăng nhập")}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-slate-200 placeholder-slate-600 outline-none transition focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {t("login.password", isEn ? "Security Password" : "Mật khẩu bảo mật")}
              </label>
              {isDemoMode && <span className="text-[10px] text-slate-500 font-mono">demo: admin123</span>}
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500 w-4 h-4" strokeWidth={1.5} />
              <input
                id="login-password"
                autoComplete="current-password"
                aria-label={t("login.password")}
                disabled={isSubmitting}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isDemoMode ? t("login.password_placeholder", isEn ? "Enter password" : "Nhập mật khẩu") : (isEn ? "Enter password" : "Nhập mật khẩu")}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-xl py-2.5 pl-10 pr-10 text-xs font-medium text-slate-200 placeholder-slate-600 outline-none transition focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                aria-label={t(showPassword ? "ui.hidePassword" : "f1.showPassword")}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-sans font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-lg hover:shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                <span>{t("login.authorizing", isEn ? "Verifying Credentials..." : "Đang xác thực thông tin...")}</span>
              </>
            ) : (
              <>
                <span>{t("login.login_btn", isEn ? "Sign In To SmartWMS" : "Đăng Nhập Hệ Thống")}</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </>
            )}
          </button>
        </form>

        {/* ========================================================================= */}
        {/* QUICK DEMO ACCOUNTS (1-CLICK TEST RBAC ROLES) */}
        {/* ========================================================================= */}
        {isDemoMode && <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.5} />
              {t("login.quick_demo", isEn ? "Quick Demo Test Accounts (RBAC)" : "Tài Khoản Kiểm Thử Nhanh (Demo RBAC)")}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {t("login.click_to_fill", isEn ? "Click to auto-fill" : "Bấm để tự điền")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {demoAccounts.map((acc) => {
              const AccIcon = acc.icon;
              const isSelected = selectedDemoRole === acc.role && username === acc.user;

              return (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleSelectDemoAccount(acc, false)}
                  onDoubleClick={() => handleSelectDemoAccount(acc, true)}
                  className={`p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between gap-1.5 group relative ${
                    isSelected
                      ? "ring-2 ring-blue-500/70 border-blue-500 " + acc.color
                      : "border-slate-800 bg-slate-950/60 hover:bg-slate-850 hover:border-slate-700 text-slate-300"
                  }`}
                  title={`${acc.label}: ${acc.user} / ${acc.pass} (Double-click to sign in instantly)`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <AccIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                      <span className="font-bold text-xs font-mono">{acc.role}</span>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" strokeWidth={1.5} />
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 leading-tight line-clamp-1">
                    {acc.desc}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[9px] font-mono">
                    <span className="text-slate-500">{acc.user}</span>
                    <span className="text-blue-400 font-bold uppercase">{acc.badge}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        }
        {/* Footer info */}
        <div className="mt-6 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>SMARTWMS ENTERPRISE v8.2</span>
          <span>{t("ui.secureAccess")}</span>
        </div>
      </div>
    </div>
  );
}
