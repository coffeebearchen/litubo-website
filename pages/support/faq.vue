<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useHead({ title: t('seo.faq.title'), meta: [{ name: 'description', content: t('seo.faq.description') }] })

const faqs = [
  { question: 'What is the difference between X-Ray inspection and metal detection?', answer: 'X-Ray inspection can detect a broader range of contaminants including bone, glass, dense plastic, rubber, and metal in all orientations and through various packaging types. Metal detection is highly sensitive to metallic contaminants and is often used where X-Ray is impractical due to foil or metallised film packaging.' },
  { question: 'How do I request a spare part?', answer: 'Use the Request Spare Parts form with your machine model and serial number. Our team will respond with availability and lead times.' },
  { question: 'Can LITUBO systems integrate with my existing production line?', answer: 'Yes. Contact our engineering team with your line layout and conveyor specifications. We will advise on integration options for your specific setup.' },
]
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.support'), to: localePath('/support') }, { label: t('nav_support.faq') }]" />
        <h1 class="page-hero__title">{{ t('pages.faq.heroTitle') }}</h1>
      </div>
    </section>
    <section class="section-gap">
      <div class="container faq-container">
        <Accordion v-for="faq in faqs" :key="faq.question" :title="faq.question">
          {{ faq.answer }}
        </Accordion>
        <p class="faq-more">Have a question not listed here? <NuxtLink :to="localePath('/contact')">Contact us</NuxtLink>.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }
.faq-container { max-width: 760px; }
.faq-more { margin-top: var(--space-8); font-size: var(--text-sm); color: var(--color-ink-muted); }
.faq-more a { color: var(--color-primary); text-decoration: underline; }
</style>
