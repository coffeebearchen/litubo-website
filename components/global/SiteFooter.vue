<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const year = new Date().getFullYear()
const contact = useContactInfo()
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
              <a :href="contact.phoneHref">{{ contact.phone }}</a>
            </p>
            <p>
              <a :href="`mailto:${contact.email}`">{{ contact.email }}</a>
            </p>
          </address>
          <!-- Social icons -->
          <div class="site-footer__social" aria-label="Social media">
            <a href="https://www.linkedin.com/company/litubo" target="_blank" rel="noopener noreferrer" aria-label="LITUBO on LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zm2-5a2 2 0 110 4 2 2 0 010-4z" />
              </svg>
            </a>
            <a href="https://www.youtube.com/@litubo" target="_blank" rel="noopener noreferrer" aria-label="LITUBO on YouTube">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 001.95-1.98A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02v-6.04L15.5 12l-5.75 3.02z" />
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
            <li><NuxtLink :to="localePath('/applications/packaged-food')">{{ t('nav_applications.packaged') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/applications/meat-seafood')">{{ t('nav_applications.meat') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/applications/frozen-food')">{{ t('nav_applications.frozen') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/applications/bakery-snacks')">{{ t('nav_applications.bakery') }}</NuxtLink></li>
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
        <p class="site-footer__legal-name">{{ t('footer.legalName') }}</p>
        <p class="site-footer__copyright">
          {{ t('footer.copyright').replace('{year}', String(year)) }}
        </p>
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
