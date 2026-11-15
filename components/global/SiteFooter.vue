<script setup lang="ts">
import type { PublicSiteSettings } from '~/types/settings'

const { t } = useI18n()
const localePath = useLocalePath()
const year = new Date().getFullYear()

const FALLBACK: PublicSiteSettings = {
  brand_name: 'LITUBO',
  legal_company_name: 'Shanghai NingPin Industrial Dev. Co., Ltd.',
  public_email: 'sales@litubo.com',
  public_phone: '+86 21 5270 7913',
  public_whatsapp_url: 'https://wa.me/8619370713936',
  public_address: 'No. 23, Huangtu Rd., Huaqiao Town, Kunshan, Jiangsu Province, China',
  copyright_text: '© {year} LITUBO. All rights reserved.',
  social_links: [
    { platform: 'linkedin', url: 'https://www.linkedin.com/company/litubo', sort: 1 },
    { platform: 'youtube', url: 'https://www.youtube.com/@litubo', sort: 2 },
  ],
}

const SOCIAL_ICONS: Record<string, string> = {
  linkedin: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zm2-5a2 2 0 110 4 2 2 0 010-4z',
  youtube: 'M22.54 6.42a2.78 2.78 0 00-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 001.95-1.98A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02v-6.04L15.5 12l-5.75 3.02z',
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
}

const { data: siteSettings } = useFetch<PublicSiteSettings>('/api/cms/site-settings', {
  default: () => FALLBACK,
})

const phone = computed(() => siteSettings.value?.public_phone ?? FALLBACK.public_phone)
const phoneHref = computed(() => 'tel:' + phone.value.replace(/[\s\-().]/g, ''))
const email = computed(() => siteSettings.value?.public_email ?? FALLBACK.public_email)
const socialLinks = computed(() => siteSettings.value?.social_links ?? FALLBACK.social_links)
const legalName = computed(() => siteSettings.value?.legal_company_name || t('footer.legalName'))
const copyrightText = computed(() =>
  (siteSettings.value?.copyright_text || t('footer.copyright')).replace('{year}', String(year))
)

const productLinks = [
  { label: 'X-Ray Inspection', to: '/products/x-ray-inspection' },
  { label: 'Metal Detection', to: '/products/metal-detection' },
  { label: 'Checkweighers', to: '/products/checkweighers' },
  { label: 'Combination Inspection', to: '/products/combination-inspection' },
  { label: 'Conveyors & Reject Systems', to: '/products/conveyors-reject-systems' },
]

const applicationLinks = [
  { label: 'Packaged Food', to: '/applications/packaged-food' },
  { label: 'Bottled & Canned', to: '/applications/bottled-canned-products' },
  { label: 'Meat & Seafood', to: '/applications/meat-seafood' },
  { label: 'Frozen Food', to: '/applications/frozen-food' },
  { label: 'Bakery & Snacks', to: '/applications/bakery-snacks' },
  { label: 'Nuts, Seeds & Dried', to: '/applications/nuts-seeds-dried-food' },
  { label: 'Powder & Granules', to: '/applications/powder-granules' },
  { label: 'Pharma & Daily Chemical', to: '/applications/pharmaceutical-daily-chemical' },
]

const supportLinks = [
  { label: 'Support overview', to: '/support' },
  { label: 'Find a distributor', to: '/find-a-distributor' },
  { label: 'Request spare parts', to: '/support/request-spare-parts' },
  { label: 'Send product for test', to: '/support/send-product-test' },
  { label: 'FAQ', to: '/support/faq' },
]

const resourceLinks = [
  { label: 'LITUBO Insights', to: '/resources' },
  { label: 'Case Studies', to: '/resources' },
  { label: 'Downloads', to: '/resources/downloads' },
  { label: 'Videos', to: '/resources/videos' },
]

const companyLinks = [
  { label: 'About LITUBO', to: '/company/about' },
  { label: 'Quality & Manufacturing', to: '/company/quality-manufacturing' },
  { label: 'Global Service Capability', to: '/company/global-service' },
  { label: 'Become a Partner', to: '/company/become-a-partner' },
]
</script>

<template>
  <footer id="site-footer" class="site-footer" role="contentinfo">
    <div class="site-footer__main">
      <div class="container">

        <!-- Brand + contact -->
        <div class="site-footer__top">
          <div class="site-footer__brand">
            <p class="site-footer__logo">LITUBO</p>
            <p class="site-footer__tagline">{{ t('footer.tagline') }}</p>
            <p class="site-footer__description">{{ t('footer.description') }}</p>
          </div>

          <div class="site-footer__actions">
            <address class="site-footer__contact">
              <a :href="phoneHref" class="site-footer__contact-link">{{ phone }}</a>
              <a :href="`mailto:${email}`" class="site-footer__contact-link">{{ email }}</a>
              <span class="site-footer__address">Kunshan, Jiangsu Province, China</span>
            </address>
            <div class="site-footer__social" aria-label="Social media">
              <a
                v-for="link in socialLinks"
                :key="link.platform"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`LITUBO on ${link.platform}`"
              >
                <svg v-if="SOCIAL_ICONS[link.platform]" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path :d="SOCIAL_ICONS[link.platform]" />
                </svg>
              </a>
            </div>
            <NuxtLink :to="localePath('/contact')" class="site-footer__cta">
              {{ t('nav.contact') }}
              <span aria-hidden="true">→</span>
            </NuxtLink>
          </div>
        </div>

        <!-- Link columns -->
        <div class="site-footer__grid">
          <nav class="site-footer__col" aria-label="Products">
            <p class="site-footer__col-title">{{ t('footer.links_products') }}</p>
            <ul role="list">
              <li v-for="l in productLinks" :key="l.to"><NuxtLink :to="localePath(l.to)">{{ l.label }}</NuxtLink></li>
            </ul>
          </nav>

          <nav class="site-footer__col site-footer__col--apps" aria-label="Applications">
            <p class="site-footer__col-title">{{ t('footer.links_applications') }}</p>
            <ul role="list">
              <li v-for="l in applicationLinks" :key="l.to"><NuxtLink :to="localePath(l.to)">{{ l.label }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/applications')" class="site-footer__view-all">{{ t('nav_applications.viewAll') }}</NuxtLink></li>
            </ul>
          </nav>

          <nav class="site-footer__col" aria-label="Support">
            <p class="site-footer__col-title">{{ t('footer.links_support') }}</p>
            <ul role="list">
              <li v-for="l in supportLinks" :key="l.to"><NuxtLink :to="localePath(l.to)">{{ l.label }}</NuxtLink></li>
            </ul>
          </nav>

          <nav class="site-footer__col" aria-label="Resources">
            <p class="site-footer__col-title">{{ t('footer.links_resources') }}</p>
            <ul role="list">
              <li v-for="l in resourceLinks" :key="l.to + l.label"><NuxtLink :to="localePath(l.to)">{{ l.label }}</NuxtLink></li>
            </ul>
          </nav>

          <nav class="site-footer__col" aria-label="Company">
            <p class="site-footer__col-title">{{ t('footer.links_company') }}</p>
            <ul role="list">
              <li v-for="l in companyLinks" :key="l.to"><NuxtLink :to="localePath(l.to)">{{ l.label }}</NuxtLink></li>
            </ul>
          </nav>
        </div>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="site-footer__bottom">
      <div class="container site-footer__bottom-inner">
        <p class="site-footer__legal-name">{{ legalName }}</p>
        <p class="site-footer__copyright">{{ copyrightText }}</p>
        <nav class="site-footer__legal-links" aria-label="Legal">
          <NuxtLink :to="localePath('/privacy-policy')">{{ t('footer.privacy') }}</NuxtLink>
          <NuxtLink :to="localePath('/terms-of-use')">{{ t('footer.terms') }}</NuxtLink>
        </nav>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  background: var(--color-primary-deep);
  color: rgba(255, 255, 255, 0.72);
}

.site-footer__main {
  padding: var(--space-12) 0 var(--space-8);
}

/* ── Brand + contact ─────────────────────────────── */
.site-footer__top {
  display: flex;
  justify-content: space-between;
  gap: var(--space-10);
  padding-bottom: var(--space-8);
  margin-bottom: var(--space-8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  flex-wrap: wrap;
}

.site-footer__brand { max-width: 560px; }

.site-footer__logo {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-white);
  text-transform: uppercase;
  margin: 0 0 var(--space-2);
}

.site-footer__tagline {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-accent);
  margin: 0 0 var(--space-4);
}

.site-footer__description {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
}

.site-footer__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-4);
  text-align: right;
}

.site-footer__contact { display: flex; flex-direction: column; gap: var(--space-1); font-style: normal; }

.site-footer__contact-link {
  color: var(--color-white);
  text-decoration: none;
  font-size: var(--text-sm);
}
.site-footer__contact-link:hover { color: var(--color-accent); }

.site-footer__address { font-size: var(--text-xs); color: rgba(255, 255, 255, 0.55); }

.site-footer__social { display: flex; gap: var(--space-2); }

.site-footer__social a {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.8);
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.site-footer__social a:hover { color: var(--color-accent); border-color: var(--color-accent); }

.site-footer__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 18px;
  background: var(--color-accent);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.site-footer__cta:hover { background: var(--color-accent-hover); }

/* ── Link columns ────────────────────────────────── */
.site-footer__grid {
  display: grid;
  grid-template-columns: 1fr 1.9fr 1fr 1fr 1fr;
  gap: var(--space-8);
  align-items: start;
}

.site-footer__col-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 var(--space-4);
}

.site-footer__col ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Applications runs in two sub-columns so no single column doubles the footer height. */
.site-footer__col--apps ul {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px var(--space-5);
}
.site-footer__col--apps ul li:last-child { grid-column: 1 / -1; }

.site-footer__col a {
  display: inline-block;
  padding: 5px 0;
  font-size: 13.5px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.site-footer__col a:hover { color: var(--color-white); }

.site-footer__view-all { color: var(--color-accent) !important; font-weight: 600; }
.site-footer__view-all:hover { color: #fff !important; }

/* ── Bottom bar ──────────────────────────────────── */
.site-footer__bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding: var(--space-4) 0;
}

.site-footer__bottom-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.site-footer__legal-name,
.site-footer__copyright { margin: 0; }

.site-footer__legal-links { display: flex; gap: var(--space-4); }
.site-footer__legal-links a { color: rgba(255, 255, 255, 0.6); text-decoration: none; }
.site-footer__legal-links a:hover { color: var(--color-white); }

@media (max-width: 1100px) {
  .site-footer__grid { grid-template-columns: 1fr 1fr 1fr; gap: var(--space-6); }
  .site-footer__col--apps ul { grid-template-columns: 1fr; }
  .site-footer__col--apps ul li:last-child { grid-column: auto; }
}

@media (max-width: 720px) {
  .site-footer__top { flex-direction: column; }
  .site-footer__actions { align-items: flex-start; text-align: left; }
  .site-footer__grid { grid-template-columns: 1fr 1fr; }
}
</style>
