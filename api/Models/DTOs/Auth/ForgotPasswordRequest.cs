using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

public sealed class ForgotPasswordRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;
}
