import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './ui'

describe('Modal', () => {
  it('fecha com Escape e mantém o título acessível', () => {
    const onClose = vi.fn()
    render(<Modal open title="Confirmar alteração" onClose={onClose}><input aria-label="Busca" /></Modal>)
    expect(screen.getByRole('dialog', { name: 'Confirmar alteração' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
