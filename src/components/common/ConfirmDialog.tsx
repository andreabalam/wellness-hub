import { memo } from 'react'

interface Props {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default memo(function ConfirmDialog({
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-overlay__card">
        <p className="confirm-overlay__message">{message}</p>
        <div className="confirm-overlay__actions">
          <button className="btn btn--ghost btn--md" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="btn btn--danger btn--md" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
})
