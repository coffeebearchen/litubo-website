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
    ],
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
    contactEmail: process.env.CONTACT_EMAIL ?? 'info@litubo.com',
    salesEmail: process.env.SALES_EMAIL ?? 'sales@litubo.com',
    smtpHost: process.env.SMTP_HOST ?? '',
    smtpPort: process.env.SMTP_PORT ?? '587',
    smtpUser: process.env.SMTP_USER ?? '',
    smtpPass: process.env.SMTP_PASS ?? '',
    smtpFrom: process.env.SMTP_FROM ?? 'noreply@litubo.com',
    // Inquiry security — server-side only
    submissionIpSecret: process.env.SUBMISSION_IP_SECRET ?? '',
    privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION ?? '1.0',
    // CMS adapter — server-side only, not exposed to the browser.
    // Populated when CMS_MODE=directus; ignored when CMS_MODE=fixtures (default).
    directusUrl: process.env.DIRECTUS_URL ?? '',
    directusToken: process.env.DIRECTUS_TOKEN ?? '',
    cmsMode: process.env.CMS_MODE ?? 'fixtures',
    // Products-only CMS switch — independent of cmsMode so Home/Posts stay on fixtures.
    // Set CMS_MODE_PRODUCTS=directus (plus DIRECTUS_URL and DIRECTUS_TOKEN) to enable.
    productsCmsMode: process.env.CMS_MODE_PRODUCTS ?? 'fixtures',
    // HubSpot Contact sync (Phase 7A framework — Phase 7B configures token)
    hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN ?? '',
    // Override API base for local mock testing only; always https://api.hubapi.com in production
    hubspotApiBase: process.env.HUBSPOT_API_BASE_URL ?? '',
    // AI provider registry (PWS-AI-PLATFORM-01 + PWS-AI-PROVIDER-02) — server-side only,
    // never runtimeConfig.public. *_API_KEY values are secrets (local/deployment .env only);
    // *_MODEL values are non-secret and configurable — no model name is ever hardcoded in
    // application code. All empty by default: each provider's isConfigured() fails closed
    // until an operator sets both of its values in their own .env. AI_DEFAULT_PROVIDER picks
    // which already-configured provider a future Generate call defaults to — 'deepseek' unless
    // explicitly set to 'openai' (validated server-side by parseAiProviderId(), never trusted raw).
    aiDefaultProvider: process.env.AI_DEFAULT_PROVIDER ?? 'deepseek',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? '',
    deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
    deepseekModel: process.env.DEEPSEEK_MODEL ?? '',
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://litubo.com',
      publishedLocales: ['en'],
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
    // PWS-AI-ENGINE-01: pdf-parse's bundled pdf.js build and xlsx's Node
    // codepage fallback both contain `require(...)` text that Rollup's
    // production bundler cannot safely inline (pdf-parse's is a template-
    // string specifier it cannot statically resolve). Externalizing both
    // makes Nitro `require()` them directly from node_modules at runtime
    // instead. This covers the production (`nuxt build`) Rollup bundle.
    externals: {
      external: ['pdf-parse', 'xlsx'],
    },
  },

  // `nitro.externals` only affects the production Rollup build — `nuxt dev`
  // runs server code through Vite's own SSR dev pipeline. Vite's dependency
  // pre-bundler (esbuild) uses a fast text scan (not a full parse) to find
  // `require`/`import` calls, including inside comments — xlsx.mjs has one
  // (`/*:: = require('fs'); */`, a dead Flow-type comment) that this scan
  // still picks up, and pdf-parse's dynamic pdf.js loader hits the same
  // class of problem. Both crashed every SSR route in this project's real
  // dev server (not just an AI route) until excluded here; `ssr.external`
  // additionally stops Vite from trying to transform them as ESM.
  vite: {
    optimizeDeps: {
      exclude: ['pdf-parse', 'xlsx'],
    },
    ssr: {
      external: ['pdf-parse', 'xlsx'],
    },
  },
})
