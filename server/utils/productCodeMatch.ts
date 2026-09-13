/**
 * AI-XLSX-SOURCE-01 — the one rule for "this cell names the current product's code".
 *
 * A spreadsheet often lists several models. Narrowing it to the current
 * product's rows before anything reaches a model is only safe if "names this
 * code" can never mean "names a similar code". So the rule is equality after a
 * small, fixed normalization, and nothing else: no edit distance, no prefix or
 * suffix, no "contains", nothing inferred from a file or folder name, and no
 * call to a model. LT180 is not LT180C; LT180C-S is not LT180C. Missing a row is
 * safer than attributing another model's value to this product — and whatever
 * is kept still goes through the D-025 relevance guard.
 */

/**
 * NFKC, trim, upper case, then drop whitespace and only these three
 * separators: `-`, `_`, `.`. `LT-180C`, `LT 180 C` and `LT_180_C` all become
 * `LT180C`.
 */
export function normalizeProductCode(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]/gu, '')
}

/**
 * Whether a normalized code may narrow a sheet at all. A code without both a
 * letter and a digit — `180`, `PRO` — can equal an ordinary cell value, an
 * aperture or a word, and would narrow a sheet to the wrong rows while labelling
 * them with this product's code. Such a code narrows nothing: the sheet is kept
 * whole, exactly as for a product with no code, and the relevance guard decides.
 */
export function isFilterableProductCode(normalizedCode: string): boolean {
  return /\p{L}/u.test(normalizedCode) && /\p{N}/u.test(normalizedCode)
}

/** A cell may name several models: `LT180C / LT200C`, a comma list, one per line. `，` becomes `,` under NFKC. */
const FRAGMENT_SEPARATORS = /[/,;|、\r\n]/u

/**
 * Whether any fragment of `cellValue`, split at an explicit separator, is
 * exactly the product code once both are normalized. `normalizedCode` is the
 * output of `normalizeProductCode`; an empty one never matches.
 */
export function cellNamesProductCode(cellValue: string, normalizedCode: string): boolean {
  if (!normalizedCode) return false
  return cellValue
    .normalize('NFKC')
    .split(FRAGMENT_SEPARATORS)
    .some(fragment => normalizeProductCode(fragment) === normalizedCode)
}
