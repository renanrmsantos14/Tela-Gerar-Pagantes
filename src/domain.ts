export type Guid = string

export const PAYMENT_METHODS = [
  { value: 202410000, label: 'Cartão de crédito' },
  { value: 202410001, label: 'Pedido de compra' },
  { value: 202410002, label: 'Pix' }
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

export type LinkStatus = 'NotApplicable' | 'Generated' | 'Pending' | 'Failed' | 'Indeterminate'
export type EmailStatus = 'NotApplicable' | 'Pending' | 'Sent' | 'Failed'

export interface Person {
  id: Guid
  name: string
  email: string
  phone: string
  role: 'Solicitante' | 'Passageiro' | 'Adicionado'
}

export interface Payer extends Person {
  existingPayerId?: Guid
  paymentStatus?: string
  amountCents: number
  paymentMethod: PaymentMethod
  generateLink: boolean
  sendEmail: boolean
  paymentUrl?: string
  linkStatus: LinkStatus
  emailStatus: EmailStatus
  linkError?: string
  emailError?: string
}

export interface OperationData {
  id: Guid
  displayId: string
  version: string
  serviceCount: number
  totalCents: number
  statusLabel: string
  stateCode: number
  ownerId?: Guid
  people: Person[]
  directory: Person[]
  payers: Payer[]
}

export interface SubmitRequest {
  requestId: Guid
  expectedFinanceiroVersion: string
  financeiroDisplayId: string
  totalCents: number
  allowTotalMismatch: boolean
  serviceStartDate?: string | null
  serviceEndDate?: string | null
  pagantes: Array<{
    paganteId: Guid
    existingPaganteId?: Guid
    name: string
    email: string
    amountCents: number
    paymentMethod: PaymentMethod
    generateLink: boolean
    sendEmail: boolean
  }>
}

export interface SubmitResult {
  success: boolean
  requestId: Guid
  financeiroId: Guid
  totalCents: number
  results: Array<{
    paganteId: Guid
    pagantesRecordId: Guid
    linkStatus: LinkStatus
    emailStatus: EmailStatus
    paymentUrl?: string
  }>
  errors: Array<{ code: string; message: string; paganteId?: Guid }>
}

export interface FlowPayerResult {
  paganteId: Guid
  paganteRecordId: Guid
  linkStatus: LinkStatus
  emailStatus: EmailStatus
  paymentUrl?: string
  error?: string
}
