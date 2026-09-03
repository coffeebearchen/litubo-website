<script setup lang="ts">
import type { AdminUser } from '~/types/product-cms'

const user = ref<AdminUser | null>(null)
const router = useRouter()

onMounted(async () => {
  try {
    user.value = await $fetch<AdminUser>('/api/admin/auth/me')
  } catch {
    router.push('/admin/login')
  }
})

async function logout() {
  await $fetch('/api/admin/auth/logout', { method: 'POST' })
  user.value = null
  router.push('/admin/login')
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="sidebar-brand">
        <span class="brand-mark">L</span>
        <span class="brand-name">LITUBO Admin</span>
      </div>

      <nav class="sidebar-nav">
        <p class="nav-section-label">内容管理</p>
        <NuxtLink to="/admin/products" class="nav-item" active-class="nav-item--active">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          Product Center
        </NuxtLink>
        <span class="nav-item nav-item--disabled" title="Phase 9A-2 后开放">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Content Center
        </span>
        <span class="nav-item nav-item--disabled" title="Phase 9A-2 后开放">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Media Library
        </span>
        <span class="nav-item nav-item--disabled" title="Phase 9A-2 后开放">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M20 12h2M2 12h2M12 20v2M12 2v2"/></svg>
          Settings
        </span>
      </nav>

      <div class="sidebar-footer">
        <div v-if="user" class="user-info">
          <span class="user-name">{{ user.first_name ?? user.email }}</span>
          <button class="logout-btn" @click="logout">退出</button>
        </div>
      </div>
    </aside>

    <div class="admin-main">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: #F4F6F5;
}

.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--color-primary-deep);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 10;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.brand-mark {
  width: 28px;
  height: 28px;
  background: var(--color-accent);
  color: white;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  flex-shrink: 0;
}

.brand-name {
  color: white;
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.sidebar-nav {
  flex: 1;
  padding: var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  padding: var(--space-3) var(--space-2) var(--space-1);
  margin: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast);
  cursor: pointer;
  user-select: none;
}

.nav-item:not(.nav-item--disabled):hover {
  background: rgba(255,255,255,0.08);
  color: white;
}

.nav-item--active {
  background: rgba(255,255,255,0.12) !important;
  color: white !important;
}

.nav-item--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.sidebar-footer {
  padding: var(--space-4);
  border-top: 1px solid rgba(255,255,255,0.08);
}

.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.user-name {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.5);
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: color var(--transition-fast);
}

.logout-btn:hover {
  color: white;
}

.admin-main {
  margin-left: 220px;
  flex: 1;
  min-width: 0;
}

@media (max-width: 767px) {
  .admin-sidebar {
    display: none;
  }

  .admin-main {
    margin-left: 0;
  }
}
</style>
