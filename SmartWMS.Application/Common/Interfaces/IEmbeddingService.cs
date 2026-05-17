namespace SmartWMS.Application.Common.Interfaces;

public interface IEmbeddingService
{
    // Hàm chuyển đổi một đoạn văn bản (ví dụ: tên + mô tả sản phẩm) thành mảng Vector
    Task<float[]> GenerateEmbeddingAsync(string text);

    // Hàm tính toán độ tương đồng giữa 2 Vector (Cosine Similarity)
    double CalculateCosineSimilarity(float[] vectorA, float[] vectorB);
}