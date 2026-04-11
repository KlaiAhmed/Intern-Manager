using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace InternManager.Api.Services.Email;

public sealed class SmtpEmailService(
    IConfiguration configuration) : IEmailService
{
    public async Task SendPasswordResetCodeAsync(
        string toEmail,
        string resetCode,
        DateTime expiresAtUtc,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(toEmail) || string.IsNullOrWhiteSpace(resetCode))
        {
            return;
        }

        var host = GetRequiredValue("EMAIL_HOST");
        var port = GetRequiredPort("EMAIL_PORT");
        var username = GetRequiredValue("EMAIL_USERNAME");
        var password = NormalizePassword(GetRequiredValue("EMAIL_PASSWORD"));
        var fromAddress = GetRequiredValue("EMAIL_FROM_ADDRESS");
        var fromName = GetRequiredValue("EMAIL_FROM_NAME");
        _ = GetRequiredBooleanValue("EMAIL_ENABLE_SSL");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail.Trim()));
        message.Subject = "Your Axia password reset code";

        var ttlMinutes = Math.Max(1, (int)Math.Ceiling((expiresAtUtc - DateTime.UtcNow).TotalMinutes));
        message.Body = new TextPart("plain")
        {
            Text = $"Your password reset code is: {resetCode}\n\nThis code expires in {ttlMinutes} minutes.\nIf you did not request this change, you can ignore this message."
        };

        using var smtpClient = new SmtpClient();
        await smtpClient.ConnectAsync(host, port, SecureSocketOptions.StartTls, cancellationToken);
        await smtpClient.AuthenticateAsync(username, password, cancellationToken);
        await smtpClient.SendAsync(message, cancellationToken);
        await smtpClient.DisconnectAsync(true, cancellationToken);
    }

    private string GetRequiredValue(string key)
    {
        var value = configuration[key];
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Missing required email configuration value '{key}'.");
        }

        return value.Trim();
    }

    private int GetRequiredPort(string key)
    {
        var value = GetRequiredValue(key);
        if (!int.TryParse(value, out var parsedPort) || parsedPort <= 0)
        {
            throw new InvalidOperationException($"Email configuration value '{key}' must be a positive integer.");
        }

        return parsedPort;
    }

    private bool GetRequiredBooleanValue(string key)
    {
        var value = GetRequiredValue(key);
        if (!bool.TryParse(value, out var parsedValue))
        {
            throw new InvalidOperationException($"Email configuration value '{key}' must be a boolean value.");
        }

        return parsedValue;
    }

    private static string NormalizePassword(string password)
    {
        return new string(password.Where(character => !char.IsWhiteSpace(character)).ToArray());
    }
}
