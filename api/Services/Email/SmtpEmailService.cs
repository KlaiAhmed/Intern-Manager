using InternManager.Api.Common.Options;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace InternManager.Api.Services.Email;

public sealed class SmtpEmailService(
    IOptions<EmailOptions> emailOptions,
    ILogger<SmtpEmailService> logger) : IEmailService
{
    private readonly EmailOptions _emailOptions = emailOptions.Value;

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

        if (!IsSmtpConfigured())
        {
            logger.LogWarning("SMTP configuration is incomplete. Password reset code email was not sent.");
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_emailOptions.FromName, _emailOptions.FromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail.Trim()));
        message.Subject = "Your Axia password reset code";

        var ttlMinutes = Math.Max(1, (int)Math.Ceiling((expiresAtUtc - DateTime.UtcNow).TotalMinutes));
        message.Body = new TextPart("plain")
        {
            Text = $"Your password reset code is: {resetCode}\n\nThis code expires in {ttlMinutes} minutes.\nIf you did not request this change, you can ignore this message."
        };

        using var smtpClient = new SmtpClient();
        var socketOptions = _emailOptions.UseSsl
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTlsWhenAvailable;

        await smtpClient.ConnectAsync(_emailOptions.Host, _emailOptions.Port, socketOptions, cancellationToken);

        if (!string.IsNullOrWhiteSpace(_emailOptions.Username))
        {
            await smtpClient.AuthenticateAsync(_emailOptions.Username, _emailOptions.Password, cancellationToken);
        }

        await smtpClient.SendAsync(message, cancellationToken);
        await smtpClient.DisconnectAsync(true, cancellationToken);
    }

    private bool IsSmtpConfigured()
    {
        return !string.IsNullOrWhiteSpace(_emailOptions.Host)
               && _emailOptions.Port > 0
               && !string.IsNullOrWhiteSpace(_emailOptions.FromAddress);
    }
}
