<script setup lang="ts">
import { ref } from 'vue'
import type { AdminContentDraft } from '~/types/content-center'
import {
  CONTENT_CENTER_LIST_ROUTE,
  CONTENT_TYPE_OPTIONS,
  type ContentCreateField,
  contentCreateRequestBody,
  emptyContentCreateForm,
  interpretContentApiError,
  missingContentCreateFields,
} from '~/utils/contentCenter'

/**
 * CC-IMP-02 — minimal Create Draft form (CC-00 write boundary: CREATE Draft only).
 * Sends only the four fields `POST /api/admin/content-center` accepts; the BFF
 * and the database stay the authority for slug rules and uniqueness, and every
 * error they return is shown. Emits `created` with the new id on success.
 */
const emit = defineEmits<{ created: [id: number] }>()

const form = ref(emptyContentCreateForm())
const fieldErrors = ref<Partial<Record<ContentCreateField, string>>>({})
const message = ref<string | null>(null)
const sessionExpired = ref(false)
const submitting = ref(false)

async function submit() {
  if (submitting.value) return
  message.value = null
  sessionExpired.value = false
  fieldErrors.value = missingContentCreateFields(form.value)
  if (Object.keys(fieldErrors.value).length > 0) return

  submitting.value = true
  try {
    const draft = await $fetch<AdminContentDraft>('/api/admin/content-center', {
      method: 'POST',
      body: contentCreateRequestBody(form.value),
    })
    emit('created', draft.id)
  } catch (err: unknown) {
    const view = interpretContentApiError(err)
    if (view.field) fieldErrors.value = { [view.field]: view.message }
    else message.value = view.message
    sessionExpired.value = view.status === 401
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="cc-form" novalidate @submit.prevent="submit">
    <div v-if="message" class="cc-form-error" role="alert">
      {{ message }}
      <NuxtLink v-if="sessionExpired" to="/admin/login" class="cc-form-error-link">Sign in</NuxtLink>
    </div>

    <div class="cc-form-field">
      <label for="cc-create-type">Content type</label>
      <select
        id="cc-create-type"
        v-model="form.content_type"
        :aria-invalid="Boolean(fieldErrors.content_type)"
        :aria-describedby="fieldErrors.content_type ? 'cc-create-type-error' : 'cc-create-type-hint'"
      >
        <option value="" disabled>Select a content type</option>
        <option v-for="option in CONTENT_TYPE_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <p v-if="fieldErrors.content_type" id="cc-create-type-error" class="cc-field-error">{{ fieldErrors.content_type }}</p>
      <p v-else id="cc-create-type-hint" class="cc-field-hint">The type cannot be changed after the draft is created.</p>
    </div>

    <div class="cc-form-field">
      <label for="cc-create-title">Title</label>
      <input
        id="cc-create-title"
        v-model="form.title"
        type="text"
        maxlength="160"
        autocomplete="off"
        :aria-invalid="Boolean(fieldErrors.title)"
        :aria-describedby="fieldErrors.title ? 'cc-create-title-error' : undefined"
      >
      <p v-if="fieldErrors.title" id="cc-create-title-error" class="cc-field-error">{{ fieldErrors.title }}</p>
    </div>

    <div class="cc-form-field">
      <label for="cc-create-slug">Slug</label>
      <input
        id="cc-create-slug"
        v-model="form.slug"
        type="text"
        maxlength="100"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="Boolean(fieldErrors.slug)"
        :aria-describedby="fieldErrors.slug ? 'cc-create-slug-error' : 'cc-create-slug-hint'"
      >
      <p v-if="fieldErrors.slug" id="cc-create-slug-error" class="cc-field-error">{{ fieldErrors.slug }}</p>
      <p v-else id="cc-create-slug-hint" class="cc-field-hint">
        Lowercase letters, numbers and hyphens, for example <code>checkweigher-selection-guide</code>. Must be unique for English.
      </p>
    </div>

    <div class="cc-form-field">
      <label for="cc-create-summary">Summary <span class="cc-optional">(optional)</span></label>
      <textarea
        id="cc-create-summary"
        v-model="form.summary"
        maxlength="400"
        rows="3"
        :aria-invalid="Boolean(fieldErrors.summary)"
        :aria-describedby="fieldErrors.summary ? 'cc-create-summary-error' : undefined"
      />
      <p v-if="fieldErrors.summary" id="cc-create-summary-error" class="cc-field-error">{{ fieldErrors.summary }}</p>
    </div>

    <p class="cc-form-note">
      Creates an English draft. Nothing is published. Sections, media, SEO and other languages are added in later workspace modules.
    </p>

    <div class="cc-form-actions">
      <button type="submit" class="cc-form-submit" :disabled="submitting">
        {{ submitting ? 'Creating…' : 'Create draft' }}
      </button>
      <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-form-cancel">Cancel</NuxtLink>
    </div>
  </form>
</template>

<style scoped>
.cc-form { display: flex; flex-direction: column; gap: var(--space-5); }

.cc-form-field { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }

.cc-form-field label { color: var(--color-ink); }
.cc-optional { font-weight: 400; color: var(--color-ink-muted); }

.cc-form-field input,
.cc-form-field select,
.cc-form-field textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: inherit;
}

.cc-form-field input:focus,
.cc-form-field select:focus,
.cc-form-field textarea:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }

.cc-form-field [aria-invalid="true"] { border-color: #C0392B; }

.cc-field-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; overflow-wrap: anywhere; }
.cc-field-hint code { font-size: 0.95em; }
.cc-field-error { font-size: var(--text-xs); color: #C0392B; margin: 0; }

.cc-form-error {
  background: #FDF0EE;
  border: 1px solid #F5C6C2;
  border-radius: var(--radius-sm);
  color: #C0392B;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
}

.cc-form-error-link { margin-left: var(--space-2); color: var(--color-primary); }

.cc-form-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; line-height: 1.5; }

.cc-form-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }

.cc-form-submit {
  min-height: 40px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.cc-form-submit:hover:not(:disabled) { background: var(--color-primary-deep); }
.cc-form-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.cc-form-cancel { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.cc-form-cancel:hover { text-decoration: underline; }

@media (max-width: 767px) {
  .cc-form-actions { flex-direction: column; align-items: stretch; }
  .cc-form-submit { width: 100%; }
  .cc-form-cancel { text-align: center; padding: var(--space-2) 0; }
}
</style>
