<script setup lang="ts">
import type { AdminProduct } from '~/types/product-cms'
import { WORKSPACE_READINESS_UNAVAILABLE, workspaceCategoryName, workspaceHeroUrl } from '~/utils/productWorkspace'
import { workspaceAiSourceIntakeRoute } from '~/utils/productCentre'

const props = defineProps<{
  product: AdminProduct
  categories: { id: number, name_en: string }[]
}>()

const categoryName = computed(() => workspaceCategoryName(props.product, props.categories))
const heroUrl = computed(() => workspaceHeroUrl(props.product))
const aiSourceIntakeHref = computed(() => workspaceAiSourceIntakeRoute(props.product.id))
</script>

<template>
  <div class="ws-overview">
    <section class="ws-card ws-card--identity" aria-labelledby="ws-identity-heading">
      <h2 id="ws-identity-heading" class="ws-card-title">Product identity</h2>
      <p class="ws-card-hint">Core information about this product.</p>

      <dl class="ws-field-list">
        <div class="ws-field">
          <dt>Product name</dt>
          <dd>{{ product.name_en }}</dd>
        </div>

        <div class="ws-field">
          <dt>Product code</dt>
          <dd :class="{ 'ws-field-muted': !product.product_code }">
            {{ product.product_code ?? 'Not set' }}
          </dd>
        </div>

        <div class="ws-field-row">
          <div class="ws-field">
            <dt>Model / series</dt>
            <dd :class="{ 'ws-field-muted': !product.model_or_series }">
              {{ product.model_or_series ?? 'Not set' }}
            </dd>
          </div>
          <div class="ws-field">
            <dt>Technical category</dt>
            <dd>{{ categoryName }}</dd>
          </div>
        </div>

        <div class="ws-field">
          <dt>Summary</dt>
          <dd :class="{ 'ws-field-muted': !product.summary_en }">
            {{ product.summary_en ?? 'Not set' }}
          </dd>
        </div>
      </dl>
    </section>

    <div class="ws-side">
      <section class="ws-card" aria-labelledby="ws-lifecycle-heading">
        <h2 id="ws-lifecycle-heading" class="ws-card-title">Lifecycle status</h2>
        <p class="ws-card-hint">Current state in the product lifecycle.</p>
        <StatusBadge :status="product.status" />
        <p v-if="product.status === 'archived'" class="ws-card-note">
          This product is archived. Use the existing product editor to restore it.
        </p>
        <p v-else class="ws-card-note">
          Read-only in this preview. Lifecycle changes remain in the existing product editor.
        </p>
        <button
          type="button"
          class="ws-btn-primary ws-btn-full"
          disabled
          title="Submit for review is disabled in this read-only preview — the readiness rule is not yet configured."
        >
          Submit for review
        </button>
        <p class="ws-card-footnote">Submit when the product information is ready for internal review.</p>
      </section>

      <section class="ws-card" aria-labelledby="ws-readiness-heading">
        <h2 id="ws-readiness-heading" class="ws-card-title">Readiness</h2>
        <p class="ws-card-hint">Content readiness for publishing.</p>
        <p class="ws-readiness-value">{{ WORKSPACE_READINESS_UNAVAILABLE }}</p>
      </section>

      <section class="ws-card ws-card--ai" aria-labelledby="ws-ai-heading">
        <h2 id="ws-ai-heading" class="ws-card-title">AI-assisted specifications</h2>
        <p class="ws-card-hint">
          Turn already-linked, readable text sources into draft specification suggestions you review and accept one at a time.
        </p>
        <NuxtLink :to="aiSourceIntakeHref" class="ws-btn-ai ws-btn-full">
          ✨ AI Fill Specifications
        </NuxtLink>
        <p class="ws-card-footnote">
          Only opens AI Source Intake to select sources — nothing is written or published from here.
        </p>
      </section>
    </div>

    <section class="ws-card ws-card--context" aria-labelledby="ws-context-heading">
      <h2 id="ws-context-heading" class="ws-card-title">Product context</h2>
      <p class="ws-card-hint">Key details at a glance.</p>

      <div v-if="heroUrl" class="ws-context-hero">
        <img :src="heroUrl" :alt="product.name_en" loading="lazy">
      </div>
      <div v-else class="ws-context-hero ws-context-hero--empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span class="ws-context-hero-note">No hero image linked</span>
      </div>

      <div class="ws-context-field">
        <span class="ws-context-label">Product category</span>
        <span class="ws-context-value">{{ categoryName }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ws-overview {
  display: grid;
  grid-template-columns: 1.4fr 1fr 320px;
  gap: var(--space-6);
  align-items: start;
}

.ws-side { display: flex; flex-direction: column; gap: var(--space-4); }

.ws-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.ws-card-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-1);
}

.ws-card-hint {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-4);
}

.ws-card-note {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  line-height: 1.5;
  margin: var(--space-3) 0 0;
}

.ws-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  border: 1px solid transparent;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
}

.ws-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ws-btn-full { width: 100%; margin-top: var(--space-4); box-sizing: border-box; }

.ws-card--ai { border-color: var(--color-primary); background: rgba(15, 92, 75, 0.04); }

.ws-btn-ai {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  border: 1px solid transparent;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  text-decoration: none;
}
.ws-btn-ai:hover { background: var(--color-primary-deep); }

.ws-card-footnote {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  line-height: 1.5;
  margin: var(--space-2) 0 0;
}

.ws-field-list { margin: 0; display: flex; flex-direction: column; gap: var(--space-4); }

.ws-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.ws-field dt {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-1);
}

.ws-field dd {
  font-size: var(--text-sm);
  color: var(--color-ink);
  margin: 0;
  overflow-wrap: anywhere;
}

.ws-field-muted { color: var(--color-ink-muted); font-style: italic; }

.ws-readiness-value {
  display: inline-block;
  font-size: var(--text-xs);
  font-weight: 500;
  color: #856404;
  background: #FFF3CD;
  border: 1px solid #F0E0A0;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}

.ws-context-hero {
  width: 100%;
  height: 140px;
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  overflow: hidden;
  margin-bottom: var(--space-4);
}

.ws-context-hero img { width: 100%; height: 100%; object-fit: cover; display: block; }

.ws-context-hero--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-style: dashed;
  color: var(--color-ink-muted);
}

.ws-context-hero-note { font-size: var(--text-xs); color: var(--color-ink-muted); }

.ws-context-field { display: flex; flex-direction: column; gap: var(--space-1); }

.ws-context-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}

.ws-context-value { font-size: var(--text-sm); color: var(--color-ink); }

/* ── ≤1023px: context column drops below the two-column main area ── */
@media (max-width: 1023px) {
  .ws-overview { grid-template-columns: 1fr 1fr; }
  .ws-card--context { grid-column: 1 / -1; }
}

/* ── ≤767px: single column; context stays after identity and lifecycle/readiness ── */
@media (max-width: 767px) {
  .ws-overview { grid-template-columns: 1fr; }
  .ws-card--context { grid-column: auto; }
}
</style>
