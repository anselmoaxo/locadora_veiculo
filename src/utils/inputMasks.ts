export function digitsOnly(value: string, limit?: number) {
  const digits = value.replace(/\D/g, '')
  return limit === undefined ? digits : digits.slice(0, limit)
}

export function maskCpf(value: string) {
  const digits = digitsOnly(value, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function maskPhone(value: string) {
  const digits = digitsOnly(value, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function maskDriverLicense(value: string) {
  return digitsOnly(value, 11)
}

export function maskRenavam(value: string) {
  return digitsOnly(value, 11)
}

export function maskPlate(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  return normalized.length > 3 ? `${normalized.slice(0, 3)}-${normalized.slice(3)}` : normalized
}
