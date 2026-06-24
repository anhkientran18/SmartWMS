using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.HealthChecks;

// ============================================================================
// Bộ kiểm tra sức khỏe kết nối SQL Server nội bộ - Không phụ thuộc package ngoài
// ============================================================================
public class SqlStorageHealthCheck : IHealthCheck
{
    private readonly string _connectionString;

    public SqlStorageHealthCheck(IConfiguration configuration)
    {
        // Trích xuất chuỗi kết nối an toàn từ cấu hình hệ thống
        _connectionString = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_connectionString))
            {
                return HealthCheckResult.Unhealthy("Chuỗi kết nối SQL Server (ConnectionString) đang để trống.");
            }

            // Thực thi mở kết nối vật lý trực tiếp tới SQL Server để kiểm tra đường truyền
            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            return HealthCheckResult.Healthy("Kết nối đến cơ sở dữ liệu SQL Server thông suốt và ổn định.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Không thể kết nối đến máy chủ cơ sở dữ liệu SQL Server.", ex);
        }
    }
}