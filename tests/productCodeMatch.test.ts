/**
 * AI-XLSX-SOURCE-01 — "this cell names the current product's code" (`productCodeMatch.ts`).
 *
 * Equality after a fixed normalization, and nothing else. Missing a row is
 * safer than attributing another model's value to this product.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cellNamesProductCode, isFilterableProductCode, normalizeProductCode } from '../server/utils/productCodeMatch'

describe('productCodeMatch — normalization', () => {
  it.each([
    'LT180C', 'LT-180C', 'LT 180 C', 'LT_180_C', 'lt.180c', '  LT180C  ',
    'ＬＴ－１８０Ｃ', 'LT 180C', 'LT　180C', 'LT\t180-C',
  ])('%j normalizes to LT180C', (value) => {
    expect(normalizeProductCode(value)).toBe('LT180C')
  })

  it('removes only whitespace, "-", "_" and "." — every other character stays', () => {
    expect(normalizeProductCode('LT180C/S')).toBe('LT180C/S')
    expect(normalizeProductCode('LT180C(S)')).toBe('LT180C(S)')
    expect(normalizeProductCode('LT180C+')).toBe('LT180C+')
  })
})

describe('productCodeMatch — exact match only', () => {
  const code = normalizeProductCode('LT-180C')

  it.each(['LT180C', 'LT-180C', 'LT 180 C', 'LT_180_C', 'lt180c'])('matches %j', (cell) => {
    expect(cellNamesProductCode(cell, code)).toBe(true)
  })

  it.each([
    'LT180', 'LT180C-S', 'LT180D', 'XLT180C', 'LT180CC', 'LT-180',
    'LT180C Standard', 'Model LT180C', 'LT180C (S)', 'LT200C', '',
  ])('does not match %j', (cell) => {
    expect(cellNamesProductCode(cell, code)).toBe(false)
  })

  it.each([
    'LT180C / LT200C', 'LT200C, LT180C', 'LT200C;LT180C', 'LT200C | LT180C',
    'LT200C、LT180C', 'LT200C，LT180C', 'LT200C\nLT180C', 'LT200C\r\nLT180C',
  ])('finds the exact code among several models in %j', (cell) => {
    expect(cellNamesProductCode(cell, code)).toBe(true)
  })

  it.each(['LT200C & LT180C', 'LT200C LT180C', 'LT180C-S / LT200C'])('splits %j only at an explicit separator', (cell) => {
    expect(cellNamesProductCode(cell, code)).toBe(false)
  })

  it('never matches with an empty code', () => {
    expect(cellNamesProductCode('LT180C', '')).toBe(false)
    expect(cellNamesProductCode('', '')).toBe(false)
  })
})

describe('productCodeMatch — which codes may narrow a sheet', () => {
  it.each([
    ['LT180C', true],
    ['LT-180C', true],
    ['A1', true],
    ['180', false],
    ['PRO', false],
    ['---', false],
    ['', false],
  ])('%j → %s', (value, expected) => {
    expect(isFilterableProductCode(normalizeProductCode(value))).toBe(expected)
  })
})

describe('productCodeMatch — no fuzzy matching, by construction', () => {
  it('has no imports and no similarity, prefix, suffix or substring logic', () => {
    const code = readFileSync(resolve(process.cwd(), 'server/utils/productCodeMatch.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/\bimport\b|require\(|fetch|levenshtein|distance|similar|fuzzy|startsWith|endsWith|includes|indexOf|search\(|localeCompare/i)
  })
})
