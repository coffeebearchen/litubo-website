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
      htmlAttrs: { lang: 'en' },
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
  },
})
