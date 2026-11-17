<script setup lang="ts">
import { INQUIRY_STATUSES } from '~/types/inquiries'
import type { AdminInquiry } from '~/types/inquiries'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Inquiry — LITUBO Admin' })
const route = useRoute()
const { data: inquiry, error } = await useFetch<AdminInquiry>(`/api/admin/inquiries/${route.params.id}`)
const form = reactive({ status: inquiry.value?.status ?? 'new', note: inquiry.value?.note ?? '' })
const saving = ref(false)
const retryingHubspot = ref(false)
const feedback = ref('')
const hubspotFeedback = ref('')
const label = (value: string) => value.replaceAll('_', ' ')
const details = computed(() => Object.entries(inquiry.value?.raw_fields ?? {}).filter(([key, value]) => value && !['contact_name', 'contact_email', 'contact_company', 'contact_country', 'message'].includes(key)))
const canRetryHubspot = computed(() => ['failed', 'not_configured'].includes(inquiry.value?.hubspot_sync_status ?? 'not_configured'))
async function save() {
  saving.value = true
  feedback.value = ''
  try {
    inquiry.value = await $fetch<AdminInquiry>(`/api/admin/inquiries/${route.params.id}`, { method: 'PATCH', body: form })
    feedback.value = 'Follow-up saved.'
  } catch { feedback.value = 'Could not save. Please try again.' }
  finally { saving.value = false }
}
async function retryHubspot() {
  retryingHubspot.value = true
  hubspotFeedback.value = ''
  try {
    inquiry.value = await $fetch<AdminInquiry>(`/api/admin/inquiries/${route.params.id}/retry-hubspot`, { method: 'POST' })
    hubspotFeedback.value = inquiry.value.hubspot_sync_status === 'synced'
      ? 'HubSpot contact synchronized.'
      : 'HubSpot is not configured yet. The inquiry remains safely stored here.'
  } catch { hubspotFeedback.value = 'HubSpot retry failed. The inquiry remains safely stored here.' }
  finally { retryingHubspot.value = false }
}

/**
 * V2-06 — AI assistance.
 *
 * The proposal lives in this component only: it is not saved anywhere until a person presses
 * Confirm, and Discard throws it away without touching the inquiry. The confirmed result (if any)
 * comes back from the server with the inquiry and is shown separately, so a new unreviewed proposal
 * can never look like it inherits an older confirmation.
 */
interface AiProposal { summary: string; intent: string; missing: string[] }
interface AiProposalResponse {
  ok: boolean
  unavailable?: boolean
  error?: string
  proposal?: AiProposal
  proposalRef?: string
  alreadyConfirmed?: boolean
}

const aiProposal = ref<AiProposal | null>(null)
const aiProposalRef = ref('')
const aiGenerating = ref(false)
const aiSaving = ref(false)
const aiError = ref('')
const aiFeedback = ref('')
const acceptSummary = ref(true)
const acceptIntent = ref(true)

async function generateProposal() {
  aiGenerating.value = true
  aiError.value = ''
  aiFeedback.value = ''
  try {
    const res = await $fetch<AiProposalResponse>(`/api/admin/inquiries/${route.params.id}/ai-proposal`, { method: 'POST', body: {} })
    if (!res.ok || !res.proposal || !res.proposalRef) {
      aiError.value = res.error ?? 'A proposal could not be generated. The inquiry is unchanged.'
      return
    }
    aiProposal.value = res.proposal
    aiProposalRef.value = res.proposalRef
    acceptSummary.value = true
    acceptIntent.value = true
  } catch (error) {
    const message = (error as { data?: { message?: string } })?.data?.message
    aiError.value = message ?? 'A proposal could not be generated. The inquiry is unchanged.'
  } finally {
    aiGenerating.value = false
  }
}

function discardProposal() {
  aiProposal.value = null
  aiProposalRef.value = ''
  aiError.value = ''
  aiFeedback.value = 'Proposal discarded. Nothing was saved and the inquiry is unchanged.'
}

async function confirmProposal() {
  if (!aiProposal.value || (!acceptSummary.value && !acceptIntent.value)) {
    aiError.value = 'Choose at least one recommendation to save.'
    return
  }
  aiSaving.value = true
  aiError.value = ''
  aiFeedback.value = ''
  try {
    const res = await $fetch<{ ok: boolean; inquiry: AdminInquiry }>(`/api/admin/inquiries/${route.params.id}/ai-confirm`, {
      method: 'POST',
      body: { proposalRef: aiProposalRef.value, acceptSummary: acceptSummary.value, acceptIntent: acceptIntent.value },
    })
    inquiry.value = res.inquiry
    aiProposal.value = null
    aiProposalRef.value = ''
    aiFeedback.value = 'Confirmed and saved. No reply was sent to the customer.'
  } catch (error) {
    const message = (error as { data?: { message?: string } })?.data?.message
    aiError.value = message ?? 'The confirmation could not be saved. Nothing was written.'
  } finally {
    aiSaving.value = false
  }
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
          <article class="panel"><h2>Source and CRM</h2><p>Page: {{ inquiry.source_url || 'Not recorded' }}</p><p>Language: {{ inquiry.locale }}</p><p>HubSpot: {{ label(inquiry.hubspot_sync_status || 'not_configured') }}</p><p v-if="inquiry.hubspot_sync_status === 'failed'" class="muted">CRM synchronization needs attention. The inquiry is safely stored here.</p><button v-if="canRetryHubspot" type="button" :disabled="retryingHubspot" @click="retryHubspot">{{ retryingHubspot ? 'Retrying…' : 'Retry HubSpot sync' }}</button><p v-if="hubspotFeedback" role="status" class="muted">{{ hubspotFeedback }}</p></article>
        </div>
        <div>
          <article class="panel ai-panel">
            <div class="ai-head">
              <h2>AI assistance</h2>
              <span v-if="aiProposal" class="ai-badge ai-badge--proposal">Unreviewed proposal</span>
              <span v-else-if="inquiry.ai_reviewed" class="ai-badge ai-badge--confirmed">Confirmed</span>
            </div>

            <!-- What a person already confirmed, read back from the inquiry -->
            <div v-if="inquiry.ai_reviewed && inquiry.ai_summary" class="ai-confirmed">
              <p class="ai-label">Summary</p>
              <p class="ai-summary">{{ inquiry.ai_summary }}</p>
              <template v-if="inquiry.ai_intent">
                <p class="ai-label">Intent (hint only — the inquiry type is unchanged)</p>
                <p class="ai-intent">{{ label(inquiry.ai_intent) }}</p>
              </template>
              <p class="muted">
                Confirmed from a proposal generated {{ inquiry.ai_processed_at ? new Date(inquiry.ai_processed_at).toLocaleString('en-GB') : 'at an unrecorded time' }}
                · confidence: Not assessed
              </p>
            </div>

            <!-- The unreviewed candidate -->
            <div v-if="aiProposal" class="ai-proposal">
              <label class="ai-check">
                <input v-model="acceptSummary" type="checkbox">
                <span>Summary</span>
              </label>
              <p class="ai-summary">{{ aiProposal.summary }}</p>

              <label class="ai-check">
                <input v-model="acceptIntent" type="checkbox">
                <span>Intent: {{ label(aiProposal.intent) }}</span>
              </label>

              <div v-if="aiProposal.missing.length" class="ai-missing">
                <p class="ai-label">Needs human review — the message does not say:</p>
                <ul>
                  <li v-for="item in aiProposal.missing" :key="item">{{ item }}</li>
                </ul>
              </div>

              <p class="muted">Confidence: Not assessed</p>

              <div class="ai-actions">
                <button type="button" :disabled="aiSaving" @click="confirmProposal">
                  {{ aiSaving ? 'Saving…' : 'Confirm selected' }}
                </button>
                <button type="button" class="ai-secondary" :disabled="aiSaving" @click="discardProposal">Discard proposal</button>
              </div>
            </div>

            <p v-else-if="!inquiry.ai_reviewed" class="muted">
              Generate an internal summary and an intent hint. Nothing is sent to the customer, and nothing is saved until you confirm.
            </p>

            <button
              v-if="!aiProposal"
              type="button"
              class="ai-generate"
              :disabled="aiGenerating"
              @click="generateProposal"
            >
              {{ aiGenerating ? 'Generating…' : (inquiry.ai_summary ? 'Generate again' : 'Generate summary & intent') }}
            </button>

            <p v-if="aiError" role="alert" class="ai-error">{{ aiError }}</p>
            <p v-if="aiFeedback" role="status" class="muted">{{ aiFeedback }}</p>
            <p class="ai-note">No customer reply is sent. Discard only clears this proposal.</p>
          </article>

          <form class="panel follow-up" @submit.prevent="save"><h2>Follow-up</h2><label for="inquiry-status">Status</label><select id="inquiry-status" v-model="form.status"><option v-for="value in INQUIRY_STATUSES" :key="value" :value="value">{{ label(value) }}</option></select><label for="inquiry-note">Internal notes</label><textarea id="inquiry-note" v-model="form.note" rows="10" maxlength="8000" placeholder="Record your follow-up and next action." /><p class="muted">Internal notes stay in the backend. Saving does not send a customer reply.</p><button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save follow-up' }}</button><p v-if="feedback" role="status">{{ feedback }}</p></form>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.inquiry-detail { padding: 32px; max-width: 1200px; color: var(--color-ink); } .back, a { color: var(--color-primary); } h1 { font-size: 28px; margin: 24px 0 8px; } h2 { font-size: 18px; margin-bottom: 16px; } .muted { color: var(--color-ink-muted); font-size: 14px; } .detail-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr); gap: 24px; margin-top: 24px; align-items: start; } .panel { background: white; border: 1px solid var(--color-line); padding: 24px; margin-bottom: 20px; overflow-wrap: anywhere; } .panel p { margin: 8px 0; } .message { white-space: pre-wrap; } dl { margin-top: 24px; } dt { font-size: 12px; color: var(--color-ink-muted); margin-top: 12px; } dd { margin: 4px 0; white-space: pre-wrap; } .follow-up { display: flex; flex-direction: column; gap: 12px; } label { font-weight: 500; font-size: 14px; } select, textarea { width: 100%; border: 1px solid var(--color-line); border-radius: 4px; padding: 10px; font: inherit; } textarea { resize: vertical; } button { background: var(--color-primary); color: white; padding: 12px; cursor: pointer; } button:disabled { opacity: .5; }
@media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; } .inquiry-detail { padding: 20px 16px; } }

/* V2-06 — AI assistance panel */
.ai-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 16px; }
.ai-head h2 { margin: 0; }
.ai-badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.ai-badge--proposal { background: #F4F0FA; color: #7250A2; }
.ai-badge--confirmed { background: #EEF5EF; color: #2F6B3A; }
.ai-label { font-size: 12px; font-weight: 600; color: var(--color-ink-muted); margin: 12px 0 4px; }
.ai-summary { margin: 0 0 8px; white-space: pre-wrap; }
.ai-intent { margin: 0 0 8px; font-weight: 600; }
.ai-confirmed { border-inline-start: 3px solid #2F6B3A; padding-inline-start: 12px; }
.ai-proposal { border: 1px solid #D9CFEA; border-radius: 6px; padding: 14px; background: #FBFAFE; }
.ai-check { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
.ai-check input { accent-color: #7250A2; }
.ai-missing { margin: 12px 0; padding: 10px 12px; border: 1px solid #E5B4A0; border-radius: 6px; background: #FDF0EA; }
.ai-missing .ai-label { color: #8A3A1A; margin-top: 0; }
.ai-missing ul { margin: 6px 0 0; padding-inline-start: 20px; font-size: 14px; }
.ai-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.ai-secondary { background: #fff; color: var(--color-primary); border: 1px solid var(--color-line); }
.ai-generate { background: var(--color-primary); color: #fff; }
.ai-error { margin: 12px 0 0; padding: 10px 12px; border: 1px solid #F3B5AC; border-radius: 6px; background: #FFF1EF; color: #B42318; font-size: 14px; }
.ai-note { margin: 14px 0 0; font-size: 13px; color: var(--color-ink-muted); }
</style>
