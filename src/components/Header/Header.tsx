import { useState } from 'react'
import { SearchField } from '../ui/SearchField'
import { Button } from '../ui/Button'
import logoSrc from '../../assets/logo.svg'

interface HeaderProps {
  isLoggedIn?: boolean
  userName?: string
  onLoginClick?: () => void
  onRegisterClick?: () => void
  onLogoutClick?: () => void
}

export function Header({
  isLoggedIn = false,
  userName,
  onLoginClick,
  onRegisterClick,
  onLogoutClick,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-white shadow-elevation-1 sticky top-0 z-40">
      <div className="max-w-[1480px] mx-auto px-md md:px-lg flex items-center justify-between h-[92px] gap-md">
        {/* Logo */}
        <a href="/" className="shrink-0">
          <img src={logoSrc} alt="Hermex Locadora" className="h-[60px] w-auto" />
        </a>

        {/* Search — hidden on mobile */}
        <div className="hidden md:flex flex-1 max-w-[400px]">
          <SearchField className="w-full" />
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-md">
          {isLoggedIn ? (
            <>
              <span className="flex items-center gap-xs font-inter text-body-md text-neutral-text">
                <span className="material-icons text-[20px]">account_circle</span>
                {userName ?? 'Minha conta'}
              </span>
              <Button variant="ghost" onClick={onLogoutClick}>
                Sair
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={onRegisterClick}
                className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
              >
                <span className="material-icons text-[20px]">account_circle</span>
                Cadastro
              </button>
              <button
                onClick={onLoginClick}
                className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
              >
                <span className="material-icons text-[20px]">login</span>
                Login
              </button>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex items-center text-neutral-text"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menu"
        >
          <span className="material-icons text-[28px]">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-neutral-divisor px-md py-md flex flex-col gap-md">
          <SearchField />
          {isLoggedIn ? (
            <>
              <span className="flex items-center gap-xs font-inter text-body-md text-neutral-text">
                <span className="material-icons text-[20px]">account_circle</span>
                {userName ?? 'Minha conta'}
              </span>
              <Button variant="ghost" onClick={onLogoutClick} className="w-full">
                Sair
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={onRegisterClick}
                className="flex items-center gap-xs font-inter text-body-md text-neutral-text"
              >
                <span className="material-icons text-[20px]">account_circle</span>
                Cadastro
              </button>
              <button
                onClick={onLoginClick}
                className="flex items-center gap-xs font-inter text-body-md text-neutral-text"
              >
                <span className="material-icons text-[20px]">login</span>
                Login
              </button>
            </>
          )}
        </div>
      )}
    </header>
  )
}
