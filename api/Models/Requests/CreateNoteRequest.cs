using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.Requests;

/// <summary>
/// Request body for creating a private supervisor mission note.
/// </summary>
public sealed class CreateNoteRequest
{
    [Required]
    [StringLength(4000, MinimumLength = 1)]
    public string Content { get; init; } = string.Empty;
}
