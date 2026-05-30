import { memo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export default memo(function EmptyState({ children }: Props) {
  return (
    <div style={{
      padding: 32,
      textAlign: 'center',
      color: 'var(--muted2)',
      fontSize: 13,
      fontStyle: 'italic',
      gridColumn: '1/-1',
    }}>
      {children}
    </div>
  )
})
