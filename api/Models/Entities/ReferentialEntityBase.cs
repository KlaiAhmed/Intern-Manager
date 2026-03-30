/// <summary>
/// Represente une entite de referentiel avec identifiant technique et libelle.
/// </summary>
namespace InternManager.Api.Models.Entities;

public abstract class ReferentialEntityBase
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
