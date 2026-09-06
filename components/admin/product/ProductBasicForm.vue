<script setup lang="ts">
import type { AdminProduct, ProductCategory, ProductPreset } from '~/types/product-cms'

const props = defineProps<{
  modelValue: Partial<AdminProduct>
  categories: ProductCategory[]
  presets: ProductPreset[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Partial<AdminProduct>]
  save: []
}>()

function update(field: keyof AdminProduct, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="basic-form">
    <div class="form-row">
      <label class="form-label required">Product Name (EN)</label>
      <input
        class="form-input"
        type="text"
        :value="modelValue.name_en ?? ''"
        placeholder="e.g. LT-180C Series Metal Detector"
        @input="update('name_en', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="form-row">
      <label class="form-label">Product Name (ES)</label>
      <input class="form-input" type="text" :value="modelValue.name_es ?? ''" @input="update('name_es', ($event.target as HTMLInputElement).value)">
    </div>

    <div class="form-row">
      <label class="form-label">Product Name (PT)</label>
      <input class="form-input" type="text" :value="modelValue.name_pt ?? ''" @input="update('name_pt', ($event.target as HTMLInputElement).value)">
    </div>

    <div class="form-row">
      <label class="form-label required">URL Slug</label>
      <input
        class="form-input form-input--mono"
        type="text"
        :value="modelValue.slug ?? ''"
        placeholder="lt-180c-series"
        pattern="[a-z0-9-]+"
        @input="update('slug', ($event.target as HTMLInputElement).value)"
      >
      <p class="form-hint">Lowercase letters, numbers, and hyphens</p>
    </div>

    <div class="form-row">
      <label class="form-label">Product Code</label>
      <input
        class="form-input form-input--mono"
        type="text"
        :value="modelValue.product_code ?? ''"
        :disabled="!!modelValue.product_code"
        placeholder="e.g. LT-180C"
        @input="update('product_code', ($event.target as HTMLInputElement).value.trim().toUpperCase())"
      >
      <p v-if="modelValue.product_code" class="form-hint form-hint--locked">
        Locked: {{ modelValue.product_code }} — cannot be changed
      </p>
      <p v-else class="form-hint">Uppercase letters, digits, and hyphens. Required before submitting for Review. Cannot be changed once set.</p>
    </div>

    <div class="form-row">
      <label class="form-label">Model / Series</label>
      <input
        class="form-input"
        type="text"
        :value="modelValue.model_or_series ?? ''"
        placeholder="e.g. LT-180C Series"
        @input="update('model_or_series', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="form-row">
      <label class="form-label required">Category</label>
      <select class="form-select" :value="modelValue.category_id ?? ''" @change="update('category_id', Number(($event.target as HTMLSelectElement).value) || null)">
        <option value="">— Select category —</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name_en }}</option>
      </select>
    </div>

    <div class="form-row">
      <label class="form-label">Page Preset</label>
      <select class="form-select" :value="modelValue.page_preset_id ?? ''" @change="update('page_preset_id', Number(($event.target as HTMLSelectElement).value) || null)">
        <option value="">— No preset —</option>
        <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name_en }}</option>
      </select>
    </div>

    <div class="form-row">
      <label class="form-label">Summary (EN)</label>
      <textarea class="form-textarea" :value="modelValue.summary_en ?? ''" rows="3" @input="update('summary_en', ($event.target as HTMLTextAreaElement).value)" />
    </div>

    <div class="form-row">
      <label class="form-label">Review Notes (internal)</label>
      <textarea class="form-textarea" :value="modelValue.review_notes ?? ''" rows="2" placeholder="Internal notes, not shown on the website" @input="update('review_notes', ($event.target as HTMLTextAreaElement).value)" />
    </div>

    <div class="form-actions">
      <button class="btn btn--primary" :disabled="loading" @click="emit('save')">
        {{ loading ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.basic-form { display: flex; flex-direction: column; gap: var(--space-5); }

.form-row { display: flex; flex-direction: column; gap: var(--space-1); }

.form-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ink);
}

.form-label.required::after {
  content: ' *';
  color: #C0392B;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-family: var(--font-body);
  color: var(--color-ink);
  background: white;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input--mono { font-family: 'Courier New', monospace; }

.form-textarea { resize: vertical; }

.form-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }
.form-hint--locked { color: #8B4513; }

.form-input:disabled {
  background: #f5f5f0;
  cursor: not-allowed;
  color: var(--color-ink-muted);
}

.form-actions { display: flex; gap: var(--space-3); padding-top: var(--space-4); border-top: 1px solid var(--color-line); }

.btn {
  padding: var(--space-2) var(--space-6);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background var(--transition-fast);
}

.btn--primary { background: var(--color-primary); color: white; }
.btn--primary:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 720px) {
  .form-input, .form-select, .form-textarea { min-height: 44px; }
  .btn { min-height: 44px; padding-left: var(--space-5); padding-right: var(--space-5); }
}
</style>
