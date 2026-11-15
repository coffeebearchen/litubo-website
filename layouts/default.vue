<script setup lang="ts">
const { locale } = useI18n()
useHead(computed(() => ({ htmlAttrs: { lang: locale.value } })))
</script>

<template>
  <div class="layout">
    <SiteHeader />
    <CategoryStrip class="cat-strip-offset" />
    <main class="page-content">
      <slot />
    </main>
    <SiteFooter />
    <MobileConversionBar />
    <VisitorAssistant />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page-content {
  flex: 1;
  padding-top: 0;
}

/* The fixed header (72px) is followed by the category strip in normal flow. */
.cat-strip-offset {
  margin-top: var(--header-height);
}
</style>
