import React, { useState } from "react";
import { X, User, Mail, Shield, MapPin, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rbacApi } from "../../services/api/rbacApi";
import { InviteUserRequest } from "../../types/index";

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteUserModal({ isOpen, onClose, onSuccess }: InviteUserModalProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US" || i18n.language?.startsWith("en");
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<InviteUserRequest>({
    fullName: "",
    email: "",
    roleId: "",
    warehouse: "",
  });

  const { mutate, isPending } = useMutation({
    mutationFn: rbacApi.inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.roleId || !formData.warehouse) return;
    if (formData.roleId === "admin") return;

    mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {t("rbac.inviteModal.title", isEn ? "Invite Member" : "Mời thành viên")}
                </h2>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pr-8">
                  {t("rbac.inviteModal.subtitle", isEn ? "User creation is currently governed by backend policy." : "Thao tác thêm tài khoản được quản lý bởi chính sách hệ thống.")}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isPending}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Policy Notice */}
            <div className="mx-6 mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                {isEn
                  ? "User provisioning mutation is not supported by current backend policy. This form is read-only."
                  : "Chính sách backend hiện không hỗ trợ tự động cấp tài khoản từ giao diện. Biểu mẫu này chỉ mang tính tham khảo."}
              </span>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <form id="invite-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {t("rbac.inviteModal.fullName", isEn ? "Full Name" : "Họ và tên")}
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder={t("rbac.inviteModal.fullNamePlaceholder", isEn ? "e.g. Nguyen Van A" : "Ví dụ: Nguyễn Văn A")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-slate-100"
                      disabled
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {t("rbac.inviteModal.email", isEn ? "Email" : "Email")}
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t("rbac.inviteModal.emailPlaceholder", isEn ? "user@smartwms.com" : "email@smartwms.com")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-slate-100"
                      disabled
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {t("rbac.inviteModal.role", isEn ? "Role" : "Vai trò")}
                  </label>
                  <div className="relative flex items-center">
                    <Shield className="absolute left-3.5 text-slate-400 w-4 h-4 pointer-events-none" />
                    <select
                      name="roleId"
                      value={formData.roleId}
                      onChange={handleChange}
                      className="w-full appearance-none bg-slate-100 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-500 cursor-not-allowed"
                      disabled
                    >
                      <option value="" disabled>{t("rbac.inviteModal.rolePlaceholder", isEn ? "-- Select role --" : "-- Chọn vai trò --")}</option>
                      <option value="manager">{t("rbac.roles.manager", isEn ? "Warehouse Manager" : "Quản lý kho")}</option>
                      <option value="staff">{t("rbac.roles.staff", isEn ? "Operations Staff" : "Nhân viên vận hành")}</option>
                    </select>
                  </div>
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {t("rbac.inviteModal.warehouse", isEn ? "Assigned Warehouse" : "Kho làm việc")}
                  </label>
                  <div className="relative flex items-center">
                    <MapPin className="absolute left-3.5 text-slate-400 w-4 h-4 pointer-events-none" />
                    <select
                      name="warehouse"
                      value={formData.warehouse}
                      onChange={handleChange}
                      className="w-full appearance-none bg-slate-100 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-500 cursor-not-allowed"
                      disabled
                    >
                      <option value="" disabled>{t("rbac.inviteModal.warehousePlaceholder", isEn ? "-- Select warehouse --" : "-- Chọn kho làm việc --")}</option>
                      <option value="Tổng Kho Trung Tâm - WH-01">Tổng Kho Trung Tâm - WH-01</option>
                      <option value="Kho Vệ Tinh Bình Dương - WH-02">Kho Vệ Tinh Bình Dương - WH-02</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 focus:outline-none transition-colors"
              >
                {t("rbac.inviteModal.cancel", isEn ? "Close" : "Đóng")}
              </button>
              <button
                type="button"
                disabled
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed flex items-center justify-center min-w-[120px]"
                title={isEn ? "User provisioning is governed by system policy" : "Thao tác được quản lý bởi chính sách hệ thống"}
              >
                {t("rbac.inviteModal.submit", isEn ? "Send Invitation" : "Gửi lời mời")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
