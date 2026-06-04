namespace InternManager.Api.Common.Exceptions;

public sealed class UnsupportedDocumentMediaTypeException : Exception
{
    public UnsupportedDocumentMediaTypeException(string message)
        : base(message)
    {
    }
}
