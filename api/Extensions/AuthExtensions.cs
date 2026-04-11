using System.Security.Claims;
using System.Text;
using InternManager.Api.Common.Options;
using InternManager.Api.Middleware;
using InternManager.Api.Services.Auth;
using InternManager.Api.Services.Email;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace InternManager.Api.Extensions;

/// <summary>
/// Propose des méthodes d extension pour configurer la sécurité auth dans le conteneur d injection de dépendances.
/// </summary>
public static class AuthExtensions
{
    /// <summary>
    /// Ajoute et configure les services d authentification, d autorisation et de protection CSRF.
    /// </summary>
    /// <param name="services">Collection de services à enrichir.</param>
    /// <param name="configuration">Configuration applicative contenant la section JWT.</param>
    /// <returns>La même collection <see cref="IServiceCollection"/> pour chaînage de configuration.</returns>
    /// <exception cref="InvalidOperationException">Levée si la configuration JWT est invalide ou incomplète.</exception>
    public static IServiceCollection AddAuth(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtOptions = configuration
            .GetSection(JwtOptions.SectionName)
            .Get<JwtOptions>() ?? new JwtOptions();

        ValidateJwtOptions(jwtOptions);
        ValidateEmailConfiguration(configuration);

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        services.AddSingleton<IAuthUserStore, DbAuthUserStore>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPasswordResetService, PasswordResetService>();
        services.AddScoped<IEmailService, SmtpEmailService>();

        services.AddScoped<CsrfValidationFilter>();
        services.Configure<MvcOptions>(options =>
        {
            options.Filters.AddService<CsrfValidationFilter>();
        });

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key));

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = signingKey,
                    ValidateIssuer = true,
                    ValidIssuer = jwtOptions.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtOptions.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                    NameClaimType = ClaimTypes.Email,
                    RoleClaimType = ClaimTypes.Role
                };

                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        if (context.Request.Cookies.TryGetValue("access_token", out var cookieToken) &&
                            !string.IsNullOrWhiteSpace(cookieToken))
                        {
                            context.Token = cookieToken;
                        }

                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization();

        return services;
    }

    /// <summary>
    /// Vérifie que les options JWT obligatoires sont présentes et cohérentes.
    /// </summary>
    /// <param name="jwtOptions">Options JWT à valider.</param>
    /// <exception cref="InvalidOperationException">Levée quand une option requise est absente ou invalide.</exception>
    private static void ValidateJwtOptions(JwtOptions jwtOptions)
    {
        if (string.IsNullOrWhiteSpace(jwtOptions.Key))
        {
            throw new InvalidOperationException("La configuration JWT:Key est obligatoire.");
        }

        if (Encoding.UTF8.GetByteCount(jwtOptions.Key) < 32)
        {
            throw new InvalidOperationException("La cle JWT doit faire au minimum 32 octets.");
        }

        if (string.IsNullOrWhiteSpace(jwtOptions.Issuer))
        {
            throw new InvalidOperationException("La configuration JWT:Issuer est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(jwtOptions.Audience))
        {
            throw new InvalidOperationException("La configuration JWT:Audience est obligatoire.");
        }

        if (jwtOptions.AccessTokenMinutes <= 0)
        {
            throw new InvalidOperationException("JWT:AccessTokenMinutes doit etre superieur a 0.");
        }

        if (jwtOptions.RefreshTokenDays <= 0)
        {
            throw new InvalidOperationException("JWT:RefreshTokenDays doit etre superieur a 0.");
        }
    }

    /// <summary>
    /// Vérifie que la configuration SMTP requise est présente avant le démarrage.
    /// </summary>
    /// <param name="configuration">Configuration applicative à contrôler.</param>
    /// <exception cref="InvalidOperationException">Levée quand une variable SMTP requise manque ou est invalide.</exception>
    private static void ValidateEmailConfiguration(IConfiguration configuration)
    {
        var requiredKeys = new[]
        {
            "EMAIL_HOST",
            "EMAIL_PORT",
            "EMAIL_ENABLE_SSL",
            "EMAIL_USERNAME",
            "EMAIL_FROM_ADDRESS",
            "EMAIL_FROM_NAME",
            "EMAIL_PASSWORD"
        };

        var missingKeys = requiredKeys
            .Where(key => string.IsNullOrWhiteSpace(configuration[key]))
            .ToArray();

        if (missingKeys.Length > 0)
        {
            throw new InvalidOperationException(
                $"Missing required email configuration values: {string.Join(", ", missingKeys)}. Add them to .env.");
        }

        if (!int.TryParse(configuration["EMAIL_PORT"], out var emailPort) || emailPort <= 0)
        {
            throw new InvalidOperationException("EMAIL_PORT must be a positive integer.");
        }

        if (!bool.TryParse(configuration["EMAIL_ENABLE_SSL"], out _))
        {
            throw new InvalidOperationException("EMAIL_ENABLE_SSL must be a boolean value.");
        }
    }
}
