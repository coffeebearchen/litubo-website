<template>
  <div class="layout">
    <SiteHeader />
    <main class="page-content">
      <slot />
    </main>
    <SiteFooter />
    <MobileConversionBar />
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
}
</style>
