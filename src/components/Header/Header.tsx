import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchField } from '../ui/SearchField'
import { Button } from '../ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import logoSrc from '../../assets/logo.svg'

export function Header() {
  const navigate = useNavigate()
  const { user, profile, loading, isAdmin, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  const userName = profile?.nome_completo
    ?? (user?.user_metadata.full_name as string | undefined)
    ?? user?.email?.split('@')[0]
    ?? 'Minha conta'

  async function handleLogout() {
    setLogoutError('')
    try {
      await signOut()
      setMenuOpen(false)
      navigate('/')
    } catch {
      setLogoutError('Não foi possível sair agora.')
    }
  }

  const accountActions = loading ? (
    <span className="font-inter text-body-md text-neutral-text">Carregando...</span>
  ) : user ? (
    <>
      <button type="button" onClick={() => navigate('/minha-conta')} className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors">
        <span className="material-icons text-[20px]">account_circle</span>
        {userName}
      </button>
      <Button variant="ghost" onClick={() => void handleLogout()}>
        Sair
      </Button>
    </>
  ) : (
    <>
      <button
        type="button"
        onClick={() => navigate('/auth?tab=register')}
        className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
      >
        <span className="material-icons text-[20px]">account_circle</span>
        Cadastro
      </button>
      <button
        type="button"
        onClick={() => navigate('/auth')}
        className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
      >
        <span className="material-icons text-[20px]">login</span>
        Login
      </button>
    </>
  )

  return (
    <header className="bg-white shadow-elevation-1 sticky top-0 z-40">
      <div className="max-w-[1480px] mx-auto px-md md:px-lg flex items-center justify-between h-[92px] gap-md">
        <button type="button" onClick={() => navigate('/')} className="shrink-0">
          <img src={logoSrc} alt="Axo Locadoras" className="h-[58px] w-auto" />
        </button>

        <div className="hidden md:flex flex-1 max-w-[400px]">
          <SearchField className="w-full" />
        </div>

        <nav className="hidden md:flex items-center gap-md" aria-label="Navegação e conta">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
              >
                <span className="material-icons text-[20px]">admin_panel_settings</span>
                Administração
              </button>
              <button
                type="button"
                onClick={() => navigate('/cadastro-veiculo')}
                className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
              >
                <span className="material-icons text-[20px]">directions_car</span>
                Cadastrar veículo
              </button>
            </>
          ) : null}
          {accountActions}
        </nav>

        <button
          type="button"
          className="md:hidden flex items-center text-neutral-text"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          <span className="material-icons text-[28px]">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {menuOpen ? (
        <div className="md:hidden bg-white border-t border-neutral-divisor px-md py-md flex flex-col gap-md">
          <SearchField />
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); navigate('/admin') }}
                className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
              >
                <span className="material-icons text-[20px]">admin_panel_settings</span>
                Administração
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); navigate('/cadastro-veiculo') }}
                className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
              >
                <span className="material-icons text-[20px]">directions_car</span>
                Cadastrar veículo
              </button>
            </>
          ) : null}
          {accountActions}
        </div>
      ) : null}

      {logoutError ? (
        <p className="px-md pb-xs text-right font-inter text-body-sm text-feedback-negative">
          {logoutError}
        </p>
      ) : null}
    </header>
  )
}
