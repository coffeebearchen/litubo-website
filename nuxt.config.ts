export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },

  modules: [
    '@nuxtjs/i18n',
    '@nuxt/eslint',
  ],

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  css: [
    '@/assets/css/tokens.css',
    '@/assets/css/base.css',
    '@/assets/css/admin-tokens.css',
  ],

  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    lazy: true,
    restructureDir: false,
    langDir: 'i18n',
    locales: [
      { code: 'en', name: 'English', file: 'en.json', language: 'en-US' },
      { code: 'es', name: 'Español', file: 'es.json', language: 'es' },
      { code: 'pt', name: 'Português', file: 'pt.json', language: 'pt' },
      { code: 'zh', name: '简体中文', file: 'zh.json', language: 'zh-Hans' },
      { code: 'ar', name: 'العربية', file: 'ar.json', language: 'ar', dir: 'rtl' },
      { code: 'ja', name: '日本語', file: 'ja.json', language: 'ja' },
      { code: 'ru', name: 'Русский', file: 'ru.json', language: 'ru' },
    ],
    /**
     * A locale that is not translated yet must not render raw keys: vue-i18n falls back to
     * `defaultLocale` (English) while the locale stays outside `publishedLocales`, so the public
     * site still answers 404 for it.
     */
    detectBrowserLanguage: false,
    bundle: {
      optimizeTranslationDirective: false,
    },
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://litubo.com',
  },

  app: {
    head: {
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,300;1,8..60,400&family=Inter:wght@300;400;500;600;700&display=swap',
        },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { charset: 'utf-8' },
      ],
    },
  },

  runtimeConfig: {
    // Server secrets are deliberately NOT declared anywhere in runtimeConfig (D-039). It is evaluated
    // whenever this file is loaded — `nuxt build` included — and serialized into .output, so a secret
    // declared here would be baked into the build artifact. The running server reads DIRECTUS_TOKEN,
    // SMTP_PASS, SUBMISSION_IP_SECRET, HUBSPOT_ACCESS_TOKEN, OPENAI_API_KEY and DEEPSEEK_API_KEY from its
    // own process environment instead: server/utils/directusServiceToken.ts and
    // server/utils/serverSecrets.ts (FINAL-RELEASE-PRODUCTION-READY-01C / 01D). Every value declared
    // below is non-secret configuration.
    contactEmail: process.env.CONTACT_EMAIL ?? 'info@litubo.com',
    salesEmail: process.env.SALES_EMAIL ?? 'sales@litubo.com',
    smtpHost: process.env.SMTP_HOST ?? '',
    smtpPort: process.env.SMTP_PORT ?? '587',
    // The SMTP account name identifies the mailbox; it is not a credential. Its password is SMTP_PASS.
    smtpUser: process.env.SMTP_USER ?? '',
    smtpFrom: process.env.SMTP_FROM ?? 'noreply@litubo.com',
    privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION ?? '1.0',
    // CMS adapter — server-side only, not exposed to the browser.
    // Populated when CMS_MODE=directus; ignored when CMS_MODE=fixtures (default).
    directusUrl: process.env.DIRECTUS_URL ?? '',
    // The Directus service token is deliberately NOT declared here (FINAL-RELEASE-PRODUCTION-READY-01C).
    // runtimeConfig is evaluated whenever this file is loaded — `nuxt build` included — and
    // serialized into .output, so a token declared here is baked into the build artifact. The
    // running server reads DIRECTUS_TOKEN from its own process environment instead:
    // server/utils/directusServiceToken.ts.
    cmsMode: process.env.CMS_MODE ?? 'fixtures',
    // Products-only CMS switch — independent of cmsMode so Home/Posts stay on fixtures.
    // Set CMS_MODE_PRODUCTS=directus (plus DIRECTUS_URL, and DIRECTUS_TOKEN in the running
    // server's environment) to enable.
    productsCmsMode: process.env.CMS_MODE_PRODUCTS ?? 'fixtures',
    // HubSpot Contact sync (Phase 7A framework — Phase 7B configures token). The token itself,
    // HUBSPOT_ACCESS_TOKEN, is runtime-only (see the note at the top of runtimeConfig).
    // Override API base for local mock testing only; always https://api.hubapi.com in production
    hubspotApiBase: process.env.HUBSPOT_API_BASE_URL ?? '',
    // AI provider registry (PWS-AI-PLATFORM-01 + PWS-AI-PROVIDER-02) — server-side only,
    // never runtimeConfig.public. The API keys, OPENAI_API_KEY and DEEPSEEK_API_KEY, are secrets and
    // runtime-only (see the note at the top of runtimeConfig); *_MODEL values are non-secret and
    // configurable — no model name is ever hardcoded in application code. All empty by default:
    // each provider's isConfigured() fails closed until both its key and its model are set.
    // AI_DEFAULT_PROVIDER picks which already-configured provider a future Generate call defaults
    // to — 'deepseek' unless explicitly set to 'openai' (validated server-side by
    // parseAiProviderId(), never trusted raw).
    aiDefaultProvider: process.env.AI_DEFAULT_PROVIDER ?? 'deepseek',
    openaiModel: process.env.OPENAI_MODEL ?? '',
    deepseekModel: process.env.DEEPSEEK_MODEL ?? '',
    // Public visitor assistant release gate. It remains off unless explicitly enabled at runtime;
    // a configured provider alone never makes a paid public endpoint available.
    visitorAiEnabled: process.env.VISITOR_AI_ENABLED ?? 'false',
    // AI-PDF-SOURCE-01 — where the server reaches the document-extractor sidecar that
    // reads text-layer PDFs. Server-side only, never runtimeConfig.public: the browser
    // never talks to it. Not a secret. The default is the loopback port docker-compose.yml
    // publishes for a host-process Nuxt; a containerized Nuxt would use
    // http://document-extractor:8787.
    documentExtractorUrl: process.env.DOCUMENT_EXTRACTOR_URL ?? 'http://127.0.0.1:8787',
    // FINAL-RELEASE-FIX-F — Product AI "Apply to Draft" release gate. Not a secret.
    // Apply writes a batch as separate Directus REST calls and cannot be made
    // all-or-nothing without a redesign, so production runs it only when this is
    // exactly "true"; missing, empty or any other value keeps it closed there.
    // Outside production it is on unless explicitly set to "false".
    productAiApplyEnabled: process.env.PRODUCT_AI_APPLY_ENABLED ?? '',
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://litubo.com',
      /**
       * Locales the public site actually publishes. Only these are indexable and only these resolve
       * for a visitor — the locale gate answers 404 for everything else.
       */
      publishedLocales: ['en'],
      /**
       * Locales that may be opened in a development build so a translation draft can be reviewed.
       * Empty in production, so a preview locale can never be reached on the live site; publishing a
       * locale stays a deliberate edit to `publishedLocales` after review.
       */
      previewLocales: process.env.NODE_ENV === 'production' ? [] : ['es', 'pt', 'zh', 'ar', 'ja', 'ru'],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  eslint: {
    config: {
      stylistic: false,
    },
  },

  nitro: {
    compressPublicAssets: true,
  },
})
