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
    /// Table des evenements d audit affiches dans les dashboards admin.
    /// </summary>
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    /// <summary>
    /// Table des missions superviseur.
    /// </summary>
    public DbSet<Mission> Missions => Set<Mission>();

    /// <summary>
    /// Table des livrables rattaches aux missions.
    /// </summary>
    public DbSet<Deliverable> Deliverables => Set<Deliverable>();

    /// <summary>
    /// Table des evaluations superviseur stagiaire.
    /// </summary>
    public DbSet<Evaluation> Evaluations => Set<Evaluation>();

    /// <summary>
    /// Table des reunions superviseur stagiaire.
    /// </summary>
    public DbSet<Meeting> Meetings => Set<Meeting>();

    /// <summary>
    /// Table des entrees de journal des stagiaires.
    /// </summary>
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();

    /// <summary>
    /// Table des taches individuelles des stagiaires.
    /// </summary>
    public DbSet<InternTask> InternTasks => Set<InternTask>();

    /// <summary>
    /// Table des departements parametrables depuis les settings admin.
    /// </summary>
    public DbSet<Department> Departments => Set<Department>();

    /// <summary>
    /// Table des ecoles parametrables depuis les settings admin.
    /// </summary>
    public DbSet<School> Schools => Set<School>();

    /// <summary>
    /// Table des types de stage parametrables depuis les settings admin.
    /// </summary>
    public DbSet<InternshipType> InternshipTypes => Set<InternshipType>();

    /// <summary>
    /// Table des competences parametrables depuis les settings admin.
    /// </summary>
    public DbSet<Skill> Skills => Set<Skill>();

    /// <summary>
    /// Table des statuts utilisateur parametrables depuis les settings admin.
    /// </summary>
    public DbSet<UserStatusReference> UserStatusReferences => Set<UserStatusReference>();

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

            entity.Property(u => u.LastLoginAt);

            entity.HasIndex(u => u.DepartmentId);
            entity.HasIndex(u => new { u.Role, u.Status });
            entity.HasIndex(u => new { u.Role, u.DepartmentId, u.Status });

            entity.HasOne(u => u.Department)
                .WithMany()
                .HasForeignKey(u => u.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.Property(u => u.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.Property(u => u.UpdatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs");

            entity.HasKey(log => log.Id);

            entity.Property(log => log.Id)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("NEWID()");

            entity.Property(log => log.Actor)
                .IsRequired()
                .HasMaxLength(255);

            entity.Property(log => log.Action)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(log => log.Entity)
                .HasMaxLength(300);

            entity.Property(log => log.Timestamp)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(log => log.Timestamp);
            entity.HasIndex(log => log.ActorUserId);

            entity.HasOne(log => log.ActorUser)
                .WithMany()
                .HasForeignKey(log => log.ActorUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Mission>(entity =>
        {
            entity.ToTable("Missions");

            entity.HasKey(mission => mission.Id);

            entity.Property(mission => mission.Id)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("NEWID()");

            entity.Property(mission => mission.Title)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(mission => mission.Description)
                .HasMaxLength(4000);

            entity.Property(mission => mission.SkillsJson)
                .IsRequired();

            entity.Property(mission => mission.Tools)
                .HasMaxLength(1000);

            entity.Property(mission => mission.Level)
                .HasMaxLength(64);

            entity.Property(mission => mission.Status)
                .IsRequired()
                .HasMaxLength(32)
                .HasDefaultValue("active");

            entity.Property(mission => mission.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(mission => mission.SupervisorId);
            entity.HasIndex(mission => mission.InternId);
            entity.HasIndex(mission => mission.CreatedAt);

            entity.HasOne(mission => mission.Supervisor)
                .WithMany()
                .HasForeignKey(mission => mission.SupervisorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(mission => mission.Intern)
                .WithMany()
                .HasForeignKey(mission => mission.InternId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Deliverable>(entity =>
        {
            entity.ToTable("Deliverables");

            entity.HasKey(deliverable => deliverable.Id);

            entity.Property(deliverable => deliverable.Id)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("NEWID()");

            entity.Property(deliverable => deliverable.Title)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(deliverable => deliverable.Status)
                .IsRequired()
                .HasMaxLength(32)
                .HasDefaultValue("pending");

            entity.Property(deliverable => deliverable.FileUrl)
                .HasMaxLength(2048);

            entity.Property(deliverable => deliverable.SupervisorComment)
                .HasMaxLength(2000);

            entity.Property(deliverable => deliverable.Progress)
                .HasDefaultValue(0);

            entity.Property(deliverable => deliverable.Version)
                .HasDefaultValue(1);

            entity.Property(deliverable => deliverable.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(deliverable => deliverable.MissionId);
            entity.HasIndex(deliverable => deliverable.SupervisorId);
            entity.HasIndex(deliverable => deliverable.InternId);
            entity.HasIndex(deliverable => deliverable.Status);

            entity.HasOne(deliverable => deliverable.Mission)
                .WithMany(mission => mission.Deliverables)
                .HasForeignKey(deliverable => deliverable.MissionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(deliverable => deliverable.Supervisor)
                .WithMany()
                .HasForeignKey(deliverable => deliverable.SupervisorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(deliverable => deliverable.Intern)
                .WithMany()
                .HasForeignKey(deliverable => deliverable.InternId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Evaluation>(entity =>
        {
            entity.ToTable("Evaluations");

            entity.HasKey(evaluation => evaluation.Id);

            entity.Property(evaluation => evaluation.Id)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("NEWID()");

            entity.Property(evaluation => evaluation.Type)
                .IsRequired()
                .HasMaxLength(32);

            entity.Property(evaluation => evaluation.Comments)
                .HasMaxLength(3000);

            entity.Property(evaluation => evaluation.Status)
                .IsRequired()
                .HasMaxLength(32)
                .HasDefaultValue("pending");

            entity.Property(evaluation => evaluation.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(evaluation => evaluation.SupervisorId);
            entity.HasIndex(evaluation => evaluation.InternId);
            entity.HasIndex(evaluation => evaluation.Status);

            entity.HasIndex(evaluation => new { evaluation.SupervisorId, evaluation.InternId, evaluation.Type })
                .IsUnique();

            entity.HasOne(evaluation => evaluation.Supervisor)
                .WithMany()
                .HasForeignKey(evaluation => evaluation.SupervisorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(evaluation => evaluation.Intern)
                .WithMany()
                .HasForeignKey(evaluation => evaluation.InternId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Meeting>(entity =>
        {
            entity.ToTable("Meetings");

            entity.HasKey(meeting => meeting.Id);

            entity.Property(meeting => meeting.Id)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("NEWID()");

            entity.Property(meeting => meeting.Notes)
                .HasMaxLength(3000);

            entity.Property(meeting => meeting.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(meeting => meeting.SupervisorId);
            entity.HasIndex(meeting => meeting.InternId);
            entity.HasIndex(meeting => meeting.Date);

            entity.HasOne(meeting => meeting.Supervisor)
                .WithMany()
                .HasForeignKey(meeting => meeting.SupervisorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(meeting => meeting.Intern)
                .WithMany()
                .HasForeignKey(meeting => meeting.InternId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<JournalEntry>(entity =>
        {
            entity.ToTable("JournalEntries");

            entity.HasKey(entry => entry.Id);

            entity.Property(entry => entry.Id)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("NEWID()");

            entity.Property(entry => entry.Content)
                .IsRequired()
                .HasMaxLength(4000);

            entity.Property(entry => entry.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(entry => entry.InternId);
            entity.HasIndex(entry => entry.CreatedAt);

            entity.HasOne(entry => entry.Intern)
                .WithMany()
                .HasForeignKey(entry => entry.InternId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<InternTask>(entity =>
        {
            entity.ToTable("InternTasks");

            entity.HasKey(task => task.Id);

            entity.Property(task => task.Id)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("NEWID()");

            entity.Property(task => task.Title)
                .IsRequired()
                .HasMaxLength(250);

            entity.Property(task => task.IsComplete)
                .HasDefaultValue(false);

            entity.Property(task => task.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(task => task.InternId);
            entity.HasIndex(task => task.DeliverableId);
            entity.HasIndex(task => task.DueDate);

            entity.HasOne(task => task.Intern)
                .WithMany()
                .HasForeignKey(task => task.InternId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(task => task.Deliverable)
                .WithMany()
                .HasForeignKey(task => task.DeliverableId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Department>(entity => ConfigureReferentialEntity(entity, "Departments"));
        modelBuilder.Entity<School>(entity => ConfigureReferentialEntity(entity, "Schools"));
        modelBuilder.Entity<InternshipType>(entity => ConfigureReferentialEntity(entity, "InternshipTypes"));
        modelBuilder.Entity<Skill>(entity => ConfigureReferentialEntity(entity, "Skills"));
        modelBuilder.Entity<UserStatusReference>(entity => ConfigureReferentialEntity(entity, "UserStatusReferences"));
    }

    /// <summary>
    /// Configure une entite de referentiel (id, nom unique et timestamps techniques).
    /// </summary>
    private static void ConfigureReferentialEntity<TEntity>(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> entity,
        string tableName)
        where TEntity : ReferentialEntityBase
    {
        entity.ToTable(tableName);

        entity.HasKey(item => item.Id);

        entity.Property(item => item.Id)
            .ValueGeneratedOnAdd()
            .HasDefaultValueSql("NEWID()");

        entity.Property(item => item.Name)
            .IsRequired()
            .HasMaxLength(120);

        entity.HasIndex(item => item.Name)
            .IsUnique();

        entity.Property(item => item.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        entity.Property(item => item.UpdatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");
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

        foreach (var entry in ChangeTracker.Entries<ReferentialEntityBase>())
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
