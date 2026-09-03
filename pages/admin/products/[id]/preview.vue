<script setup lang="ts">
import type { AdminProduct, ProductSection, ProductSectionItem, ProductSpecGroup, ProductSpecItem, ProductMedia, ProductFaq } from '~/types/product-cms'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)

// Auth check — redirect to login if session is missing
const authed = ref(false)
onMounted(async () => {
  try {
    await $fetch('/api/admin/auth/me')
    authed.value = true
  } catch {
    router.push('/admin/login')
  }
})

interface PreviewData {
  product: AdminProduct
  sections: (ProductSection & { items: ProductSectionItem[] })[]
  specGroups: (ProductSpecGroup & { items: ProductSpecItem[] })[]
  media: ProductMedia[]
  faqs: ProductFaq[]
}

const { data: preview, error } = await useFetch<PreviewData>(`/api/admin/products/${id}/preview-data`)

const openFaqs = ref<Set<number>>(new Set())
function toggleFaq(faqId: number) {
  if (openFaqs.value.has(faqId)) openFaqs.value.delete(faqId)
  else openFaqs.value.add(faqId)
}

const SAFE_NOTE = 'Internal test source — TEST ONLY, unverified, do not publish'
const LOCAL_PATH_RE = /private-product-source[\\/]|[A-Za-z]:[/\\]|(?:^|\s)\/[a-z]/i
function safeNote(raw: string | null | undefined): string | null {
  if (!raw) return null
  return LOCAL_PATH_RE.test(raw) ? SAFE_NOTE : raw
}

const imgMedia = computed(() => preview.value?.media.filter(m => {
  const id = m.directus_files_id
  return id && m.file_role !== 'brochure' && m.file_role !== 'datasheet' && m.file_role !== 'drawing' && m.file_role !== 'manual' && m.file_role !== 'certificate'
}) ?? [])

const docMedia = computed(() => preview.value?.media.filter(m =>
  ['brochure', 'datasheet', 'drawing', 'manual', 'certificate'].includes(m.file_role ?? '')
) ?? [])

function mediaUrl(
  fileId: string | null | undefined,
  opts: { w?: number; h?: number; fit?: string; fpx?: number | null; fpy?: number | null } = {},
) {
  if (!fileId) return ''
  const p = new URLSearchParams()
  if (opts.w) p.set('width', String(opts.w))
  if (opts.h) p.set('height', String(opts.h))
  if (opts.fit) p.set('fit', opts.fit)
  if (opts.fpx != null) p.set('focal_point_x', String(opts.fpx))
  if (opts.fpy != null) p.set('focal_point_y', String(opts.fpy))
  const qs = p.toString()
  return `/api/admin/media/${fileId}${qs ? '?' + qs : ''}`
}
</script>

<template>
  <div v-if="authed" class="preview-root">
    <!-- Fixed banner -->
    <div class="preview-banner" role="alert" aria-live="polite">
      <span class="preview-banner__icon">⚠</span>
      TEST ONLY — ADMIN PREVIEW &nbsp;|&nbsp; Status: {{ preview?.product?.status?.toUpperCase() ?? 'DRAFT' }} &nbsp;|&nbsp;
      Draft is not publicly visible
      <NuxtLink :to="`/admin/products/${id}`" class="preview-banner__back">← Back to Edit</NuxtLink>
    </div>

    <div v-if="error" class="preview-error">
      Failed to load preview data. <a :href="`/admin/products/${id}`">Back to edit</a>
    </div>

    <template v-else-if="preview">
      <!-- Hero -->
      <section class="pv-hero">
        <div class="pv-container">
          <p class="pv-hero__eyebrow">TEST ONLY — NOT FOR PUBLICATION</p>
          <h1 class="pv-hero__title">{{ preview.product.name_en }}</h1>
          <p v-if="preview.product.model_or_series" class="pv-hero__model">{{ preview.product.model_or_series }}</p>
          <p v-if="preview.product.summary_en" class="pv-hero__summary">{{ preview.product.summary_en }}</p>
          <div class="pv-hero__actions">
            <span class="pv-btn pv-btn--accent">Talk to an Engineer</span>
            <span class="pv-btn pv-btn--outline">Technical Matching</span>
          </div>
        </div>
        <div v-if="preview.product.hero_image" class="pv-hero__imgwrap">
          <img
            :src="mediaUrl(preview.product.hero_image, { w: 800, h: 500, fit: 'contain' })"
            :alt="preview.product.name_en"
            class="pv-hero__img"
            loading="eager"
          >
        </div>
      </section>

      <!-- Review note -->
      <div v-if="safeNote(preview.product.review_notes)" class="pv-review-note">
        <strong>Admin note:</strong> {{ safeNote(preview.product.review_notes) }}
      </div>

      <!-- Sections -->
      <template v-for="section in preview.sections" :key="section.id">
        <!-- Text sections -->
        <section v-if="section.type !== 'feature_list'" class="pv-section">
          <div class="pv-container">
            <h2 v-if="section.title_en" class="pv-section__title">{{ section.title_en }}</h2>
            <p v-if="section.body_en" class="pv-section__body">{{ section.body_en }}</p>
          </div>
        </section>

        <!-- Feature list section -->
        <section v-else class="pv-section pv-section--alt">
          <div class="pv-container">
            <h2 v-if="section.title_en" class="pv-section__title">{{ section.title_en }}</h2>
            <ul class="pv-features">
              <li v-for="item in section.items" :key="item.id" class="pv-feature-item">
                <strong class="pv-feature-item__label">{{ item.label_en }}</strong>
                <span v-if="item.body_en" class="pv-feature-item__body">{{ item.body_en }}</span>
              </li>
            </ul>
          </div>
        </section>
      </template>

      <!-- Spec groups -->
      <section v-if="preview.specGroups.length" class="pv-section pv-section--alt">
        <div class="pv-container">
          <h2 class="pv-section__title">Technical Specifications</h2>
          <template v-for="group in preview.specGroups" :key="group.id">
            <h3 class="pv-spec-group-title">{{ group.title_en }}</h3>
            <p v-if="group.description_en" class="pv-spec-group-desc">{{ group.description_en }}</p>
            <div class="pv-spec-table-wrap">
              <table class="pv-spec-table">
                <tbody>
                  <tr v-for="item in group.items" :key="item.id">
                    <th>{{ item.label_en }}</th>
                    <td>{{ item.value_en }}</td>
                    <td v-if="item.note_en" class="pv-spec-note">{{ item.note_en }}</td>
                    <td v-else />
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </section>

      <!-- Media gallery (images only) -->
      <section v-if="imgMedia.length" class="pv-section">
        <div class="pv-container">
          <h2 class="pv-section__title">Product Images</h2>
          <div class="pv-gallery">
            <figure v-for="m in imgMedia" :key="m.id" class="pv-gallery__item">
              <img
                :src="mediaUrl(m.directus_files_id, { w: 600, h: 450, fit: 'contain' })"
                :alt="m.caption_en ?? ''"
                class="pv-gallery__img"
                loading="lazy"
              >
              <figcaption v-if="m.caption_en" class="pv-gallery__cap">{{ m.caption_en }}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <!-- Downloads section -->
      <section class="pv-section pv-section--alt">
        <div class="pv-container">
          <h2 class="pv-section__title">Downloads</h2>
          <template v-if="docMedia.length">
            <ul class="pv-downloads">
              <li v-for="m in docMedia" :key="m.id" class="pv-downloads__item">
                <span class="pv-downloads__icon">↓</span>
                <span>{{ m.caption_en ?? m.file_role }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="pv-empty">No downloads have been added to this product.</p>
        </div>
      </section>

      <!-- FAQ -->
      <section v-if="preview.faqs.length" class="pv-section">
        <div class="pv-container">
          <h2 class="pv-section__title">Frequently Asked Questions</h2>
          <div class="pv-faq">
            <div
              v-for="faq in preview.faqs"
              :key="faq.id"
              class="pv-faq__item"
              :class="{ 'pv-faq__item--open': openFaqs.has(faq.id) }"
            >
              <button :aria-expanded="openFaqs.has(faq.id)" class="pv-faq__q" @click="toggleFaq(faq.id)">
                <span>{{ faq.question_en }}</span>
                <span class="pv-faq__icon" aria-hidden="true">{{ openFaqs.has(faq.id) ? '−' : '+' }}</span>
              </button>
              <div v-show="openFaqs.has(faq.id)" class="pv-faq__a">
                <p>{{ faq.answer_en }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="pv-cta">
        <div class="pv-container">
          <h2 class="pv-cta__title">Ready to Inspect with Confidence?</h2>
          <p class="pv-cta__sub">Talk to an engineer or find your nearest distributor.</p>
          <div class="pv-cta__actions">
            <span class="pv-btn pv-btn--accent">Talk to an Engineer</span>
            <span class="pv-btn pv-btn--outline-dark">WhatsApp</span>
            <span class="pv-btn pv-btn--outline-dark">Technical Matching</span>
          </div>
        </div>
      </section>

      <!-- Footer admin bar -->
      <div class="pv-footer-bar">
        <NuxtLink :to="`/admin/products/${id}`" class="pv-btn pv-btn--sm">← Edit Product</NuxtLink>
        <NuxtLink :to="`/admin/products/${id}/content`" class="pv-btn pv-btn--sm">Sections</NuxtLink>
        <NuxtLink :to="`/admin/products/${id}/specs`" class="pv-btn pv-btn--sm">Specs</NuxtLink>
        <NuxtLink :to="`/admin/products/${id}/media`" class="pv-btn pv-btn--sm">Media</NuxtLink>
        <NuxtLink :to="`/admin/products/${id}/faq`" class="pv-btn pv-btn--sm">FAQ</NuxtLink>
        <span class="pv-footer-bar__status">{{ preview.product.status }} · Last updated: {{ preview.product.date_updated?.slice(0, 10) }}</span>
      </div>
    </template>
  </div>

  <!-- Loading state (before auth check completes) -->
  <div v-else class="preview-loading">Verifying session…</div>
</template>

<style scoped>
* { box-sizing: border-box; }

.preview-root {
  min-height: 100vh;
  background: #f8f9fa;
  color: #1a1a2e;
  font-family: system-ui, -apple-system, sans-serif;
  padding-top: 52px; /* space for fixed banner */
}

.preview-loading {
  display: flex; align-items: center; justify-content: center;
  height: 100vh; font-size: 1rem; color: #666;
}

.preview-error {
  padding: 2rem; text-align: center; color: #c00;
}

/* Fixed warning banner */
.preview-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: #d97706; color: #fff;
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 1rem;
  font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.01em;
}
.preview-banner__icon { font-size: 1rem; }
.preview-banner__back {
  margin-left: auto; color: #fff; text-decoration: underline;
  font-weight: 400; font-size: 0.8125rem; white-space: nowrap;
}

.preview-review-note,
.pv-review-note {
  background: #fef3c7; border-left: 4px solid #d97706;
  padding: 0.75rem 1.25rem; font-size: 0.875rem; color: #92400e;
}

.pv-container {
  max-width: 1200px; margin: 0 auto; padding: 0 1.25rem;
  width: 100%;
}

/* Hero */
.pv-hero {
  background: #0d1b3e; color: #fff;
  padding: 3.5rem 1.25rem 2.5rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  align-items: start;
  max-width: 100%;
  overflow: hidden;
}
.pv-hero__eyebrow {
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em;
  color: #d97706; text-transform: uppercase; margin: 0 0 0.5rem;
}
.pv-hero__title {
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  font-weight: 700; line-height: 1.2; margin: 0 0 0.5rem;
}
.pv-hero__model {
  font-size: 0.875rem; color: rgba(255,255,255,0.6); margin: 0 0 1rem;
}
.pv-hero__summary {
  font-size: 1rem; color: rgba(255,255,255,0.8);
  max-width: 540px; line-height: 1.6; margin: 0 0 1.5rem;
}
.pv-hero__actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.pv-hero__imgwrap {
  width: min(320px, 38vw);
  flex-shrink: 0;
}
.pv-hero__img {
  width: 100%; height: 100%; object-fit: contain;
  max-height: 280px; display: block;
}

/* Buttons */
.pv-btn {
  display: inline-flex; align-items: center;
  padding: 0.5rem 1.25rem; border-radius: 4px; font-size: 0.875rem;
  font-weight: 600; cursor: default; text-decoration: none;
  border: 2px solid transparent; white-space: nowrap;
}
.pv-btn--accent { background: #d97706; color: #fff; border-color: #d97706; }
.pv-btn--outline { background: transparent; color: #fff; border-color: rgba(255,255,255,0.5); }
.pv-btn--outline-dark { background: transparent; color: #0d1b3e; border-color: #0d1b3e; }
.pv-btn--sm { padding: 0.3rem 0.75rem; font-size: 0.8125rem; cursor: pointer; }
.pv-btn--sm, a.pv-btn--sm { background: #1e293b; color: #fff; border-color: #1e293b; border-radius: 4px; text-decoration: none; }

/* Sections */
.pv-section { padding: 3rem 0; }
.pv-section--alt { background: #fff; }
.pv-section__title {
  font-size: 1.5rem; font-weight: 700; color: #0d1b3e;
  margin: 0 0 1rem;
}
.pv-section__body {
  font-size: 0.9375rem; color: #444; line-height: 1.7; max-width: 720px;
}

/* Features */
.pv-features {
  list-style: none; padding: 0; margin: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.pv-feature-item {
  background: #f1f5f9; border-radius: 6px; padding: 1rem;
}
.pv-feature-item__label { display: block; font-weight: 600; color: #0d1b3e; margin-bottom: 0.25rem; }
.pv-feature-item__body { font-size: 0.875rem; color: #555; line-height: 1.5; }

/* Spec table */
.pv-spec-group-title {
  font-size: 1.125rem; font-weight: 600; color: #0d1b3e;
  margin: 1.5rem 0 0.25rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.25rem;
}
.pv-spec-group-desc { font-size: 0.8125rem; color: #e97316; margin: 0 0 0.75rem; }
.pv-spec-table-wrap { overflow-x: auto; margin-bottom: 1rem; }
.pv-spec-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.pv-spec-table th, .pv-spec-table td { padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; text-align: left; }
.pv-spec-table th { width: 35%; background: #f8fafc; font-weight: 600; color: #1a1a2e; }
.pv-spec-table td { color: #444; }
.pv-spec-note { color: #d97706; font-style: italic; font-size: 0.8125rem; }

/* Gallery */
.pv-gallery {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem; margin-top: 1rem;
}
.pv-gallery__item { margin: 0; }
.pv-gallery__img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 4px; display: block; background: #e2e8f0; }
.pv-gallery__cap { font-size: 0.75rem; color: #666; margin-top: 0.25rem; }

/* Downloads */
.pv-downloads { list-style: none; padding: 0; margin: 0; }
.pv-downloads__item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; }
.pv-downloads__icon { color: #0d1b3e; font-weight: 700; }
.pv-empty { color: #999; font-size: 0.875rem; font-style: italic; }

/* FAQ */
.pv-faq { max-width: 720px; }
.pv-faq__item { border-bottom: 1px solid #e2e8f0; }
.pv-faq__q {
  width: 100%; background: none; border: none; padding: 1rem 0; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  font-size: 0.9375rem; font-weight: 600; color: #0d1b3e; text-align: left;
}
.pv-faq__icon { font-size: 1.25rem; font-weight: 400; flex-shrink: 0; color: #d97706; }
.pv-faq__a { padding: 0 0 1rem; font-size: 0.875rem; color: #555; line-height: 1.7; }

/* CTA */
.pv-cta { background: #0d1b3e; color: #fff; padding: 3rem 1.25rem; text-align: center; }
.pv-cta .pv-container { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.pv-cta__title { font-size: 1.5rem; font-weight: 700; margin: 0; }
.pv-cta__sub { margin: 0; color: rgba(255,255,255,0.7); }
.pv-cta__actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }

/* Footer admin bar */
.pv-footer-bar {
  background: #1e293b; color: #fff; padding: 0.75rem 1.25rem;
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
}
.pv-footer-bar__status { margin-left: auto; font-size: 0.8125rem; color: #94a3b8; }

/* Responsive */
@media (max-width: 768px) {
  .pv-hero {
    grid-template-columns: 1fr;
    padding: 2rem 1rem 1.5rem;
  }
  .pv-hero__imgwrap {
    width: 100%; max-width: 280px; margin: 0 auto;
  }
  .pv-section { padding: 2rem 0; }
  .pv-cta { padding: 2rem 1rem; }
  .pv-gallery { grid-template-columns: repeat(2, 1fr); }
  .pv-features { grid-template-columns: 1fr; }
  .pv-footer-bar { gap: 0.375rem; }
  .pv-footer-bar__status { width: 100%; margin-left: 0; margin-top: 0.25rem; }
}
</style>
