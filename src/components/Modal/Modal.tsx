import { useEffect } from 'react'
import { TextField } from '../ui/TextField'
import { PasswordField } from '../ui/PasswordField'
import { Button } from '../ui/Button'
import logoSrc from '../../assets/logo.svg'
import googleIconSrc from '../../assets/google-icon.svg'

type ModalVariant = 'login' | 'register'

interface ModalProps {
  variant?: ModalVariant
  isOpen: boolean
  onClose: () => void
  onSwitchVariant?: () => void
  onGoogleLogin?: () => void
  onSubmit?: (data: Record<string, string>) => void
}

export function Modal({
  variant = 'login',
  isOpen,
  onClose,
  onSwitchVariant,
  onGoogleLogin,
}: ModalProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const isLogin = variant === 'login'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-md bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-modal w-full max-w-[384px] flex flex-col gap-xl pb-xl pt-md px-md shadow-elevation-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="material-icons text-neutral-text hover:text-primary transition-colors cursor-pointer"
          >
            close
          </button>
        </div>

        <div className="flex flex-col gap-xl items-center">
          {/* Logo */}
          <img src={logoSrc} alt="Hermex Locadora" className="h-[60px] w-auto" />

          <div className="flex flex-col gap-xl items-center w-full">
            {/* Form fields */}
            <div className="flex flex-col gap-md w-full">
              {!isLogin && (
                <TextField label="Nome completo" placeholder="Insira seu nome" />
              )}
              <TextField label="E-mail" type="email" placeholder="Insira seu e-mail" />
              <PasswordField label="Senha" placeholder="Insira sua senha" />
              {!isLogin && (
                <PasswordField label="Confirmar senha" placeholder="Confirme sua senha" />
              )}

              <Button variant="primary" className="w-full">
                {isLogin ? 'Entrar' : 'Criar conta'}
              </Button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-md w-full">
              <hr className="flex-1 border-neutral-divisor" />
              <span className="font-inter text-body-md text-neutral-text whitespace-nowrap">
                {isLogin ? 'Ou entrar com' : 'Ou cadastrar com'}
              </span>
              <hr className="flex-1 border-neutral-divisor" />
            </div>

            {/* Google */}
            <Button
              variant="ghost-google"
              className="w-full"
              onClick={onGoogleLogin}
              icon={
                <img src={googleIconSrc} alt="Google" className="w-6 h-6" />
              }
            >
              Google
            </Button>
          </div>

          {/* Switch variant */}
          <Button variant="ghost" className="w-full" onClick={onSwitchVariant}>
            <span className="material-icons text-[20px]">
              {isLogin ? 'person_add' : 'login'}
            </span>
            {isLogin ? 'Ainda não tenho conta' : 'Já tenho conta'}
          </Button>
        </div>
      </div>
    </div>
  )
}
