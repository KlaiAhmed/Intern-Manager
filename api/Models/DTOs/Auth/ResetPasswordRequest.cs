using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

public sealed class ResetPasswordRequest
{
    [Required]
    public string VerificationToken { get; init; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string NewPassword { get; init; } = string.Empty;

    [Required]
    [Compare(nameof(NewPassword))]
    public string ConfirmPassword { get; init; } = string.Empty;
}
