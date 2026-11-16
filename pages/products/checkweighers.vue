<script setup lang="ts">
/**
 * Checkweighers — series-first catalogue.
 *
 * Replaces the flat twelve-card list with: pick a series → narrow by configuration → read the model.
 * Every other product category still uses `pages/products/[category]/index.vue`; this static route
 * only takes over for `/products/checkweighers`.
 *
 * Series and configuration come from real product metadata, never from the model name at render time,
 * so the owner can move a model between series in Directus without a code change. A product with no
 * series stays visible under "All series" — nothing disappears because it has not been classified.
 *
 * Counts are computed from the published products the API returns; nothing is hard-coded.
 */
import type { Product, ProductCategory } from '~/types/content'

const { t, locale } = useI18n()
const localePath = useLocalePath()

const { data, pending, error, refresh } = await useAsyncData(
  `checkweighers-${locale.value}`,
  () => $fetch<{ category: ProductCategory, products: Product[] }>('/api/cms/products/checkweighers', {
    query: { locale: locale.value },
  }),
)

// A02: a failed product read must not render as "All series · 0 models".
const status = publicPageStatus(error.value, Boolean(data.value?.products))
if (status && import.meta.server) throw createError({ statusCode: status, fatal: true })

const category = computed(() => data.value?.category ?? null)
const products = computed<Product[]>(() => data.value?.products ?? [])

useSeoHead({
  title: t('seo.products.title'),
  description: category.value?.intro?.[locale.value as 'en'] || '',
  canonicalPath: '/products/checkweighers',
})

function loc(v: { en: string, es: string, pt: string } | undefined): string {
  if (!v) return ''
  const code = locale.value as 'en' | 'es' | 'pt'
  return v[code] || v.en || ''
}

type SeriesKey = 'all' | 'compact' | 'standard' | 'medium-range' | 'extra-large' | 'pharmaceutical'

/** Browsing order from the design: Compact → Standard → Medium-range → Extra-large. */
const SERIES: { key: SeriesKey, label: string, blurb: string }[] = [
  { key: 'compact', label: 'Compact', blurb: 'Small-pack lines with limited floor space.' },
  { key: 'standard', label: 'Standard', blurb: 'A practical inline weight-control point.' },
  { key: 'medium-range', label: 'Medium-range', blurb: 'Wider packs and heavier individual items.' },
  { key: 'extra-large', label: 'Extra-large', blurb: 'Sacks, cartons and heavy packages.' },
  { key: 'pharmaceutical', label: 'Pharmaceutical', blurb: 'Discussed as a dedicated project.' },
]

const activeSeries = ref<SeriesKey>('all')
const query = ref('')
const config = ref<'all' | 'online' | 'left-right'>('all')
const lSeriesOnly = ref(false)

/** Selecting a series clears the previous search and filters, so a stale empty result cannot appear. */
function selectSeries(key: SeriesKey) {
  activeSeries.value = key
  query.value = ''
  config.value = 'all'
  lSeriesOnly.value = false
}

const seriesCount = computed(() => {
  const out: Record<string, number> = {}
  for (const s of SERIES) out[s.key] = products.value.filter((p: Product) => p.checkweigherSeries === s.key).length
  return out
})

const isPharma = computed(() => activeSeries.value === 'pharmaceutical')

const visible = computed<Product[]>(() => {
  let list = products.value
  if (activeSeries.value !== 'all') list = list.filter((p: Product) => p.checkweigherSeries === activeSeries.value)
  if (config.value !== 'all') list = list.filter((p: Product) => p.checkweigherConfiguration === config.value)
  if (lSeriesOnly.value) list = list.filter((p: Product) => p.checkweigherLSeries === true)
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p: Product) =>
      (p.modelSeries ?? '').toLowerCase().includes(q)
      || loc(p.name).toLowerCase().includes(q)
      || loc(p.summary).toLowerCase().includes(q),
    )
  }
  return list
})

const resultTitle = computed(() => {
  if (activeSeries.value === 'all') return 'All series'
  return SERIES.find(s => s.key === activeSeries.value)?.label ?? 'All series'
})

const hasFilters = computed(() => query.value !== '' || config.value !== 'all' || lSeriesOnly.value)

function clearFilters() {
  query.value = ''
  config.value = 'all'
  lSeriesOnly.value = false
  activeSeries.value = 'all'
}

/** The enquiry carries the series context into the existing technical-matching form. */
const enquiryPath = computed(() => {
  const series = activeSeries.value === 'all' ? '' : activeSeries.value
  return series ? `/technical-matching?application=checkweighers&series=${series}` : '/technical-matching'
})
</script>

<template>
  <div class="cw-page">
    <!-- 1. Compact first screen -->
    <section class="cw-hero">
      <div class="container cw-hero__inner">
        <div class="cw-hero__text">
          <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.products'), to: localePath('/products') }, { label: 'Checkweighers' }]" />
          <h1 class="cw-hero__title">Checkweighers</h1>
          <p class="cw-hero__intro">
            Start from the series that matches your pack, then narrow by configuration. The model follows
            from your product, pack and line — not from a list.
          </p>
        </div>
        <aside class="cw-hero__aside">
          <p class="cw-hero__aside-label">Before you choose</p>
          <ul role="list">
            <li><span>Product</span>What is being weighed, and its normal spread</li>
            <li><span>Pack</span>Format, dimensions and how it sits on the belt</li>
            <li><span>Line</span>Speed, available length and how rejects are removed</li>
          </ul>
        </aside>
      </div>
    </section>

    <!-- 2. Five series + All -->
    <section class="cw-series">
      <div class="container">
        <h2 class="cw-series__title">Choose a series</h2>
        <div class="cw-series__row" role="radiogroup" aria-label="Checkweigher series">
          <button
            v-for="s in SERIES"
            :key="s.key"
            type="button"
            role="radio"
            class="cw-series__card"
            :class="{ 'is-active': activeSeries === s.key }"
            :aria-checked="activeSeries === s.key"
            @click="selectSeries(s.key)"
          >
            <span v-if="s.key === 'pharmaceutical'" class="cw-series__symbol" aria-hidden="true">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <circle cx="26" cy="26" r="19" stroke="currentColor" stroke-width="1.6" />
                <path d="M26 14v24M14 26h24" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </span>
            <span v-else class="cw-series__count">{{ seriesCount[s.key] }}</span>
            <span class="cw-series__name">{{ s.label }}</span>
            <span class="cw-series__blurb">{{ s.blurb }}</span>
          </button>
        </div>
        <button type="button" class="cw-all" :class="{ 'is-active': activeSeries === 'all' }" @click="selectSeries('all')">
          All series · {{ products.length }} models
        </button>
      </div>
    </section>

    <!-- 3–5. Results, search, filters, grid — or the pharmaceutical enquiry panel -->
    <section class="cw-results">
      <div class="container">
        <template v-if="isPharma">
          <!-- 6. Pharmaceutical: no invented models, an enquiry panel instead -->
          <div class="cw-pharma">
            <div class="cw-pharma__side">
              <span class="cw-pharma__symbol" aria-hidden="true">
                <svg width="72" height="72" viewBox="0 0 52 52" fill="none">
                  <circle cx="26" cy="26" r="19" stroke="currentColor" stroke-width="1.4" />
                  <path d="M26 14v24M14 26h24" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
              </span>
            </div>
            <div class="cw-pharma__body">
              <p class="eyebrow">Pharmaceutical</p>
              <h2 class="cw-pharma__title">Pharmaceutical weighing is discussed as a project.</h2>
              <p class="cw-pharma__text">
                A pharmaceutical checkweigher is specified against the product, the dose and the records
                your process has to keep. There is no standard model list to browse here yet — the
                configuration is agreed with our team.
              </p>
              <ul class="cw-pharma__list" role="list">
                <li><span>Product and pack</span>Form, primary packaging and how it is presented</li>
                <li><span>Target weight</span>Nominal weight and the tolerance you work to</li>
                <li><span>Line and records</span>Line conditions, cleaning and documentation needs</li>
              </ul>
              <NuxtLink :to="localePath('/technical-matching?application=checkweighers&series=pharmaceutical')" class="cw-cta">
                Discuss your project →
              </NuxtLink>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="cw-head">
            <div>
              <h2 class="cw-head__title">{{ resultTitle }}</h2>
              <p class="cw-head__count">
                {{ visible.length }} {{ visible.length === 1 ? 'model' : 'models' }}
                <span v-if="hasFilters"> · filtered</span>
              </p>
            </div>
            <label class="cw-search">
              <span class="cw-search__label">Search models</span>
              <input v-model="query" type="search" placeholder="Model or keyword" autocomplete="off">
            </label>
          </div>

          <div class="cw-filters">
            <div class="cw-filters__group" role="radiogroup" aria-label="Configuration">
              <button type="button" role="radio" :aria-checked="config === 'all'" class="cw-chip" :class="{ 'is-active': config === 'all' }" @click="config = 'all'">All</button>
              <button type="button" role="radio" :aria-checked="config === 'online'" class="cw-chip" :class="{ 'is-active': config === 'online' }" @click="config = 'online'">Online weighing</button>
              <button type="button" role="radio" :aria-checked="config === 'left-right'" class="cw-chip" :class="{ 'is-active': config === 'left-right' }" @click="config = 'left-right'">Left-right sorting</button>
            </div>
            <button type="button" class="cw-chip cw-chip--variant" :class="{ 'is-active': lSeriesOnly }" :aria-pressed="lSeriesOnly" @click="lSeriesOnly = !lSeriesOnly">
              L-series only
            </button>
          </div>

          <p v-if="pending" class="cw-state">Loading models…</p>

          <div v-else-if="error" class="cw-state cw-state--error" role="alert">
            <p class="cw-state__title">The model list could not be loaded.</p>
            <p class="cw-state__body">This is a temporary problem on our side. Your filters are kept.</p>
            <button type="button" class="cw-clear" @click="refresh()">Try again</button>
          </div>

          <div v-else-if="!visible.length" class="cw-state">
            <p class="cw-state__title">No models match these filters.</p>
            <button type="button" class="cw-clear" @click="clearFilters">Clear filters</button>
          </div>

          <ul v-else class="cw-grid" role="list">
            <li v-for="p in visible" :key="p.slug">
              <NuxtLink :to="localePath(`/products/checkweighers/${p.slug}`)" class="cw-card">
                <div class="cw-card__media">
                  <img v-if="p.heroMedia?.url" :src="p.heroMedia.url" alt="" loading="lazy" decoding="async">
                </div>
                <div class="cw-card__body">
                  <p class="cw-card__model">{{ p.modelSeries }}</p>
                  <h3 class="cw-card__title">{{ loc(p.name) }}</h3>
                  <p class="cw-card__summary">{{ loc(p.summary) }}</p>
                  <p class="cw-card__tags">
                    <span v-if="p.checkweigherConfiguration === 'left-right'">Left-right sorting</span>
                    <span v-else>Online weighing</span>
                    <span v-if="p.checkweigherLSeries">L-series</span>
                  </p>
                  <span class="cw-card__link">View model →</span>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </template>

        <!-- 7. Bottom help -->
        <div class="cw-help">
          <p class="cw-help__text">Not sure which series fits your line?</p>
          <NuxtLink :to="localePath(enquiryPath)" class="cw-help__link">Talk through your application →</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}

/* Hero */
.cw-hero { background: #F2F6EF; border-bottom: 1px solid #DAE3DD; padding-block: var(--space-6) 37px; }
.cw-hero__inner {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 80px;
  align-items: start;
}
.cw-hero__title {
  margin: var(--space-4) 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, 62px);
  line-height: 1.08;
  color: var(--color-ink);
}
.cw-hero__intro {
  margin: 0;
  max-width: 620px;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}
.cw-hero__aside { padding: var(--space-5); border: 1px solid #D5DFD4; border-radius: 6px; background: #fff; }
.cw-hero__aside-label { margin: 0 0 var(--space-3); font-size: var(--text-xs); letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-ink-muted); }
.cw-hero__aside ul { list-style: none; margin: 0; padding: 0; }
.cw-hero__aside li { padding: var(--space-2) 0; border-bottom: 1px solid #E3EBE4; font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }
.cw-hero__aside li:last-child { border-bottom: 0; }
.cw-hero__aside li span { display: block; font-weight: 600; color: var(--color-ink); }

/* Series */
.cw-series { padding-block: 38px 34px; }
.cw-series__title { margin: 0 0 var(--space-4); font-family: var(--font-display); font-size: 34px; color: var(--color-ink); }
.cw-series__row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
.cw-series__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 16px 15px 18px;
  border: 1px solid #D5DFD4;
  border-radius: 6px;
  background: #fff;
  text-align: start;
  font: inherit;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}
.cw-series__card.is-active { border: 2px solid var(--color-primary); background: #F3F7EF; padding: 15px 14px 17px; }
.cw-series__count { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--color-primary); }
.cw-series__symbol { color: var(--color-primary); height: 52px; display: flex; align-items: center; }
.cw-series__name { font-size: 20px; font-weight: 600; color: var(--color-ink); }
.cw-series__blurb { font-size: var(--text-xs); line-height: 1.5; color: var(--color-ink-muted); }
.cw-all {
  margin-top: var(--space-4);
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid #D5DFD4;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 16px;
  color: var(--color-ink);
  cursor: pointer;
}
.cw-all.is-active { border-color: var(--color-primary); background: #F3F7EF; color: var(--color-primary); }

/* Results */
.cw-results { background: #FAFBF7; padding-block: 39px 60px; }
.cw-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-4); }
.cw-head__title { margin: 0; font-family: var(--font-display); font-size: 38px; color: var(--color-ink); }
.cw-head__count { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--color-ink-muted); }
.cw-search { display: flex; flex-direction: column; gap: 4px; width: 310px; }
.cw-search__label { font-size: var(--text-xs); color: var(--color-ink-muted); }
.cw-search input {
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid #D7E0D5;
  border-radius: 4px;
  font: inherit;
  font-size: 18px;
  color: var(--color-ink);
  background: #fff;
}

.cw-filters { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-bottom: var(--space-6); }
.cw-filters__group { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.cw-chip {
  min-height: 41px;
  padding: 8px 13px;
  border: 1px solid #D5DFD4;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 15px;
  color: var(--color-ink);
  cursor: pointer;
}
.cw-chip.is-active { border-color: var(--color-primary); background: #E9F1E5; color: var(--color-primary); }
.cw-chip--variant { margin-inline-start: auto; }

.cw-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.cw-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #D7E0D5;
  border-radius: 6px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.cw-card:hover { border-color: var(--color-primary); box-shadow: 0 4px 16px rgba(27, 66, 36, 0.08); }
.cw-card__media { padding: 20px 25px; background: #fff; }
.cw-card__media img { display: block; width: 100%; height: 245px; object-fit: contain; }
.cw-card__body { display: flex; flex-direction: column; gap: var(--space-2); padding: 23px 25px 26px; flex: 1; }
.cw-card__model { margin: 0; font-size: 15px; letter-spacing: 0.04em; color: var(--color-ink-muted); }
.cw-card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 29px;
  line-height: 1.2;
  color: var(--color-ink);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cw-card__summary {
  margin: 0;
  font-size: 20px;
  line-height: 1.6;
  color: var(--color-ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cw-card__tags { display: flex; flex-wrap: wrap; gap: 6px; margin: auto 0 0; }
.cw-card__tags span {
  padding: 3px 9px;
  border-radius: 999px;
  background: #F2F6EF;
  font-size: 12px;
  color: var(--color-ink-muted);
}
.cw-card__link { font-size: 18px; color: var(--color-link-on-light); }

.cw-state { padding: var(--space-8) 0; text-align: center; color: var(--color-ink-muted); }
.cw-state__title { margin: 0 0 var(--space-3); font-size: var(--text-base); }
.cw-state--error { border: 1px solid #E5B4A0; background: #FDF0EA; border-radius: 6px; padding: var(--space-6); }
.cw-state--error .cw-state__title { color: #8A3A1A; font-weight: 600; }
.cw-state__body { margin: 0 0 var(--space-3); font-size: var(--text-sm); color: #8A3A1A; }
.cw-clear {
  padding: 10px 18px;
  border: 1px solid #D5DFD4;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
}

/* Pharmaceutical */
.cw-pharma {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.35fr);
  border: 1px solid #D7E0D5;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}
.cw-pharma__side { display: grid; place-items: center; padding: var(--space-8); background: #EEF4E9; }
.cw-pharma__symbol { color: var(--color-primary); }
.cw-pharma__body { padding: 40px 45px; }
.cw-pharma__title { margin: 0 0 var(--space-4); font-family: var(--font-display); font-size: 37px; line-height: 1.15; color: var(--color-ink); }
.cw-pharma__text { margin: 0 0 var(--space-5); font-size: 21px; line-height: 1.6; color: var(--color-ink-muted); }
.cw-pharma__list { list-style: none; margin: 0 0 var(--space-6); padding: 0; }
.cw-pharma__list li { padding: var(--space-3) 0; border-bottom: 1px solid #E3EBE4; font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }
.cw-pharma__list li span { display: block; font-weight: 600; color: var(--color-ink); }

.cw-cta {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #203C32;
  font-size: var(--text-base);
  font-weight: 600;
  text-decoration: none;
}

/* Bottom help */
.cw-help {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-10);
  padding: var(--space-5);
  border: 1px solid #D7E0D5;
  border-radius: 6px;
  background: #fff;
}
.cw-help__text { margin: 0; font-size: var(--text-base); color: var(--color-ink); }
.cw-help__link { font-size: var(--text-sm); color: var(--color-link-on-light); text-decoration: none; }
.cw-help__link:hover { text-decoration: underline; }

@media (max-width: 1023px) {
  .cw-hero__inner { grid-template-columns: minmax(0, 1fr); gap: 23px; }
  .cw-series__row {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    padding-bottom: var(--space-2);
    scrollbar-width: none;
  }
  .cw-series__row::-webkit-scrollbar { display: none; }
  .cw-series__card { flex: 0 0 156px; scroll-snap-align: start; }
  .cw-search { width: 100%; }
  .cw-grid { grid-template-columns: minmax(0, 1fr); gap: 22px; }
  .cw-pharma { grid-template-columns: minmax(0, 1fr); }
  .cw-chip--variant { margin-inline-start: 0; }
}

@media (max-width: 700px) {
  .cw-hero { padding-block: var(--space-4) 28px; }
  .cw-hero__title { font-size: 46px; }
  .cw-series { padding-block: 30px 27px; }
  .cw-series__title { font-size: 29px; }
  .cw-results { padding-block: 30px 40px; }
  .cw-head__title { font-size: 34px; }
  .cw-card__media img { height: 255px; }
  .cw-card__body { padding: 25px; }
  .cw-pharma__body { padding: 27px; }
  .cw-pharma__title { font-size: 33px; }
  .cw-pharma__text { font-size: 22px; }
}

@media (prefers-reduced-motion: reduce) {
  .cw-series__card, .cw-card { transition: none; }
}

@media (max-width: 380px) {
  /* The design lowers the display heading again at 320px; without this the longest word meets the
     right edge of the viewport. */
  .cw-hero__title { font-size: 40px; }
}

</style>
