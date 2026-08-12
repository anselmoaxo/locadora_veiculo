import logoWhiteSrc from '../../assets/logo-white.svg'
import whatsappSrc from '../../assets/social-whatsapp.svg'
import instagramSrc from '../../assets/social-instagram.svg'
import tiktokSrc from '../../assets/social-tiktok.svg'

export function Footer() {
  return (
    <footer className="bg-secondary-dark">
      <div className="max-w-[1480px] mx-auto px-md md:px-lg py-xl">
        {/* Desktop layout */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-xl md:gap-lg">
          {/* Logo + tagline */}
          <div className="flex flex-col gap-md">
            <img src={logoWhiteSrc} alt="Axo Locadoras" className="h-[60px] w-auto" />
            <p className="font-inter text-body-md text-white/80">A liberdade de ir começa aqui.</p>
          </div>

          {/* Center text */}
          <p className="font-inter text-body-md text-white text-center hidden md:block">
            Axo Locadoras · Mobilidade simples, segura e transparente.
          </p>

          {/* Social */}
          <div className="flex flex-col gap-md">
            <p className="font-exo font-bold text-heading-xs text-white">Siga nossas redes:</p>
            <div className="flex items-center gap-xs">
              <a href="#" aria-label="WhatsApp" className="opacity-90 hover:opacity-100 transition-opacity">
                <img src={whatsappSrc} alt="WhatsApp" className="w-8 h-8" />
              </a>
              <a href="#" aria-label="Instagram" className="opacity-90 hover:opacity-100 transition-opacity">
                <img src={instagramSrc} alt="Instagram" className="w-8 h-8" />
              </a>
              <a href="#" aria-label="TikTok" className="opacity-90 hover:opacity-100 transition-opacity">
                <img src={tiktokSrc} alt="TikTok" className="w-8 h-8" />
              </a>
            </div>
          </div>
        </div>

        {/* Mobile center text */}
        <p className="font-inter text-body-md text-white text-center mt-xl md:hidden">
          Axo Locadoras · Mobilidade simples, segura e transparente.
        </p>
      </div>
    </footer>
  )
}
