namespace InternManager.Api.Common.Utilities;

public static class PasswordPolicyValidator
{
    public const string ErrorMessage = "Password must be at least 8 characters and include uppercase, lowercase, digit, and special character.";

    public static bool IsValid(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
        {
            return false;
        }

        var hasUpper = false;
        var hasLower = false;
        var hasDigit = false;
        var hasSpecial = false;

        foreach (var character in password)
        {
            if (char.IsUpper(character))
            {
                hasUpper = true;
                continue;
            }

            if (char.IsLower(character))
            {
                hasLower = true;
                continue;
            }

            if (char.IsDigit(character))
            {
                hasDigit = true;
                continue;
            }

            hasSpecial = true;
        }

        return hasUpper && hasLower && hasDigit && hasSpecial;
    }
}
