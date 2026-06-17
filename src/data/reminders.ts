export interface Reminder {
  id: string // UUID — generated client-side via crypto.randomUUID()
  text: string
  checked: boolean
  checkedAt: string | null // ISO timestamp set when checked
  createdAt: string // ISO timestamp
}
