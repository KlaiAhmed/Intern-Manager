import type { AuthScreenProps } from '../../types/authScreen'
import { useAuthScreenLogic } from '../../hooks/useAuthScreenLogic'
import { LoginAuthView } from './LoginAuthView'
import { SignUpAuthView } from './SignUpAuthView'

/**
 * Ecran d'authentification responsive qui affiche soit la connexion,
 * soit l'inscription selon la variante de route.
 */
export function AuthScreen({ variant }: AuthScreenProps) {
  const logic = useAuthScreenLogic(variant)

  if (logic.isSignUpVariant) {
    return <SignUpAuthView logic={logic} />
  }

  return <LoginAuthView logic={logic} />
}
