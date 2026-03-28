using InternManager.Api.Data;
using InternManager.Api.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services.Auth;

public sealed class DbAuthUserStore(IServiceScopeFactory scopeFactory) : IAuthUserStore
{
    public async Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var normalizedEmail = email.Trim();

        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                u => u.Status == UserStatus.Active &&
                     u.Email.ToLower() == normalizedEmail.ToLower(),
                cancellationToken);

        return user is null
            ? null
            : new AuthUserRecord(
                user.Id,
                user.Email,
                user.PasswordHash,
                user.Role.ToString());
    }

    public async Task<AuthUserRecord?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && u.Status == UserStatus.Active, cancellationToken);

        return user is null
            ? null
            : new AuthUserRecord(
                user.Id,
                user.Email,
                user.PasswordHash,
                user.Role.ToString());
    }
}