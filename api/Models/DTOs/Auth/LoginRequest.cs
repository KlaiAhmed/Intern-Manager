using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

public sealed class LoginRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    public string Password { get; init; } = string.Empty;
}
