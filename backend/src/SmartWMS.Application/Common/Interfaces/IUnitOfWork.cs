using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Common.Interfaces;

public interface IUnitOfWork : IDisposable
{
    // Khởi tạo dynamic repository cho bất kỳ Entity nào
    IGenericRepository<TEntity> Repository<TEntity>() where TEntity : class;

    // Nơi duy nhất gọi SaveChanges
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}