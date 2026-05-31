import { memo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export default memo(function EmptyState({ children }: Props) {
  return (
    <div className="empty-state">
      {children}
    </div>
  )
})
