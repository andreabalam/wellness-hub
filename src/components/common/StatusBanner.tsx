import { memo } from 'react'

export type BannerVariant = 'info' | 'warn' | 'error' | 'success'

interface Props {
  message: string
  variant?: BannerVariant
}

const VARIANT_COLORS: Record<BannerVariant, { bg: string; border: string; text: string }> = {
  info:    { bg: 'rgba(58,125,90,0.12)',  border: 'var(--green)',  text: 'var(--green-light)' },
  warn:    { bg: 'rgba(201,145,58,0.12)', border: 'var(--amber)',  text: 'var(--amber-light)' },
  error:   { bg: 'rgba(220,80,60,0.12)',  border: 'var(--coral)',  text: 'var(--coral-light)' },
  success: { bg: 'rgba(58,125,90,0.18)',  border: 'var(--teal)',   text: 'var(--teal-light)' },
}

export default memo(function StatusBanner({ message, variant = 'info' }: Props) {
  const { bg, border, text } = VARIANT_COLORS[variant]
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 9,
      background: bg,
      border: `1px solid ${border}`,
      fontSize: 12,
      color: text,
      fontFamily: '"DM Mono", monospace',
      lineHeight: 1.5,
    }}>
      {message}
    </div>
  )
})
