export const availableRoles = ['admin', 'supervisor', 'intern', 'manager', 'hr'] as const

export type UserRole = (typeof availableRoles)[number]
