using InternManager.Api.Data;
using InternManager.Api.Extensions;
using Microsoft.EntityFrameworkCore;

EnvLoader.LoadFromProjectRoot();

var builder = WebApplication.CreateBuilder(args);

var serverPort = builder.Configuration["SERVER_PORT"];
var serverUrl = BuildServerUrl(serverPort);
builder.WebHost.UseUrls(serverUrl);

var databasePath = builder.Configuration["DATABASE_PATH"];
var sqlServerInstance = builder.Configuration["SQLSERVER_INSTANCE"];
var connectionString = BuildSqlServerConnectionString(databasePath, sqlServerInstance);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

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

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

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

static string BuildServerUrl(string? serverPort)
{
    const int defaultPort = 5184;

    if (!int.TryParse(serverPort, out var port) || port is < 1 or > 65535)
    {
        port = defaultPort;
    }

    return $"http://localhost:{port}";
}
