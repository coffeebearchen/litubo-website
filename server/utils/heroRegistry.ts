/**
 * V2-04 — the thirteen public pages whose hero can be overridden from the admin.
 *
 * The server owns this list: the admin sends a `page_key` and the server decides which
 * `site_content` row that means. A client cannot invent a page key, and adding a page means editing
 * this file, not the database.
 *
 * `contentKey` is the existing `site_content.content_key` value. Home already uses `home.hero` and
 * keeps it, along with its other eight home blocks. Every other key is a V2 suggestion.
 *
 * `defaults` is the copy the page renders today from its own component. It is what the public page
 * falls back to when the row is missing, empty, unpublished, or the CMS call fails — so a page is
 * never blank because nobody filled the form in.
 */
export interface HeroRegistryEntry {
  pageKey: string
  contentKey: string
  label: string
  path: string
  zone: 'Home' | 'Company' | 'Support' | 'Resources'
  /** Hero only, or the home page that also owns its existing blocks. */
  scope: 'Hero only' | 'Hero + existing home blocks'
  defaults: {
    eyebrow: string
    title: string
    body: string
    ctaPrimaryLabel: string
    ctaPrimaryPath: string
    ctaSecondaryLabel: string
    ctaSecondaryPath: string
  }
}

const HOME_DEFAULTS = {
  eyebrow: 'Food & packaging inspection',
  title: 'Built for safer production.',
  body: 'Reliable inspection systems and expert support help food and packaging producers deliver safe, high-quality products.',
  ctaPrimaryLabel: 'Explore solutions',
  ctaPrimaryPath: '/products',
  ctaSecondaryLabel: 'Talk to an engineer',
  ctaSecondaryPath: '/contact',
}

export const HERO_REGISTRY: HeroRegistryEntry[] = [
  {
    pageKey: 'home',
    contentKey: 'home.hero',
    label: 'Home',
    path: '/',
    zone: 'Home',
    scope: 'Hero + existing home blocks',
    defaults: HOME_DEFAULTS,
  },
  {
    pageKey: 'company.about',
    contentKey: 'company.about.hero',
    label: 'About LITUBO',
    path: '/company/about',
    zone: 'Company',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'About LITUBO',
      title: 'Food & packaging inspection solutions.',
      body: 'LITUBO builds inspection equipment for food and packaging producers: X-ray inspection, metal detection, checkweighing, combination inspection, and conveyors and reject systems.',
      ctaPrimaryLabel: 'Explore the equipment',
      ctaPrimaryPath: '/products',
      ctaSecondaryLabel: 'Talk to an engineer',
      ctaSecondaryPath: '/contact',
    },
  },
  {
    pageKey: 'company.quality-manufacturing',
    contentKey: 'company.quality-manufacturing.hero',
    label: 'Quality & Manufacturing',
    path: '/company/quality-manufacturing',
    zone: 'Company',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Quality & manufacturing',
      title: 'Clear requirements come before configuration.',
      body: 'A machine is confirmed against your product and your line, not selected from a catalogue.',
      ctaPrimaryLabel: 'Discuss your requirements',
      ctaPrimaryPath: '/technical-matching',
      ctaSecondaryLabel: 'Request documents',
      ctaSecondaryPath: '/resources/downloads',
    },
  },
  {
    pageKey: 'company.global-service',
    contentKey: 'company.global-service.hero',
    label: 'Global Service Capability',
    path: '/company/global-service',
    zone: 'Company',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Support · Global',
      title: 'Find the right route for your request.',
      body: 'Support starts with a clear request. Tell us the machine, where it runs and what you need.',
      ctaPrimaryLabel: 'Start a support request',
      ctaPrimaryPath: '/support',
      ctaSecondaryLabel: 'Not sure where to begin?',
      ctaSecondaryPath: '/contact',
    },
  },
  {
    pageKey: 'company.become-a-partner',
    contentKey: 'company.become-a-partner.hero',
    label: 'Become a Partner',
    path: '/company/become-a-partner',
    zone: 'Company',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Partnership',
      title: 'Introduce your company.',
      body: 'Introduce your market, your experience and what you have in mind.',
      ctaPrimaryLabel: 'Send a partnership enquiry',
      ctaPrimaryPath: '/company/become-a-partner',
      ctaSecondaryLabel: '',
      ctaSecondaryPath: '',
    },
  },
  {
    pageKey: 'support.technical-support',
    contentKey: 'support.technical-support.hero',
    label: 'Technical support',
    path: '/support/technical-support',
    zone: 'Support',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Support',
      title: 'Technical support.',
      body: 'Describe the machine and the issue. Include the model and serial number where you have them.',
      ctaPrimaryLabel: '',
      ctaPrimaryPath: '',
      ctaSecondaryLabel: '',
      ctaSecondaryPath: '',
    },
  },
  {
    pageKey: 'support.manual-request',
    contentKey: 'support.manual-request.hero',
    label: 'Manual request',
    path: '/support/manual-request',
    zone: 'Support',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Support',
      title: 'Request a manual.',
      body: 'Manuals are provided on request, because the correct document depends on the model.',
      ctaPrimaryLabel: 'Request a document',
      ctaPrimaryPath: '/resources/downloads',
      ctaSecondaryLabel: '',
      ctaSecondaryPath: '',
    },
  },
  {
    pageKey: 'support.service-training',
    contentKey: 'support.service-training.hero',
    label: 'Service & training',
    path: '/support/service-training',
    zone: 'Support',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Support · Service & training',
      title: 'Service & training.',
      body: 'Tell us what you need to resolve or learn. You do not need to diagnose the equipment before asking.',
      ctaPrimaryLabel: '',
      ctaPrimaryPath: '',
      ctaSecondaryLabel: '',
      ctaSecondaryPath: '',
    },
  },
  {
    pageKey: 'support.request-spare-parts',
    contentKey: 'support.request-spare-parts.hero',
    label: 'Request spare parts',
    path: '/support/request-spare-parts',
    zone: 'Support',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Support · Equipment & parts',
      title: 'Request spare parts.',
      body: 'Start with the equipment and the part you need.',
      ctaPrimaryLabel: '',
      ctaPrimaryPath: '',
      ctaSecondaryLabel: '',
      ctaSecondaryPath: '',
    },
  },
  {
    pageKey: 'support.send-product-test',
    contentKey: 'support.send-product-test.hero',
    label: 'Send product for test',
    path: '/support/send-product-test',
    zone: 'Support',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Support · Product test',
      title: 'Request a product test.',
      body: 'Describe the product and the question you want answered. The team confirms the arrangement before anything is sent.',
      ctaPrimaryLabel: '',
      ctaPrimaryPath: '',
      ctaSecondaryLabel: '',
      ctaSecondaryPath: '',
    },
  },
  {
    pageKey: 'resources.overview',
    contentKey: 'resources.overview.hero',
    label: 'Resources',
    path: '/resources',
    zone: 'Resources',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Resources',
      title: 'Practical ideas. A clearer conversation.',
      body: 'Technical articles, documents and demonstration enquiries, in one place.',
      ctaPrimaryLabel: '',
      ctaPrimaryPath: '',
      ctaSecondaryLabel: '',
      ctaSecondaryPath: '',
    },
  },
  {
    pageKey: 'resources.downloads',
    contentKey: 'resources.downloads.hero',
    label: 'Downloads',
    path: '/resources/downloads',
    zone: 'Resources',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Technical documents',
      title: 'The right information. A clearer next step.',
      body: 'Datasheets, manuals and drawings are provided on request, because the correct document depends on the model and the configuration you are discussing.',
      ctaPrimaryLabel: 'Request a document',
      ctaPrimaryPath: '/resources/downloads',
      ctaSecondaryLabel: '',
      ctaSecondaryPath: '',
    },
  },
  {
    pageKey: 'resources.videos',
    contentKey: 'resources.videos.hero',
    label: 'Videos & demonstrations',
    path: '/resources/videos',
    zone: 'Resources',
    scope: 'Hero only',
    defaults: {
      eyebrow: 'Videos & demonstrations',
      title: 'A closer look at your inspection line.',
      body: 'Start with the equipment and the questions that matter to your production line.',
      ctaPrimaryLabel: 'Explore the equipment',
      ctaPrimaryPath: '/products',
      ctaSecondaryLabel: 'Discuss a demonstration',
      ctaSecondaryPath: '/contact',
    },
  },
]

export function findHeroPage(pageKey: unknown): HeroRegistryEntry | null {
  if (typeof pageKey !== 'string') return null
  return HERO_REGISTRY.find(e => e.pageKey === pageKey) ?? null
}
