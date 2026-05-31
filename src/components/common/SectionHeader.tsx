import { memo } from 'react'

interface Props {
  title: string
  subtitle?: string
}

export default memo(function SectionHeader({ title, subtitle }: Props) {
  return (
    <div className="section-header">
      <h2 className="section-header__title">{title}</h2>
      {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
    </div>
  )
})
