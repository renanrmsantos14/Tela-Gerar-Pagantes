import { describe, expect, it } from 'vitest'
import { parseCurrency, splitEvenly } from './money'

describe('splitEvenly', () => {
  it('distribui centavos residuais no começo da lista', () => {
    expect([...splitEvenly(100, ['a', 'b', 'c']).values()]).toEqual([34, 33, 33])
  })
})

describe('parseCurrency', () => {
  it('converte formato brasileiro para centavos', () => {
    expect(parseCurrency('1.000,50')).toBe(100050)
  })

  it('rejeita valor inválido', () => {
    expect(parseCurrency('1,2,3')).toBeNull()
  })
})
