using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace InternManager.Api.Common.OpenApi;

public sealed class CreatedResponseLocationHeaderOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        if (!operation.Responses.TryGetValue("201", out var createdResponse))
        {
            return;
        }

        createdResponse.Headers ??= new Dictionary<string, OpenApiHeader>(StringComparer.OrdinalIgnoreCase);

        if (createdResponse.Headers.ContainsKey("Location"))
        {
            return;
        }

        createdResponse.Headers["Location"] = new OpenApiHeader
        {
            Description = "URI of the created resource.",
            Schema = new OpenApiSchema
            {
                Type = "string",
                Format = "uri"
            }
        };
    }
}
