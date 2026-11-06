import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

/*
 * =========================================================================
 * MẪU CẤU HÌNH NESTED ROUTER CHO SMARTWMS (React Router v6)
 * File này dùng làm mẫu tham khảo cách cấu trúc Router cho dự án thực tế.
 *
 * Lưu ý: Trong phiên bản hiện tại của applet, logic routing đã được tích
 * hợp trực tiếp trong App.tsx để dễ dàng truyền các props State toàn cục.
 * =========================================================================
 */

// Dummy imports cho các màn hình
const WebDashboard = () => <div>Web Dashboard</div>;
const MobileApp = () => <div>Mobile Staff App</div>;
const AdminPanel = ({ activeSubTab }: { activeSubTab: string }) => <div>Admin Panel - {activeSubTab}</div>;
const DBViewer = ({ activeSubTab }: { activeSubTab: string }) => <div>DB Viewer - {activeSubTab}</div>;

export default function AppRoutes() {
  return (
    <Routes>
      {/* Route Mặc định (Index Redirect) */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Các Route Độc lập chính */}
      <Route path="/dashboard" element={<WebDashboard />} />
      <Route path="/mobile" element={<MobileApp />} />

      {/* Nested Route cho Security & Auditing (Bảo mật & Nhật ký) */}
      <Route path="/dashboard/security/*" element={
        <Routes>
          <Route path="audit-logs" element={<AdminPanel activeSubTab="audit-logs" />} />
          <Route path="monitor" element={<AdminPanel activeSubTab="monitor" />} />
          <Route path="*" element={<Navigate to="audit-logs" replace />} />
        </Routes>
      } />

      {/* Nested Route cho Master Data Management (Danh mục hệ thống) */}
      <Route path="/dashboard/mdm/*" element={
        <Routes>
          <Route path="products" element={<DBViewer activeSubTab="products" />} />
          <Route path="bins" element={<DBViewer activeSubTab="bins" />} />
          <Route path="vendors" element={<DBViewer activeSubTab="vendors" />} />
          <Route path="warehouses_zones" element={<DBViewer activeSubTab="warehouses_zones" />} />
          <Route path="print-labels" element={<AdminPanel activeSubTab="labels" />} />

          <Route path="*" element={<Navigate to="products" replace />} />
        </Routes>
      } />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
