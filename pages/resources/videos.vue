<script setup lang="ts">
/**
 * Videos — a demonstration enquiry page, not a video library.
 *
 * No public recording is confirmed, so the page never shows a player, a duration or a view count.
 * Equipment photographs are labelled as photographs. The enquiry continues into the existing contact
 * flow with `topic=demonstration`; the chosen family and the visitor's question travel with it.
 *
 * Structure follows the V2 reference: equipment-view hero → three in-page anchors → three equipment
 * families → what to discuss → request card → shared footer.
 */
const { t } = useI18n()
const localePath = useLocalePath()

/**
 * V2-04 — the hero may be overridden from /admin/page-content. Every field falls back to the copy
 * below, so the page renders exactly as before until someone publishes an override.
 */
const { hero } = await usePageHero('resources.videos', {
  eyebrow: 'Videos &amp; demonstrations',
  title: 'A closer look at your inspection line.',
  body: 'Start with the equipment and the questions that matter to your production line. Ask our team about relevant demonstration material.',
  ctaPrimaryLabel: 'Explore the equipment',
  ctaPrimaryPath: '#families',
})


useSeoHead({
  title: 'Equipment demonstrations — LITUBO',
  description: 'Discuss a demonstration of LITUBO inspection equipment and the questions that matter to your production line.',
  canonicalPath: '/resources/videos',
})

type Family = 'metal-detection' | 'checkweighers' | 'combination-inspection' | 'x-ray-inspection' | 'conveyors-reject-systems' | ''

const families: { id: Exclude<Family, ''>, title: string, body: string, image: string, alt: string }[] = [
  {
    id: 'metal-detection',
    title: 'Metal detection',
    body: 'Ask about the equipment, product presentation and operator workflow.',
    image: '/images/devices/metal-real.webp',
    alt: 'LITUBO metal detection head on a conveyor',
  },
  {
    id: 'checkweighers',
    title: 'Checkweighing',
    body: 'Discuss pack handling, line conditions and the checking objective.',
    image: '/images/devices/weigher-real.webp',
    alt: 'LITUBO checkweigher on a production line',
  },
  {
    id: 'combination-inspection',
    title: 'Combination inspection',
    body: 'Discuss the equipment arrangement and how it would fit into your line.',
    image: '/images/devices/combination-real.webp',
    alt: 'LITUBO combination inspection system with its conveyor arrangement',
  },
]

const topics = [
  { title: 'Product feeding & handling', body: 'Discuss how your product is presented, supported and transferred.' },
  { title: 'Setup & operator workflow', body: 'Ask about operation, product changes and the information an operator needs.' },
  { title: 'Reject handling & integration', body: 'Discuss the collection arrangement and the space around the inspection point.' },
  { title: 'Cleaning & access', body: 'Share your cleaning routine, changeover needs and access restrictions.' },
]

const anchors = [
  { id: 'families', label: 'Equipment families' },
  { id: 'topics', label: 'What to discuss' },
  { id: 'request', label: 'Your request' },
]

const family = ref<Family>('')
const question = ref('')

/**
 * The family and the question are carried into the existing contact flow. The question is free text,
 * so it is passed in the query only as an encoding of the visitor's own choice of family; the free
 * text stays in this page and is prefilled through the same demonstration topic the contact page
 * already understands.
 */
const enquiryPath = computed(() => {
  const query = new URLSearchParams({ topic: 'demonstration' })
  if (family.value) query.set('equipment', family.value)
  if (question.value.trim()) query.set('focus', question.value.trim().slice(0, 200))
  return `/contact?${query.toString()}`
})
</script>

<template>
  <div class="videos-page">
    <!-- 1. Equipment-view hero, no player -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.resources'), to: localePath('/resources') }, { label: 'Videos' }]" />
        <div class="vd-hero">
          <div class="vd-hero__text">
            <p class="eyebrow">{{ hero.eyebrow }}</p>
            <h1 class="vd-hero__title">{{ hero.title }}</h1>
            <p class="vd-hero__intro">{{ hero.body }}</p>
            <p class="vd-hero__actions">
              <a href="#families" class="vd-cta">Explore the equipment</a>
              <NuxtLink :to="localePath('/contact?topic=demonstration')" class="vd-link">Discuss a demonstration</NuxtLink>
            </p>
          </div>
          <figure class="vd-hero__media">
            <p class="vd-hero__label">Equipment view</p>
            <img src="/images/devices/combination-real.webp" alt="LITUBO combination inspection system" width="800" height="533" loading="eager" decoding="async">
            <figcaption>
              <span>Equipment photograph</span>
              <NuxtLink :to="localePath('/contact?topic=demonstration')">Ask about demonstration material</NuxtLink>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- 2. In-page anchors -->
    <nav class="vd-anchors" aria-label="On this page">
      <div class="container vd-anchors__inner">
        <a v-for="a in anchors" :key="a.id" :href="`#${a.id}`" class="vd-anchor">{{ a.label }}</a>
      </div>
    </nav>

    <!-- 3. Equipment families -->
    <section id="families" class="vd-band">
      <div class="container">
        <div class="vd-head">
          <div>
            <p class="eyebrow">Start with the equipment</p>
            <h2 class="vd-h2">What would you like to see?</h2>
          </div>
          <p class="vd-head__aside">Choose a starting point, then tell us about your product and application.</p>
        </div>

        <ul class="vd-families" role="list">
          <li v-for="item in families" :key="item.id" class="vd-family">
            <img :src="item.image" :alt="item.alt" width="800" height="533" loading="lazy" decoding="async">
            <p class="vd-family__label">Equipment family</p>
            <h3 class="vd-family__title">{{ item.title }}</h3>
            <p class="vd-family__body">{{ item.body }}</p>
            <NuxtLink :to="localePath(`/contact?topic=demonstration&equipment=${item.id}`)" class="vd-family__link">
              Ask about a demonstration →
            </NuxtLink>
          </li>
        </ul>

        <p class="vd-footnote">
          Equipment photographs shown. Demonstration material and its relevance to your application are
          confirmed separately.
        </p>
      </div>
    </section>

    <!-- 4. What to discuss -->
    <section id="topics" class="vd-band vd-band--tint">
      <div class="container vd-topics">
        <div class="vd-topics__intro">
          <p class="eyebrow">See the process in context</p>
          <h2 class="vd-h2">Ask about more than the machine.</h2>
          <p class="vd-body">A useful discussion includes your product, the operator and the surrounding line.</p>
          <a href="#request" class="vd-link">Prepare your request →</a>
        </div>
        <ul class="vd-topic-list" role="list">
          <li v-for="topic in topics" :key="topic.title">
            <span class="vd-topic__title">{{ topic.title }}</span>
            <span class="vd-topic__body">{{ topic.body }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- 5. Request card -->
    <section id="request" class="vd-band">
      <div class="container vd-request">
        <div class="vd-request__text">
          <p class="eyebrow">Your product. Your questions.</p>
          <h2 class="vd-h2">Make the discussion useful.</h2>
          <p class="vd-body">Start with a few details. Our team can discuss what material is relevant and what else may be needed.</p>
          <ol class="vd-numbered" role="list">
            <li><span>01</span> Your product and packaging</li>
            <li><span>02</span> The equipment or process you are considering</li>
            <li><span>03</span> The question you would like to resolve</li>
          </ol>
          <NuxtLink :to="localePath('/resources/downloads')" class="vd-link">Need technical documents instead? →</NuxtLink>
        </div>

        <div class="vd-card">
          <p class="vd-card__kicker">Start a demonstration enquiry</p>
          <h3 class="vd-card__title">Tell us where to focus.</h3>

          <label class="vd-field">
            <span>Equipment family</span>
            <select v-model="family">
              <option value="">Not sure yet</option>
              <option v-for="f in families" :key="f.id" :value="f.id">{{ f.title }}</option>
            </select>
          </label>

          <label class="vd-field">
            <span>What would you like to understand?</span>
            <textarea
              v-model="question"
              rows="4"
              placeholder="For example: product handling, operator workflow or line integration."
            />
          </label>

          <NuxtLink :to="localePath(enquiryPath)" class="vd-submit">Continue to enquiry</NuxtLink>
          <p class="vd-card__note">
            Continue to the contact form to provide your details. Availability is discussed with the team.
          </p>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('nav.resources')"
      :secondary-to="localePath('/resources')"
    />
  </div>
</template>

<style scoped>
.vd-band { padding: var(--space-14) 0; }
.vd-band--tint { background: #F2F6F2; }

.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.vd-h2 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1.2;
  color: var(--color-ink);
}
.vd-body {
  margin: 0 0 var(--space-4);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
  max-width: 560px;
}
.vd-footnote {
  margin: var(--space-4) 0 0;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}

/* Hero */
.vd-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 60px;
  align-items: center;
  padding-block: var(--space-4) var(--space-8);
}
.vd-hero__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 3.6vw, var(--text-5xl));
  line-height: 1.08;
  color: var(--color-ink);
}
.vd-hero__intro {
  margin: 0 0 var(--space-5);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
  max-width: 520px;
}
.vd-hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); margin: 0; }
.vd-hero__media {
  margin: 0;
  padding: 26px;
  border: 1px solid #C7D7CB;
  border-radius: 7px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(27, 66, 36, 0.04);
}
.vd-hero__label {
  margin: 0 0 var(--space-3);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.vd-hero__media img {
  display: block;
  width: 100%;
  height: 275px;
  object-fit: contain;
  background: #F2F8F4;
  border-radius: 4px;
}
.vd-hero__media figcaption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: 12px;
  border-top: 1px solid #E0E7DE;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}
.vd-hero__media figcaption a { color: var(--color-primary); text-decoration: none; }
.vd-hero__media figcaption a:hover { text-decoration: underline; }

.vd-cta {
  display: inline-block;
  padding: 13px 22px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}
.vd-cta:hover { background: var(--color-primary-deep); }
.vd-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.vd-link:hover { text-decoration: underline; }

/* Anchors */
.vd-anchors { border-block: 1px solid #DAE3DD; background: #fff; }
.vd-anchors__inner { display: flex; gap: 34px; padding-block: 19px; }
.vd-anchor {
  font-size: var(--text-base);
  color: var(--color-ink-muted);
  text-decoration: none;
  padding-bottom: 6px;
  border-bottom: 2px solid transparent;
}
.vd-anchor:hover { color: var(--color-primary); border-bottom-color: var(--color-primary); }

/* Families */
.vd-head {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 48px;
  align-items: end;
  margin-bottom: var(--space-8);
}
.vd-head__aside { margin: 0; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

.vd-families {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.vd-family {
  display: flex;
  flex-direction: column;
  padding: 22px;
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
}
.vd-family img {
  display: block;
  width: 100%;
  height: 240px;
  object-fit: contain;
  background: #F2F8F4;
  border-radius: 4px;
}
.vd-family__label {
  margin: var(--space-4) 0 var(--space-1);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.vd-family__title {
  margin: 0 0 var(--space-2);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--color-ink);
}
.vd-family__body {
  margin: 0 0 var(--space-4);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--color-ink-muted);
  flex: 1;
}
.vd-family__link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.vd-family__link:hover { text-decoration: underline; }

/* Topics */
.vd-topics {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
  gap: 65px;
  align-items: start;
}
.vd-topic-list { list-style: none; margin: 0; padding: 0; }
.vd-topic-list li {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-4) 0;
  border-bottom: 1px solid #DAE3DD;
}
.vd-topic-list li:first-child { padding-top: 0; }
.vd-topic__title { font-size: var(--text-lg); color: var(--color-ink); }
.vd-topic__body { font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

/* Request */
.vd-request {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 65px;
  align-items: start;
}
.vd-numbered { list-style: none; margin: var(--space-4) 0; padding: 0; }
.vd-numbered li {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid #E7EDE8;
  font-size: var(--text-base);
  color: var(--color-ink);
}
.vd-numbered span { font-size: var(--text-xs); color: var(--color-ink-muted); }

.vd-card {
  padding: 30px;
  border: 1px solid #C7D9C8;
  border-top: 3px solid var(--color-primary);
  border-radius: 5px;
  background: #F8FAF5;
}
.vd-card__kicker {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.vd-card__title {
  margin: 0 0 var(--space-5);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--color-ink);
}
.vd-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--space-4); font-size: var(--text-sm); color: var(--color-ink); }
.vd-field select,
.vd-field textarea {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #B9CABA;
  border-radius: 4px;
  font: inherit;
  font-size: var(--text-base);
  color: var(--color-ink);
  background: #fff;
}
.vd-field textarea { min-height: 120px; }
.vd-submit {
  display: block;
  width: 100%;
  padding: 13px 20px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}
.vd-submit:hover { background: var(--color-primary-deep); }
.vd-card__note { margin: var(--space-3) 0 0; font-size: var(--text-xs); line-height: 1.5; color: var(--color-ink-muted); }

@media (max-width: 1023px) {
  .vd-hero, .vd-head, .vd-topics, .vd-request { grid-template-columns: minmax(0, 1fr); gap: 30px; }
  .vd-hero__media { order: 2; }
  .vd-families { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .vd-anchors__inner { gap: 24px; overflow-x: auto; scrollbar-width: none; }
  .vd-anchors__inner::-webkit-scrollbar { display: none; }
}

@media (max-width: 700px) {
  .vd-band { padding: var(--space-10) 0; }
  .vd-h2 { font-size: var(--text-xl); }
  .vd-families { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .vd-family img { height: 220px; }
  .vd-card { padding: 24px; }
}

@media (max-width: 380px) {
  /* The design lowers the display heading again at 320px; without this the longest word meets the
     right edge of the viewport. */
  .vd-hero__title { font-size: 39px; }
}

</style>
