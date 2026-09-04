<script setup lang="ts">
import type { AdminUser } from '~/types/product-cms'

const user = ref<AdminUser | null>(null)
const router = useRouter()
const menuOpen = ref(false)

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

function closeMenu() {
  menuOpen.value = false
}
</script>

<template>
  <div class="admin-shell">
    <!-- 移动端顶部导航栏 -->
    <div class="admin-topbar">
      <button class="topbar-menu-btn" aria-label="打开菜单" @click="menuOpen = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span class="topbar-brand">LITUBO Admin</span>
    </div>

    <!-- 移动端遮罩层 -->
    <div v-if="menuOpen" class="sidebar-overlay" @click="closeMenu" />

    <!-- 侧边栏 -->
    <aside class="admin-sidebar" :class="{ 'sidebar--open': menuOpen }">
      <div class="sidebar-brand">
        <span class="brand-mark">L</span>
        <span class="brand-name">LITUBO Admin</span>
        <button class="sidebar-close" aria-label="关闭菜单" @click="closeMenu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav">
        <p class="nav-section-label">内容管理</p>
        <NuxtLink to="/admin/products" class="nav-item" active-class="nav-item--active" @click="closeMenu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Product Center
        </NuxtLink>
        <span class="nav-item nav-item--disabled" title="Phase 9A-2 后开放">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Content Center
        </span>
        <NuxtLink to="/admin/media" class="nav-item" active-class="nav-item--active" @click="closeMenu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Media Library
        </NuxtLink>
        <span class="nav-item nav-item--disabled" title="Phase 9A-2 后开放">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M20 12h2M2 12h2M12 20v2M12 2v2" />
          </svg>
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
/* ── Shell ── */
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: #F4F6F5;
}

/* ── 移动端顶部栏 ── */
.admin-topbar {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 52px;
  background: white;
  border-bottom: 1px solid var(--color-line);
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  z-index: 50;
}

.topbar-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-primary-deep);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.topbar-menu-btn:hover { background: rgba(18, 60, 50, 0.06); }

.topbar-brand {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-primary-deep);
  letter-spacing: 0.01em;
}

/* ── 侧边栏 ── */
.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: white;
  border-right: 1px solid var(--color-line);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 60;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4);
  border-bottom: 1px solid var(--color-line);
}

.brand-mark {
  width: 28px;
  height: 28px;
  background: var(--color-primary);
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
  color: var(--color-primary-deep);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.01em;
  flex: 1;
}

.sidebar-close {
  display: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-ink-muted);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.sidebar-close:hover { background: rgba(18, 60, 50, 0.06); }

/* ── 导航 ── */
.sidebar-nav {
  flex: 1;
  padding: var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
}

.nav-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
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
  color: var(--color-ink-muted);
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast);
  cursor: pointer;
  user-select: none;
}

.nav-item:not(.nav-item--disabled):hover {
  background: rgba(18, 60, 50, 0.06);
  color: var(--color-primary-deep);
}

.nav-item--active {
  background: rgba(18, 60, 50, 0.1) !important;
  color: var(--color-primary-deep) !important;
  font-weight: 500;
}

.nav-item--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── 侧边栏底部 ── */
.sidebar-footer {
  padding: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.user-name {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  background: none;
  border: 1px solid var(--color-line);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.logout-btn:hover {
  color: var(--color-primary-deep);
  border-color: var(--color-primary-deep);
}

/* ── 主内容区 ── */
.admin-main {
  margin-left: 220px;
  flex: 1;
  min-width: 0;
}

/* ── 移动端遮罩 ── */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 55;
}

/* ── 响应式：≤ 767px ── */
@media (max-width: 767px) {
  .admin-topbar {
    display: flex;
  }

  .admin-sidebar {
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: var(--shadow-menu);
    border-right: none;
  }

  .admin-sidebar.sidebar--open {
    transform: translateX(0);
  }

  .sidebar-close {
    display: flex;
  }

  .admin-main {
    margin-left: 0;
    padding-top: 52px;
  }
}
</style>
