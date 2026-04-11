using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

public sealed class VerifyResetCodeRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    [RegularExpression("^\\d{6}$")]
    public string Code { get; init; } = string.Empty;
}
