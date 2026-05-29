using Microsoft.AspNetCore.Http;

namespace InternManager.Api.Tests.TestSupport;

internal static class TestFiles
{
    public static IFormFile FormFile(
        string fileName,
        string contentType,
        int length,
        bool pdfSignature = false)
    {
        var bytes = new byte[length];
        if (pdfSignature && length >= 5)
        {
            bytes[0] = 0x25;
            bytes[1] = 0x50;
            bytes[2] = 0x44;
            bytes[3] = 0x46;
            bytes[4] = 0x2D;
        }

        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }
}
