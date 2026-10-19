using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Specifications;
using System.Linq;

namespace SmartWMS.Infrastructure.Persistence.Repositories;

public class SpecificationEvaluator<TEntity> where TEntity : class
{
    public static IQueryable<TEntity> GetQuery(IQueryable<TEntity> inputQuery, ISpecification<TEntity> spec)
    {
        var query = inputQuery;

        // 1. Áp dụng điều kiện lọc (Where)
        if (spec.Criteria != null)
        {
            query = query.Where(spec.Criteria);
        }

        // 2. Áp dụng Include cho các Navigation Properties (Eager Loading)
        query = spec.Includes.Aggregate(query, (current, include) => current.Include(include));
        query = spec.IncludeStrings.Aggregate(query, (current, include) => current.Include(include));

        // 3. Áp dụng sắp xếp (OrderBy / OrderByDescending)
        if (spec.OrderBy != null)
        {
            query = query.OrderBy(spec.OrderBy);
        }
        else if (spec.OrderByDescending != null)
        {
            query = query.OrderByDescending(spec.OrderByDescending);
        }

        // 4. Áp dụng phân trang (Pagination)
        if (spec.IsPagingEnabled && spec.Skip.HasValue && spec.Take.HasValue)
        {
            query = query.Skip(spec.Skip.Value).Take(spec.Take.Value);
        }

        // 5. Tối ưu hiệu năng đọc (AsNoTracking)
        if (spec.AsNoTracking)
        {
            query = query.AsNoTracking();
        }

        return query;
    }
}