<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'accent' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  as?: 'button' | 'a'
  href?: string
  disabled?: boolean
}>()
</script>

<template>
  <component
    :is="as ?? 'button'"
    class="base-btn"
    :class="[
      `base-btn--${variant ?? 'primary'}`,
      `base-btn--${size ?? 'md'}`,
      { 'base-btn--disabled': disabled },
    ]"
    :href="href"
    :disabled="as !== 'a' ? disabled : undefined"
  >
    <slot />
  </component>
</template>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-body);
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
  text-decoration: none;
  white-space: nowrap;
}

.base-btn--sm  { padding: var(--space-1) var(--space-4);  font-size: var(--text-xs); }
.base-btn--md  { padding: var(--space-2) var(--space-6);  font-size: var(--text-sm); }
.base-btn--lg  { padding: var(--space-3) var(--space-8);  font-size: var(--text-base); }

.base-btn--primary {
  background: var(--color-primary);
  color: var(--color-white);
  border-color: var(--color-primary);
}
.base-btn--primary:hover {
  background: #0a4a3b;
  border-color: #0a4a3b;
}

.base-btn--accent {
  background: var(--color-accent);
  color: var(--color-white);
  border-color: var(--color-accent);
}
.base-btn--accent:hover {
  background: #B87A00;
  border-color: #B87A00;
}

.base-btn--outline {
  background: transparent;
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.base-btn--outline:hover {
  background: var(--color-primary);
  color: var(--color-white);
}

.base-btn--ghost {
  background: transparent;
  color: var(--color-ink);
  border-color: var(--color-line);
}
.base-btn--ghost:hover {
  background: var(--color-surface-alt);
}

.base-btn--disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
