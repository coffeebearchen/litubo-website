<script setup lang="ts">
import { INQUIRY_STATUSES } from '~/types/inquiries'
import type { AdminInquiry } from '~/types/inquiries'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Inquiry — LITUBO Admin' })
const route = useRoute()
const { data: inquiry, error } = await useFetch<AdminInquiry>(`/api/admin/inquiries/${route.params.id}`)
const form = reactive({ status: inquiry.value?.status ?? 'new', note: inquiry.value?.note ?? '' })
const saving = ref(false)
const feedback = ref('')
const label = (value: string) => value.replaceAll('_', ' ')
const details = computed(() => Object.entries(inquiry.value?.raw_fields ?? {}).filter(([key, value]) => value && !['contact_name', 'contact_email', 'contact_company', 'contact_country', 'message'].includes(key)))
async function save() {
  saving.value = true
  feedback.value = ''
  try {
    inquiry.value = await $fetch<AdminInquiry>(`/api/admin/inquiries/${route.params.id}`, { method: 'PATCH', body: form })
    feedback.value = 'Follow-up saved.'
  } catch { feedback.value = 'Could not save. Please try again.' }
  finally { saving.value = false }
}
</script>

<template>
  <section class="inquiry-detail">
    <NuxtLink to="/admin/inquiries" class="back">← Customer inquiries</NuxtLink>
    <p v-if="error" role="alert">This inquiry could not be loaded.</p>
    <template v-else-if="inquiry">
      <h1>Inquiry #{{ inquiry.id }}</h1>
      <p class="muted">{{ label(inquiry.inquiry_type) }} · {{ inquiry.submitted_at ? new Date(inquiry.submitted_at).toLocaleString('en-GB') : 'Date unavailable' }}</p>
      <div class="detail-grid">
        <div>
          <article class="panel"><h2>Contact</h2><p><strong>{{ inquiry.contact_name || 'Name not supplied' }}</strong></p><p>{{ inquiry.contact_company }}<span v-if="inquiry.contact_country"> · {{ inquiry.contact_country }}</span></p><p><a :href="`mailto:${inquiry.contact_email}`">{{ inquiry.contact_email }}</a></p><p>{{ inquiry.contact_phone }}</p></article>
          <article class="panel"><h2>Customer message</h2><p class="message">{{ inquiry.message || 'No additional message.' }}</p><dl v-if="details.length"><template v-for="[key, value] in details" :key="key"><dt>{{ label(key) }}</dt><dd>{{ value }}</dd></template></dl></article>
          <article class="panel"><h2>Source and CRM</h2><p>Page: {{ inquiry.source_url || 'Not recorded' }}</p><p>Language: {{ inquiry.locale }}</p><p>HubSpot: {{ label(inquiry.hubspot_sync_status || 'not_configured') }}</p><p v-if="inquiry.hubspot_sync_status === 'failed'" class="muted">CRM synchronization needs attention. The inquiry is safely stored here.</p></article>
        </div>
        <form class="panel follow-up" @submit.prevent="save"><h2>Follow-up</h2><label for="inquiry-status">Status</label><select id="inquiry-status" v-model="form.status"><option v-for="value in INQUIRY_STATUSES" :key="value" :value="value">{{ label(value) }}</option></select><label for="inquiry-note">Internal notes</label><textarea id="inquiry-note" v-model="form.note" rows="10" maxlength="8000" placeholder="Record your follow-up and next action." /><p class="muted">Internal notes stay in the backend. Saving does not send a customer reply.</p><button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save follow-up' }}</button><p v-if="feedback" role="status">{{ feedback }}</p></form>
      </div>
    </template>
  </section>
</template>

<style scoped>
.inquiry-detail { padding: 32px; max-width: 1200px; color: var(--color-ink); } .back, a { color: var(--color-primary); } h1 { font-size: 28px; margin: 24px 0 8px; } h2 { font-size: 18px; margin-bottom: 16px; } .muted { color: var(--color-ink-muted); font-size: 14px; } .detail-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr); gap: 24px; margin-top: 24px; align-items: start; } .panel { background: white; border: 1px solid var(--color-line); padding: 24px; margin-bottom: 20px; overflow-wrap: anywhere; } .panel p { margin: 8px 0; } .message { white-space: pre-wrap; } dl { margin-top: 24px; } dt { font-size: 12px; color: var(--color-ink-muted); margin-top: 12px; } dd { margin: 4px 0; white-space: pre-wrap; } .follow-up { display: flex; flex-direction: column; gap: 12px; } label { font-weight: 500; font-size: 14px; } select, textarea { width: 100%; border: 1px solid var(--color-line); border-radius: 4px; padding: 10px; font: inherit; } textarea { resize: vertical; } button { background: var(--color-primary); color: white; padding: 12px; cursor: pointer; } button:disabled { opacity: .5; }
@media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; } .inquiry-detail { padding: 20px 16px; } }
</style>
