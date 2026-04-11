namespace InternManager.Api.Services.Email;

public interface IEmailService
{
    Task SendPasswordResetCodeAsync(
        string toEmail,
        string resetCode,
        DateTime expiresAtUtc,
        CancellationToken cancellationToken = default);
}
