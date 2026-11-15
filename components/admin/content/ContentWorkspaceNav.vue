<script setup lang="ts">
import { ref } from 'vue'
import type { ContentItemStatus } from '~/types/content-center'
import { CONTENT_CENTER_LIST_ROUTE, CONTENT_WORKSPACE_MODULES, contentWorkspaceModuleRoute } from '~/utils/contentCenter'

/**
 * CC-IMP-02 — Content Workspace module rail (CC-VIS-01 left rail, Freeze §10 order).
 * Mirrors the Product Workspace rail pattern: enabled modules navigate, every
 * future module is a visible disabled button that never links anywhere.
 */
const props = defineProps<{
  itemId: number
  title: string
  typeLabel: string
  status: ContentItemStatus
  activeKey: string
}>()

/** Collapsed by default on narrow viewports; always expanded from 768px up. */
const navOpen = ref(false)

function routeFor(key: string): string {
  return contentWorkspaceModuleRoute(key, props.itemId) ?? CONTENT_CENTER_LIST_ROUTE
}
</script>

<template>
  <aside class="cc-nav" :class="{ 'cc-nav--open': navOpen }" aria-label="Content workspace navigation">
    <div class="cc-nav-titlebar">
      <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-nav-back">← All content</NuxtLink>
      <button
        type="button"
        class="cc-nav-toggle"
        :aria-expanded="navOpen"
        aria-controls="content-workspace-module-nav"
        @click="navOpen = !navOpen"
      >
        {{ navOpen ? 'Hide modules' : 'Modules' }}
      </button>
    </div>

    <div class="cc-nav-identity">
      <p class="cc-nav-name">{{ title }}</p>
      <p class="cc-nav-type">{{ typeLabel }}</p>
      <StatusBadge :status="status" />
    </div>

    <div id="content-workspace-module-nav" class="cc-nav-content">
      <p class="cc-nav-heading">Content record</p>
      <ul class="cc-nav-list" role="list">
        <li v-for="item in CONTENT_WORKSPACE_MODULES" :key="item.key">
          <button
            v-if="!item.enabled"
            type="button"
            class="cc-nav-item cc-nav-item--disabled"
            disabled
            :title="`${item.label} is not yet available`"
          >
            <WorkspaceNavIcon :module-key="item.icon" />
            <span class="cc-nav-item-text">
              <span class="cc-nav-item-label">{{ item.label }}</span>
              <span class="cc-nav-item-note">{{ item.disabledReason ?? 'Not built yet' }}</span>
            </span>
          </button>
          <span
            v-else-if="item.key === activeKey"
            class="cc-nav-item cc-nav-item--active"
            aria-current="page"
          >
            <WorkspaceNavIcon :module-key="item.icon" />
            <span class="cc-nav-item-label">{{ item.label }}</span>
          </span>
          <NuxtLink v-else :to="routeFor(item.key)" class="cc-nav-item">
            <WorkspaceNavIcon :module-key="item.icon" />
            <span class="cc-nav-item-label">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.cc-nav {
  width: 220px;
  flex-shrink: 0;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cc-nav-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) 0;
}

.cc-nav-back {
  font-size: var(--text-xs);
  color: var(--color-primary);
  text-decoration: none;
}

.cc-nav-back:hover { text-decoration: underline; }

.cc-nav-identity {
  min-width: 0;
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-bottom: 1px solid var(--color-line);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.cc-nav-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
  overflow-wrap: anywhere;
}

.cc-nav-type {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-1);
}

/* Disclosure control exists only on narrow viewports. */
.cc-nav-toggle {
  display: none;
  flex-shrink: 0;
  align-items: center;
  min-height: 40px;
  padding: var(--space-1) var(--space-3) !important;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs) !important;
  color: var(--color-primary);
  cursor: pointer;
}

.cc-nav-content {
  flex: 1;
  padding: var(--space-3) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cc-nav-heading {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-2) var(--space-1);
  margin: 0;
}

.cc-nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cc-nav-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) var(--space-3) !important;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  font-size: var(--text-sm) !important;
  font-family: inherit;
  color: var(--color-ink);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.cc-nav-item-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cc-nav-item-label {
  display: block;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.3;
  padding-top: 2px;
}

.cc-nav-item-note {
  display: block;
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
  line-height: 1.3;
}

.cc-nav-item--active {
  background: rgba(47, 107, 58, 0.12);
  color: var(--color-primary);
  font-weight: 600;
  cursor: default;
}

.cc-nav-item--disabled {
  cursor: not-allowed;
  color: var(--color-ink-muted);
  opacity: 0.75;
}

@media (max-width: 1279px) {
  .cc-nav { width: 190px; }
}

/* ── ≤767px: collapsible module list so the rail never squeezes the content ── */
@media (max-width: 767px) {
  .cc-nav { width: 100%; }
  .cc-nav-toggle { display: inline-flex; }
  .cc-nav-content { display: none; }
  .cc-nav--open .cc-nav-content { display: flex; }
}
</style>
