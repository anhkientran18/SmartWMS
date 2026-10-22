using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Users.Commands;
using SmartWMS.Application.Features.Zones.Commands.DeleteZone;
using SmartWMS.Application.Features.Zones.DTOs.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Persistence.Repositories;
using SmartWMS.Infrastructure.Services;

internal static class DeleteRaceVerification
{
    public static async Task RunAsync(string directory)
    {
        var report = Path.GetFullPath(directory); Directory.CreateDirectory(report);
        const string prefix = "SmartWMS_DeleteRace_Verify_";
        var database = prefix + Guid.NewGuid().ToString("N");
        var connection = $"Server=(localdb)\\MSSQLLocalDB;Database={database};Integrated Security=true;TrustServerCertificate=true;Encrypt=false";
        var results = new List<string>();
        void Check(bool ok, string label)
        {
            if (!ok) throw new Exception("FAIL: " + label);
            results.Add("PASS: " + label); Console.WriteLine(results[^1]);
        }
        ApplicationDbContext Db(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(connection).AddInterceptors(interceptors).Options, new VerifyUser());
        var warehouse = Guid.NewGuid();
        async Task<Guid> Target(string kind)
        {
            await using var db = Db(); var id = Guid.NewGuid();
            if (kind == "Zone") db.Zones.Add(new Zone { Id = id, Code = id.ToString(), Name = "delete fixture", WarehouseId = warehouse });
            else db.Users.Add(new User { Id = id, Username = id.ToString(), Email = id + "@example.invalid" });
            await db.SaveChangesAsync(); return id;
        }
        Task<bool> Exists(ApplicationDbContext db, string kind, Guid id) => kind == "Zone"
            ? db.Zones.AnyAsync(x => x.Id == id) : db.Users.AnyAsync(x => x.Id == id);
        Task<Result<bool>> Delete(ApplicationDbContext db, string kind, Guid id) => kind == "Zone"
            ? new DeleteZoneCommandHandler(new UnitOfWork(db), db, new InventoryMutationCoordinator(db))
                .Handle(new(new DeleteZoneRequest { Id = id }), default)
            : new DeleteUserCommandHandler(db, new InventoryMutationCoordinator(db)).Handle(new(id), default);
        try
        {
            await using (var db = Db())
            {
                // Current-model isolated fixture only; never migrate or write SmartWMS_DB.
                await db.Database.EnsureCreatedAsync();
                db.Warehouses.Add(new Warehouse { Id = warehouse, Code = "DELETE-RACE", Name = "fixture" });
                await db.SaveChangesAsync();
            }
            foreach (var kind in new[] { "Zone", "User" })
            {
                var id = await Target(kind);
                var sheet = Guid.NewGuid(); string? afterConcurrentInsert = null;
                var race = new ReferenceAfterGuard(async () =>
                {
                    // A second connection commits after AnyAsync=false, before T1 issues DELETE.
                    await using var concurrent = Db();
                    concurrent.CycleCountSheets.Add(new CycleCountSheet { Id = sheet,
                        ZoneId = kind == "Zone" ? id : null,
                        AssignedUserId = kind == "User" ? id : null,
                        SheetNumber = sheet.ToString(), Status = "Completed", IsDeleted = true });
                    await concurrent.SaveChangesAsync();
                    afterConcurrentInsert = await Snapshot(connection);
                });
                await using (var db = Db(race))
                {
                    var result = await Delete(db, kind, id);
                    Check(race.Calls == 1 && race.Sql?.Number == 547, kind + ": real concurrent reference produces SQL FK 547; no retry");
                    Check(!result.IsSuccess && result.Error?.Code == "COM_409", kind + ": FK race returns COM_409");
                    Check(db.Database.CurrentTransaction == null && !db.ChangeTracker.Entries().Any(), kind + ": rollback disposes transaction and clears tracker");
                    Check(await Exists(db, kind, id) && await db.CycleCountSheets.AnyAsync(x => x.Id == sheet), kind + ": parent and concurrent historical reference remain");
                    Check(afterConcurrentInsert == await Snapshot(connection), kind + ": failed delete/audit writes fully rolled back");
                    Check(await db.Database.CanConnectAsync(), kind + ": context/connection reusable after conflict");
                }
                await using (var db = Db(race))
                {
                    var result = await Delete(db, kind, id);
                    Check(!result.IsSuccess && result.Error?.Code == "COM_409" && race.Calls == 1,
                        kind + ": existing reference still rejects before SaveChanges");
                    Check(!db.ChangeTracker.Entries().Any() && db.Database.CurrentTransaction == null,
                        kind + ": existing-reference rejection clears/disposes");
                }

                var free = await Target(kind);
                await using (var db = Db())
                {
                    Check((await Delete(db, kind, free)).IsSuccess, kind + ": unreferenced delete succeeds");
                    Check(!await Exists(db, kind, free), kind + ": successful delete actually removes only target");
                }

                var unexpected = await Target(kind); var before = await Snapshot(connection);
                var fault = new UnexpectedSqlOnDelete(kind == "Zone" ? "Zones" : "Users");
                await using (var db = Db(fault))
                {
                    try { await Delete(db, kind, unexpected); throw new Exception("Expected SQL 51001"); }
                    catch (DbUpdateException ex) when (Sql(ex)?.Number == 51001)
                    { Check(true, kind + ": unexpected SQL error propagates, not COM_409"); }
                    Check(fault.Calls == 1 && !db.ChangeTracker.Entries().Any() && db.Database.CurrentTransaction == null,
                        kind + ": unexpected DB error rolls back/clears, no retry");
                    Check(await Exists(db, kind, unexpected) && before == await Snapshot(connection),
                        kind + ": unexpected DB failure leaves target and all data unchanged");
                }

                // SQL number alone is insufficient: no deleted-target entries must not be classified.
                var unrelated = await Target(kind); before = await Snapshot(connection);
                await using (var db = Db(new Unrelated547(race.Sql!)))
                {
                    try { await Delete(db, kind, unrelated); throw new Exception("Expected unrelated 547"); }
                    catch (DbUpdateException ex) when (ex.Message == "Unrelated FK error without delete entries")
                    { Check(true, kind + ": unrelated SQL 547 without target delete entries propagates"); }
                    Check(!db.ChangeTracker.Entries().Any() && db.Database.CurrentTransaction == null &&
                        await Exists(db, kind, unrelated) && before == await Snapshot(connection),
                        kind + ": unrelated FK error also rolls back/clears without data loss");
                }
            }
        }
        finally
        {
            SqlConnection.ClearAllPools();
            if (!database.StartsWith(prefix, StringComparison.Ordinal) || database.Length != prefix.Length + 32)
                throw new Exception("Unexpected cleanup database");
            await using var master = new SqlConnection("Server=(localdb)\\MSSQLLocalDB;Database=master;Integrated Security=true;TrustServerCertificate=true;Encrypt=false");
            await master.OpenAsync(); await using var cmd = master.CreateCommand();
            cmd.CommandText = $"IF DB_ID(N'{database}') IS NOT NULL BEGIN ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}]; END";
            await cmd.ExecuteNonQueryAsync();
            cmd.CommandText = $"SELECT COUNT(*) FROM sys.databases WHERE name=N'{database}'";
            Check((int)(await cmd.ExecuteScalarAsync())! == 0, "focused fixture database cleanup verified");
            await File.WriteAllLinesAsync(Path.Combine(report, "delete-race-results.txt"), results);
        }
        Console.WriteLine($"ALL {results.Count} FOCUSED DELETE CHECKS PASSED");
    }

    private static SqlException? Sql(Exception exception)
    {
        for (Exception? current = exception; current != null; current = current.InnerException)
            if (current is SqlException sql) return sql;
        return null;
    }

    private static async Task<string> Snapshot(string connection)
    {
        await using var c = new SqlConnection(connection); await c.OpenAsync(); await using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT QUOTENAME(SCHEMA_NAME(schema_id))+N'.'+QUOTENAME(name) FROM sys.tables ORDER BY 1";
        var tables = new List<string>();
        await using (var r = await cmd.ExecuteReaderAsync()) while (await r.ReadAsync()) tables.Add(r.GetString(0));
        var data = new List<string>();
        foreach (var table in tables)
        {
            cmd.CommandText = "SELECT * FROM " + table;
            var rows = new List<string>();
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                var values = new object[r.FieldCount]; r.GetValues(values);
                rows.Add(JsonSerializer.Serialize(values.Select(v => v is DBNull ? null : v is byte[] b ? Convert.ToHexString(b) : v)));
            }
            rows.Sort(StringComparer.Ordinal); data.Add(table + ":" + string.Join("\n", rows));
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("\n", data))));
    }

    private sealed class VerifyUser : ICurrentUserService
    {
        public string UserId => "DeleteRaceVerification";
        public string Role => "Admin";
        public string IpAddress => "127.0.0.1";
    }
    private sealed class ReferenceAfterGuard(Func<Task> insert) : SaveChangesInterceptor
    {
        public int Calls { get; private set; }
        public SqlException? Sql { get; private set; }
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            Calls++; await insert(); return result;
        }
        public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
        {
            Sql = DeleteRaceVerification.Sql(eventData.Exception); return Task.CompletedTask;
        }
    }
    private sealed class UnexpectedSqlOnDelete(string table) : DbCommandInterceptor
    {
        public int Calls { get; private set; }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("DELETE FROM [" + table + "]", StringComparison.Ordinal))
            { Calls++; command.CommandText = "THROW 51001, N'Controlled unexpected DB failure', 1;"; }
            return ValueTask.FromResult(result);
        }
    }
    private sealed class Unrelated547(SqlException sql) : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default) =>
            throw new DbUpdateException("Unrelated FK error without delete entries", sql);
    }
}
