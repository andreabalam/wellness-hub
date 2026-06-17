import { useState, useRef, useEffect, type ReactNode } from 'react'

interface Props {
  /** Initial text; the component owns the draft state while editing. */
  initialValue: string
  /** Called with the trimmed value when the user saves (only if non-empty). */
  onSave: (value: string) => void
  onCancel: () => void
  /** Wrapper / input / button class names — let callers keep their own styling. */
  className?: string
  inputClassName?: string
  saveClassName?: string
  cancelClassName?: string
  saveLabel?: ReactNode
  cancelLabel?: ReactNode
  saveAriaLabel?: string
  cancelAriaLabel?: string
  /** Stop click events bubbling (e.g. when the row itself has an onClick). */
  stopPropagation?: boolean
}

/**
 * Shared inline text-edit row: an auto-focused input with Enter-to-save /
 * Escape-to-cancel plus save and cancel buttons. Extracted from the duplicated
 * reminder/grocery edit rows. Styling is left to the caller via class props so
 * each usage keeps its existing look.
 */
export default function InlineEdit({
  initialValue,
  onSave,
  onCancel,
  className,
  inputClassName,
  saveClassName,
  cancelClassName,
  saveLabel = 'Save',
  cancelLabel = '×',
  saveAriaLabel = 'Save edit',
  cancelAriaLabel = 'Cancel edit',
  stopPropagation = false,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  const save = () => {
    const trimmed = value.trim()
    if (trimmed) onSave(trimmed)
  }

  return (
    <div className={className} onClick={stopPropagation ? e => e.stopPropagation() : undefined}>
      <input
        ref={ref}
        className={inputClassName}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') onCancel()
        }}
      />
      <button
        type="button"
        className={saveClassName}
        onClick={save}
        disabled={!value.trim()}
        aria-label={saveAriaLabel}
      >
        {saveLabel}
      </button>
      <button
        type="button"
        className={cancelClassName}
        onClick={onCancel}
        aria-label={cancelAriaLabel}
      >
        {cancelLabel}
      </button>
    </div>
  )
}
