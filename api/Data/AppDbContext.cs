/// <summary>
/// 📁 Emplacement : api/Data/AppDbContext.cs
/// 🎯 Rôle       : Configure l accès à la base de données et la persistance des entités métier.
/// 📦 Contient   : [AppDbContext]
/// </summary>
using InternManager.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Data;

/// <summary>
/// Contexte Entity Framework principal de l application.
/// Il expose les tables métier et applique les règles de mapping vers SQL.
/// </summary>
/// <param name="options">Options de configuration du contexte injectées par l application.</param>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    /// <summary>
    /// Table logique des utilisateurs, mappée vers l entité <see cref="User"/>.
    /// </summary>
    public DbSet<User> Users => Set<User>();

    /// <summary>
    /// Définit les contraintes de schéma et les conversions de l entité <see cref="User"/>.
    /// </summary>
    /// <param name="modelBuilder">Constructeur du modèle EF Core utilisé pour la configuration.</param>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");

            entity.HasKey(u => u.Id);

            entity.Property(u => u.Id)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("NEWID()");

            entity.Property(u => u.FirstName)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(u => u.LastName)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(u => u.Email)
                .IsRequired()
                .HasMaxLength(255);

            entity.HasIndex(u => u.Email)
                .IsUnique();

            entity.Property(u => u.PasswordHash)
                .IsRequired();

            entity.Property(u => u.Role)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(32);

            entity.Property(u => u.Status)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(32);

            entity.Property(u => u.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.Property(u => u.UpdatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");
        });
    }

    /// <summary>
    /// Enregistre les changements synchrones après mise à jour automatique des dates techniques.
    /// </summary>
    /// <returns>Le nombre d enregistrements écrits en base.</returns>
    public override int SaveChanges()
    {
        ApplyTimestamps();
        return base.SaveChanges();
    }

    /// <summary>
    /// Enregistre les changements synchrones après mise à jour automatique des dates techniques.
    /// </summary>
    /// <param name="acceptAllChangesOnSuccess">Indique si EF doit accepter les changements après succès.</param>
    /// <returns>Le nombre d enregistrements écrits en base.</returns>
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ApplyTimestamps();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    /// <summary>
    /// Enregistre les changements asynchrones après mise à jour automatique des dates techniques.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>Une tâche retournant le nombre d enregistrements écrits en base.</returns>
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Enregistre les changements asynchrones après mise à jour automatique des dates techniques.
    /// </summary>
    /// <param name="acceptAllChangesOnSuccess">Indique si EF doit accepter les changements après succès.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>Une tâche retournant le nombre d enregistrements écrits en base.</returns>
    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ApplyTimestamps();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>
    /// Met à jour automatiquement les champs temporels (`CreatedAt` et `UpdatedAt`) avant écriture en base.
    /// </summary>
    private void ApplyTimestamps()
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<User>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default)
                {
                    entry.Entity.CreatedAt = utcNow;
                }

                entry.Entity.UpdatedAt = utcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(e => e.CreatedAt).IsModified = false;
                entry.Entity.UpdatedAt = utcNow;
            }
        }
    }
}
