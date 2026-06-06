using InternManager.Api.Application.Users;
using InternManager.Api.Jobs;

DotNetEnv.Env.Load();

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
    options.UseSqlServer( // Configure SQL Server provider with bounded transient retries.
        connectionString, // Preserve the existing SQL Server connection string.
        sqlOptions => sqlOptions.EnableRetryOnFailure( // Retry transient SQL failures automatically.
            maxRetryCount: 3, // Match the audit-required retry count.
            maxRetryDelay: TimeSpan.FromSeconds(5), // Bound retry delay so requests fail promptly.
            errorNumbersToAdd: null))); // Use EF Core's default transient SQL error list.

builder.Services.AddSingleton<UserDeletionPolicy>();
builder.Services.AddScoped<UserDeletionService>();

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

builder.Services
.AddControllers(options =>
{
    options.Filters.AddService<FeatureFlagGateFilter>();
})
.ConfigureApiBehaviorOptions(options =>
{
        options.InvalidModelStateResponseFactory = context =>
        {
            var validationProblemDetails = new ValidationProblemDetails(context.ModelState)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred.",
                Type = ProblemDetailsHelper.GetProblemTypeUri(StatusCodes.Status400BadRequest),
                Detail = "Validation failed for one or more fields.",
                Instance = context.HttpContext.Request.Path
            };

            validationProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;

            return new BadRequestObjectResult(validationProblemDetails)
            {
                ContentTypes = { "application/problem+json" }
            };
        };
    });
builder.Services.AddAuth(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddScoped<IInternshipsService, InternshipsService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<ICvStorageService, CvStorageService>();
builder.Services.AddScoped<IFileStorageService, LocalFileStorageService>();
builder.Services.AddScoped<ISupervisorScopeService, SupervisorScopeService>();
builder.Services.AddScoped<ISupervisorStatsService, SupervisorStatsService>();
builder.Services.AddScoped<ISupervisorInternsService, SupervisorInternsService>();
builder.Services.AddScoped<ISupervisorJournalRepository, SupervisorJournalRepository>();
builder.Services.AddScoped<ISupervisorJournalService, SupervisorJournalService>();
builder.Services.AddScoped<ISupervisorMissionNotesService, SupervisorMissionNotesService>();
builder.Services.AddScoped<IMissionDocumentsService, MissionDocumentsService>();
builder.Services.AddScoped<IInternMissionDocumentsService, InternMissionDocumentsService>();
builder.Services.AddScoped<IDeliverablesService, DeliverablesService>();
builder.Services.AddScoped<IDeliverableProgressService, DeliverableProgressService>();
builder.Services.AddScoped<IMissionProgressService, MissionProgressService>();
builder.Services.AddScoped<IMissionPolicyService, MissionPolicyService>();
builder.Services.AddScoped<IEvaluationStatusService, EvaluationStatusService>();
builder.Services.AddScoped<IEvaluationReleaseRepository, EvaluationReleaseRepository>();
builder.Services.AddScoped<IEvaluationReleaseService, EvaluationReleaseService>();
builder.Services.AddScoped<IMissionFeatureFlagsRepository, MissionFeatureFlagsRepository>();
builder.Services.AddScoped<IMissionFeatureFlagsService, MissionFeatureFlagsService>();
builder.Services.AddScoped<IInternNotificationRepository, InternNotificationRepository>();
builder.Services.AddScoped<IInternNotificationService, InternNotificationService>();
builder.Services.AddScoped<IInternSkillsService, InternSkillsService>();
builder.Services.AddScoped<ITaskWorkflowService, TaskWorkflowService>();
builder.Services.AddScoped<ITaskStateService, TaskStateService>();
builder.Services.AddScoped<IDeliverableStateService, DeliverableStateService>();
builder.Services.AddScoped<IMissionStateService, MissionStateService>();
builder.Services.AddHostedService<ProgressConsistencyJob>();
builder.Services.AddHostedService<NotificationWorker>();
builder.Services.AddScoped<InternOnboardingValidationFilter>();
builder.Services.AddScoped<FeatureFlagGateFilter>();
builder.Services.AddProblemDetails();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, cancellationToken) =>
    {
        var httpContext = context.HttpContext;
        var logger = httpContext.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("RateLimiting");
        var endpoint = httpContext.GetEndpoint();
        var policyName = endpoint?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName ?? "unknown";
        var userId = httpContext.User?.FindFirst("userId")?.Value;
        var partitionKey = userId ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous";
        var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfterValue)
            ? retryAfterValue.ToString("c")
            : "n/a";

        logger.LogWarning(
            "Rate limit rejected {Method} {Path} policy={PolicyName} userId={UserId} partition={PartitionKey} retryAfter={RetryAfter}",
            httpContext.Request.Method,
            httpContext.Request.Path,
            policyName,
            userId ?? "anonymous",
            partitionKey,
            retryAfter);

        return ValueTask.CompletedTask;
    };

options.AddPolicy("auth", context =>
 {
 var userId = context.User?.FindFirst("userId")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous";
 return RateLimitPartition.GetFixedWindowLimiter(
 partitionKey: userId,
 factory: _ => new FixedWindowRateLimiterOptions
 {
 PermitLimit = 5,
 Window = TimeSpan.FromMinutes(1),
 QueueLimit = 0,
 QueueProcessingOrder = QueueProcessingOrder.OldestFirst
 });
 });

 options.AddPolicy("auth-refresh", context =>
 {
 var userId = context.User?.FindFirst("userId")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous";
 return RateLimitPartition.GetFixedWindowLimiter(
 partitionKey: userId,
 factory: _ => new FixedWindowRateLimiterOptions
 {
 PermitLimit = 10,
 Window = TimeSpan.FromMinutes(1),
 QueueLimit = 0,
 QueueProcessingOrder = QueueProcessingOrder.OldestFirst
 });
 });

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

    options.AddPolicy("read-frequent", context =>
    {
        var userId = context.User?.FindFirst("userId")?.Value ?? "anonymous";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: userId,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    });

    options.AddPolicy("delete-operations", context =>
    {
        var userId = context.User?.FindFirst("userId")?.Value ?? "anonymous";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: userId,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 15,
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
    var hostEnvironment = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();

    logger.LogInformation("Step 1/4: Running EF baseline bootstrapper");
    await EfMigrationBootstrapper.EnsureBaselineHistoryAsync(dbContext, logger);

    logger.LogInformation("Step 2/4: Applying EF migrations");
    await dbContext.Database.MigrateAsync();

    logger.LogInformation("Step 3/4: Applying pending SQL migration scripts");
    await SqlMigrationScriptRunner.ApplyPendingScriptsAsync(dbContext, logger, hostEnvironment.ContentRootPath);

    logger.LogInformation("Step 4/4: Seeding SuperAdmin");
    await DbSeeder.SeedSuperAdminAsync(app.Services);
}
catch (Exception exception)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogCritical(exception, "Database migration failed at startup. Startup aborted.");
    throw;
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionMiddleware>();
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

    var problemDetails = new ProblemDetails
    {
        Status = httpContext.Response.StatusCode,
        Title = ProblemDetailsHelper.GetErrorTitle(httpContext.Response.StatusCode),
        Type = ProblemDetailsHelper.GetProblemTypeUri(httpContext.Response.StatusCode),
        Detail = ProblemDetailsHelper.GetErrorMessage(httpContext.Response.StatusCode),
        Instance = httpContext.Request.Path
    };

    problemDetails.Extensions["traceId"] = httpContext.TraceIdentifier;

    httpContext.Response.ContentType = "application/problem+json";
    await httpContext.Response.WriteAsJsonAsync(problemDetails);
});
app.UseCors(clientCorsPolicyName);
app.UseHttpsRedirection();
// FIX L23: security headers at app layer (belt-and-suspenders behind reverse proxy).
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    var spaOrigin = app.Configuration["CLIENT_ORIGIN"] ?? "http://localhost:5173";
    context.Response.Headers["Content-Security-Policy"] =
        $"default-src 'self'; " +
        $"script-src 'self'; " +
        $"style-src 'self' 'unsafe-inline'; " +
        $"img-src 'self' data: blob:; " +
        $"connect-src 'self' {spaOrigin}; " +
        $"frame-ancestors 'none';";
    if (context.Request.IsHttps)
    {
        context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    }

    await next();
});
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

// Construit la chaîne de connexion SQL Server à partir des valeurs de configuration.
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

    return $"Server={effectiveSqlServerInstance};Database=AxiaInternManager_{databaseName};Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";
}

// Construit l URL locale du serveur HTTP à partir du port configuré.
static string BuildServerUrl(string? serverPort)
{
    const int defaultPort = 5184;

    if (!int.TryParse(serverPort, out var port) || port is < 1 or > 65535)
    {
        port = defaultPort;
    }

    return $"http://localhost:{port}";
}

// Construit la liste des origines autorisées pour CORS à partir de la configuration.
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
