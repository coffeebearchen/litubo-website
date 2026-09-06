<script setup lang="ts">
import type { ProductStatus } from '~/types/product-cms'

defineProps<{ status: ProductStatus }>()

const label: Record<ProductStatus, string> = {
  draft: 'Draft',
  review: 'In Review',
  published: 'Published',
  archived: 'Archived',
}
</script>

<template>
  <span class="badge" :class="`badge--${status}`">{{ label[status] }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.badge--draft    { background: #E8EDE8; color: #4A5E58; }
.badge--review   { background: #FFF3CD; color: #856404; }
.badge--published{ background: #D1F0E8; color: #0F5C4B; }
.badge--archived { background: #F0EDED; color: #8B7070; }
</style>
