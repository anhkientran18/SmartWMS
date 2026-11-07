import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, Wifi, Activity, Send, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DeviceData {
  id: string;
  operator: string;
  zone: string;
  zoneKey?: string;
  task: string;
  taskKey: string;
  progress: number;
  status: 'online' | 'offline';
  isBusy: boolean;
  deviceType?: 'pda' | 'byod';
}

const mockDevices: DeviceData[] = [
  { id: 'PDA-01', operator: 'Nguyễn Văn Hùng', zone: 'Zone A - Cool Zone', zoneKey: 'zone_a', task: 'Đang nhặt hàng Wave-001', taskKey: 'picking', progress: 45, status: 'online', isBusy: true, deviceType: 'pda' },
  { id: 'MOB-02', operator: 'Trần Anh Tuấn', zone: 'Zone B - Dry Zone', zoneKey: 'zone_b', task: 'Đang kiểm kho định kỳ', taskKey: 'cycleCounting', progress: 80, status: 'online', isBusy: true, deviceType: 'byod' },
  { id: 'PDA-03', operator: 'Kiện Nguyễn', zone: 'Không có', zoneKey: 'none', task: 'Đang chờ lệnh (Idle)', taskKey: 'idle', progress: 0, status: 'offline', isBusy: false, deviceType: 'pda' },
];

export default function StaffMobileAppPortal() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('vi') ? 'vi' : 'en';
  const [devices] = useState<DeviceData[]>(mockDevices);

  const totalRecords = devices.length;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const busyDevices = devices.filter(d => d.isBusy).length;

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-6 flex flex-col items-start justify-between sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t("deviceMonitor.title", currentLang === 'vi' ? 'Giám sát thiết bị cầm tay Staff' : 'Staff Handheld Device Monitor')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("deviceMonitor.subtitle", currentLang === 'vi' ? 'Quản lý và điều phối công việc cho thiết bị PDA di động' : 'Manage and dispatch tasks to mobile PDA devices')}
          </p>
        </div>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Card 1: Total Devices */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{t("deviceMonitor.widgets.total", currentLang === 'vi' ? 'Tổng số thiết bị đăng ký' : 'Total Registered Devices')}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{totalRecords}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <Smartphone className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Online Devices */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              {t("deviceMonitor.widgets.online", currentLang === 'vi' ? 'Thiết bị đang trực tuyến' : 'Online Devices')}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{onlineDevices}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
            <Wifi className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Busy Devices */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{t("deviceMonitor.widgets.busy", currentLang === 'vi' ? 'Thiết bị đang bận (In-Task)' : 'Devices In-Task')}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{busyDevices}</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col min-h-[calc(100vh-24rem)] mt-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-4 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t("deviceMonitor.headers.deviceId", currentLang === 'vi' ? "MÃ THIẾT BỊ" : "DEVICE ID")}</th>
                <th className="py-4 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t("deviceMonitor.headers.operator", currentLang === 'vi' ? "NHÂN VIÊN VẬN HÀNH" : "OPERATOR")}</th>
                <th className="py-4 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t("web.monitor.device_type", currentLang === 'vi' ? "LOẠI THIẾT BỊ" : "DEVICE TYPE")}</th>
                <th className="py-4 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t("deviceMonitor.headers.zone", currentLang === 'vi' ? "VÙNG LÀM VIỆC" : "WORK ZONE")}</th>
                <th className="py-4 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t("deviceMonitor.headers.task", currentLang === 'vi' ? "NHIỆM VỤ HIỆN TẠI" : "CURRENT TASK")}</th>
                <th className="py-4 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t("deviceMonitor.headers.progress", currentLang === 'vi' ? "TIẾN ĐỘ QUÉT" : "SCAN PROGRESS")}</th>
                <th className="py-4 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t("deviceMonitor.headers.status", currentLang === 'vi' ? "TRẠNG THÁI" : "STATUS")}</th>
                <th className="py-4 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">{t("deviceMonitor.headers.action", currentLang === 'vi' ? "ĐIỀU PHỐI" : "DISPATCH")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-5">
                    <span className="font-semibold text-slate-900">{device.id}</span>
                  </td>
                  <td className="py-3 px-5 text-sm font-medium text-slate-700">
                    {device.operator}
                  </td>
                  <td className="py-3 px-5">
                    {device.deviceType === 'pda' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        🤖 {t("web.monitor.pda", currentLang === 'vi' ? "PDA Công Nghiệp" : "Industrial PDA")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
                        📲 {t("web.monitor.byod", currentLang === 'vi' ? "Điện thoại (BYOD)" : "Smartphone (BYOD)")}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-sm text-slate-600">
                    {device.zoneKey === 'none'
                      ? t("deviceMonitor.zone.none", currentLang === 'vi' ? 'Không có' : 'None')
                      : device.zoneKey === 'zone_a'
                        ? t("web.monitor.zone_a", currentLang === 'vi' ? 'Phân khu A - Khu Mát' : 'Zone A - Cool Zone')
                        : device.zoneKey === 'zone_b'
                          ? t("web.monitor.zone_b", currentLang === 'vi' ? 'Phân khu B - Khu Khô' : 'Zone B - Dry Zone')
                          : device.zone}
                  </td>
                  <td className="py-3 px-5 text-sm text-slate-600">
                    {device.taskKey === 'picking' ? t("deviceMonitor.tasks.picking", currentLang === 'vi' ? 'Đang nhặt hàng Wave-001' : 'Picking Wave-001') :
                     device.taskKey === 'cycleCounting' ? t("deviceMonitor.tasks.cycleCounting", currentLang === 'vi' ? 'Đang kiểm kho định kỳ' : 'Cycle Counting') :
                     device.taskKey === 'idle' ? t("deviceMonitor.tasks.idle", currentLang === 'vi' ? 'Đang chờ lệnh (Idle)' : 'Idle') : device.task}
                  </td>
                  <td className="py-3 px-5 w-48">
                    <div className="flex items-center gap-2">
                       <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${device.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${device.progress}%` }}
                          />
                       </div>
                       <span className="text-xs font-semibold text-slate-600 w-8">{device.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    {device.status === 'online' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 outline outline-2 outline-emerald-50 outline-offset-0"></span>
                        {currentLang === 'vi' ? 'Trực tuyến' : 'Live / Online'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        {currentLang === 'vi' ? 'Ngoại tuyến' : 'Offline'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      disabled={device.isBusy || device.status === 'offline'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        !device.isBusy && device.status === 'online'
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {t("deviceMonitor.action.dispatch", currentLang === 'vi' ? "Giao việc nhanh" : "Dispatch Task")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Sync with standard UI */}
        <div className="mt-auto w-full flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white select-none text-sm">
          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <div>
              {t("common.pagination.display", { start: 1, end: totalRecords, total: totalRecords })}
            </div>
            <div className="border-l border-slate-200 h-4" />
            <select className="appearance-none border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer">
              <option value="10">10 {t('common.pagination.perPage', currentLang === 'vi' ? 'mục/trang' : 'items/page')}</option>
              <option value="20">20 {t('common.pagination.perPage', currentLang === 'vi' ? 'mục/trang' : 'items/page')}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 font-medium">
            <button className={`flex items-center justify-center transition-colors ${totalPages === 1 ? 'text-slate-300 cursor-not-allowed p-1.5' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer'}`} disabled={totalPages === 1}>
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button className={`flex items-center justify-center transition-colors ${totalPages === 1 ? 'text-slate-300 cursor-not-allowed p-1.5' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer'}`} disabled={totalPages === 1}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button key={page} className={`flex items-center justify-center transition-colors ${page === 1 ? 'w-8 h-8 rounded-lg bg-blue-600 text-white shadow-sm font-bold text-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 h-8 w-8 rounded-lg transition-all cursor-pointer'}`}>
                {page}
              </button>
            ))}
            <button className={`flex items-center justify-center transition-colors ${totalPages === 1 ? 'text-slate-300 cursor-not-allowed p-1.5' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer'}`} disabled={totalPages === 1}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button className={`flex items-center justify-center transition-colors ${totalPages === 1 ? 'text-slate-300 cursor-not-allowed p-1.5' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer'}`} disabled={totalPages === 1}>
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
