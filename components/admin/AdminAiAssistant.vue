<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * The admin assistant, present on every admin page in the top-right corner.
 *
 * It exists because the same three things are useful wherever the editor happens to be standing: write
 * the search metadata for the item in front of me, tell me what this page controls, and let me fix a
 * value without hunting for the right tab. So it lives in the layout, not in a page.
 *
 * What it may write is deliberately small: seo title and seo description, for one named item, only
 * after the person presses 采纳并写入. Everything else it does is read-only. The item is read from the
 * URL and sent explicitly, so the server never has to guess which record the panel meant.
 *
 * The colours are a bright clash (magenta into orange) against the admin's green: this is a control
 * that must be findable at a glance, and it is the one thing in the shell that is not part of the
 * site's own palette.
 */
interface Proposal {
  seoTitle: string
  seoDescription: string
}

type Entity = 'post' | 'contentItem'

const route = useRoute()

const open = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const proposal = ref<Proposal | null>(null)
const proposalRef = ref('')
const draftTitle = ref('')
const draftDescription = ref('')
const saved = ref<Proposal | null>(null)

const TITLE_IDEAL = { min: 30, max: 65 }
const DESCRIPTION_IDEAL = { min: 70, max: 165 }

/** Which record the panel is looking at, read from the admin URL. */
const context = computed<{ entity: Entity, id: number, label: string } | null>(() => {
  const path = route.path
  const content = /^\/admin\/content-center\/(\d+)(?:\/|$)/.exec(path)
  if (content) return { entity: 'contentItem', id: Number(content[1]), label: `Content item #${content[1]}` }

  // The posts editor is a single page with a list; it puts the open article in ?id=.
  if (path === '/admin/posts' || path === '/admin/posts/') {
    const id = String(route.query.id ?? '')
    if (/^\d+$/.test(id)) return { entity: 'post', id: Number(id), label: `Article #${id}` }
  }

  const post = /^\/admin\/posts\/(\d+)(?:\/|$)/.exec(path)
  if (post) return { entity: 'post', id: Number(post[1]), label: `Article #${post[1]}` }

  return null
})

const contextText = computed(() => {
  if (context.value) return context.value.label
  return 'No single item on this page'
})

const canSuggestSeo = computed(() => Boolean(context.value))

function resetProposal() {
  proposal.value = null
  proposalRef.value = ''
  draftTitle.value = ''
  draftDescription.value = ''
}

function openPanel() {
  open.value = true
  error.value = ''
  notice.value = ''
  saved.value = null
}

function closePanel() {
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) closePanel()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

async function suggestSeo() {
  if (!context.value || busy.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  resetProposal()
  try {
    const res = await $fetch<{
      ok: boolean
      unavailable?: boolean
      error?: string
      proposal?: Proposal
      proposalRef?: string
      reused?: boolean
    }>('/api/admin/ai/seo-proposal', {
      method: 'POST',
      body: { entity: context.value.entity, id: context.value.id },
    })
    if (!res.ok || !res.proposal) {
      error.value = res.unavailable ? 'AI is not configured on this server yet.' : (res.error ?? 'The suggestion could not be generated.')
      return
    }
    proposal.value = res.proposal
    proposalRef.value = res.proposalRef ?? ''
    draftTitle.value = res.proposal.seoTitle
    draftDescription.value = res.proposal.seoDescription
    notice.value = res.reused ? 'This is the suggestion already generated for this item.' : ''
  }
  catch (e: unknown) {
    const fe = e as { data?: { message?: string, statusCode?: number }, statusCode?: number }
    const status = fe?.data?.statusCode ?? fe?.statusCode
    error.value = status === 401
      ? 'Your session expired. Sign in again.'
      : (fe?.data?.message ?? 'The suggestion could not be generated.')
  }
  finally {
    busy.value = false
  }
}

async function confirmSeo() {
  if (!context.value || !proposalRef.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ ok: boolean, saved: Proposal }>('/api/admin/ai/seo-confirm', {
      method: 'POST',
      body: {
        entity: context.value.entity,
        id: context.value.id,
        proposalRef: proposalRef.value,
        seoTitle: draftTitle.value,
        seoDescription: draftDescription.value,
      },
    })
    saved.value = res.saved
    notice.value = 'Saved. Reload the page to see the stored values in the form.'
    resetProposal()
  }
  catch (e: unknown) {
    const fe = e as { data?: { message?: string, statusCode?: number }, statusCode?: number }
    const status = fe?.data?.statusCode ?? fe?.statusCode
    error.value = status === 401
      ? 'Your session expired. Sign in again.'
      : (fe?.data?.message ?? 'Saving failed.')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ai-assist">
    <button
      type="button"
      class="ai-assist__launch"
      :aria-expanded="open"
      aria-controls="admin-ai-panel"
      @click="open ? closePanel() : openPanel()"
    >
      <span aria-hidden="true">✦</span>
      <span class="ai-assist__launch-text">AI</span>
    </button>

    <section
      v-if="open"
      id="admin-ai-panel"
      class="ai-assist__panel"
      aria-label="LITUBO AI assistant"
    >
      <header class="ai-assist__head">
        <div>
          <p class="ai-assist__title">LITUBO AI</p>
          <p class="ai-assist__context">
            <span class="ai-assist__context-dot" aria-hidden="true" />
            {{ contextText }}
          </p>
        </div>
        <button type="button" class="ai-assist__close" aria-label="Close assistant" @click="closePanel">×</button>
      </header>

      <p v-if="error" class="ai-assist__error" role="alert">{{ error }}</p>
      <p v-if="notice" class="ai-assist__notice">{{ notice }}</p>

      <div class="ai-assist__actions">
        <button
          type="button"
          class="ai-assist__action"
          :disabled="busy || !canSuggestSeo"
          @click="suggestSeo"
        >
          {{ busy ? 'Working…' : 'Write this page’s SEO' }}
        </button>
        <p v-if="!canSuggestSeo" class="ai-assist__hint">
          Open an article or a content item to write its SEO. This page has nothing to write to.
        </p>
      </div>

      <div v-if="proposal" class="ai-assist__proposal">
        <p class="ai-assist__proposal-head">Review before saving</p>

        <label class="ai-assist__field">
          <span class="ai-assist__label">Search title</span>
          <input v-model="draftTitle" type="text" maxlength="120">
          <span class="ai-assist__count" :class="{ 'is-off': draftTitle.length < TITLE_IDEAL.min || draftTitle.length > TITLE_IDEAL.max }">
            {{ draftTitle.length }} / 120 · ideal {{ TITLE_IDEAL.min }}–{{ TITLE_IDEAL.max }}
          </span>
        </label>

        <label class="ai-assist__field">
          <span class="ai-assist__label">Search description</span>
          <textarea v-model="draftDescription" rows="4" maxlength="320" />
          <span class="ai-assist__count" :class="{ 'is-off': draftDescription.length < DESCRIPTION_IDEAL.min || draftDescription.length > DESCRIPTION_IDEAL.max }">
            {{ draftDescription.length }} / 320 · ideal {{ DESCRIPTION_IDEAL.min }}–{{ DESCRIPTION_IDEAL.max }}
          </span>
        </label>

        <div class="ai-assist__row">
          <button type="button" class="ai-assist__save" :disabled="busy" @click="confirmSeo">Save these two fields</button>
          <button type="button" class="ai-assist__ghost" :disabled="busy" @click="resetProposal">Discard</button>
        </div>
        <p class="ai-assist__hint">Only the two fields above are written. Nothing else changes.</p>
      </div>

      <div v-if="saved" class="ai-assist__saved">
        <p class="ai-assist__label">Saved</p>
        <p class="ai-assist__saved-line"><strong>{{ saved.seoTitle }}</strong></p>
        <p class="ai-assist__saved-line">{{ saved.seoDescription }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ai-assist {
  position: fixed;
  top: 64px;
  right: 20px;
  z-index: 90;
}

.ai-assist__launch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: #F0208C;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 6px 18px rgb(240 32 140 / 35%);
}

.ai-assist__launch:hover { background: #FF7A00; box-shadow: 0 6px 18px rgb(255 122 0 / 38%); }
.ai-assist__launch:focus-visible { outline: 3px solid #FF7A00; outline-offset: 2px; }
.ai-assist__launch-text { letter-spacing: 0.08em; }

.ai-assist__panel {
  margin-top: 10px;
  width: min(420px, calc(100vw - 40px));
  max-height: min(620px, calc(100vh - 120px));
  overflow-y: auto;
  background: #fff;
  border: 1px solid #E6D9C6;
  border-top: 4px solid #F0208C;
  border-radius: 10px;
  box-shadow: 0 18px 48px rgb(24 51 43 / 22%);
  padding: 16px;
}

.ai-assist__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.ai-assist__title { margin: 0; font-size: 16px; font-weight: 700; color: #18332B; letter-spacing: 0.02em; }
.ai-assist__context { margin: 4px 0 0; font-size: 12px; color: #4A5E58; display: flex; align-items: center; gap: 6px; }
.ai-assist__context-dot { width: 7px; height: 7px; border-radius: 50%; background: #FF7A00; display: inline-block; }
.ai-assist__close { border: 0; background: none; font-size: 22px; line-height: 1; color: #4A5E58; cursor: pointer; padding: 0 2px; }

.ai-assist__error { margin: 0 0 10px; padding: 8px 10px; background: #FDECEC; border: 1px solid #F3C5C5; border-radius: 6px; color: #B42318; font-size: 13px; }
.ai-assist__notice { margin: 0 0 10px; padding: 8px 10px; background: #FFF4E5; border: 1px solid #FFD8A8; border-radius: 6px; color: #945A20; font-size: 13px; }

.ai-assist__actions { display: flex; flex-direction: column; gap: 6px; }
.ai-assist__action {
  align-self: flex-start;
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: #FF7A00;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.ai-assist__action:disabled { opacity: 0.55; cursor: default; }
.ai-assist__hint { margin: 6px 0 0; font-size: 12px; color: #4A5E58; }

.ai-assist__proposal { margin-top: 14px; border-top: 1px dashed #E6D9C6; padding-top: 12px; }
.ai-assist__proposal-head { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #18332B; }
.ai-assist__field { display: block; margin-bottom: 12px; }
.ai-assist__label { display: block; font-size: 12px; font-weight: 600; color: #4A5E58; margin-bottom: 4px; }
.ai-assist__field input, .ai-assist__field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #D8CFC0;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  color: #18332B;
  background: #FFFDF8;
}
.ai-assist__count { display: block; margin-top: 4px; font-size: 11px; color: #2F6B3A; }
.ai-assist__count.is-off { color: #B54708; }
.ai-assist__row { display: flex; gap: 8px; }
.ai-assist__save {
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: #F0208C;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.ai-assist__save:disabled { opacity: 0.55; cursor: default; }
.ai-assist__ghost { height: 34px; padding: 0 12px; border: 1px solid #D8CFC0; border-radius: 6px; background: #fff; color: #4A5E58; font-size: 13px; cursor: pointer; }

.ai-assist__saved { margin-top: 14px; border-top: 1px dashed #E6D9C6; padding-top: 12px; }
.ai-assist__saved-line { margin: 0 0 4px; font-size: 13px; color: #18332B; }

@media (max-width: 640px) {
  .ai-assist { top: 60px; right: 12px; }
  .ai-assist__launch-text { display: none; }
  .ai-assist__launch { padding: 0 12px; }
  .ai-assist__panel { width: calc(100vw - 24px); }
}
</style>
