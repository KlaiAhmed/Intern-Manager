/// <summary>
/// 📁 Emplacement : api/Program.cs
/// 🎯 Rôle       : Point d entrée de l API : configure les services, initialise la base et démarre le serveur HTTP.
/// 📦 Contient   : [BuildSqlServerConnectionString, BuildServerUrl]
/// </summary>
using InternManager.Api.Data;
using InternManager.Api.Data.Initialization;
using InternManager.Api.Common.OpenApi;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Extensions;
using InternManager.Api.Middleware;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using InternManager.Api.Services.Internships;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

EnvLoader.LoadFromProjectRoot();

var builder = WebApplication.CreateBuilder(args);
const string clientCorsPolicyName = "ClientCorsPolicy";
const string jwtSecretPlaceholder = "REPLACE_WITH_SECRET_IN_ENVIRONMENT";

if (string.Equals(builder.Configuration["Jwt:Key"], jwtSecretPlaceholder, StringComparison.Ordinal))
{
    throw new InvalidOperationException("JWT secret is not configured. Set a real value before deployment.");
}

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
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IInternshipsService, InternshipsService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<ICvStorageService, CvStorageService>();
builder.Services.AddScoped<ISupervisorScopeService, SupervisorScopeService>();
builder.Services.AddScoped<ITaskWorkflowService, TaskWorkflowService>();
builder.Services.AddScoped<InternOnboardingValidationFilter>();
builder.Services.AddProblemDetails();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            }));

    options.AddFixedWindowLimiter("upload", limiterOptions =>
    {
        limiterOptions.PermitLimit = 5;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });

    options.AddFixedWindowLimiter("write-heavy", limiterOptions =>
    {
        limiterOptions.PermitLimit = 20;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });

    options.AddPolicy("write-operations", context =>
    {
        var userId = context.User?.FindFirst("userId")?.Value ?? "anonymous";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: userId,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    });
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.CustomOperationIds(apiDescription =>
    {
        return apiDescription.ActionDescriptor.AttributeRouteInfo?.Name;
    });

    options.OperationFilter<CreatedResponseLocationHeaderOperationFilter>();

    // Inclure les commentaires XML dans la documentation Swagger
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }
});

var app = builder.Build();

try
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    await EfMigrationBootstrapper.EnsureBaselineHistoryAsync(dbContext, logger);
    await dbContext.Database.MigrateAsync();
}
catch (Exception exception)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogCritical(exception, "Fatal startup error during database initialization.");
    throw;
}

try
{
    await DbSeeder.SeedSuperAdminAsync(app.Services);
}
catch (Exception exception)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogCritical(exception, "Fatal startup error during SuperAdmin seeding.");
    throw;
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler();
app.UseStatusCodePages(async statusCodeContext =>
{
    var httpContext = statusCodeContext.HttpContext;

    if (!httpContext.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
    {
        return;
    }

    if (httpContext.Response.HasStarted)
    {
        return;
    }

    if (!string.IsNullOrWhiteSpace(httpContext.Response.ContentType))
    {
        return;
    }

    if (httpContext.Response.ContentLength.HasValue && httpContext.Response.ContentLength.Value > 0)
    {
        return;
    }

    await httpContext.Response.WriteAsJsonAsync(new ErrorResponse
    {
        Message = GetDefaultErrorMessage(httpContext.Response.StatusCode)
    });
});
app.UseCors(clientCorsPolicyName);
app.UseHttpsRedirection();
app.UseAuthentication();

if (app.Environment.IsDevelopment())
{
    // Development-only middleware: never remove this environment guard.
    app.UseMiddleware<DevelopmentLazyAuthBypassMiddleware>();
}

app.UseRateLimiter();
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

static string GetDefaultErrorMessage(int statusCode)
{
    return statusCode switch
    {
        StatusCodes.Status400BadRequest => "Bad request.",
        StatusCodes.Status401Unauthorized => "Authentication is required.",
        StatusCodes.Status403Forbidden => "You do not have permission to perform this action.",
        StatusCodes.Status404NotFound => "Resource not found.",
        StatusCodes.Status409Conflict => "The request could not be completed because of a conflict.",
        StatusCodes.Status429TooManyRequests => "Too many requests. Please try again later.",
        _ => "An unexpected error occurred."
    };
}

public partial class Program
{
}
