import { memo, type ReactNode, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize    = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary:   { background: 'var(--green)',  border: 'none', color: '#fff' },
  secondary: { background: 'var(--purple)', border: 'none', color: '#fff' },
  ghost:     { background: 'none', border: '1px solid var(--border)', color: 'var(--muted)' },
  danger:    { background: 'none', border: '1px solid var(--coral)', color: 'var(--coral-light)' },
}

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 12px', fontSize: 12 },
  md: { padding: '7px 16px', fontSize: 13 },
}

export default memo(function Button({
  variant = 'primary',
  size = 'md',
  style,
  children,
  ...rest
}: Props) {
  return (
    <button
      style={{
        borderRadius: 8,
        fontFamily: 'sans-serif',
        fontWeight: 500,
        cursor: 'pointer',
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
})
