/// <summary>
/// 📁 Emplacement : api/Program.cs
/// 🎯 Rôle       : Point d entrée de l API : configure les services, initialise la base et démarre le serveur HTTP.
/// 📦 Contient   : [BuildSqlServerConnectionString, BuildServerUrl]
/// </summary>
using InternManager.Api.Data;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Extensions;
using Microsoft.EntityFrameworkCore;

EnvLoader.LoadFromProjectRoot();

var builder = WebApplication.CreateBuilder(args);
const string clientCorsPolicyName = "ClientCorsPolicy";

var serverPort = builder.Configuration["SERVER_PORT"];
var serverUrl = BuildServerUrl(serverPort);
builder.WebHost.UseUrls(serverUrl);

var corsOrigins = BuildCorsOrigins(builder.Configuration["CLIENT_ORIGIN"]);

var databasePath = builder.Configuration["DATABASE_PATH"];
var sqlServerInstance = builder.Configuration["SQLSERVER_INSTANCE"];
var connectionString = BuildSqlServerConnectionString(databasePath, sqlServerInstance);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddCors(options =>
{
    options.AddPolicy(clientCorsPolicyName, policyBuilder =>
    {
        policyBuilder
            .WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddControllers();
builder.Services.AddAuth(builder.Configuration);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

try
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.EnsureCreatedAsync();
}
catch (Exception exception)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogError(exception, "Database initialization failed.");
}

try
{
    await DbSeeder.SeedSuperAdminAsync(app.Services);
}
catch (Exception exception)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogError(exception, "SuperAdmin seeding failed.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(clientCorsPolicyName);
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

/// <summary>
/// Construit la chaîne de connexion SQL Server à partir des valeurs de configuration.
/// </summary>
/// <param name="databasePath">Nom logique de base fourni par la configuration.</param>
/// <param name="sqlServerInstance">Nom de l instance SQL Server à utiliser.</param>
/// <returns>Une chaîne de connexion SQL Server complète.</returns>
static string BuildSqlServerConnectionString(string? databasePath, string? sqlServerInstance)
{
    var effectivePath = string.IsNullOrWhiteSpace(databasePath)
        ? "app.db"
        : databasePath;

    var effectiveSqlServerInstance = string.IsNullOrWhiteSpace(sqlServerInstance)
        ? @".\SQLEXPRESS"
        : sqlServerInstance;

    var databaseName = Path.GetFileNameWithoutExtension(effectivePath);
    if (string.IsNullOrWhiteSpace(databaseName))
    {
        databaseName = "app";
    }

    return $"Server={effectiveSqlServerInstance};Database=SmartAxiaInternManager_{databaseName};Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";
}

/// <summary>
/// Construit l URL locale du serveur HTTP à partir du port configuré.
/// </summary>
/// <param name="serverPort">Valeur de port brute lue depuis la configuration.</param>
/// <returns>URL locale au format `http://localhost:{port}`.</returns>
static string BuildServerUrl(string? serverPort)
{
    const int defaultPort = 5184;

    if (!int.TryParse(serverPort, out var port) || port is < 1 or > 65535)
    {
        port = defaultPort;
    }

    return $"http://localhost:{port}";
}

/// <summary>
/// Construit la liste des origines autorisées pour CORS à partir de la configuration.
/// </summary>
/// <param name="configuredOrigin">Origines autorisées séparées par virgule (optionnel).</param>
/// <returns>Tableau des origines autorisées pour la policy CORS.</returns>
static string[] BuildCorsOrigins(string? configuredOrigin)
{
    const string defaultOrigin = "http://localhost:5173";

    if (string.IsNullOrWhiteSpace(configuredOrigin))
    {
        return [defaultOrigin];
    }

    var origins = configuredOrigin
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(origin => origin.TrimEnd('/'))
        .Where(origin => !string.IsNullOrWhiteSpace(origin))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    return origins.Length > 0
        ? origins
        : [defaultOrigin];
}
