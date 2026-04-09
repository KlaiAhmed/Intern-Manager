/// <summary>
/// Expose les endpoints admin de parametrage et de gestion des referentiels.
/// </summary>
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des paramètres et référentiels admin.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/admin/settings")]
[Authorize]
[EnableRateLimiting("write-operations")]
public sealed class AdminSettingsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Récupère la liste des départements.
    /// </summary>
    /// <remarks>
    /// Cette route retourne tous les départements disponibles dans le système.
    /// Ils sont utilisés pour classer les utilisateurs par service.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de départements.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("departments", Name = "ListDepartments")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetDepartments(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Departments, cancellationToken);
    }

    /// <summary>
    /// Récupère un département par son identifiant.
    /// </summary>
    /// <remarks>
    /// Cette route retourne les informations d un département spécifique.
    /// </remarks>
    /// <param name="id">Identifiant unique du département.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du département.</returns>
    /// <response code="200">Département récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Département non trouvé.</response>
    [HttpGet("departments/{id:guid}", Name = "GetDepartmentById")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetDepartmentById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.Departments, id, cancellationToken);
    }

    /// <summary>
    /// Crée un nouveau département.
    /// </summary>
    /// <remarks>
    /// Cette route ajoute un département au référentiel. Le nom doit être unique.
    /// </remarks>
    /// <param name="request">Objet contenant le nom du département.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du département créé.</returns>
    /// <response code="201">Département créé avec succès.</response>
    /// <response code="400">Nom manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="409">Un département avec ce nom existe déjà.</response>
    [HttpPost("departments", Name = "CreateDepartment")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateDepartment([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Departments, request, nameof(GetDepartmentById), cancellationToken);
    }

    /// <summary>
    /// Met à jour un département.
    /// </summary>
    /// <remarks>
    /// Cette route modifie le nom d un département existant.
    /// </remarks>
    /// <param name="id">Identifiant unique du département.</param>
    /// <param name="request">Objet contenant le nouveau nom.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour.</returns>
    /// <response code="200">Département mis à jour avec succès.</response>
    /// <response code="400">Nom manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Département non trouvé.</response>
    /// <response code="409">Un département avec ce nom existe déjà.</response>
    [HttpPatch("departments/{id:guid}", Name = "UpdateDepartment")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateDepartment(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Departments, id, request, cancellationToken);
    }

    /// <summary>
    /// Supprime un département.
    /// </summary>
    /// <remarks>
    /// Cette route supprime un département du référentiel. Le département
    /// ne doit pas être utilisé par des utilisateurs.
    /// </remarks>
    /// <param name="id">Identifiant unique du département.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">Département supprimé avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Département non trouvé.</response>
    /// <response code="409">Département encore utilisé par des utilisateurs.</response>
    [HttpDelete("departments/{id:guid}", Name = "DeleteDepartment")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteDepartment(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Departments, id, cancellationToken);
    }

    /// <summary>
    /// Récupère la liste des écoles.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les écoles disponibles dans le système.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste d écoles.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("schools", Name = "ListSchools")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetSchools(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Schools, cancellationToken);
    }

    /// <summary>
    /// Récupère une école par son identifiant.
    /// </summary>
    /// <param name="id">Identifiant unique de l école.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de l école.</returns>
    /// <response code="200">École récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">École non trouvée.</response>
    [HttpGet("schools/{id:guid}", Name = "GetSchoolById")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetSchoolById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.Schools, id, cancellationToken);
    }

    /// <summary>
    /// Crée une nouvelle école.
    /// </summary>
    /// <param name="request">Objet contenant le nom de l école.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de l école créée.</returns>
    /// <response code="201">École créée avec succès.</response>
    /// <response code="400">Nom manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="409">Une école avec ce nom existe déjà.</response>
    [HttpPost("schools", Name = "CreateSchool")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateSchool([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Schools, request, nameof(GetSchoolById), cancellationToken);
    }

    /// <summary>
    /// Met à jour une école.
    /// </summary>
    /// <param name="id">Identifiant unique de l école.</param>
    /// <param name="request">Objet contenant le nouveau nom.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour.</returns>
    /// <response code="200">École mise à jour avec succès.</response>
    /// <response code="400">Nom manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">École non trouvée.</response>
    /// <response code="409">Une école avec ce nom existe déjà.</response>
    [HttpPatch("schools/{id:guid}", Name = "UpdateSchool")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateSchool(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Schools, id, request, cancellationToken);
    }

    /// <summary>
    /// Supprime une école.
    /// </summary>
    /// <param name="id">Identifiant unique de l école.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">École supprimée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">École non trouvée.</response>
    /// <response code="409">École encore utilisée.</response>
    [HttpDelete("schools/{id:guid}", Name = "DeleteSchool")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteSchool(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Schools, id, cancellationToken);
    }

    /// <summary>
    /// Récupère la liste des types de stage.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de types de stage.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("internship-types", Name = "ListInternshipTypes")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetInternshipTypes(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.InternshipTypes, cancellationToken);
    }

    /// <summary>
    /// Récupère un type de stage par son identifiant.
    /// </summary>
    /// <param name="id">Identifiant unique du type de stage.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du type de stage.</returns>
    /// <response code="200">Type de stage récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Type de stage non trouvé.</response>
    [HttpGet("internship-types/{id:guid}", Name = "GetInternshipTypeById")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetInternshipTypeById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.InternshipTypes, id, cancellationToken);
    }

    /// <summary>
    /// Crée un nouveau type de stage.
    /// </summary>
    /// <param name="request">Objet contenant le nom du type de stage.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du type de stage créé.</returns>
    /// <response code="201">Type de stage créé avec succès.</response>
    /// <response code="400">Nom manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="409">Un type de stage avec ce nom existe déjà.</response>
    [HttpPost("internship-types", Name = "CreateInternshipType")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateInternshipType([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.InternshipTypes, request, nameof(GetInternshipTypeById), cancellationToken);
    }

    /// <summary>
    /// Met à jour un type de stage.
    /// </summary>
    /// <param name="id">Identifiant unique du type de stage.</param>
    /// <param name="request">Objet contenant le nouveau nom.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour.</returns>
    /// <response code="200">Type de stage mis à jour avec succès.</response>
    /// <response code="400">Nom manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Type de stage non trouvé.</response>
    /// <response code="409">Un type de stage avec ce nom existe déjà.</response>
    [HttpPatch("internship-types/{id:guid}", Name = "UpdateInternshipType")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateInternshipType(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.InternshipTypes, id, request, cancellationToken);
    }

    /// <summary>
    /// Supprime un type de stage.
    /// </summary>
    /// <param name="id">Identifiant unique du type de stage.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">Type de stage supprimé avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Type de stage non trouvé.</response>
    /// <response code="409">Type de stage encore utilisé.</response>
    [HttpDelete("internship-types/{id:guid}", Name = "DeleteInternshipType")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteInternshipType(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.InternshipTypes, id, cancellationToken);
    }

    /// <summary>
    /// Récupère la liste des compétences.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de compétences.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("skills", Name = "ListSkills")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetSkills(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Skills, cancellationToken);
    }

    /// <summary>
    /// Récupère une compétence par son identifiant.
    /// </summary>
    /// <param name="id">Identifiant unique de la compétence.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de la compétence.</returns>
    /// <response code="200">Compétence récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Compétence non trouvée.</response>
    [HttpGet("skills/{id:guid}", Name = "GetSkillById")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetSkillById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.Skills, id, cancellationToken);
    }

    /// <summary>
    /// Crée une nouvelle compétence.
    /// </summary>
    /// <param name="request">Objet contenant le nom de la compétence.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de la compétence créée.</returns>
    /// <response code="201">Compétence créée avec succès.</response>
    /// <response code="400">Nom manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="409">Une compétence avec ce nom existe déjà.</response>
    [HttpPost("skills", Name = "CreateSkill")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateSkill([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Skills, request, nameof(GetSkillById), cancellationToken);
    }

    /// <summary>
    /// Met à jour une compétence.
    /// </summary>
    /// <param name="id">Identifiant unique de la compétence.</param>
    /// <param name="request">Objet contenant le nouveau nom.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour.</returns>
    /// <response code="200">Compétence mise à jour avec succès.</response>
    /// <response code="400">Nom manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Compétence non trouvée.</response>
    /// <response code="409">Une compétence avec ce nom existe déjà.</response>
    [HttpPatch("skills/{id:guid}", Name = "UpdateSkill")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateSkill(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Skills, id, request, cancellationToken);
    }

    /// <summary>
    /// Supprime une compétence.
    /// </summary>
    /// <param name="id">Identifiant unique de la compétence.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">Compétence supprimée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Compétence non trouvée.</response>
    /// <response code="409">Compétence encore utilisée.</response>
    [HttpDelete("skills/{id:guid}", Name = "DeleteSkill")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteSkill(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Skills, id, cancellationToken);
    }

    [HttpGet("verification-statuses", Name = "ListVerificationStatuses")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetVerificationStatuses(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.UserVerificationStatusReferences, cancellationToken);
    }

    [HttpGet("verification-statuses/{id:guid}", Name = "GetVerificationStatusById")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetVerificationStatusById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.UserVerificationStatusReferences, id, cancellationToken);
    }

    [HttpPost("verification-statuses", Name = "CreateVerificationStatus")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateVerificationStatus([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.UserVerificationStatusReferences, request, nameof(GetVerificationStatusById), cancellationToken);
    }

    [HttpPatch("verification-statuses/{id:guid}", Name = "UpdateVerificationStatus")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateVerificationStatus(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.UserVerificationStatusReferences, id, request, cancellationToken);
    }

    [HttpDelete("verification-statuses/{id:guid}", Name = "DeleteVerificationStatus")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteVerificationStatus(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.UserVerificationStatusReferences, id, cancellationToken);
    }

    private static string? NormalizeName(string? rawName)
    {
        if (string.IsNullOrWhiteSpace(rawName))
        {
            return null;
        }

        var tokens = rawName
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (tokens.Length == 0)
        {
            return null;
        }

        return string.Join(' ', tokens);
    }

    private static string BuildDuplicateMessage(string name)
    {
        return $"An entry with name '{name}' already exists.";
    }

    private static string BuildNotFoundMessage(Guid id)
    {
        return $"Entry '{id}' was not found.";
    }

    private static object ToResponse(ReferentialEntityBase item)
    {
        return new
        {
            id = item.Id,
            name = item.Name
        };
    }

    private static async Task<bool> ExistsByNameAsync<TEntity>(DbSet<TEntity> dbSet, string normalizedName, Guid? excludedId, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        return await dbSet
            .AsNoTracking()
            .AnyAsync(item =>
                (excludedId == null || item.Id != excludedId.Value) &&
                EF.Functions.Collate(item.Name, "SQL_Latin1_General_CP1_CI_AS") == normalizedName,
                cancellationToken);
    }

    private async Task<IActionResult> GetReferentialItemsAsync<TEntity>(DbSet<TEntity> dbSet, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        var data = await dbSet
            .AsNoTracking()
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);

        return Ok(new { data = data.Select(ToResponse) });
    }

    private async Task<IActionResult> GetReferentialItemByIdAsync<TEntity>(DbSet<TEntity> dbSet, Guid id, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        var entry = await dbSet
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        return entry is null
            ? NotFound()
            : Ok(ToResponse(entry));
    }

    private async Task<IActionResult> CreateReferentialItemAsync<TEntity>(DbSet<TEntity> dbSet, UpsertReferentialRequest request, string getByIdActionName, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase, new()
    {
        var normalizedName = NormalizeName(request.Name);
        if (normalizedName is null)
        {
            return BadRequest(new { message = "Name is required." });
        }

        if (await ExistsByNameAsync(dbSet, normalizedName, null, cancellationToken))
        {
            return Conflict(new { message = BuildDuplicateMessage(normalizedName) });
        }

        var entry = new TEntity
        {
            Name = normalizedName
        };

        dbSet.Add(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = UserContextHelper.ResolveCurrentUserId(User),
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = $"settings.{typeof(TEntity).Name.ToLowerInvariant()}.create",
            Entity = $"{typeof(TEntity).Name.ToLowerInvariant()}:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var result = ToResponse(entry);
        return CreatedAtAction(getByIdActionName, new { id = entry.Id }, result);
    }

    private async Task<IActionResult> UpdateReferentialItemAsync<TEntity>(DbSet<TEntity> dbSet, Guid id, UpdateReferentialRequest request, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        var normalizedName = NormalizeName(request.Name);
        if (normalizedName is null)
        {
            return BadRequest(new { message = "Name is required." });
        }

        var entry = await dbSet.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entry is null)
        {
            return NotFound(new { message = BuildNotFoundMessage(id) });
        }

        if (await ExistsByNameAsync(dbSet, normalizedName, id, cancellationToken))
        {
            return Conflict(new { message = BuildDuplicateMessage(normalizedName) });
        }

        entry.Name = normalizedName;

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = UserContextHelper.ResolveCurrentUserId(User),
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = $"settings.{typeof(TEntity).Name.ToLowerInvariant()}.update",
            Entity = $"{typeof(TEntity).Name.ToLowerInvariant()}:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(entry));
    }

    private async Task<IActionResult> DeleteReferentialItemAsync<TEntity>(DbSet<TEntity> dbSet, Guid id, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        var entry = await dbSet.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entry is null)
        {
            return NotFound(new { message = BuildNotFoundMessage(id) });
        }

        if (await HasReferentialUsageAsync<TEntity>(id, cancellationToken))
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                message = "Cannot delete this item because it is referenced by existing records."
            });
        }

        dbSet.Remove(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = UserContextHelper.ResolveCurrentUserId(User),
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = $"settings.{typeof(TEntity).Name.ToLowerInvariant()}.delete",
            Entity = $"{typeof(TEntity).Name.ToLowerInvariant()}:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsForeignKeyViolation(exception))
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                message = "Cannot delete this item because it is referenced by existing records."
            });
        }

        return NoContent();
    }

    private async Task<bool> HasReferentialUsageAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        if (typeof(TEntity) == typeof(Department))
        {
            return await dbContext.Users
                .AsNoTracking()
                .AnyAsync(user => user.DepartmentId == id, cancellationToken);
        }

        if (typeof(TEntity) == typeof(School))
        {
            return await dbContext.InternProfiles
                .AsNoTracking()
                .AnyAsync(profile => profile.UniversityId == id, cancellationToken);
        }

        if (typeof(TEntity) == typeof(Skill))
        {
            return await dbContext.InternProfileSkills
                .AsNoTracking()
                .AnyAsync(link => link.SkillId == id, cancellationToken);
        }

        if (typeof(TEntity) == typeof(InternshipType))
        {
            var typeName = await dbContext.InternshipTypes
                .AsNoTracking()
                .Where(item => item.Id == id)
                .Select(item => item.Name)
                .FirstOrDefaultAsync(cancellationToken);

            if (string.IsNullOrWhiteSpace(typeName))
            {
                return false;
            }

            return await dbContext.Missions
                .AsNoTracking()
                .AnyAsync(
                    mission => mission.InternshipTypeId == id ||
                               (mission.InternshipTypeId == null &&
                                EF.Functions.Collate(mission.Level, "SQL_Latin1_General_CP1_CI_AS") == typeName),
                    cancellationToken);
        }

        return false;
    }

    private static bool IsForeignKeyViolation(DbUpdateException exception)
    {
        return exception.InnerException is SqlException sqlException && sqlException.Number == 547;
    }
}

public sealed class UpsertReferentialRequest
{
    public string Name { get; init; } = string.Empty;
}
