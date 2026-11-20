namespace SmartWMS.Application.Common.Constants;

public static class ErrorCodeConstants
{
    // Authentication & Authorization
    public const string Unauthorized = "AUTH_401";
    public const string Forbidden = "AUTH_403";

    // Common & System
    public const string NotFound = "COM_001";
    public const string ValidationError = "VAL_1000";
    public const string DatabaseError = "SYS_5002";
    public const string Conflict = "COM_409";

    // Products
    public const string ProductNotFound = "PRD_001";
    public const string SkuAlreadyExists = "PRD_002";
    public const string BarcodeAlreadyExists = "PRD_003";

    // Bins & Warehouses
    public const string BinNotFound = "BIN_001";
    public const string BinOverCapacity = "BIN_002";
    public const string ZoneNotFound = "ZON_001";
}