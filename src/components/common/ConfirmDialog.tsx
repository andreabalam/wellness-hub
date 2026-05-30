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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '24px 28px', maxWidth: 360, width: '100%',
      }}>
        <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 20, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{ background: 'var(--coral)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#fff', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 500 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
})
