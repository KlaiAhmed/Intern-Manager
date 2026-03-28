/// <summary>
/// 📁 Emplacement : api/Services/Auth/PasswordHasher.cs
/// 🎯 Rôle       : Fournit les fonctions de hachage et de vérification des mots de passe.
/// 📦 Contient   : [PasswordHasher]
/// </summary>
using System.Security.Cryptography;
using System.Text;

namespace InternManager.Api.Services.Auth;

/// <summary>
/// Gère le hachage des mots de passe et la vérification de compatibilité entre anciens et nouveaux formats.
/// </summary>
internal static class PasswordHasher
{
    /// <summary>
    /// Crée une empreinte BCrypt sécurisée à partir d un mot de passe en clair.
    /// </summary>
    /// <param name="password">Mot de passe en clair à transformer.</param>
    /// <returns>Une chaîne hachée au format BCrypt.</returns>
    /// <exception cref="ArgumentException">Levée quand <paramref name="password"/> est vide ou contient seulement des espaces.</exception>
    public static string HashPassword(string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);

        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    /// <summary>
    /// Vérifie si un mot de passe en clair correspond à une empreinte stockée.
    /// </summary>
    /// <param name="password">Mot de passe en clair fourni par l utilisateur.</param>
    /// <param name="storedHash">Empreinte stockée en base (BCrypt ou ancien format PBKDF2).</param>
    /// <returns><see langword="true"/> si le mot de passe est valide ; sinon <see langword="false"/>.</returns>
    public static bool VerifyPassword(string password, string storedHash)
    {
        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(storedHash))
        {
            return false;
        }

        if (storedHash.StartsWith("$2", StringComparison.Ordinal))
        {
            return BCrypt.Net.BCrypt.Verify(password, storedHash);
        }

        return VerifyLegacyPbkdf2(password, storedHash);
    }

    /// <summary>
    /// Vérifie un mot de passe contre une empreinte héritée au format PBKDF2.
    /// </summary>
    /// <param name="password">Mot de passe en clair à valider.</param>
    /// <param name="storedHash">Empreinte héritée au format `PBKDF2$iterations$salt$hash`.</param>
    /// <returns><see langword="true"/> si la validation réussit ; sinon <see langword="false"/>.</returns>
    private static bool VerifyLegacyPbkdf2(string password, string storedHash)
    {
        if (!storedHash.StartsWith("PBKDF2$", StringComparison.Ordinal))
        {
            return false;
        }

        var parts = storedHash.Split('$', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 4 || !parts[0].Equals("PBKDF2", StringComparison.Ordinal))
        {
            return false;
        }

        if (!int.TryParse(parts[1], out var iterations) || iterations <= 0)
        {
            return false;
        }

        byte[] salt;
        byte[] expectedHash;

        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expectedHash = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actualHash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            expectedHash.Length);

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }
}
