<script setup lang="ts">
interface NavLink { label: string; to: string }
interface NavSection { title: string; items: NavLink[]; cta?: NavLink }
interface NavItem {
  id: string
  label: string
  to: string
  menuType: string
  sections: NavSection[]
  cta?: NavLink
  featured?: { title: string; to: string }
  promo?: { title: string; body: string; cta: NavLink }
}

defineProps<{
  item: NavItem
  isOpen: boolean
}>()

const { t } = useI18n()
const emit = defineEmits<{ close: []; hover: []; leave: [] }>()

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Transition name="mega-menu">
    <div
      v-if="isOpen"
      class="mega-menu"
      role="region"
      @keydown="handleKeydown"
      @mouseenter="emit('hover')"
      @mouseleave="emit('leave')"
    >
      <div class="mega-menu__inner container">

        <!-- ── Products: 3 text columns + image ─── -->
        <template v-if="item.menuType === 'products'">
          <div class="mega-menu__cols mega-menu__cols--products">
            <div v-for="section in item.sections" :key="section.title" class="mega-menu__col">
              <p class="mega-menu__col-heading">{{ section.title }}</p>
              <ul class="mega-menu__list" role="list">
                <li v-for="link in section.items" :key="link.to">
                  <NuxtLink :to="link.to" class="mega-menu__link" @click="emit('close')">
                    <span class="mega-menu__link-arrow" aria-hidden="true">›</span>
                    {{ link.label }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <!-- Photo column -->
            <div class="mega-menu__photo-col" aria-hidden="true">
              <div class="mega-menu__photo-area" />
            </div>
          </div>
          <div class="mega-menu__footer">
            <NuxtLink v-if="item.cta" :to="item.cta.to" class="mega-menu__circle-cta" @click="emit('close')">
              <span>{{ item.cta.label }}</span>
              <span class="mega-menu__circle-arrow" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2" />
                  <path d="M5.5 8h5M8 5.5l2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </NuxtLink>
          </div>
        </template>

        <!-- ── Applications: horizontal cards ───── -->
        <template v-else-if="item.menuType === 'applications'">
          <div class="mega-menu__app-cards">
            <NuxtLink
              v-for="card in item.sections[0]?.items"
              :key="card.to"
              :to="card.to"
              class="mega-menu__app-card"
              @click="emit('close')"
            >
              <div class="mega-menu__app-card-photo">
                <!-- Same mapping as /applications: category name is real text, so the art is decorative.
                     Eager, not lazy: the cards scroll horizontally, so a lazy image would stay blank
                     until it was scrolled into view. Eight files of ~30–50 KB make eager safe. -->
                <img
                  :src="applicationArtPath(applicationSlugFromPath(card.to))"
                  alt=""
                  width="800"
                  height="600"
                  loading="eager"
                >
              </div>
              <div class="mega-menu__app-card-body">
                <span class="mega-menu__app-card-label">{{ card.label }}</span>
                <span class="mega-menu__app-card-view" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2" />
                    <path d="M5.5 8h5M8 5.5l2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
              </div>
            </NuxtLink>
          </div>
          <div class="mega-menu__footer">
            <NuxtLink v-if="item.cta" :to="item.cta.to" class="mega-menu__circle-cta" @click="emit('close')">
              <span>{{ item.cta.label }}</span>
              <span class="mega-menu__circle-arrow" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2" />
                  <path d="M5.5 8h5M8 5.5l2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </NuxtLink>
          </div>
        </template>

        <!-- ── Resources: links + featured ───────── -->
        <template v-else-if="item.menuType === 'resources'">
          <div class="mega-menu__cols mega-menu__cols--2">
            <div class="mega-menu__col">
              <p class="mega-menu__col-heading">{{ item.sections[0]?.title }}</p>
              <ul class="mega-menu__list" role="list">
                <li v-for="link in item.sections[0]?.items" :key="link.to">
                  <NuxtLink :to="link.to" class="mega-menu__link" @click="emit('close')">
                    <span class="mega-menu__link-arrow" aria-hidden="true">›</span>
                    {{ link.label }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <div class="mega-menu__featured-col">
              <p class="mega-menu__col-heading">{{ t('nav_resources.featuredHeading') }}</p>
              <div class="mega-menu__featured-photo" aria-hidden="true" />
              <p class="mega-menu__featured-title">{{ item.featured?.title }}</p>
              <NuxtLink v-if="item.featured" :to="item.featured.to" class="mega-menu__text-cta" @click="emit('close')">
                {{ t('nav_resources.readArticle') }} →
              </NuxtLink>
            </div>
          </div>
        </template>

        <!-- ── Support: 2 column groups ──────────── -->
        <template v-else-if="item.menuType === 'support'">
          <div class="mega-menu__cols mega-menu__cols--2">
            <div v-for="section in item.sections" :key="section.title" class="mega-menu__col">
              <p class="mega-menu__col-heading">{{ section.title }}</p>
              <ul class="mega-menu__list" role="list">
                <li v-for="link in section.items" :key="link.to">
                  <NuxtLink :to="link.to" class="mega-menu__link" @click="emit('close')">
                    <span class="mega-menu__link-arrow" aria-hidden="true">›</span>
                    {{ link.label }}
                  </NuxtLink>
                </li>
              </ul>
              <NuxtLink v-if="section.cta" :to="section.cta.to" class="mega-menu__circle-cta mega-menu__circle-cta--sm" style="margin-top: var(--space-4);" @click="emit('close')">
                <span>{{ section.cta.label }}</span>
                <span class="mega-menu__circle-arrow" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2" />
                    <path d="M5.5 8h5M8 5.5l2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
              </NuxtLink>
            </div>
          </div>
        </template>

        <!-- ── Company: links + promo ─────────────── -->
        <template v-else-if="item.menuType === 'company'">
          <div class="mega-menu__cols mega-menu__cols--2">
            <div class="mega-menu__col">
              <p class="mega-menu__col-heading">{{ item.sections[0]?.title }}</p>
              <ul class="mega-menu__list" role="list">
                <li v-for="link in item.sections[0]?.items" :key="link.to">
                  <NuxtLink :to="link.to" class="mega-menu__link" @click="emit('close')">
                    <span class="mega-menu__link-arrow" aria-hidden="true">›</span>
                    {{ link.label }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <div class="mega-menu__promo-col">
              <div class="mega-menu__promo-photo" aria-hidden="true" />
              <p class="mega-menu__promo-title">{{ item.promo?.title }}</p>
              <p class="mega-menu__promo-body">{{ item.promo?.body }}</p>
              <NuxtLink v-if="item.promo?.cta" :to="item.promo.cta.to" class="mega-menu__text-cta" @click="emit('close')">
                {{ item.promo.cta.label }} →
              </NuxtLink>
            </div>
          </div>
        </template>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.mega-menu {
  position: fixed;
  top: var(--header-height);
  left: 0;
  right: 0;
  z-index: 95;
  background-color: #fff;
  border-top: 2px solid var(--color-accent);
  box-shadow: var(--shadow-menu);
  padding: var(--space-8) 0 var(--space-6);
}

.mega-menu__inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* ── Column grids ──────────────────────────────── */
.mega-menu__cols {
  display: grid;
  gap: var(--space-10);
}

.mega-menu__cols--products {
  grid-template-columns: 1fr 1fr 1fr 200px;
}

.mega-menu__cols--2 {
  grid-template-columns: 1fr 1.4fr;
}

/* ── Column heading ──────────────────────────────── */
.mega-menu__col-heading {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-ink-muted);
  margin-bottom: var(--space-4);
}

/* ── Link list ─────────────────────────────────── */
.mega-menu__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mega-menu__link {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: 5px 0;
  font-size: var(--text-sm);
  color: var(--color-ink);
  transition: color var(--transition-fast);
  text-decoration: none;
}

.mega-menu__link:hover {
  color: var(--color-primary);
}

.mega-menu__link-arrow {
  color: var(--color-accent);
  font-size: calc(1rem * var(--type-scale));
  line-height: 1;
  flex-shrink: 0;
}

/* ── Photo placeholder areas ─────────────────── */
.mega-menu__photo-col {
  display: flex;
  align-items: stretch;
}

.mega-menu__photo-area {
  width: 100%;
  min-height: 160px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

/* ── Applications cards ───────────────────────── */
.mega-menu__app-cards {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding-bottom: var(--space-2);
  scrollbar-width: thin;
}

.mega-menu__app-card {
  flex: 0 0 150px;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-line);
  transition: box-shadow var(--transition-fast);
}

.mega-menu__app-card:hover {
  box-shadow: 0 4px 16px rgba(27, 66, 36, 0.12);
}

.mega-menu__app-card-photo {
  height: 96px;
  /* Cool white ground from the 冷绿光 spec; the artwork itself carries the pale green light. */
  background: #F2F8F4;
  display: grid;
  place-items: center;
  overflow: hidden;
}

/* Contain, never cover: the illustration must show its whole subject inside the fixed height. */
.mega-menu__app-card-photo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.mega-menu__app-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--color-white);
}

.mega-menu__app-card-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-ink);
}

.mega-menu__app-card-view {
  color: var(--color-accent);
}

/* ── Resources featured col ───────────────────── */
.mega-menu__featured-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-left: var(--space-8);
  border-left: 1px solid var(--color-line);
}

.mega-menu__featured-photo {
  height: 120px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.mega-menu__featured-title {
  font-family: var(--font-display);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  line-height: var(--leading-snug);
}

/* ── Company promo col ────────────────────────── */
.mega-menu__promo-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-left: var(--space-8);
  border-left: 1px solid var(--color-line);
}

.mega-menu__promo-photo {
  height: 120px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.mega-menu__promo-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-ink);
  line-height: var(--leading-snug);
}

.mega-menu__promo-body {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}

/* ── Footer CTA row ───────────────────────────── */
.mega-menu__footer {
  display: flex;
  align-items: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.mega-menu__circle-cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.mega-menu__circle-cta:hover {
  color: var(--color-accent);
}

.mega-menu__circle-cta--sm {
  font-size: var(--text-xs);
}

.mega-menu__circle-arrow {
  display: flex;
  align-items: center;
  color: var(--color-accent);
}

.mega-menu__text-cta {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.mega-menu__text-cta:hover {
  color: var(--color-accent);
}

/* ── Transition ───────────────────────────────── */
/* Kept instant on purpose: a fading overlay could be captured mid-transition
   and read as a see-through menu. The panel is always fully opaque. */
.mega-menu-enter-active,
.mega-menu-leave-active {
  transition: none;
}

.mega-menu-enter-from,
.mega-menu-leave-to {
  opacity: 1;
  transform: none;
}
</style>
