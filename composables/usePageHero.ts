/**
 * V2-04 — read the published hero override for a page, merged over its approved default.
 *
 * Every field falls back individually: an override that only changes the title keeps the default
 * eyebrow and body. A missing row, an unpublished row, an empty value, an ineligible image or an
 * unreachable CMS all leave the default in place, so a page can never render blank because the
 * editor has not filled the form in yet.
 *
 * A button is merged as a pair, not field by field: a label without a path (or the reverse) keeps the
 * whole default button, because a label pointing at the previous default's destination is worse than
 * no override at all.
 *
 * The default lives in the page component, which is why it is passed in rather than looked up here:
 * the registry on the server owns the keys, the component owns its own fallback copy.
 */
export interface HeroOverride {
  eyebrow?: string | null
  title?: string | null
  body?: string | null
  imageUrl?: string | null
  ctaPrimaryLabel?: string | null
  ctaPrimaryPath?: string | null
  ctaSecondaryLabel?: string | null
  ctaSecondaryPath?: string | null
}

export interface HeroDefault {
  eyebrow: string
  title: string
  body: string
  imageUrl?: string
  ctaPrimaryLabel?: string
  ctaPrimaryPath?: string
  ctaSecondaryLabel?: string
  ctaSecondaryPath?: string
}

/** A hero after fallback. Every field is a string, so a template never has to guard for undefined. */
export interface ResolvedHero {
  eyebrow: string
  title: string
  body: string
  imageUrl: string
  ctaPrimaryLabel: string
  ctaPrimaryPath: string
  ctaSecondaryLabel: string
  ctaSecondaryPath: string
  /** True when at least one field came from a published override. */
  overridden: boolean
}

function pick(value: string | null | undefined, fallback: string | undefined): string {
  const v = (value ?? '').trim()
  return v || (fallback ?? '')
}

/** A label and its path come from one source: either both are overridden, or both stay default. */
function pair(
  label: string | null | undefined,
  path: string | null | undefined,
  defaultLabel: string | undefined,
  defaultPath: string | undefined,
): { label: string; path: string } {
  const l = (label ?? '').trim()
  const p = (path ?? '').trim()
  if (l && p) return { label: l, path: p }
  return { label: defaultLabel ?? '', path: defaultPath ?? '' }
}

function fromDefaults(defaults: HeroDefault): ResolvedHero {
  return {
    eyebrow: defaults.eyebrow,
    title: defaults.title,
    body: defaults.body,
    imageUrl: defaults.imageUrl ?? '',
    ctaPrimaryLabel: defaults.ctaPrimaryLabel ?? '',
    ctaPrimaryPath: defaults.ctaPrimaryPath ?? '',
    ctaSecondaryLabel: defaults.ctaSecondaryLabel ?? '',
    ctaSecondaryPath: defaults.ctaSecondaryPath ?? '',
    overridden: false,
  }
}

export async function usePageHero(
  pageKey: string,
  defaults: HeroDefault,
): Promise<{ hero: ResolvedHero }> {
  let override: HeroOverride | null = null
  try {
    const res = await $fetch<{ hero: HeroOverride | null }>('/api/cms/page-hero', {
      query: { page: pageKey },
    })
    override = res?.hero ?? null
  }
  catch {
    // Fall through to the default; a hero is never a reason to fail a page.
  }

  if (!override) return { hero: fromDefaults(defaults) }

  const primary = pair(override.ctaPrimaryLabel, override.ctaPrimaryPath, defaults.ctaPrimaryLabel, defaults.ctaPrimaryPath)
  const secondary = pair(override.ctaSecondaryLabel, override.ctaSecondaryPath, defaults.ctaSecondaryLabel, defaults.ctaSecondaryPath)

  return {
    hero: {
      eyebrow: pick(override.eyebrow, defaults.eyebrow),
      title: pick(override.title, defaults.title),
      body: pick(override.body, defaults.body),
      imageUrl: pick(override.imageUrl, defaults.imageUrl),
      ctaPrimaryLabel: primary.label,
      ctaPrimaryPath: primary.path,
      ctaSecondaryLabel: secondary.label,
      ctaSecondaryPath: secondary.path,
      overridden: true,
    },
  }
}
