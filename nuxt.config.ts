import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { readdirSync } from 'node:fs'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — the PDF engine is imported by absolute
 * path inside a worker thread (`server/utils/pdfExtractionWorker.ts`), which
 * the bundler's dependency tracer cannot see. Without this the package is
 * simply absent from `.output/server/node_modules` and PDF extraction fails
 * in production only — verified by building and inspecting the output, not
 * assumed. Resolved here so a rename or version bump fails the build loudly
 * instead of silently dropping the dependency.
 *
 * `pdf.worker.mjs` must be listed too. pdf.js loads it at runtime through its
 * own dynamic import when setting up the Node "fake worker", so tracing
 * `pdf.mjs` alone produced a build that failed with "Setting up fake worker
 * failed: Cannot find module …/pdf.worker.mjs" — caught by running a real
 * parse against the built output on Node 20, not by inspection.
 */
const pdfjsLegacyEntry = createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.mjs')
const pdfjsLegacyWorker = join(dirname(pdfjsLegacyEntry), 'pdf.worker.mjs')
/**
 * Standard font data is plain data, loaded from disk by path at parse time.
 * Without it pdf.js falls back to built-in metrics and logs a warning on every
 * PDF that references a standard font; the extraction still succeeds, but the
 * production build should behave the same as development.
 */
const pdfjsStandardFontsDir = join(dirname(dirname(dirname(pdfjsLegacyEntry))), 'standard_fonts')
// The tracer takes files, not directories, so the font files are listed individually.
const pdfjsStandardFonts = readdirSync(pdfjsStandardFontsDir).map(name => join(pdfjsStandardFontsDir, name))

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
    externals: {
      traceInclude: [pdfjsLegacyEntry, pdfjsLegacyWorker, ...pdfjsStandardFonts],
    },
  },
})
