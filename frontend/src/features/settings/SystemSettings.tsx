import React, { useState } from "react";
import {
  Bot,
  Settings,
  Shield,
  Globe,
  Clock,
  Bell,
  Lock,
  Server,
  KeyRound,
  CheckCircle2,
  FileText,
  UserCheck
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

const getBaseLanguage = (lang?: string) => {
  if (!lang) return 'vi';
  return lang.toLowerCase().startsWith('vi') ? 'vi' : 'en';
};

export default function SystemSettings() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en-US" || i18n.language?.startsWith("en");

  const [activeTab, setActiveTab] = useState<"general" | "ai" | "security">("general");
  const [selectedLang, setSelectedLang] = useState(getBaseLanguage(i18n.language));
  const [langChangeFeedback, setLangChangeFeedback] = useState(false);

  React.useEffect(() => {
    setSelectedLang(getBaseLanguage(i18n.language));
  }, [i18n.language]);

  const handleLanguageChange = async (newLang: string) => {
    setSelectedLang(newLang);
    const targetCode = newLang === 'vi' ? 'vi-VN' : 'en-US';
    await i18n.changeLanguage(targetCode);
    localStorage.setItem('saved_system_lang', targetCode);
    localStorage.setItem('i18nextLng', targetCode);
    setLangChangeFeedback(true);
    setTimeout(() => setLangChangeFeedback(false), 2500);
  };

  const navTabs = [
    {
      id: "general" as const,
      label: t("settings.tabs.general", isEn ? "General Settings" : "Cài đặt chung"),
      icon: Settings
    },
    {
      id: "ai" as const,
      label: t("settings.tabs.ai", isEn ? "AI Integration" : "Tích hợp AI"),
      icon: Bot
    },
    {
      id: "security" as const,
      label: t("settings.tabs.security", isEn ? "Security & Tokens" : "Bảo mật & Token"),
      icon: Shield
    },
  ];

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-6 lg:p-8 animate-fadeIn relative">
      {/* Tiêu đề trang chuẩn sentence case */}
      <div className="mb-8">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
            <Settings className="w-6 h-6" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t("settings.title", isEn ? "System Settings" : "Cài đặt hệ thống")}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {t("settings.description", isEn ? "View server runtime parameters, security policies, and interface display preferences." : "Xem thông số vận hành máy chủ, chính sách bảo mật và tùy chọn hiển thị giao diện.")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1.5 bg-white md:bg-transparent rounded-2xl border md:border-0 border-slate-200 p-2 md:p-0 md:border-r md:border-slate-200/80 md:pr-4">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all rounded-xl md:rounded-r-xl text-left cursor-pointer ${
                  isActive
                    ? "border-l-2 border-blue-600 bg-blue-50/50 font-bold text-blue-600"
                    : "border-l-2 border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 w-full">
          <AnimatePresence mode="wait">
            {activeTab === "general" && (
              <motion.div
                key="general"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Thông số hiển thị & Múi giờ */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      {t("settings.general.regional", isEn ? "Display & Regional Settings" : "Thông số hiển thị & Múi giờ")}
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Ngôn ngữ hiển thị phiên làm việc */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t("settings.general.language", isEn ? "Interface Display Language" : "Ngôn ngữ giao diện người dùng")}</span>
                        </label>
                        <select
                          value={selectedLang}
                          onChange={(e) => handleLanguageChange(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs cursor-pointer transition-all"
                        >
                          <option value="vi">Tiếng Việt (Vietnamese)</option>
                          <option value="en">English (US)</option>
                        </select>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                          <span>{t("settings.general.languageDesc", isEn ? "Language setting is applied directly to this browser session." : "Ngôn ngữ hiển thị được áp dụng trực tiếp cho phiên làm việc trên trình duyệt này.")}</span>
                          {langChangeFeedback && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t("settings.general.savedLangNotice", isEn ? "Updated" : "Đã cập nhật")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Múi giờ vận hành kho - Read-only */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t("settings.general.timezone", isEn ? "Warehouse Operational Timezone" : "Múi giờ vận hành kho")}</span>
                        </label>
                        <div className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-sm font-mono text-slate-800 shadow-2xs">
                          <span>(UTC+07:00) Asia/Ho_Chi_Minh</span>
                          <span className="text-[10px] font-sans font-semibold uppercase tracking-wider bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded">
                            {isEn ? "System Default" : "Mặc định hệ thống"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {t("settings.general.timezoneDesc", isEn ? "Standard warehouse operating timezone synchronized with server runtime configuration." : "Múi giờ vận hành chuẩn của kho hàng được đồng bộ theo cấu hình máy chủ.")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thông báo vận hành nội bộ */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-slate-600" />
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      {t("settings.general.realtime", isEn ? "In-app Operational Notifications" : "Thông báo vận hành nội bộ")}
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 mt-0.5 shadow-2xs">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          {t("settings.general.realtime", isEn ? "In-app Operational Notifications" : "Thông báo vận hành nội bộ")}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                          {t("settings.general.realtimeDesc", isEn ? "The system records and displays internal operational alerts (low stock thresholds, order receipts) directly in the application interface." : "Hệ thống hỗ trợ ghi nhận và hiển thị cảnh báo vận hành nội bộ (tồn kho dưới mức an toàn, chứng từ xuất nhập) trên giao diện ứng dụng.")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="mb-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {t("settings.ai.title", isEn ? "Artificial Intelligence (AI) Integration" : "Tích hợp trí tuệ nhân tạo (AI)")}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {t("settings.ai.subtitle", isEn ? "Information regarding the system's language processing and automated data analytics services." : "Thông tin về dịch vụ xử lý ngôn ngữ và phân tích dữ liệu tự động của hệ thống.")}
                  </p>
                </div>

                {/* Dịch vụ AI máy chủ */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Bot className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        {t("settings.ai.serviceTitle", isEn ? "Server-side AI Processing" : "Dịch vụ xử lý AI máy chủ")}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                      SERVER MANAGED
                    </span>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {t("settings.ai.provider", isEn ? "Service Provider" : "Nhà cung cấp dịch vụ")}
                        </span>
                        <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <Bot className="w-4 h-4 text-indigo-600" />
                          <span>Google Gemini API</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {t("settings.ai.management", isEn ? "Management Method" : "Phương thức quản lý")}
                        </span>
                        <div className="text-sm font-mono font-semibold text-slate-900 flex items-center gap-2">
                          <Server className="w-4 h-4 text-slate-500" />
                          <span>{t("settings.ai.managementValue", isEn ? "Server environment variables (GEMINI_API_KEY)" : "Biến môi trường máy chủ (GEMINI_API_KEY)")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t("settings.ai.capabilities", isEn ? "Supported Capabilities" : "Khả năng hỗ trợ")}
                      </span>
                      <p className="text-sm text-slate-800 leading-relaxed">
                        {t("settings.ai.capabilitiesValue", isEn ? "PO/invoice document OCR, inventory analytics" : "Nhận diện chứng từ PO/hóa đơn, phân tích tồn kho")}
                      </p>
                    </div>

                    {/* Notice về an toàn cấu hình */}
                    <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/70 flex items-start gap-3 text-xs text-blue-900 leading-relaxed">
                      <Server className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>
                        {t("settings.ai.securityNotice", isEn ? "API keys and model parameters are managed directly via server environment variables for security. Administrators do not need to configure them manually in the web interface." : "Khóa API và tham số mô hình được quản lý trực tiếp qua biến môi trường máy chủ để đảm bảo an toàn bảo mật. Quản trị viên không cần cấu hình thủ công trên giao diện web.")}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "security" && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="mb-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {t("settings.security.title", isEn ? "Security & Tokens" : "Bảo mật & Token")}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {t("settings.security.subtitle", isEn ? "Session authentication policies, token lifetimes, and system security architecture." : "Chính sách xác thực phiên làm việc, thời hạn token và kiến trúc an toàn hệ thống.")}
                  </p>
                </div>

                {/* Chính sách xác thực & Token (JWT) - Read-only truth */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Lock className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        {t("settings.security.jwtSection", isEn ? "Authentication & Token Policies (JWT)" : "Chính sách xác thực & Token (JWT)")}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                      {t("settings.security.serverManaged", isEn ? "Server-side Managed" : "Quản lý tại máy chủ")}
                    </span>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Access Token Lifetime */}
                      <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            {t("settings.security.accessTokenLife", isEn ? "Access Token Lifetime" : "Thời hạn Access Token")}
                          </label>
                          <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                            {t("settings.security.accessTokenLifeValue", isEn ? "15 minutes" : "15 phút")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {t("settings.security.accessTokenDesc", isEn ? "Default Access Token validity period enforced by server runtime." : "Thời hạn hiệu lực mặc định của Access Token do máy chủ áp dụng.")}
                        </p>
                      </div>

                      {/* Refresh Token Lifetime */}
                      <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            {t("settings.security.refreshTokenLife", isEn ? "Refresh Token Lifetime" : "Thời hạn Refresh Token")}
                          </label>
                          <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                            {t("settings.security.refreshTokenLifeValue", isEn ? "7 days" : "7 ngày")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {t("settings.security.refreshTokenDesc", isEn ? "Retention period for session renewal and automatic token rotation." : "Thời gian lưu trữ phiên đăng nhập và cấp mới token tự động.")}
                        </p>
                      </div>
                    </div>

                    {/* Dòng Khóa ký token trung tính */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            {t("settings.security.signingKey", isEn ? "Token Signing Key" : "Khóa ký token")}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          {isEn ? "PROTECTED" : "ĐƯỢC BẢO VỆ"}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800">
                        {t("settings.security.signingKeyDesc", isEn ? "Token signing keys are managed by server configuration." : "Khóa ký token được quản lý bởi cấu hình máy chủ.")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t("settings.security.signingKeyNotice", isEn ? "Secret signing keys are securely stored in server environment variables and are not exposed in the web interface." : "Khóa ký bí mật (secret key) được lưu trữ an toàn trong biến môi trường máy chủ và không được công khai trên giao diện web.")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Kiến trúc an toàn hệ thống */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      {t("settings.security.architectureSection", isEn ? "System Security Architecture" : "Kiến trúc an toàn hệ thống")}
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">
                            {t("settings.security.tokenRevocation", isEn ? "Token Revocation & Logout" : "Thu hồi token & Đăng xuất")}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {t("settings.security.tokenRevocationDesc", isEn ? "Supports in-memory token blacklist and immediate session revocation upon logout." : "Hỗ trợ danh sách thu hồi token (blacklist) và hủy phiên làm việc tức thì khi đăng xuất.")}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        {isEn ? "Enforced" : "Đang thực thi"}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-start gap-3">
                        <UserCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">
                            {t("settings.security.rbac", isEn ? "Role-Based Access Control (RBAC)" : "Kiểm soát truy cập dựa trên vai trò (RBAC)")}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {t("settings.security.rbacDesc", isEn ? "All API requests are strictly verified against Admin, Manager, and Staff role definitions." : "Mọi yêu cầu API đều được kiểm tra phân quyền nghiêm ngặt theo vai trò Quản trị viên, Quản lý kho, Nhân viên.")}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        {isEn ? "Enforced" : "Đang thực thi"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
