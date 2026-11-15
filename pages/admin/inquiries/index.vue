<script setup lang="ts">
import { INQUIRY_STATUSES, INQUIRY_TYPES } from '~/types/inquiries'
import type { AdminInquiriesResult } from '~/types/inquiries'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Inquiries — LITUBO Admin' })
const filterStatus = ref('')
const filterType = ref('')
const page = ref(1)
const query = computed(() => ({ page: page.value, status: filterStatus.value || undefined, type: filterType.value || undefined }))
const { data, status, error, refresh } = await useFetch<AdminInquiriesResult>('/api/admin/inquiries', { query })
watch([filterStatus, filterType], () => { page.value = 1 })
const label = (value: string) => value.replaceAll('_', ' ')
const date = (value: string | null) => value ? new Date(value).toLocaleString('en-GB') : '—'
</script>

<template>
  <section class="inquiries">
    <header><div><h1>Customer inquiries</h1><p>Review website requests and keep track of follow-up.</p></div><button type="button" @click="refresh()">Refresh</button></header>
    <div class="filters">
      <label>Status <select v-model="filterStatus"><option value="">All statuses</option><option v-for="value in INQUIRY_STATUSES" :key="value" :value="value">{{ label(value) }}</option></select></label>
      <label>Request <select v-model="filterType"><option value="">All requests</option><option v-for="value in INQUIRY_TYPES" :key="value" :value="value">{{ label(value) }}</option></select></label>
      <span v-if="data">{{ data.total }} requests</span>
    </div>
    <p v-if="error" role="alert">Could not load inquiries. Check the CMS connection or try again.</p>
    <p v-else-if="status === 'pending'">Loading inquiries…</p>
    <p v-else-if="!data?.inquiries.length" class="empty">No inquiries in this view yet.</p>
    <div v-else class="table-wrap">
      <table><thead><tr><th>Received</th><th>Contact</th><th>Request</th><th>Status</th><th>HubSpot</th></tr></thead><tbody>
        <tr v-for="item in data.inquiries" :key="item.id">
          <td><NuxtLink :to="`/admin/inquiries/${item.id}`">#{{ item.id }}</NuxtLink><small>{{ date(item.submitted_at) }}</small></td>
          <td><strong>{{ item.contact_name || item.contact_email }}</strong><small>{{ item.contact_company }}<span v-if="item.contact_country"> · {{ item.contact_country }}</span></small></td>
          <td>{{ label(item.inquiry_type) }}</td><td>{{ label(item.status) }}</td><td>{{ label(item.hubspot_sync_status || 'not_configured') }}</td>
        </tr>
      </tbody></table>
    </div>
    <nav v-if="data && data.total > data.pageSize" class="pagination" aria-label="Inquiry pages"><button type="button" :disabled="page === 1" @click="page--">Previous</button><span>Page {{ page }}</span><button type="button" :disabled="page * data.pageSize >= data.total" @click="page++">Next</button></nav>
  </section>
</template>

<style scoped>
.inquiries { max-width: 1200px; padding: 32px; color: var(--color-ink); }
header, .filters, .pagination { display: flex; gap: 20px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
h1 { font-size: 28px; margin-bottom: 8px; } header p, small { color: var(--color-ink-muted); }
.filters { justify-content: flex-start; margin: 28px 0; } label { display: flex; align-items: center; gap: 8px; font-size: 14px; }
select, button { border: 1px solid var(--color-line); border-radius: 4px; padding: 9px 12px; background: white; font: inherit; }
button { cursor: pointer; } button:disabled { opacity: .45; cursor: default; }
.table-wrap { overflow-x: auto; background: white; border: 1px solid var(--color-line); }
table { width: 100%; border-collapse: collapse; min-width: 650px; font-size: 14px; } th, td { text-align: left; padding: 16px; border-bottom: 1px solid var(--color-line); } th { font-weight: 600; background: var(--color-surface-alt); }
small { display: block; font-size: 12px; margin-top: 4px; } a { color: var(--color-primary); text-decoration: underline; } .empty { padding: 40px 0; } .pagination { justify-content: flex-end; margin-top: 20px; }
@media (max-width: 600px) { .inquiries { padding: 20px 16px; } h1 { font-size: 24px; } }
</style>
