using System.Collections;
using System.Linq.Expressions;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.Suppliers.Queries.GetList;
using SmartWMS.Application.Features.Suppliers.Queries.GetPaginatedSuppliers;
using SmartWMS.Application.Features.Suppliers.Queries.GetSupplierById;
using SmartWMS.Application.Features.Suppliers.Queries.GetSupplierList;
using SmartWMS.Domain.Entities;

// Execute the real handlers over LINQ objects with EF's async query interfaces.
// No DbContext, SQL provider, app startup, configuration, files or persistence.
Supplier Row(string code, string name, string email, string phone, bool deleted = false)
    => new() { Code = code, Name = name, Email = email, Phone = phone,
        Address = "Test address", IsDeleted = deleted };
var alpha = Row("COMMON-A", "Alpha Supply", "a@common.invalid", "09010001");
var bravo = Row("COMMON-B", "Bravo Supply", "b@common.invalid", "09010002");
var delta = Row("OTHER-D", "Delta Supply", "d@other.invalid", "08010003");
// Unsorted input, with deleted rows before and between active rows in name order.
Supplier[] rows = [delta,
    Row("COMMON-X", "Aardvark Supply", "x@common.invalid", "09019901", true),
    bravo, Row("COMMON-Y", "Charlie Supply", "y@common.invalid", "09019902", true),
    alpha, Row("TOMBSTONE", "Deleted Only", "gone@other.invalid", "07010004", true)];
var context = DispatchProxy.Create<IApplicationDbContext, SupplierContextProbe>();
((SupplierContextProbe)context).Suppliers = new SupplierSet(rows);
var handler = new GetPaginatedSuppliersQueryHandler(context);
var checks = 0;
var failures = 0;
void Check(bool condition, string label)
{
    checks++;
    if (condition) return;
    failures++;
    Console.WriteLine("FAIL: " + label);
}

async Task Page(string label, int number, int size, string? search,
    int total, params Supplier[] expected)
{
    var before = failures;
    var result = await handler.Handle(new(number, size, search), CancellationToken.None);
    Check(result.IsSuccess && result.Error is null && result.Data is not null,
        label + ": successful Result envelope");
    if (result.Data is not { } data) return;
    Check(data.TotalCount == total,
        $"{label}: TotalCount expected {total}, actual {data.TotalCount}");
    Check(data.Items.Select(item => item.Id).SequenceEqual(expected.Select(item => item.Id)),
        label + ": exact active items in Name order after pagination");
    Check(!data.Items.Any(item => rows.Any(row => row.Id == item.Id && row.IsDeleted)),
        label + ": no deleted supplier in items");
    Check(data.PageIndex == number && data.PageSize == size,
        label + ": requested pagination preserved");
    var pages = (int)Math.Ceiling(total / (double)size);
    Check(data.TotalPages == pages && data.HasNextPage == (number < pages)
        && data.HasPreviousPage == (number > 1), label + ": pagination metadata");
    Check(data.Items.Count == expected.Length && data.Items.Zip(expected).All(pair =>
        pair.First.Code == pair.Second.Code && pair.First.Name == pair.Second.Name
        && pair.First.Email == pair.Second.Email && pair.First.Phone == pair.Second.Phone
        && pair.First.Address == pair.Second.Address), label + ": DTO fields preserved");
    Console.WriteLine((failures == before ? "PASS: " : "FAILED: ") + label);
}

await Page("Unfiltered active rows and total", 1, 100, null, 3, alpha, bravo, delta);
await Page("Page 1 excludes deleted rows before Take", 1, 2, null, 3, alpha, bravo);
await Page("Page 2 excludes deleted rows before Skip", 2, 2, null, 3, delta);
await Page("Beyond last page retains active total", 3, 2, null, 3);
await Page("Whitespace search", 1, 10, "   ", 3, alpha, bravo, delta);
await Page("Code search ignores casing", 1, 10, "common-", 2, alpha, bravo);
await Page("Name search ignores casing", 1, 10, "SUPPLY", 3, alpha, bravo, delta);
await Page("Phone search", 1, 10, "0901", 2, alpha, bravo);
await Page("Email search ignores casing", 1, 10, "@COMMON.INVALID", 2, alpha, bravo);
await Page("Search page 1", 1, 1, "common-", 2, alpha);
await Page("Search page 2", 2, 1, "common-", 2, bravo);
await Page("Search beyond last page", 3, 1, "common-", 2);
await Page("Search matching only a deleted supplier", 1, 10, "TOMBSTONE", 0);
await Page("Search with no matches", 1, 10, "NO-MATCH", 0);

// Existing list/detail handlers must retain their current active/deleted behavior.
var list = await new GetSupplierListQueryHandler(context).Handle(new(), default);
Check(list.IsSuccess && list.Data is not null
    && list.Data.Select(item => item.Id).SequenceEqual(new[] { alpha.Id, bravo.Id, delta.Id }),
    "Supplier list still returns only active suppliers in Name order");
var detailHandler = new GetSupplierByIdQueryHandler(context);
var detail = await detailHandler.Handle(new(alpha.Id), default);
Check(detail.IsSuccess && detail.Data?.Id == alpha.Id,
    "Supplier detail still returns an active supplier");
var deletedDetail = await detailHandler.Handle(new(rows.First(row => row.IsDeleted).Id), default);
Check(!deletedDetail.IsSuccess && deletedDetail.Error?.Code == ErrorCodeConstants.NotFound,
    "Supplier detail still rejects a deleted supplier");

((SupplierContextProbe)context).Suppliers = new SupplierSet(rows.Where(row => row.IsDeleted));
await Page("All suppliers deleted", 1, 10, null, 0);
((SupplierContextProbe)context).Suppliers = new SupplierSet([]);
await Page("Empty source", 1, 10, null, 0);
Console.WriteLine($"Supplier pagination: {checks - failures}/{checks} checks passed; {failures} failed. No database or persistence used.");
return failures == 0 ? 0 : 1;

public class SupplierContextProbe : DispatchProxy
{
    public DbSet<Supplier> Suppliers { get; set; } = null!;
    protected override object? Invoke(MethodInfo? method, object?[]? args)
        => method?.Name == "get_Suppliers" ? Suppliers
            : throw new InvalidOperationException("Unexpected context call: " + method?.Name);
}

sealed class SupplierSet(IEnumerable<Supplier> rows) : DbSet<Supplier>, IQueryable<Supplier>
{
    private readonly AsyncQuery<Supplier> query = new(rows);
    public override Microsoft.EntityFrameworkCore.Metadata.IEntityType EntityType => throw new InvalidOperationException("No EF model in this query-only test.");
    public override IQueryable<Supplier> AsQueryable() => query;
    Type IQueryable.ElementType => typeof(Supplier);
    Expression IQueryable.Expression => ((IQueryable)query).Expression;
    IQueryProvider IQueryable.Provider => ((IQueryable)query).Provider;
    IEnumerator<Supplier> IEnumerable<Supplier>.GetEnumerator() => query.AsEnumerable().GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => query.AsEnumerable().GetEnumerator();
}

sealed class AsyncQuery<T> : EnumerableQuery<T>, IAsyncEnumerable<T>, IQueryable<T>
{
    public AsyncQuery(IEnumerable<T> rows) : base(rows) { }
    public AsyncQuery(Expression expression) : base(expression) { }
    IQueryProvider IQueryable.Provider => new AsyncQueryProvider(this);
    public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        => new AsyncEnumerator<T>(this.AsEnumerable().GetEnumerator(), cancellationToken);
}

sealed class AsyncQueryProvider(IQueryProvider inner) : IAsyncQueryProvider
{
    public IQueryable CreateQuery(Expression expression)
        => (IQueryable)Activator.CreateInstance(
            typeof(AsyncQuery<>).MakeGenericType(expression.Type.GetGenericArguments().Single()), expression)!;
    public IQueryable<T> CreateQuery<T>(Expression expression) => new AsyncQuery<T>(expression);
    public object? Execute(Expression expression) => inner.Execute(expression);
    public T Execute<T>(Expression expression) => inner.Execute<T>(expression);
    public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var resultType = typeof(TResult).GetGenericArguments().Single();
        return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
            .MakeGenericMethod(resultType).Invoke(null, [inner.Execute(expression)])!;
    }
}

sealed class AsyncEnumerator<T>(IEnumerator<T> inner, CancellationToken cancellationToken)
    : IAsyncEnumerator<T>
{
    public T Current => inner.Current;
    public ValueTask<bool> MoveNextAsync()
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.FromResult(inner.MoveNext());
    }
    public ValueTask DisposeAsync()
    {
        inner.Dispose();
        return ValueTask.CompletedTask;
    }
}
