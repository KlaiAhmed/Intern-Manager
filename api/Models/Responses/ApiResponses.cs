using System.Collections.Generic;

namespace InternManager.Api.Models.Responses;

public class PagedResponse<T>
{
    public IEnumerable<T> Data { get; set; } = [];

    public int Total { get; set; }

    public int Page { get; set; }

    public int Limit { get; set; }
}

public class ActionResponse
{
    public bool Success { get; set; }

    public string? Message { get; set; }
}