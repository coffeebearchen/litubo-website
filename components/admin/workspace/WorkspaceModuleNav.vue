<script setup lang="ts">
import { WORKSPACE_MODULE_GROUPS, WORKSPACE_MODULE_NAV } from '~/utils/productWorkspace'
import {
  workspaceOverviewRoute,
  workspacePageContentRoute,
  workspaceSourcesEvidenceRoute,
  workspaceSpecificationsRoute,
  workspaceMediaResourcesRoute,
} from '~/utils/productCentre'

const props = defineProps<{
  productId: number
  productName: string
  productCode: string | null
  productStatus: 'draft' | 'review' | 'published' | 'archived'
  productHeroUrl: string | null
  activeKey: string
}>()

/** Collapsed by default on narrow viewports; always expanded from 768px up. */
const navOpen = ref(false)

/** Only enabled modules need a route; disabled ones never navigate anywhere. */
const ENABLED_ROUTES: Record<string, (id: number) => string> = {
  overview: workspaceOverviewRoute,
  'page-content': workspacePageContentRoute,
  'sources-evidence': workspaceSourcesEvidenceRoute,
  specifications: workspaceSpecificationsRoute,
  'media-resources': workspaceMediaResourcesRoute,
}

function routeFor(key: string): string {
  return ENABLED_ROUTES[key]?.(props.productId) ?? ''
}
</script>

<template>
  <aside class="ws-nav" :class="{ 'ws-nav--open': navOpen }" aria-label="Product workspace navigation">
    <div class="ws-nav-titlebar">
      <p class="ws-nav-eyebrow">Product workspace</p>
      <button
        type="button"
        class="ws-nav-toggle"
        :aria-expanded="navOpen"
        aria-controls="workspace-module-nav"
        @click="navOpen = !navOpen"
      >
        {{ navOpen ? 'Hide' : 'Browse' }}
      </button>
    </div>

    <div class="ws-nav-identity">
      <div v-if="productHeroUrl" class="ws-nav-thumb">
        <img :src="productHeroUrl" :alt="productName" loading="lazy">
      </div>
      <div v-else class="ws-nav-thumb ws-nav-thumb--empty" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
      <p class="ws-nav-name">{{ productName }}</p>
      <p v-if="productCode" class="ws-nav-code">{{ productCode }}</p>
      <StatusBadge :status="productStatus" />
    </div>

    <div id="workspace-module-nav" class="ws-nav-content">
      <div v-for="group in WORKSPACE_MODULE_GROUPS" :key="group" class="ws-nav-section">
        <p class="ws-nav-heading">{{ group }}</p>
        <ul class="ws-nav-list" role="list">
          <li v-for="item in WORKSPACE_MODULE_NAV.filter(i => i.group === group)" :key="item.key">
            <button
              v-if="!item.enabled"
              type="button"
              class="ws-nav-item ws-nav-item--disabled"
              disabled
              :title="`${item.label} is not yet available`"
            >
              <WorkspaceNavIcon :module-key="item.key" />
              <span class="ws-nav-item-label">{{ item.label }}</span>
              <span class="ws-nav-item-note">Coming soon</span>
            </button>
            <span
              v-else-if="item.key === activeKey"
              class="ws-nav-item ws-nav-item--active"
              aria-current="page"
            >
              <WorkspaceNavIcon :module-key="item.key" />
              <span class="ws-nav-item-label">{{ item.label }}</span>
            </span>
            <NuxtLink
              v-else
              :to="routeFor(item.key)"
              class="ws-nav-item"
            >
              <WorkspaceNavIcon :module-key="item.key" />
              <span class="ws-nav-item-label">{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.ws-nav {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-line);
  background: var(--color-surface-alt);
  display: flex;
  flex-direction: column;
}

.ws-nav-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) 0;
}

.ws-nav-eyebrow {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  margin: 0;
}

.ws-nav-identity {
  min-width: 0;
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-bottom: 1px solid var(--color-line);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.ws-nav-thumb {
  width: 100%;
  height: 84px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  overflow: hidden;
  flex-shrink: 0;
}

.ws-nav-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

.ws-nav-thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-ink-muted);
  opacity: 0.6;
}

.ws-nav-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
  overflow-wrap: anywhere;
}

.ws-nav-code {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  font-family: 'Courier New', monospace;
  margin: calc(-1 * var(--space-1)) 0 0;
}

/* Disclosure control exists only on narrow viewports. */
.ws-nav-toggle {
  display: none;
  flex-shrink: 0;
  min-height: 40px;
  padding: var(--space-1) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-primary);
  cursor: pointer;
}

.ws-nav-content {
  flex: 1;
  padding: var(--space-3) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ws-nav-heading {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-2) var(--space-1);
  margin: 0;
}

.ws-nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ws-nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--color-ink);
  text-align: left;
  cursor: default;
}

.ws-nav-item--active {
  background: rgba(15, 92, 75, 0.12);
  color: var(--color-primary);
  font-weight: 600;
}

.ws-nav-item--disabled {
  cursor: not-allowed;
  color: var(--color-ink-muted);
  opacity: 0.7;
}

.ws-nav-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws-nav-item-note {
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  padding: 1px 8px;
  flex-shrink: 0;
}

/* Rail column narrows before it ever stacks, matching the Product Catalogue rail. */
@media (max-width: 1279px) {
  .ws-nav { width: 190px; }
}

/* ── ≤767px: collapsible accordion so the module nav never squeezes the content ── */
@media (max-width: 767px) {
  .ws-nav {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-line);
  }

  .ws-nav-toggle { display: inline-flex; align-items: center; }

  .ws-nav-content { display: none; }

  .ws-nav--open .ws-nav-content { display: flex; }
}
</style>
