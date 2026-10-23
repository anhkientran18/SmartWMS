using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using SmartWMS.Application.Common.Interfaces;
sealed class FixtureUser : ICurrentUserService
{
    public string UserId => "F1Verification";
    public string Role => "Admin";
    public string IpAddress => "127.0.0.1";
}

sealed class FixtureDatabase : IAsyncDisposable
{
    private const string Prefix = "SmartWMS_F1_Verify_";
    public string Name { get; } = Prefix + Guid.NewGuid().ToString("N");
    public string Connection => $"Server=(localdb)\\MSSQLLocalDB;Database={Name};Integrated Security=true;TrustServerCertificate=true;Encrypt=false";
    public FixtureDatabase(string purpose) => Console.WriteLine("Fixture purpose: " + purpose);
    public async ValueTask DisposeAsync()
    {
        if (!Name.StartsWith(Prefix, StringComparison.Ordinal) || Name.Length != Prefix.Length + 32) throw new Exception("Unexpected cleanup target");
        SqlConnection.ClearAllPools();
        await using var db = new SqlConnection(new SqlConnectionStringBuilder(Connection) { InitialCatalog = "master" }.ConnectionString);
        await db.OpenAsync(); await using var cmd = db.CreateCommand();
        cmd.CommandText = $"IF DB_ID(N'{Name}') IS NOT NULL BEGIN ALTER DATABASE [{Name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{Name}]; END";
        await cmd.ExecuteNonQueryAsync(); cmd.CommandText = $"SELECT COUNT(*) FROM sys.databases WHERE name=N'{Name}'";
        if ((int)(await cmd.ExecuteScalarAsync())! != 0) throw new Exception("Fixture cleanup failed");
        Console.WriteLine("CLEANUP VERIFIED: " + Name);
    }
    public static SqlException? Sql(Exception ex)
    {
        for (Exception? current = ex; current != null; current = current.InnerException) if (current is SqlException sql) return sql;
        return null;
    }
    public static async Task<string> Snapshot(string connection)
    {
        await using var db = new SqlConnection(connection); await db.OpenAsync(); await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT QUOTENAME(SCHEMA_NAME(schema_id))+N'.'+QUOTENAME(name) FROM sys.tables ORDER BY 1";
        var tables = new List<string>(); await using (var r = await cmd.ExecuteReaderAsync()) while (await r.ReadAsync()) tables.Add(r.GetString(0));
        var data = new List<string>();
        foreach (var table in tables)
        {
            cmd.CommandText = $"SELECT * FROM {table}"; var rows = new List<string>(); await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync()) { var values = new object[r.FieldCount]; r.GetValues(values);
                rows.Add(JsonSerializer.Serialize(values.Select(x => x is DBNull ? null : x is byte[] b ? Convert.ToHexString(b) : x))); }
            rows.Sort(StringComparer.Ordinal); data.Add(table + ":" + string.Join("\n", rows));
        }
        cmd.CommandText = "SELECT COALESCE((SELECT * FROM sys.columns ORDER BY object_id,column_id FOR JSON PATH),N'[]') + COALESCE((SELECT * FROM sys.indexes ORDER BY object_id,index_id FOR JSON PATH),N'[]') + COALESCE((SELECT * FROM sys.check_constraints ORDER BY object_id,parent_column_id,name FOR JSON PATH),N'[]')";
        data.Add((string)(await cmd.ExecuteScalarAsync())!);
        return Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(string.Join("\n", data))));
    }
}
