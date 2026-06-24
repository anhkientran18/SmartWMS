using System;

namespace SmartWMS.Application.Common.Exceptions;

public class NotFoundException : Exception
{
    public NotFoundException(string name, object key)
        : base($"Thực thể \"{name}\" với định danh ({key}) không tồn tại trong hệ thống kho.")
    {
    }
}