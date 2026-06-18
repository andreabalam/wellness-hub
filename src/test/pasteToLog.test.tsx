/**
 * PasteToLog — the AI-parse success path and the hard-error path that the broad
 * tracker test (which forces parseFoodLog to reject) doesn't reach.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { QuickFood } from '../data/tracker'

const parseFoodLog = vi.fn()
const parseFoodLogLocal = vi.fn()
vi.mock('../lib/foodImport', () => ({
  parseFoodLog: (...a: unknown[]) => parseFoodLog(...a),
  parseFoodLogLocal: (...a: unknown[]) => parseFoodLogLocal(...a),
}))

import PasteToLog from '../components/TrackerTab/PasteToLog'

const food = (n: string, k = 200): QuickFood => ({ n, k, p: 10, c: 20, f: 5, fi: 3 })

beforeEach(() => vi.clearAllMocks())

function openAndParse(text = 'some pasted meal text') {
  fireEvent.click(screen.getByTestId('paste-log-toggle'))
  fireEvent.change(screen.getByTestId('paste-log-input'), { target: { value: text } })
  fireEvent.click(screen.getByText('Parse'))
}

describe('PasteToLog', () => {
  it('shows reviewable rows from a successful AI parse', async () => {
    parseFoodLog.mockResolvedValue([food('Greek yogurt'), food('Berries', 80)])
    render(<PasteToLog foodLib={[]} onAdd={vi.fn()} />)
    openAndParse()
    expect(await screen.findByDisplayValue('Greek yogurt')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Berries')).toBeInTheDocument()
  })

  it('falls back to the local parser when the AI returns nothing', async () => {
    parseFoodLog.mockResolvedValue([])
    parseFoodLogLocal.mockReturnValue([food('Local Oats')])
    render(<PasteToLog foodLib={[]} onAdd={vi.fn()} />)
    openAndParse()
    expect(await screen.findByDisplayValue('Local Oats')).toBeInTheDocument()
  })

  it('shows an error when neither parser finds food', async () => {
    parseFoodLog.mockRejectedValue(new Error('No foods found in that text'))
    parseFoodLogLocal.mockReturnValue([])
    render(<PasteToLog foodLib={[]} onAdd={vi.fn()} />)
    openAndParse()
    expect(await screen.findByText(/No foods found/)).toBeInTheDocument()
  })

  it('edits a row, removes another, and logs the rest', async () => {
    parseFoodLog.mockResolvedValue([food('Yogurt'), food('Toast', 150)])
    const onAdd = vi.fn()
    render(<PasteToLog foodLib={[]} onAdd={onAdd} />)
    openAndParse()
    await screen.findByDisplayValue('Yogurt')
    fireEvent.change(screen.getByDisplayValue('Yogurt'), { target: { value: 'Skyr' } })
    // remove the second row
    fireEvent.click(screen.getAllByTitle('Remove')[1])
    fireEvent.click(screen.getByTestId('paste-log-add'))
    await waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(onAdd.mock.calls[0][0]).toHaveLength(1)
    expect(onAdd.mock.calls[0][0][0].n).toBe('Skyr')
  })

  it('cancels back to the toggle button', async () => {
    parseFoodLog.mockResolvedValue([food('X')])
    render(<PasteToLog foodLib={[]} onAdd={vi.fn()} />)
    openAndParse()
    await screen.findByDisplayValue('X')
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.getByTestId('paste-log-toggle')).toBeInTheDocument()
  })
})
