import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'
import { maskPlate, maskRenavam } from '../utils/inputMasks'
import {
  loadVehicleForEditing,
  updateVehicle,
  type ExistingVehicleImage,
  type VehicleEditData,
  type VehicleManagementPayload,
} from '../services/vehicleManagement'

const currentYear = new Date().getFullYear()
const selectClass = 'w-full border border-neutral-text rounded-xs px-md py-sm bg-white font-inter text-body-md text-neutral-text outline-none transition-colors hover:border-primary focus:border-primary disabled:bg-neutral-background disabled:cursor-not-allowed'

export function VehicleEditPage() {
  const { id = '' } = useParams()
  const [payload, setPayload] = useState<VehicleManagementPayload | null>(null)
  const [form, setForm] = useState<VehicleEditData | null>(null)
  const [images, setImages] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    loadVehicleForEditing(id)
      .then((loaded) => {
        if (!active) return
        const vehicle = loaded.veiculo
        setPayload(loaded)
        setForm({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          versao: vehicle.versao,
          categoria: vehicle.categoria,
          grupo: vehicle.grupo,
          local_id: vehicle.local_atual_id,
          cor: vehicle.cor ?? '',
          placa: maskPlate(vehicle.placa ?? ''),
          chassi: vehicle.chassi ?? '',
          renavam: maskRenavam(vehicle.renavam ?? ''),
          ano_modelo: String(vehicle.ano_modelo),
          quilometragem: String(vehicle.quilometragem),
          preco_diaria: String(vehicle.preco_diaria),
          capacidade_pessoas: vehicle.capacidade_pessoas == null ? '' : String(vehicle.capacidade_pessoas),
          capacidade_malas: vehicle.capacidade_malas == null ? '' : String(vehicle.capacidade_malas),
          cambio: vehicle.cambio,
          combustivel: vehicle.combustivel,
          status_operacional: vehicle.status_operacional,
          ar_condicionado: vehicle.ar_condicionado,
          trava_eletrica: vehicle.trava_eletrica,
          eletrico: vehicle.eletrico,
          freio_abs: vehicle.freio_abs,
          direcao_assistida: vehicle.direcao_assistida,
          direitos_imagem: false,
        })
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o veículo.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  function updateField<K extends keyof VehicleEditData>(field: K, value: VehicleEditData[K]) {
    setForm((current) => current ? { ...current, [field]: value } : current)
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
    if (!form) return
    setError('')
    setSuccess('')
    if (images.length && !form.direitos_imagem) {
      setError('Confirme que possui direito de uso das novas imagens.')
      return
    }

    setSubmitting(true)
    try {
      const result = await updateVehicle(id, form, images)
      setSuccess(`${result.message}${result.imagens_adicionadas ? ` ${result.imagens_adicionadas} nova(s) foto(s) adicionada(s).` : ''}`)
      setImages([])
      const input = document.getElementById('edit-vehicle-images') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o veículo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageMessage message="Carregando dados do veículo..." />
  if (!form || !payload) return <PageMessage message={error || 'Veículo não encontrado.'} error />

  const isShared = payload.veiculo.versao_compartilhada > 1
  const versionDisabled = isShared

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      <Header />
      <main className="flex-1 max-w-[1120px] mx-auto w-full px-md md:px-lg py-xl flex flex-col gap-lg">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Carros', href: '/carros' }, { label: 'Alterar veículo' }]} />
        <div className="flex flex-col sm:flex-row gap-md sm:items-end sm:justify-between">
          <div>
            <span className="font-inter text-body-sm uppercase tracking-[0.16em] text-primary font-bold">Área autenticada</span>
            <h1 className="font-exo font-bold text-heading-sm md:text-heading-md text-secondary">Alterar veículo</h1>
            <p className="font-inter text-body-md text-neutral-text">As alterações são validadas pela função segura antes de chegar ao banco.</p>
          </div>
          <Link to={`/carros/${id}`} className="font-inter text-body-md font-bold text-primary hover:underline">Voltar aos detalhes</Link>
        </div>

        {isShared ? (
          <p role="status" className="bg-feedback-warning/10 border border-feedback-warning rounded-xs p-md font-inter text-body-md text-neutral-text">
            Esta versão é usada por {payload.veiculo.versao_compartilhada} veículos. Para não alterar outros carros, especificações e novas fotos ficam bloqueadas; os dados da unidade continuam editáveis.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg" noValidate>
          <FormSection title="Identificação normalizada" description="Marca, modelo e versão do catálogo.">
            <TextField required disabled={versionDisabled} label="Marca *" value={form.marca} onChange={(event) => updateField('marca', event.target.value)} maxLength={60} />
            <TextField required disabled={versionDisabled} label="Modelo *" value={form.modelo} onChange={(event) => updateField('modelo', event.target.value)} maxLength={80} />
            <TextField disabled={versionDisabled} label="Versão" value={form.versao} onChange={(event) => updateField('versao', event.target.value)} maxLength={100} />
            <TextField required disabled={versionDisabled} label="Ano/modelo *" type="number" min="1900" max={currentYear + 1} value={form.ano_modelo} onChange={(event) => updateField('ano_modelo', event.target.value)} />
            <SelectField disabled={versionDisabled} label="Categoria *" value={form.categoria} onChange={(value) => updateField('categoria', value)}>
              {payload.categorias.map((option) => <option key={option.slug} value={option.slug}>{option.nome}</option>)}
            </SelectField>
            <SelectField disabled={versionDisabled} label="Grupo" value={form.grupo} onChange={(value) => updateField('grupo', value)}>
              <option value="">Sem grupo</option>
              {payload.grupos.map((option) => <option key={option.codigo} value={option.codigo}>{option.codigo} — {option.nome}</option>)}
            </SelectField>
          </FormSection>

          <FormSection title="Unidade da frota" description="Dados exclusivos deste carro físico.">
            <TextField required label="Placa *" value={form.placa} onChange={(event) => updateField('placa', maskPlate(event.target.value))} placeholder="ABC-1D23" maxLength={8} autoCapitalize="characters" />
            <TextField required label="Cor *" value={form.cor} onChange={(event) => updateField('cor', event.target.value)} maxLength={40} />
            <TextField label="Chassi" value={form.chassi} onChange={(event) => updateField('chassi', event.target.value.toUpperCase())} maxLength={17} />
            <TextField label="Renavam" inputMode="numeric" value={form.renavam} onChange={(event) => updateField('renavam', maskRenavam(event.target.value))} placeholder="00000000000" maxLength={11} />
            <TextField required label="Quilometragem *" type="number" min="0" value={form.quilometragem} onChange={(event) => updateField('quilometragem', event.target.value)} />
            <SelectField label="Status operacional *" value={form.status_operacional} onChange={(value) => updateField('status_operacional', value)}>
              <option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="alugado">Alugado</option><option value="manutencao">Manutenção</option><option value="inativo">Inativo</option>
            </SelectField>
            <SelectField label="Local atual *" value={form.local_id} onChange={(value) => updateField('local_id', value)}>
              {payload.locais.map((option) => <option key={option.id} value={option.id}>{option.codigo} — {option.nome}</option>)}
            </SelectField>
          </FormSection>

          <FormSection title="Especificações e diária" description="Campos compartilhados somente quando a versão é exclusiva.">
            <TextField required disabled={versionDisabled} label="Preço da diária (R$) *" type="number" min="0.01" step="0.01" value={form.preco_diaria} onChange={(event) => updateField('preco_diaria', event.target.value)} />
            <SelectField disabled={versionDisabled} label="Câmbio *" value={form.cambio} onChange={(value) => updateField('cambio', value)}><option value="automático">Automático</option><option value="manual">Manual</option><option value="cvt">CVT</option></SelectField>
            <SelectField disabled={versionDisabled} label="Combustível *" value={form.combustivel} onChange={(value) => updateField('combustivel', value)}><option value="flex">Flex</option><option value="gasolina">Gasolina</option><option value="etanol">Etanol</option><option value="diesel">Diesel</option><option value="híbrido">Híbrido</option><option value="elétrico">Elétrico</option></SelectField>
            <TextField disabled={versionDisabled} label="Capacidade de pessoas" type="number" min="1" max="20" value={form.capacidade_pessoas} onChange={(event) => updateField('capacidade_pessoas', event.target.value)} />
            <TextField disabled={versionDisabled} label="Capacidade de malas" type="number" min="0" max="20" value={form.capacidade_malas} onChange={(event) => updateField('capacidade_malas', event.target.value)} />
            <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-sm pt-xs">
              <CheckField disabled={versionDisabled} label="Ar-condicionado" checked={form.ar_condicionado} onChange={(checked) => updateField('ar_condicionado', checked)} />
              <CheckField disabled={versionDisabled} label="Trava elétrica" checked={form.trava_eletrica} onChange={(checked) => updateField('trava_eletrica', checked)} />
              <CheckField disabled={versionDisabled} label="Freio ABS" checked={form.freio_abs} onChange={(checked) => updateField('freio_abs', checked)} />
              <CheckField disabled={versionDisabled} label="Direção assistida" checked={form.direcao_assistida} onChange={(checked) => updateField('direcao_assistida', checked)} />
              <CheckField disabled={versionDisabled} label="Veículo elétrico" checked={form.eletrico} onChange={(checked) => updateField('eletrico', checked)} />
            </div>
          </FormSection>

          <section className="bg-white rounded-modal shadow-elevation-1 p-lg flex flex-col gap-md">
            <div><h2 className="font-exo font-bold text-heading-xs text-secondary">Galeria atual</h2><p className="font-inter text-body-sm text-neutral-text mt-xxs">As novas fotos são acrescentadas sem apagar o histórico existente.</p></div>
            <ImageGallery images={payload.veiculo.imagens} />
            <label htmlFor="edit-vehicle-images" className={`border-2 border-dashed border-neutral-details rounded-modal p-lg flex flex-col items-center gap-xs text-center ${versionDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}`}>
              <span className="material-icons text-[38px] text-primary">add_photo_alternate</span>
              <span className="font-inter text-body-md font-bold text-secondary">Adicionar até 5 imagens</span>
              <span className="font-inter text-body-sm text-neutral-text">{images.length ? `${images.length} arquivo(s) selecionado(s)` : 'JPEG, PNG ou WebP — até 5 MB cada'}</span>
              <input disabled={versionDisabled} id="edit-vehicle-images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImages} className="sr-only" />
            </label>
            {images.length ? <CheckField label="Confirmo que possuo autorização para utilizar e publicar estas imagens." checked={form.direitos_imagem} onChange={(checked) => updateField('direitos_imagem', checked)} /> : null}
          </section>

          {error ? <p role="alert" className="bg-feedback-negative/10 border border-feedback-negative rounded-xs p-md font-inter text-body-md text-feedback-negative">{error}</p> : null}
          {success ? <p role="status" className="bg-feedback-positive/10 border border-feedback-positive rounded-xs p-md font-inter text-body-md text-neutral-text">{success}</p> : null}
          <div className="flex justify-end"><Button type="submit" disabled={submitting} icon="save" className="w-full sm:w-auto min-w-[220px]">{submitting ? 'Salvando...' : 'Salvar alterações'}</Button></div>
        </form>
      </main>
      <Footer />
    </div>
  )
}

function PageMessage({ message, error = false }: { message: string; error?: boolean }) {
  return <div className="min-h-screen flex flex-col bg-neutral-background"><Header /><main className={`flex-1 flex items-center justify-center px-md font-inter text-body-lg ${error ? 'text-feedback-negative' : 'text-neutral-text'}`}>{message}</main><Footer /></div>
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="bg-white rounded-modal shadow-elevation-1 p-lg flex flex-col gap-md"><div><h2 className="font-exo font-bold text-heading-xs text-secondary">{title}</h2><p className="font-inter text-body-sm text-neutral-text mt-xxs">{description}</p></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">{children}</div></section>
}

function SelectField({ label, value, onChange, disabled, children }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; children: ReactNode }) {
  const id = `edit-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return <div className="flex flex-col gap-xxs"><label htmlFor={id} className="font-inter text-body-md text-neutral-text">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={selectClass}>{children}</select></div>
}

function CheckField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className={`flex items-center gap-xs font-inter text-body-md text-neutral-text ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="w-5 h-5 accent-primary" /><span>{label}</span></label>
}

function ImageGallery({ images }: { images: ExistingVehicleImage[] }) {
  if (!images.length) return <p className="font-inter text-body-sm text-neutral-text">Nenhuma foto cadastrada.</p>
  return <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-sm">{images.map((image) => <li key={image.id} className="aspect-[4/3] overflow-hidden rounded-xs bg-neutral-divisor"><img src={image.caminho} alt={image.texto_alternativo ?? 'Foto do veículo'} className="w-full h-full object-cover" loading="lazy" /></li>)}</ul>
}
