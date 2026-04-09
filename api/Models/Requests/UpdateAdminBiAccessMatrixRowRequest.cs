namespace InternManager.Api.Models.Requests;

public sealed class UpdateAdminBiAccessMatrixRowRequest
{
    public string Role { get; init; } = string.Empty;

    public IDictionary<string, bool> Dashboards { get; init; } =
        new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
}
