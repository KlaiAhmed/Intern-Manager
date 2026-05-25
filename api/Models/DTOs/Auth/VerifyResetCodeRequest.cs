using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

public sealed class VerifyResetCodeRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    // FIX C1: require an 8-digit numeric reset code.
    [RegularExpression("^\\d{8}$")]
    public string Code { get; init; } = string.Empty;
}
