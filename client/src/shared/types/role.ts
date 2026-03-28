export const availableRoles = ['supervisor', 'intern', 'manager'] as const

export type UserRole = (typeof availableRoles)[number]
