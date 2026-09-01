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
          <address class="site-footer__contact">
            <p>{{ t('footer.address') }}</p>
            <p>
              <a :href="contact.phoneHref">{{ contact.phone }}</a>
            </p>
            <p>
              <a :href="`mailto:${contact.email}`">{{ contact.email }}</a>
            </p>
            <p>WhatsApp: <a :href="contact.whatsappHref" target="_blank" rel="noopener noreferrer">{{ contact.whatsapp }}</a></p>
          </address>
        </div>

        <!-- Company column -->
        <nav class="site-footer__col" aria-label="Company pages">
          <p class="site-footer__col-title">{{ t('footer.links_company') }}</p>
          <ul role="list">
            <li><NuxtLink :to="localePath('/company/about')">{{ t('nav_company.about') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/company/quality-manufacturing')">{{ t('nav_company.quality') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/company/global-service')">{{ t('nav_company.globalService') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/company/become-a-partner')">{{ t('nav_company.partner') }}</NuxtLink></li>
          </ul>
        </nav>

        <!-- Support column -->
        <nav class="site-footer__col" aria-label="Support pages">
          <p class="site-footer__col-title">{{ t('footer.links_support') }}</p>
          <ul role="list">
            <li><NuxtLink :to="localePath('/support')">{{ t('nav_support.overview') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/support/faq')">{{ t('nav_support.faq') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/support/request-spare-parts')">{{ t('nav_support.spareParts') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/support/send-product-test')">{{ t('nav_support.productTest') }}</NuxtLink></li>
          </ul>
        </nav>

        <!-- Resources column -->
        <nav class="site-footer__col" aria-label="Resource pages">
          <p class="site-footer__col-title">{{ t('nav_resources.heading') }}</p>
          <ul role="list">
            <li><NuxtLink :to="localePath('/resources')">{{ t('nav_resources.insights') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/resources')">{{ t('nav_resources.caseStudies') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/resources/downloads')">{{ t('nav_resources.downloads') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/resources/videos')">{{ t('nav_resources.videos') }}</NuxtLink></li>
          </ul>
        </nav>
      </div>

      <!-- Newsletter note -->
      <div class="container site-footer__newsletter">
        <p class="site-footer__newsletter-note">{{ t('footer.newsletter') }}</p>
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
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: var(--space-10);
}

/* Brand column */
.site-footer__logo {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-white);
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}

.site-footer__tagline {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: var(--space-6);
}

.site-footer__contact {
  font-style: normal;
  font-size: var(--text-sm);
  line-height: 1.9;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.site-footer__contact a {
  color: rgba(255, 255, 255, 0.7);
  transition: color var(--transition-fast);
}

.site-footer__contact a:hover {
  color: var(--color-accent);
}

/* Nav columns */
.site-footer__col-title {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: var(--space-4);
}

.site-footer__col ul {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.site-footer__col a {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.7);
  transition: color var(--transition-fast);
}

.site-footer__col a:hover {
  color: var(--color-white);
}

/* Newsletter note */
.site-footer__newsletter {
  margin-top: var(--space-10);
  padding-top: var(--space-6);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.site-footer__newsletter-note {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.45);
  max-width: 480px;
}

/* Bottom bar */
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

.site-footer__legal-name {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.35);
}

.site-footer__copyright {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.35);
  flex: 1;
}

.site-footer__legal-links {
  display: flex;
  gap: var(--space-5);
}

.site-footer__legal-links a {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.45);
  transition: color var(--transition-fast);
}

.site-footer__legal-links a:hover {
  color: var(--color-white);
}

/* Responsive */
@media (max-width: 1023px) {
  .site-footer__grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-8);
  }

  .site-footer__brand {
    grid-column: 1 / -1;
  }
}

@media (max-width: 767px) {
  .site-footer__grid {
    grid-template-columns: 1fr;
  }

  .site-footer__bottom-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
}
</style>
