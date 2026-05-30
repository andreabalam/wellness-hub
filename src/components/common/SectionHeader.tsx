import { memo } from 'react'

interface Props {
  title: string
  subtitle?: string
}

export default memo(function SectionHeader({ title, subtitle }: Props) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{
        fontFamily: '"DM Serif Display", serif',
        fontSize: 22,
        fontWeight: 400,
        color: 'var(--text)',
        margin: 0,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 12, color: 'var(--muted2)', margin: '4px 0 0', fontFamily: 'sans-serif' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
})
