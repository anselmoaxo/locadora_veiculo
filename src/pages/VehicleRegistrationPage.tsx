import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { TextField } from '../components/ui/TextField'
import { Button } from '../components/ui/Button'
import {
  loadVehicleRegistrationOptions,
  registerVehicle,
  type VehicleRegistrationData,
  type VehicleRegistrationOptions,
} from '../services/vehicleRegistration'

const currentYear = new Date().getFullYear()

const initialForm: VehicleRegistrationData = {
  marca: '',
  modelo: '',
  versao: '',
  categoria: '',
  grupo: '',
  local_id: '',
  cor: '',
  placa: '',
  chassi: '',
  renavam: '',
  ano_modelo: String(currentYear),
  quilometragem: '0',
  preco_diaria: '',
  capacidade_pessoas: '5',
  capacidade_malas: '2',
  cambio: 'automático',
  combustivel: 'flex',
  ar_condicionado: true,
  trava_eletrica: true,
  eletrico: false,
  freio_abs: true,
  direcao_assistida: true,
  direitos_imagem: false,
}

const selectClass = 'w-full border border-neutral-text rounded-xs px-md py-sm bg-white font-inter text-body-md text-neutral-text outline-none transition-colors hover:border-primary focus:border-primary'

export function VehicleRegistrationPage() {
  const [form, setForm] = useState<VehicleRegistrationData>(initialForm)
  const [options, setOptions] = useState<VehicleRegistrationOptions | null>(null)
  const [images, setImages] = useState<File[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ id: string; images: number } | null>(null)

  useEffect(() => {
    let active = true
    loadVehicleRegistrationOptions()
      .then((loaded) => {
        if (!active) return
        setOptions(loaded)
        setForm((current) => ({
          ...current,
          categoria: current.categoria || loaded.categorias[0]?.slug || '',
          grupo: current.grupo || loaded.grupos[0]?.codigo || '',
          local_id: current.local_id || loaded.locais[0]?.id || '',
        }))
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o formulário.')
      })
      .finally(() => {
        if (active) setLoadingOptions(false)
      })
    return () => { active = false }
  }, [])

  function updateField<K extends keyof VehicleRegistrationData>(
    field: K,
    value: VehicleRegistrationData[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    setError('')
    const selected = Array.from(event.target.files ?? [])
    if (selected.length > 5) {
      setError('Selecione no máximo cinco imagens.')
      event.target.value = ''
      return
    }
    const invalid = selected.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)
    if (invalid) {
      setError('Use somente JPEG, PNG ou WebP, com até 5 MB por arquivo.')
      event.target.value = ''
      return
    }
    setImages(selected)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess(null)

    if (!form.marca || !form.modelo || !form.placa || !form.cor || !form.preco_diaria) {
      setError('Preencha os campos obrigatórios do veículo.')
      return
    }
    if (images.length < 1) {
      setError('Selecione pelo menos uma imagem do veículo.')
      return
    }
    if (!form.direitos_imagem) {
      setError('Confirme que possui direito de uso das imagens.')
      return
    }

    setSubmitting(true)
    try {
      const result = await registerVehicle(form, images)
      setSuccess({ id: result.veiculo_id, images: result.imagens })
      setForm((current) => ({
        ...initialForm,
        categoria: current.categoria,
        grupo: current.grupo,
        local_id: current.local_id,
      }))
      setImages([])
      const fileInput = document.getElementById('vehicle-images') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o veículo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      <Header />
      <main className="flex-1 max-w-[1120px] mx-auto w-full px-md md:px-lg py-xl flex flex-col gap-lg">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Administração', href: '/admin' }, { label: 'Cadastrar veículo' }]} />

        <div className="flex flex-col gap-xs">
          <span className="font-inter text-body-sm uppercase tracking-[0.16em] text-primary font-bold">Área administrativa</span>
          <h1 className="font-exo font-bold text-heading-sm md:text-heading-md text-secondary">Cadastrar novo veículo</h1>
          <p className="font-inter text-body-md text-neutral-text max-w-[760px]">
            As informações serão normalizadas pela Edge Function e as fotos serão enviadas diretamente ao bucket seguro do catálogo.
          </p>
        </div>

        {success ? (
          <div role="status" className="bg-white border-l-4 border-feedback-positive rounded-xs shadow-elevation-1 p-lg flex flex-col sm:flex-row gap-md sm:items-center sm:justify-between">
            <div>
              <h2 className="font-exo font-bold text-heading-xs text-secondary">Veículo cadastrado com sucesso</h2>
              <p className="font-inter text-body-md text-neutral-text mt-xs">{success.images} {success.images === 1 ? 'imagem vinculada' : 'imagens vinculadas'} ao catálogo.</p>
            </div>
            <Link to={`/carros/${success.id}`} className="inline-flex items-center justify-center rounded-xs bg-secondary px-md py-sm font-inter text-body-md text-white hover:bg-secondary-dark">
              Ver veículo
            </Link>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg" noValidate>
          <FormSection title="Identificação" description="Dados usados para normalizar marca, modelo e versão.">
            <TextField required label="Marca *" value={form.marca} onChange={(event) => updateField('marca', event.target.value)} placeholder="Ex.: Toyota" maxLength={60} />
            <TextField required label="Modelo *" value={form.modelo} onChange={(event) => updateField('modelo', event.target.value)} placeholder="Ex.: Corolla Cross" maxLength={80} />
            <TextField label="Versão" value={form.versao} onChange={(event) => updateField('versao', event.target.value)} placeholder="Ex.: XRE 2.0" maxLength={100} />
            <TextField required label="Ano/modelo *" type="number" min="1900" max={currentYear + 1} value={form.ano_modelo} onChange={(event) => updateField('ano_modelo', event.target.value)} />
            <SelectField label="Categoria *" value={form.categoria} onChange={(value) => updateField('categoria', value)} disabled={loadingOptions}>
              {(options?.categorias ?? []).map((option) => <option key={option.slug} value={option.slug}>{option.nome}</option>)}
            </SelectField>
            <SelectField label="Grupo" value={form.grupo} onChange={(value) => updateField('grupo', value)} disabled={loadingOptions}>
              <option value="">Sem grupo</option>
              {(options?.grupos ?? []).map((option) => <option key={option.codigo} value={option.codigo}>{option.codigo} — {option.nome}</option>)}
            </SelectField>
          </FormSection>

          <FormSection title="Unidade da frota" description="Informações exclusivas deste carro físico.">
            <TextField required label="Placa *" value={form.placa} onChange={(event) => updateField('placa', event.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} />
            <TextField required label="Cor *" value={form.cor} onChange={(event) => updateField('cor', event.target.value)} placeholder="Ex.: Prata" maxLength={40} />
            <TextField label="Chassi" value={form.chassi} onChange={(event) => updateField('chassi', event.target.value.toUpperCase())} placeholder="17 caracteres" maxLength={17} />
            <TextField label="Renavam" inputMode="numeric" value={form.renavam} onChange={(event) => updateField('renavam', event.target.value)} placeholder="11 dígitos" maxLength={11} />
            <TextField required label="Quilometragem *" type="number" min="0" value={form.quilometragem} onChange={(event) => updateField('quilometragem', event.target.value)} />
            <SelectField label="Local atual *" value={form.local_id} onChange={(value) => updateField('local_id', value)} disabled={loadingOptions}>
              {(options?.locais ?? []).map((option) => <option key={option.id} value={option.id}>{option.codigo} — {option.nome}</option>)}
            </SelectField>
          </FormSection>

          <FormSection title="Especificações e diária" description="Características exibidas nos filtros do catálogo.">
            <TextField required label="Preço da diária (R$) *" type="number" min="0.01" step="0.01" value={form.preco_diaria} onChange={(event) => updateField('preco_diaria', event.target.value)} placeholder="199,90" />
            <SelectField label="Câmbio *" value={form.cambio} onChange={(value) => updateField('cambio', value)}>
              <option value="automático">Automático</option><option value="manual">Manual</option><option value="cvt">CVT</option>
            </SelectField>
            <SelectField label="Combustível *" value={form.combustivel} onChange={(value) => updateField('combustivel', value)}>
              <option value="flex">Flex</option><option value="gasolina">Gasolina</option><option value="etanol">Etanol</option><option value="diesel">Diesel</option><option value="híbrido">Híbrido</option><option value="elétrico">Elétrico</option>
            </SelectField>
            <TextField label="Capacidade de pessoas" type="number" min="1" max="20" value={form.capacidade_pessoas} onChange={(event) => updateField('capacidade_pessoas', event.target.value)} />
            <TextField label="Capacidade de malas" type="number" min="0" max="20" value={form.capacidade_malas} onChange={(event) => updateField('capacidade_malas', event.target.value)} />
            <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-sm pt-xs">
              <CheckField label="Ar-condicionado" checked={form.ar_condicionado} onChange={(checked) => updateField('ar_condicionado', checked)} />
              <CheckField label="Trava elétrica" checked={form.trava_eletrica} onChange={(checked) => updateField('trava_eletrica', checked)} />
              <CheckField label="Freio ABS" checked={form.freio_abs} onChange={(checked) => updateField('freio_abs', checked)} />
              <CheckField label="Direção assistida" checked={form.direcao_assistida} onChange={(checked) => updateField('direcao_assistida', checked)} />
              <CheckField label="Veículo elétrico" checked={form.eletrico} onChange={(checked) => updateField('eletrico', checked)} />
            </div>
          </FormSection>

          <section className="bg-white rounded-modal shadow-elevation-1 p-lg flex flex-col gap-md">
            <div>
              <h2 className="font-exo font-bold text-heading-xs text-secondary">Imagens do veículo</h2>
              <p className="font-inter text-body-sm text-neutral-text mt-xxs">Envie de 1 a 5 arquivos JPEG, PNG ou WebP. Máximo de 5 MB por imagem.</p>
            </div>
            <label htmlFor="vehicle-images" className="border-2 border-dashed border-neutral-details rounded-modal p-xl flex flex-col items-center gap-xs text-center cursor-pointer hover:border-primary hover:bg-primary-light/20 transition-colors">
              <span className="material-icons text-[44px] text-primary">add_photo_alternate</span>
              <span className="font-inter text-body-md font-bold text-secondary">Selecionar imagens</span>
              <span className="font-inter text-body-sm text-neutral-text">{images.length ? `${images.length} arquivo(s) selecionado(s)` : 'Clique para procurar no dispositivo'}</span>
              <input id="vehicle-images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImages} className="sr-only" />
            </label>
            {images.length ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
                {images.map((image) => <li key={`${image.name}-${image.lastModified}`} className="bg-neutral-background rounded-xs px-md py-sm font-inter text-body-sm text-neutral-text truncate">{image.name} · {(image.size / 1024 / 1024).toFixed(2)} MB</li>)}
              </ul>
            ) : null}
            <CheckField label="Confirmo que possuo autorização para utilizar e publicar estas imagens." checked={form.direitos_imagem} onChange={(checked) => updateField('direitos_imagem', checked)} />
          </section>

          {error ? <p role="alert" className="bg-feedback-negative/10 border border-feedback-negative rounded-xs p-md font-inter text-body-md text-feedback-negative">{error}</p> : null}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md">
            <p className="font-inter text-body-sm text-neutral-text">Até cinco cadastros por hora por origem.</p>
            <Button type="submit" disabled={submitting || loadingOptions} icon="add_circle" className="w-full sm:w-auto min-w-[220px]">
              {submitting ? 'Cadastrando...' : 'Cadastrar veículo'}
            </Button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  )
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-modal shadow-elevation-1 p-lg flex flex-col gap-md">
      <div><h2 className="font-exo font-bold text-heading-xs text-secondary">{title}</h2><p className="font-inter text-body-sm text-neutral-text mt-xxs">{description}</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">{children}</div>
    </section>
  )
}

function SelectField({ label, value, onChange, disabled, children }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; children: ReactNode }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return <div className="flex flex-col gap-xxs"><label htmlFor={id} className="font-inter text-body-md text-neutral-text">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={selectClass}>{children}</select></div>
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-xs font-inter text-body-md text-neutral-text cursor-pointer"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="w-5 h-5 accent-primary" /><span>{label}</span></label>
}
