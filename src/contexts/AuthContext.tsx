import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { DriverProfileInput, DriverProfileStatus } from '../services/driverProfiles'

export interface UserProfile {
  id: string
  nome_completo: string
  cpf: string | null
  telefone: string | null
  cnh_numero: string | null
  cnh_categoria: string | null
  cnh_validade: string | null
  cnh_uf: string | null
  cadastro_status: DriverProfileStatus
  avaliacao_observacao: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  adminLoading: boolean
  isPasswordRecovery: boolean
  signIn: (email: string, password: string) => Promise<Session | null>
  signUp: (input: DriverProfileInput & { email: string; password: string }) => Promise<Session | null>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const user = session?.user ?? null

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('perfis')
      .select('id,nome_completo,cpf,telefone,cnh_numero,cnh_categoria,cnh_validade,cnh_uf,cadastro_status,avaliacao_observacao')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) throw error
    setProfile((data as UserProfile | null) ?? null)
  }, [session?.user.id])

  const refreshAdmin = useCallback(async () => {
    if (!session?.user.id) {
      setIsAdmin(false)
      setAdminLoading(false)
      return
    }

    setAdminLoading(true)
    const { data, error } = await supabase.rpc('is_vehicle_administrator')
    setIsAdmin(!error && data === true)
    setAdminLoading(false)
  }, [session?.user.id])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (!error) setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setIsAdmin(false)
      setAdminLoading(Boolean(nextSession))
      setSession(nextSession)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    refreshProfile().catch(() => setProfile(null))
  }, [refreshProfile])

  useEffect(() => {
    refreshAdmin().catch(() => {
      setIsAdmin(false)
      setAdminLoading(false)
    })
  }, [refreshAdmin])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    profile,
    loading,
    isAdmin,
    adminLoading,
    isPasswordRecovery,
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data.session
    },
    async signUp(input) {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            cpf: input.cpf,
            phone: input.phone,
            cnh_number: input.cnhNumber,
            cnh_category: input.cnhCategory,
            cnh_expiration: input.cnhExpiration,
            cnh_state: input.cnhState,
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      })
      if (error) throw error
      return data.session
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth` },
      })
      if (error) throw error
    },
    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setProfile(null)
      setIsAdmin(false)
    },
    async sendPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      })
      if (error) throw error
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setIsPasswordRecovery(false)
    },
    refreshProfile,
  }), [adminLoading, isAdmin, isPasswordRecovery, loading, profile, refreshProfile, session, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
