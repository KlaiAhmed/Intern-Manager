export type PasswordPolicyErrorKey =
  | 'auth.validation.passwordRequired'
  | 'auth.validation.passwordMin'
  | 'auth.validation.passwordUppercase'
  | 'auth.validation.passwordLowercase'
  | 'auth.validation.passwordNumber'
  | 'auth.validation.passwordSpecial'

export type ConfirmPasswordErrorKey =
  | 'auth.validation.confirmPasswordRequired'
  | 'auth.validation.passwordsMismatch'

export function getPasswordPolicyErrorKey(password: string): PasswordPolicyErrorKey | undefined {
  if (!password.trim()) {
    return 'auth.validation.passwordRequired'
  }

  if (password.length < 8) {
    return 'auth.validation.passwordMin'
  }

  let hasUppercase = false
  let hasLowercase = false
  let hasNumber = false
  let hasSpecialCharacter = false

  for (const character of password) {
    if (character >= 'A' && character <= 'Z') {
      hasUppercase = true
      continue
    }

    if (character >= 'a' && character <= 'z') {
      hasLowercase = true
      continue
    }

    if (character >= '0' && character <= '9') {
      hasNumber = true
      continue
    }

    hasSpecialCharacter = true
  }

  if (!hasUppercase) {
    return 'auth.validation.passwordUppercase'
  }

  if (!hasLowercase) {
    return 'auth.validation.passwordLowercase'
  }

  if (!hasNumber) {
    return 'auth.validation.passwordNumber'
  }

  if (!hasSpecialCharacter) {
    return 'auth.validation.passwordSpecial'
  }

  return undefined
}

export function getConfirmPasswordErrorKey(password: string, confirmPassword: string): ConfirmPasswordErrorKey | undefined {
  if (!confirmPassword.trim()) {
    return 'auth.validation.confirmPasswordRequired'
  }

  if (password !== confirmPassword) {
    return 'auth.validation.passwordsMismatch'
  }

  return undefined
}

export function isPasswordPolicyValid(password: string): boolean {
  return getPasswordPolicyErrorKey(password) === undefined
}