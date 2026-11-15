<script setup lang="ts">
const props = defineProps<{
  id: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  modelValue?: string
  error?: string
  hint?: string
  rows?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isTextarea = computed(() => props.type === 'textarea')
</script>

<template>
  <div class="form-field" :class="{ 'form-field--error': error }">
    <label :for="id" class="form-field__label">
      {{ label }}
      <span v-if="required" class="form-field__required" aria-hidden="true">*</span>
    </label>

    <textarea
      v-if="isTextarea"
      :id="id"
      class="form-field__input form-field__textarea"
      :placeholder="placeholder"
      :required="required"
      :rows="rows ?? 5"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      :id="id"
      class="form-field__input"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :required="required"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >

    <p v-if="hint && !error" class="form-field__hint">{{ hint }}</p>
    <p v-if="error" class="form-field__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ink);
}

.form-field__required {
  color: var(--color-accent);
  margin-left: var(--space-1);
}

.form-field__input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  appearance: none;
}

.form-field__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(47, 107, 58, 0.12);
}

.form-field--error .form-field__input {
  border-color: #c0392b;
}

.form-field__textarea {
  resize: vertical;
  min-height: 120px;
}

.form-field__hint {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}

.form-field__error {
  font-size: var(--text-xs);
  color: #c0392b;
  font-weight: 500;
}
</style>
