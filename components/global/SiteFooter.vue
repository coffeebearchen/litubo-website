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
</script>

<template>
  <footer class="site-footer" role="contentinfo">
    <div class="site-footer__main">
      <div class="container site-footer__grid">

        <!-- Brand column -->
        <div class="site-footer__brand">
          <p class="site-footer__logo">LITUBO</p>
          <p class="site-footer__tagline">{{ t('footer.tagline') }}</p>
          <p class="site-footer__description">{{ t('footer.description') }}</p>
          <address class="site-footer__contact">
            <p>
              <a :href="phoneHref">{{ phone }}</a>
            </p>
            <p>
              <a :href="`mailto:${email}`">{{ email }}</a>
            </p>
          </address>
          <!-- Social icons from CMS -->
          <div class="site-footer__social" aria-label="Social media">
            <a
              v-for="link in socialLinks"
              :key="link.platform"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="`LITUBO on ${link.platform}`"
            >
              <svg v-if="SOCIAL_ICONS[link.platform]" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path :d="SOCIAL_ICONS[link.platform]" />
              </svg>
            </a>
          </div>
        </div>

        <!-- Products column -->
        <nav class="site-footer__col" aria-label="Products">
          <p class="site-footer__col-title">{{ t('footer.links_products') }}</p>
          <ul role="list">
            <li><NuxtLink :to="localePath('/products/x-ray-inspection')">{{ t('nav_products.xray') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/products/metal-detection')">{{ t('nav_products.metal') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/products/checkweighers')">{{ t('nav_products.checkweighers') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/products/combination-inspection')">{{ t('nav_products.combination') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/products/conveyors-reject-systems')">{{ t('nav_products.conveyors') }}</NuxtLink></li>
          </ul>
        </nav>

        <!-- Applications column -->
        <nav class="site-footer__col" aria-label="Applications">
          <p class="site-footer__col-title">{{ t('footer.links_applications') }}</p>
          <ul role="list">
            <li><NuxtLink :to="localePath('/applications')">{{ t('nav_applications.packaged') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/applications')">{{ t('nav_applications.meat') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/applications')">{{ t('nav_applications.frozen') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/applications')">{{ t('nav_applications.bakery') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/applications')">{{ t('nav_applications.viewAll') }}</NuxtLink></li>
          </ul>
        </nav>

        <!-- Support column -->
        <nav class="site-footer__col" aria-label="Support">
          <p class="site-footer__col-title">{{ t('footer.links_support') }}</p>
          <ul role="list">
            <li><NuxtLink :to="localePath('/support')">{{ t('nav_support.overview') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/technical-matching')">{{ t('nav.findDistributor') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/support/request-spare-parts')">{{ t('nav_support.spareParts') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/support/send-product-test')">{{ t('nav_support.productTest') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/support/faq')">{{ t('nav_support.faq') }}</NuxtLink></li>
          </ul>
        </nav>

        <!-- Resources column -->
        <nav class="site-footer__col" aria-label="Resources">
          <p class="site-footer__col-title">{{ t('footer.links_resources') }}</p>
          <ul role="list">
            <li><NuxtLink :to="localePath('/resources')">{{ t('nav_resources.insights') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/resources')">{{ t('nav_resources.caseStudies') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/resources/downloads')">{{ t('nav_resources.downloads') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/resources/videos')">{{ t('nav_resources.videos') }}</NuxtLink></li>
          </ul>
        </nav>

        <!-- Company column -->
        <nav class="site-footer__col" aria-label="Company">
          <p class="site-footer__col-title">{{ t('footer.links_company') }}</p>
          <ul role="list">
            <li><NuxtLink :to="localePath('/company/about')">{{ t('nav_company.about') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/company/quality-manufacturing')">{{ t('nav_company.quality') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/company/global-service')">{{ t('nav_company.globalService') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/company/become-a-partner')">{{ t('nav_company.partner') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/contact')" class="site-footer__contact-cta">{{ t('nav.contact') }}</NuxtLink></li>
          </ul>
        </nav>

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
  color: rgba(255, 255, 255, 0.75);
}

.site-footer__main {
  padding: var(--space-16) 0 var(--space-10);
}

.site-footer__grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
  gap: var(--space-8);
}

/* ── Brand column ──────────────────────────────────── */
.site-footer__logo {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-white);
  text-transform: uppercase;
  margin-bottom: var(--space-2);
}

.site-footer__tagline {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: var(--space-4);
}

.site-footer__description {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.55);
  line-height: var(--leading-normal);
  margin-bottom: var(--space-5);
}

.site-footer__contact {
  font-style: normal;
  font-size: var(--text-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-5);
}

.site-footer__contact a {
  color: rgba(255, 255, 255, 0.6);
  transition: color var(--transition-fast);
}

.site-footer__contact a:hover {
  color: var(--color-accent);
}

/* ── Social ─────────────────────────────────────────── */
.site-footer__social {
  display: flex;
  gap: var(--space-3);
}

.site-footer__social a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.6);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.site-footer__social a:hover {
  background: var(--color-accent);
  color: var(--color-white);
}

/* ── Nav columns ─────────────────────────────────────── */
.site-footer__col-title {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: var(--space-4);
}

.site-footer__col ul {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.site-footer__col a {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.65);
  transition: color var(--transition-fast);
  text-decoration: none;
}

.site-footer__col a:hover {
  color: var(--color-white);
}

.site-footer__contact-cta {
  color: var(--color-accent) !important;
  font-weight: 600;
}

.site-footer__contact-cta:hover {
  color: #e88430 !important;
}

/* ── Bottom bar ──────────────────────────────────────── */
.site-footer__bottom {
  background: rgba(0, 0, 0, 0.2);
  padding: var(--space-4) 0;
}

.site-footer__bottom-inner {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.site-footer__legal-name,
.site-footer__copyright {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.3);
}

.site-footer__copyright {
  flex: 1;
}

.site-footer__legal-links {
  display: flex;
  gap: var(--space-5);
}

.site-footer__legal-links a {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.site-footer__legal-links a:hover {
  color: var(--color-white);
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 1279px) {
  .site-footer__grid {
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--space-8);
  }
  .site-footer__brand {
    grid-column: 1 / -1;
  }
}

@media (max-width: 767px) {
  .site-footer__grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
  .site-footer__brand {
    grid-column: 1 / -1;
  }
  .site-footer__bottom-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
}

@media (max-width: 479px) {
  .site-footer__grid {
    grid-template-columns: 1fr;
  }
}
</style>
