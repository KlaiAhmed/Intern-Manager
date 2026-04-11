namespace InternManager.Api.Common.Utilities;

/// <summary>
/// Fournit des méthodes utilitaires pour lire un fichier `.env` et injecter ses valeurs dans l environnement du processus.
/// </summary>
public static class EnvLoader
{
    /// <summary>
    /// Cherche un fichier `.env` en remontant les dossiers puis charge chaque variable trouvée.
    /// </summary>
    /// <remarks>
    /// Les lignes vides, les commentaires (`#`) et les lignes sans séparateur `=` sont ignorés.
    /// </remarks>
    /// <exception cref="IOException">Peut survenir si le fichier `.env` existe mais ne peut pas être lu.</exception>
    /// <exception cref="UnauthorizedAccessException">Peut survenir si le processus n a pas les droits d accès au fichier `.env`.</exception>
    public static void LoadFromProjectRoot()
    {
        var envPath = ResolveEnvPath();
        if (envPath is null)
        {
            return;
        }

        foreach (var rawLine in File.ReadAllLines(envPath))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#'))
            {
                continue;
            }

            var separatorIndex = line.IndexOf('=');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = line[..separatorIndex].Trim();
            var value = line[(separatorIndex + 1)..].Trim().Trim('"');

            if (!string.IsNullOrWhiteSpace(key))
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }

    /// <summary>
    /// Remonte l arborescence des dossiers à partir du dossier courant pour localiser un fichier `.env`.
    /// </summary>
    /// <returns>
    /// Le chemin complet du fichier `.env` si trouvé, sinon <see langword="null"/>.
    /// </returns>
    private static string? ResolveEnvPath()
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, ".env");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        return null;
    }
}
