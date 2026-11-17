/**
 * V2-04 — read the published hero override for a page, merged over its approved default.
 *
 * Every field falls back individually: an override that only changes the title keeps the default
 * eyebrow and body. A missing row, an unpublished row, an empty value, an ineligible image or an
 * unreachable CMS all leave the default in place, so a page can never render blank because the
 * editor has not filled the form in yet.
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

export interface ResolvedHero extends HeroDefault {
  /** True when at least one field came from a published override. */
  overridden: boolean
}

function pick(value: string | null | undefined, fallback: string | undefined): string {
  const v = (value ?? '').trim()
  return v || (fallback ?? '')
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

  if (!override) {
    return { hero: { ...defaults, overridden: false } }
  }

  // A CTA is only usable as a pair: a label with no path, or a path with no label, is ignored.
  const primaryLabel = pick(override.ctaPrimaryLabel, defaults.ctaPrimaryLabel)
  const primaryPath = pick(override.ctaPrimaryPath, defaults.ctaPrimaryPath)
  const secondaryLabel = pick(override.ctaSecondaryLabel, defaults.ctaSecondaryLabel)
  const secondaryPath = pick(override.ctaSecondaryPath, defaults.ctaSecondaryPath)

  return {
    hero: {
    eyebrow: pick(override.eyebrow, defaults.eyebrow),
    title: pick(override.title, defaults.title),
    body: pick(override.body, defaults.body),
    imageUrl: pick(override.imageUrl, defaults.imageUrl),
    ctaPrimaryLabel: primaryLabel && primaryPath ? primaryLabel : (defaults.ctaPrimaryLabel ?? ''),
    ctaPrimaryPath: primaryLabel && primaryPath ? primaryPath : (defaults.ctaPrimaryPath ?? ''),
    ctaSecondaryLabel: secondaryLabel && secondaryPath ? secondaryLabel : (defaults.ctaSecondaryLabel ?? ''),
    ctaSecondaryPath: secondaryLabel && secondaryPath ? secondaryPath : (defaults.ctaSecondaryPath ?? ''),
    overridden: true,
    },
  }
}
