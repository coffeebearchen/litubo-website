<script setup lang="ts">
interface AssistantAnswer {
  answer: string
  needsHuman: boolean
  topic: string
  suggestedPath: string
  suggestedLabel: string
  followUpQuestion: string
}

const { locale } = useI18n()
const open = ref(false)
const checked = ref(false)
const available = ref(false)
const checking = ref(false)
const asking = ref(false)
const question = ref('')
const answer = ref<AssistantAnswer | null>(null)
const error = ref('')

async function checkStatus() {
  if (checked.value || checking.value) return
  checking.value = true
  try {
    const result = await $fetch<{ available: boolean }>('/api/assistant/status')
    available.value = result.available
  } catch { available.value = false }
  finally {
    checked.value = true
    checking.value = false
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value) await checkStatus()
}

async function ask() {
  if (!question.value.trim() || asking.value) return
  asking.value = true
  answer.value = null
  error.value = ''
  try {
    answer.value = await $fetch<AssistantAnswer>('/api/assistant', { method: 'POST', body: { question: question.value } })
  } catch {
    error.value = 'I could not answer this safely. Please send the question to our team.'
  } finally { asking.value = false }
}
</script>

<template>
  <aside v-if="locale === 'en'" class="assistant" :class="{ 'assistant--open': open }">
    <section v-if="open" id="visitor-assistant-panel" class="assistant__panel" aria-label="LITUBO product assistant">
      <header class="assistant__header"><div><strong>Product assistant</strong><span>General guidance</span></div><button type="button" aria-label="Close assistant" @click="open = false">×</button></header>
      <div class="assistant__body">
        <p>Tell us what you need to inspect. Product parameters and final suitability are confirmed by our team.</p>
        <nav class="assistant__quick" aria-label="Product assistant shortcuts">
          <NuxtLink to="/products/x-ray-inspection">X-ray inspection</NuxtLink>
          <NuxtLink to="/products/metal-detection">Metal detection</NuxtLink>
          <NuxtLink to="/products/checkweighers">Checkweighing</NuxtLink>
          <NuxtLink to="/technical-matching">Help me choose</NuxtLink>
        </nav>
        <p v-if="checking" class="assistant__muted">Checking assistant availability…</p>
        <form v-else-if="available" @submit.prevent="ask">
          <label for="assistant-question">Ask a general product question</label>
          <textarea id="assistant-question" v-model="question" maxlength="800" rows="3" placeholder="Example: Which system should I consider for packaged food?" />
          <p class="assistant__muted">Do not include confidential production data or personal information.</p>
          <button type="submit" :disabled="asking || !question.trim()">{{ asking ? 'Thinking…' : 'Ask assistant' }}</button>
        </form>
        <div v-else class="assistant__handoff"><p>AI answers are not enabled yet. You can still use the product links or ask our team.</p><NuxtLink to="/contact">Contact LITUBO →</NuxtLink></div>
        <div v-if="answer" class="assistant__answer" role="status"><p>{{ answer.answer }}</p><p v-if="answer.followUpQuestion" class="assistant__muted">{{ answer.followUpQuestion }}</p><NuxtLink :to="answer.suggestedPath">{{ answer.suggestedLabel }} →</NuxtLink></div>
        <div v-if="error" class="assistant__answer" role="alert"><p>{{ error }}</p><NuxtLink to="/contact">Contact LITUBO →</NuxtLink></div>
      </div>
    </section>
    <button class="assistant__toggle" type="button" :aria-expanded="open" aria-controls="visitor-assistant-panel" @click="toggle">{{ open ? 'Close' : 'Product assistant' }}</button>
  </aside>
</template>

<style scoped>
.assistant { position: fixed; z-index: 80; right: 24px; bottom: 24px; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.assistant__toggle { border: 0; border-radius: 999px; padding: 13px 20px; background: var(--color-primary); color: white; box-shadow: 0 8px 28px rgb(15 49 43 / 22%); font: 600 14px/1 var(--font-body); cursor: pointer; }
.assistant__panel { width: min(390px, calc(100vw - 32px)); max-height: min(620px, calc(100vh - 120px)); overflow-y: auto; background: white; border: 1px solid var(--color-line); box-shadow: 0 18px 50px rgb(20 33 30 / 18%); }
.assistant__header { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; background: var(--color-primary); color: white; }
.assistant__header div { display: flex; flex-direction: column; gap: 3px; }.assistant__header span { font-size: 12px; opacity: .78; }.assistant__header button { border: 0; background: transparent; color: white; font-size: 26px; cursor: pointer; }
.assistant__body { display: grid; gap: 16px; padding: 20px; color: var(--color-ink); font-size: 14px; line-height: 1.55; }.assistant__body p { margin: 0; }
.assistant__quick { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.assistant__quick a { padding: 10px; border: 1px solid var(--color-line); color: var(--color-primary); text-decoration: none; }
.assistant form { display: grid; gap: 8px; }.assistant label { font-weight: 600; }.assistant textarea { width: 100%; resize: vertical; padding: 10px; border: 1px solid var(--color-line); font: inherit; }.assistant form button { justify-self: start; border: 0; padding: 10px 16px; background: var(--color-accent); color: white; font-weight: 600; cursor: pointer; }.assistant form button:disabled { opacity: .55; cursor: default; }
.assistant__muted { color: var(--color-ink-muted); font-size: 12px; }.assistant__handoff, .assistant__answer { display: grid; gap: 8px; padding: 14px; background: var(--color-surface, #f3f6f4); }.assistant__handoff a, .assistant__answer a { color: var(--color-primary); font-weight: 600; text-decoration: none; }
@media (max-width: 640px) { .assistant { right: 12px; bottom: 76px; }.assistant__panel { max-height: calc(100vh - 160px); }.assistant__quick { grid-template-columns: 1fr; } }
</style>
