import { memo } from 'react'

export type BannerVariant = 'info' | 'warn' | 'error' | 'success'

interface Props {
  message: string
  variant?: BannerVariant
}

export default memo(function StatusBanner({ message, variant = 'info' }: Props) {
  return (
    <div className={`banner banner--${variant}`}>
      {message}
    </div>
  )
})
