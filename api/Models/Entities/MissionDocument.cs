using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.Entities;

public sealed class MissionDocument
{
    public Guid Id { get; set; }

    public Guid MissionId { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [MaxLength(1000)]
    public string FileUrl { get; set; } = string.Empty;

    public DateTime UploadedAt { get; set; }

    public Guid UploadedByUserId { get; set; }

    [Required]
    [MaxLength(10)]
    public string SourceType { get; set; } = string.Empty;

    public Mission? Mission { get; set; }

    public User? UploadedByUser { get; set; }
}
