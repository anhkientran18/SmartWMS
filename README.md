# 🚀 SmartWMS Center - Base Backend Template

Hệ thống quản lý kho hàng thông minh (**SmartWMS**) được xây dựng trên nền tảng kiến trúc sạch (**Clean Architecture**), kết hợp với tư duy thiết kế hướng miền (**Domain-Driven Design - DDD**) và mô hình tách biệt lệnh/truy vấn (**CQRS**). Hệ thống được tích hợp sâu các tác vụ tự động hóa chạy ngầm và động cơ trí tuệ nhân tạo (AI Virtual Agent) nhằm tối ưu hóa toàn diện chuỗi cung ứng vật tư, luân chuyển hàng hóa theo thời gian thực.

---

## 🛠️ 1. Giới thiệu Base Backend Template

Template này đóng vai trò là kiến trúc thượng tầng mạnh mẽ, thiết lập sẵn các tiêu chuẩn doanh nghiệp (Enterprise Standards) giúp hệ thống dễ dàng mở rộng và bảo trì lâu dài. 

### Các tính năng cốt lõi được tích hợp sẵn:
* **Hệ thống Kiểm toán Tự động (Audit Trail Engine):** Sử dụng `ChangeTracker` ngầm để tự động bốc tách, ghi nhận lịch sử biến động dữ liệu chi tiết (`AuditLogs`) dưới dạng JSON.
* **Động cơ Thời gian thực (Real-time Hub):** Đồng bộ hóa trạng thái bốc dỡ, nạp hàng thông qua nền tảng SignalR siêu tốc.
* **Xử lý Tác vụ nền (Background Worker):** Đăng ký luồng quét định kỳ bằng Hangfire nhằm tự động khóa kho sản phẩm cận hạn và kích hoạt tác nhân AI.
* **Lá chắn Lỗi tập trung:** Pipeline xử lý lỗi tối cao bằng `IExceptionHandler` của .NET giúp chuẩn hóa cấu trúc phản hồi API theo chuẩn `ProblemDetails`.

---

## 💻 2. Công nghệ sử dụng

Hệ thống tận dụng tối đa sức mạnh của hệ sinh thái công nghệ mới nhất hiện nay:

* **Tầng lõi:** .NET 10 (C# 14 Web API)
* **Cơ sở dữ liệu:** SQL Server (Relational Database)
* **Truy cập dữ liệu:** Entity Framework Core 10 (Code-First Migration)
* **Quản lý bất đồng bộ:** MediatR (CQRS Pattern)
* **Bảo mật & Xác thực:** JWT Bearer Authentication
* **Hệ thống Log:** Serilog (Structured Logging ghi song song ra Console và File tuần hoàn)
* **Giám sát hạ tầng:** .NET Health Checks (Tự động theo dõi SQL Server và AI Hub Connection)
* **AI Integration:** Google Gemini AI Ecosystem (AI Insight, Forecasting Demand, Vector Embeddings)

---

## 📂 3. Cấu trúc Solution

Dự án được phân chia mạch lạc thành 4 phân tầng độc lập nhằm đảm bảo nguyên tắc đảo ngược phụ thuộc (**Dependency Inversion Principle**):

```text
SmartWMS/
│
├── 🏛️ SmartWMS.Domain/               # Tầng Miền (Lõi thực thể vô tri, không phụ thuộc bên ngoài)
│   ├── Entities/                     # Khai báo cấu trúc bảng CSDL (Product, Bin, Zone, InboundReceipt...)
│   ├── Enums/                        # Định danh kiểu strongly-typed (InventoryStatus, TransactionType...)
│   └── Common/                       # Các thực thể nền, cấu trúc dùng chung (BaseEntity)
│
├── ⚡ SmartWMS.Application/          # Tầng Ứng dụng (Luồng nghiệp vụ xử lý Core Logic)
│   ├── Common/                       # Các mô hình giao tiếp, Interfaces, DTOs hệ thống
│   └── Features/                     # Phân khu CQRS (Mỗi tính năng chứa Commands, Queries, Handlers riêng)
│       ├── InboundReceipts/          # Xử lý nhập kho, Xác nhận hộc hàng, Luân chuyển Cross-Docking
│       ├── OutboundIssues/           # Xử lý xuất kho, thuật toán gom đơn Wave Picking
│       └── Forecasts/                # Logic gọi AI dự báo nhu cầu thị trường (Demand Forecasting)
│
├── ⚙️ SmartWMS.Infrastructure/       # Tầng Hạ tầng (Kết nối CSDL, dịch vụ bên thứ ba)
│   ├── Persistence/                  # DbContext, Cấu hình Fluent API, Migrations cấu trúc dữ liệu
│   ├── Services/                     # Cài đặt dịch vụ AI Gemini, Barcode, Mail Agent, Picking Route Optimizer
│   ├── SignalR/                      # Cấu hình Real-time Hub điều phối thông báo biến động kho
│   └── HealthChecks/                 # Bộ kiểm tra trạng thái hoạt động của ổ đĩa SQL và Google AI Hub
│
└── 🌐 SmartWMS.Api/                  # Tầng Biên giới (Điểm tiếp nhận các HTTP Requests)
    ├── Controllers/                  # Các Endpoints API phân quyền bảo mật chặt chẽ
    ├── Middlewares/                  # Bộ lọc Global Exception Handler chặn bắt lỗi tập trung
    └── Program.cs                    # Trạm khởi tạo trung tâm, cấu hình Pipeline, Seeding & Job Scheduler
4. Yêu cầu môi trường
Để khởi chạy dự án mượt mà trên môi trường máy cục bộ (Local Development), máy tính của bạn cần đáp ứng các điều kiện tiên quyết sau:

SDK: .NET 10.0 SDK trở lên.

IDE: Visual Studio 2022 (Phiên bản v17.12 trở lên) hoặc JetBrains Rider / VS Code (Đã cài C# Dev Kit).

Database Engine: SQL Server 2019, 2022 hoặc Azure SQL Database Edge.

Công cụ hỗ trợ: cài đặt sẵn dotnet-ef toàn cục để chạy lệnh migration:
dotnet tool install --global dotnet-ef

## 📦 5. Các NuGet Package chính

Các thư viện nền tảng được phân bổ chuẩn chỉ vào từng phân tầng cấu trúc để đảm bảo tính bao đóng:

| Tầng Dự Án | Tên Thư Viện (NuGet Package) | Phiên Bản | Công Dụng Chính |
| :--- | :--- | :--- | :--- |
| **Domain** | *Không sử dụng thư viện ngoài* | - | Đảm bảo tính thuần khiết của thực thể |
| **Application** | `MediatR` | LATEST | Điều phối luồng dữ liệu CQRS, giảm phụ thuộc |
| **Infrastructure** | `Microsoft.EntityFrameworkCore.SqlServer` | 10.x | Trình kết nối cơ sở dữ liệu SQL Server |
| **Infrastructure** | `Hangfire.AspNetCore` | LATEST | Tích hợp bảng điều khiển và chạy tác vụ ngầm |
| **Infrastructure** | `Hangfire.SqlServer` | LATEST | Lưu trữ trạng thái và cấu hình của Hangfire Job |
| **Infrastructure** | `Microsoft.Extensions.Diagnostics.HealthChecks` | 10.x | Giám sát tài nguyên và kết nối API hệ thống |
| **Api** | `Microsoft.AspNetCore.Authentication.JwtBearer` | 10.x | Cơ chế cấp phát và giải mã Token bảo mật |
| **Api** | `Serilog.AspNetCore` | LATEST | Ghi nhật ký cấu trúc, tối ưu giám sát lỗi |

6. Cấu hình Database
Hệ thống áp dụng cơ chế tự động hóa hoàn toàn luồng quản lý dữ liệu. Ngay khi máy chủ API được khởi chạy, hệ thống sẽ tự quét tìm Migration mới để cập nhật cấu trúc bảng, đồng thời tự động nạp dữ liệu mồi (Seed Data) cho Kho tổng, Phân khu, Hệ thống hộc hàng, tài khoản Admin tối cao và đồng bộ hóa Vector thông minh.

Bước 1: Thiết lập chuỗi kết nối
Kiên cập nhật lại chuỗi kết nối SQL Server của bạn tại tệp appsettings.json nằm trong dự án SmartWMS.Api:
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=YOUR_SERVER_NAME;Database=SmartWMS_DB;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "JwtSettings": {
    "Secret": "ChuyenGiaQuanLyKhoHangThongMinhSmartWMSCenter2026SecurityKey!",
    "Issuer": "SmartWMSCenter",
    "Audience": "SmartWMSUsers"
  }
}
Bước 2: Thực thi cập nhật thủ công (Nếu cấu hình lại Entities)
Nếu Kiên bổ sung thực thể hoặc thay đổi cấu hình trường dữ liệu, hãy mở Package Manager Console (PMC), đặt dự án mặc định (Default project) về SmartWMS.Infrastructure và chạy bộ lệnh:
# 1. Tạo file di cư cấu trúc
Add-Migration UpdateStructure_Latest -Context ApplicationDbContext -Project SmartWMS.Infrastructure -StartupProject SmartWMS.Api

# 2. Đẩy cấu trúc an toàn xuống Database
Update-Database -Context ApplicationDbContext -Project SmartWMS.Infrastructure -StartupProject SmartWMS.Api
