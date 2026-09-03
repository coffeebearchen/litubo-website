<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const router = useRouter()
onMounted(() => router.replace('/admin/products'))
</script>

<template>
  <div />
</template>
