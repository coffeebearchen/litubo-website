/**
 * DEMO FIXTURE DATA — NOT FOR PUBLIC / PRODUCTION USE.
 * These are structural placeholders only. Real product data must be
 * supplied, verified, and entered via the CMS before any public release.
 */

import type { ProductCategory, Product } from '~/types/content'

export const DEMO_PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'cat-xray',
    slug: 'x-ray-inspection',
    title: { en: 'X-Ray Inspection', es: 'Inspección de Rayos X', pt: 'Inspeção por Raios X' },
    intro: {
      en: 'TODO_CONTENT',
      es: 'TODO_TRANSLATION',
      pt: 'TODO_TRANSLATION',
    },
    heroMedia: {
      id: 'hero-xray',
      url: '/images/demo/placeholder-hero.jpg',
      alt: { en: '[DEMO] X-Ray Inspection systems', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
    },
    order: 1,
    seo: {
      title: { en: 'X-Ray Inspection Systems — LITUBO', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      description: { en: 'TODO_CONTENT', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      canonicalPath: '/products/x-ray-inspection',
    },
  },
  {
    id: 'cat-metal',
    slug: 'metal-detection',
    title: { en: 'Metal Detection', es: 'Detección de Metales', pt: 'Detecção de Metais' },
    intro: {
      en: 'TODO_CONTENT',
      es: 'TODO_TRANSLATION',
      pt: 'TODO_TRANSLATION',
    },
    heroMedia: {
      id: 'hero-metal',
      url: '/images/demo/placeholder-hero.jpg',
      alt: { en: '[DEMO] Metal Detection systems', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
    },
    order: 2,
    seo: {
      title: { en: 'Metal Detection Systems — LITUBO', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      description: { en: 'TODO_CONTENT', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      canonicalPath: '/products/metal-detection',
    },
  },
  {
    id: 'cat-check',
    slug: 'checkweighers',
    title: { en: 'Checkweighers', es: 'Comprobadores de Peso', pt: 'Verificadores de Peso' },
    intro: {
      en: 'TODO_CONTENT',
      es: 'TODO_TRANSLATION',
      pt: 'TODO_TRANSLATION',
    },
    heroMedia: {
      id: 'hero-check',
      url: '/images/demo/placeholder-hero.jpg',
      alt: { en: '[DEMO] Checkweigher systems', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
    },
    order: 3,
    seo: {
      title: { en: 'Checkweighers — LITUBO', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      description: { en: 'TODO_CONTENT', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      canonicalPath: '/products/checkweighers',
    },
  },
  {
    id: 'cat-combo',
    slug: 'combination-inspection',
    title: { en: 'Combination Inspection', es: 'Inspección Combinada', pt: 'Inspeção Combinada' },
    intro: {
      en: 'TODO_CONTENT',
      es: 'TODO_TRANSLATION',
      pt: 'TODO_TRANSLATION',
    },
    heroMedia: {
      id: 'hero-combo',
      url: '/images/demo/placeholder-hero.jpg',
      alt: { en: '[DEMO] Combination Inspection systems', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
    },
    order: 4,
    seo: {
      title: { en: 'Combination Inspection Systems — LITUBO', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      description: { en: 'TODO_CONTENT', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      canonicalPath: '/products/combination-inspection',
    },
  },
  {
    id: 'cat-convey',
    slug: 'conveyors-reject-systems',
    title: { en: 'Conveyors & Reject Systems', es: 'Transportadores y Rechazadores', pt: 'Transportadores e Sistemas de Rejeição' },
    intro: {
      en: 'TODO_CONTENT',
      es: 'TODO_TRANSLATION',
      pt: 'TODO_TRANSLATION',
    },
    heroMedia: {
      id: 'hero-convey',
      url: '/images/demo/placeholder-hero.jpg',
      alt: { en: '[DEMO] Conveyor and reject systems', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
    },
    order: 5,
    seo: {
      title: { en: 'Conveyors & Reject Systems — LITUBO', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      description: { en: 'TODO_CONTENT', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      canonicalPath: '/products/conveyors-reject-systems',
    },
  },
]

export const DEMO_PRODUCTS: Product[] = [
  {
    __DEMO_NOT_FOR_PUBLIC__: true,
    id: 'prod-xray-001',
    categoryId: 'cat-xray',
    slug: 'xr-demo-series',
    name: {
      en: '[DEMO] XR Series X-Ray Inspection System',
      es: 'TODO_TRANSLATION',
      pt: 'TODO_TRANSLATION',
    },
    summary: {
      en: 'TODO_CONTENT — placeholder product. Replace with real model data before publishing.',
      es: 'TODO_TRANSLATION',
      pt: 'TODO_TRANSLATION',
    },
    heroMedia: {
      id: 'hero-prod-xray-001',
      url: '/images/demo/placeholder-product.jpg',
      alt: { en: '[DEMO] XR Series', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
    },
    gallery: [],
    highlights: [],
    specifications: [],
    options: [],
    downloadIds: [],
    relatedProductIds: [],
    applicationSlugs: ['packaged-food', 'meat-seafood'],
    seo: {
      title: { en: '[DEMO] XR Series — LITUBO', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      description: { en: 'TODO_CONTENT', es: 'TODO_TRANSLATION', pt: 'TODO_TRANSLATION' },
      canonicalPath: '/products/x-ray-inspection/xr-demo-series',
    },
    status: 'draft',
  },
]
