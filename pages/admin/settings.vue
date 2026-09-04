<script setup lang="ts">
import type { SiteSettings, SiteSocialLink } from '~/types/settings'
import { SOCIAL_PLATFORMS } from '~/types/settings'

definePageMeta({ layout: 'admin' })

type AdminSettingsResponse = { needsSetup: boolean; settings: SiteSettings | null; socialLinks: SiteSocialLink[] }

const loading = ref(true)
const setupRunning = ref(false)
const saving = ref(false)
const needsSetup = ref(false)
const error = ref('')
const success = ref('')

const form = reactive({
  brand_name: '',
  legal_company_name: '',
  public_email: '',
  public_phone: '',
  public_whatsapp_url: '',
  public_address: '',
  copyright_text: '',
})

const socialLinks = ref<SiteSocialLink[]>([])

type LinkEdit = { url: string; sort: string; saving: boolean; error: string }
const linkEdits = ref<Record<number, LinkEdit>>({})

const showAddForm = ref(false)
const newLink = reactive({ platform: '', url: '' })
const addingLink = ref(false)
const addError = ref('')

function initLinkEdit(link: SiteSocialLink) {
  if (!linkEdits.value[link.id]) {
    linkEdits.value[link.id] = { url: link.url, sort: String(link.sort ?? ''), saving: false, error: '' }
  }
}

function platformLabel(platform: string): string {
  return SOCIAL_PLATFORMS.find(p => p.value === platform)?.label ?? platform
}

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<AdminSettingsResponse>('/api/admin/settings')
    needsSetup.value = data.needsSetup
    if (data.settings) {
      form.brand_name = data.settings.brand_name ?? ''
      form.legal_company_name = data.settings.legal_company_name ?? ''
      form.public_email = data.settings.public_email ?? ''
      form.public_phone = data.settings.public_phone ?? ''
      form.public_whatsapp_url = data.settings.public_whatsapp_url ?? ''
      form.public_address = data.settings.public_address ?? ''
      form.copyright_text = data.settings.copyright_text ?? ''
    }
    socialLinks.value = data.socialLinks ?? []
    socialLinks.value.forEach(initLinkEdit)
  } catch {
    error.value = '加载设置失败，请刷新页面'
  } finally {
    loading.value = false
  }
}

async function runSetup() {
  setupRunning.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/settings/setup', { method: 'POST' })
    await loadSettings()
    success.value = '初始化成功，CMS 集合已创建并预置数据'
    setTimeout(() => (success.value = ''), 4000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '初始化失败，请稍后重试'
  } finally {
    setupRunning.value = false
  }
}

async function saveSettings() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await $fetch('/api/admin/settings', {
      method: 'PATCH',
      body: {
        brand_name: form.brand_name || null,
        legal_company_name: form.legal_company_name || null,
        public_email: form.public_email || null,
        public_phone: form.public_phone || null,
        public_whatsapp_url: form.public_whatsapp_url || null,
        public_address: form.public_address || null,
        copyright_text: form.copyright_text || null,
      },
    })
    success.value = '设置已保存，前台 Footer 下次刷新即生效'
    setTimeout(() => (success.value = ''), 4000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(link: SiteSocialLink) {
  try {
    const updated = await $fetch<SiteSocialLink>(`/api/admin/settings/social/${link.id}`, {
      method: 'PATCH',
      body: { enabled: !link.enabled },
    })
    const idx = socialLinks.value.findIndex((l: SiteSocialLink) => l.id === link.id)
    if (idx !== -1) socialLinks.value[idx] = updated
  } catch {
    error.value = '更新失败，请重试'
  }
}

async function saveLink(link: SiteSocialLink) {
  const edit = linkEdits.value[link.id]
  if (!edit) return
  edit.saving = true
  edit.error = ''
  try {
    const updated = await $fetch<SiteSocialLink>(`/api/admin/settings/social/${link.id}`, {
      method: 'PATCH',
      body: { url: edit.url, sort: edit.sort !== '' ? Number(edit.sort) : null },
    })
    const idx = socialLinks.value.findIndex((l: SiteSocialLink) => l.id === link.id)
    if (idx !== -1) socialLinks.value[idx] = updated
    linkEdits.value[link.id] = { url: updated.url, sort: String(updated.sort ?? ''), saving: false, error: '' }
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    edit.error = fe.data?.message ?? '保存失败'
    edit.saving = false
  }
}

async function deleteLink(id: number) {
  if (!window.confirm('确认删除这条社媒链接？')) return
  try {
    await $fetch(`/api/admin/settings/social/${id}`, { method: 'DELETE' })
    socialLinks.value = socialLinks.value.filter((l: SiteSocialLink) => l.id !== id)
    const updatedEdits: Record<number, LinkEdit> = {}
    for (const [k, v] of Object.entries(linkEdits.value) as [string, LinkEdit][]) {
      if (Number(k) !== id) updatedEdits[Number(k)] = v
    }
    linkEdits.value = updatedEdits
  } catch {
    error.value = '删除失败，请重试'
  }
}

async function addLink() {
  addingLink.value = true
  addError.value = ''
  try {
    const created = await $fetch<SiteSocialLink>('/api/admin/settings/social', {
      method: 'POST',
      body: { platform: newLink.platform, url: newLink.url },
    })
    socialLinks.value.push(created)
    initLinkEdit(created)
    newLink.platform = ''
    newLink.url = ''
    showAddForm.value = false
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    addError.value = fe.data?.message ?? '新增失败，请重试'
  } finally {
    addingLink.value = false
  }
}

const availablePlatforms = computed(() =>
  SOCIAL_PLATFORMS.filter(p => !socialLinks.value.some((l: SiteSocialLink) => l.platform === p.value))
)

onMounted(loadSettings)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin" class="back-link">← 管理后台</NuxtLink>
      <h1 class="page-title">网站设置</h1>
    </div>

    <p v-if="error" class="error-banner">{{ error }}</p>
    <p v-if="success" class="success-banner">{{ success }}</p>

    <div v-if="loading" class="loading-state">加载中…</div>

    <template v-else>
      <!-- 初始化 -->
      <div v-if="needsSetup" class="content-card setup-card">
        <h2 class="card-title">首次初始化</h2>
        <p class="setup-desc">尚未检测到 CMS 设置集合。点击下方按钮创建数据结构并预置默认值。</p>
        <button class="btn btn-primary" :disabled="setupRunning" @click="runSetup">
          {{ setupRunning ? '初始化中…' : '初始化 Settings CMS' }}
        </button>
      </div>

      <template v-else>
        <!-- Section 1：公司与联系资料 -->
        <div class="content-card">
          <h2 class="card-title">公司与公开联系资料</h2>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">品牌名称</label>
              <input v-model="form.brand_name" type="text" class="form-input" maxlength="100" placeholder="LITUBO">
            </div>
            <div class="form-group">
              <label class="form-label">法定公司名称</label>
              <input v-model="form.legal_company_name" type="text" class="form-input" maxlength="200" placeholder="Shanghai NingPin Industrial Dev. Co., Ltd.">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">公开邮箱</label>
              <input v-model="form.public_email" type="email" class="form-input" maxlength="254" placeholder="sales@litubo.com">
              <p class="form-hint">Footer 展示邮箱（询盘表单请使用 info@litubo.com）</p>
            </div>
            <div class="form-group">
              <label class="form-label">联系电话</label>
              <input v-model="form.public_phone" type="text" class="form-input" maxlength="50" placeholder="+86 21 5270 7913">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">WhatsApp 链接</label>
            <input v-model="form.public_whatsapp_url" type="url" class="form-input" maxlength="500" placeholder="https://wa.me/8619370713936">
          </div>

          <div class="form-group">
            <label class="form-label">公司地址</label>
            <textarea v-model="form.public_address" class="form-textarea" maxlength="500" rows="2" placeholder="No. 23, Huangtu Rd., Huaqiao Town, Kunshan, Jiangsu Province, China" />
          </div>

          <div class="form-group">
            <label class="form-label">版权声明</label>
            <input v-model="form.copyright_text" type="text" class="form-input" maxlength="200" placeholder="© {year} LITUBO. All rights reserved.">
            <p class="form-hint">使用 {year} 占位符，前台自动替换为当前年份</p>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" :disabled="saving" @click="saveSettings">
              {{ saving ? '保存中…' : '保存设置' }}
            </button>
          </div>
        </div>

        <!-- Section 2：社媒链接 -->
        <div class="content-card">
          <div class="card-header-row">
            <h2 class="card-title card-title--no-border">社媒链接</h2>
            <button
              v-if="availablePlatforms.length > 0"
              class="btn btn-secondary btn-sm"
              @click="showAddForm = !showAddForm"
            >
              {{ showAddForm ? '收起' : '+ 添加链接' }}
            </button>
          </div>
          <div class="card-divider" />

          <div v-if="socialLinks.length === 0 && !showAddForm" class="empty-state">
            暂无社媒链接。点击"+ 添加链接"开始添加。
          </div>

          <div v-for="link in socialLinks" :key="link.id" class="link-row">
            <div class="link-platform">
              <span class="platform-badge" :class="`platform-badge--${link.platform}`">
                {{ platformLabel(link.platform) }}
              </span>
            </div>

            <div class="link-url-field">
              <input
                v-if="linkEdits[link.id]"
                v-model="linkEdits[link.id].url"
                type="url"
                class="form-input form-input--sm"
                placeholder="https://"
              >
              <p v-if="linkEdits[link.id]?.error" class="link-error">{{ linkEdits[link.id].error }}</p>
            </div>

            <div class="link-sort-field">
              <input
                v-if="linkEdits[link.id]"
                v-model="linkEdits[link.id].sort"
                type="number"
                class="form-input form-input--sm form-input--sort"
                min="1"
                placeholder="顺序"
              >
            </div>

            <div class="link-actions">
              <button
                class="btn btn-sm"
                :class="link.enabled ? 'btn-enabled' : 'btn-disabled-toggle'"
                :title="link.enabled ? '点击禁用' : '点击启用'"
                @click="toggleEnabled(link)"
              >
                {{ link.enabled ? '显示' : '隐藏' }}
              </button>
              <button
                class="btn btn-primary btn-sm"
                :disabled="linkEdits[link.id]?.saving"
                @click="saveLink(link)"
              >
                {{ linkEdits[link.id]?.saving ? '…' : '保存' }}
              </button>
              <button class="btn btn-danger btn-sm" @click="deleteLink(link.id)">删除</button>
            </div>
          </div>

          <!-- 新增表单 -->
          <div v-if="showAddForm" class="add-link-form">
            <h3 class="add-form-title">添加新社媒链接</h3>
            <p v-if="addError" class="link-error">{{ addError }}</p>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">平台</label>
                <select v-model="newLink.platform" class="form-input">
                  <option value="" disabled>选择平台</option>
                  <option v-for="p in availablePlatforms" :key="p.value" :value="p.value">{{ p.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">链接地址</label>
                <input v-model="newLink.url" type="url" class="form-input" placeholder="https://">
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" :disabled="addingLink || !newLink.platform || !newLink.url" @click="addLink">
                {{ addingLink ? '添加中…' : '确认添加' }}
              </button>
              <button class="btn btn-ghost" @click="showAddForm = false; addError = ''">取消</button>
            </div>
          </div>
        </div>

        <!-- Section 3：安全与 AI 连接（只读） -->
        <div class="content-card">
          <h2 class="card-title">安全与 AI 连接</h2>
          <div class="readonly-section">
            <div class="readonly-row">
              <span class="readonly-label">AI 集成状态</span>
              <span class="readonly-value readonly-value--pending">未连接（Phase M5 规划中）</span>
            </div>
            <div class="readonly-row">
              <span class="readonly-label">API 凭证</span>
              <span class="readonly-value readonly-value--muted">在服务器 .env 文件中配置，不在此界面显示</span>
            </div>
            <div class="readonly-row">
              <span class="readonly-label">管理员权限</span>
              <span class="readonly-value readonly-value--ok">Administrator 角色（Directus 内置）</span>
            </div>
          </div>
          <p class="form-hint" style="margin-top: var(--space-4);">
            此区域为只读策略面板。凭证管理请通过服务器直接操作 .env 文件。AI 功能将在 Phase M5 独立授权后开放。
          </p>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page { padding: var(--space-8); display: flex; flex-direction: column; gap: var(--space-6); }
.page-header { margin-bottom: 0; }
.back-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; display: block; margin-bottom: var(--space-3); }
.back-link:hover { text-decoration: underline; }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--color-ink); margin: 0; }

.content-card { background: white; border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-8); }
.setup-card { display: flex; flex-direction: column; gap: var(--space-4); }
.setup-desc { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }
.card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-line); }
.card-title--no-border { border-bottom: none; margin: 0; padding-bottom: 0; }
.card-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
.card-divider { height: 1px; background: var(--color-line); margin-bottom: var(--space-5); }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.form-group { margin-bottom: var(--space-5); }
.form-label { display: block; font-size: var(--text-sm); font-weight: 500; color: var(--color-ink); margin-bottom: var(--space-2); }
.form-input { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); color: var(--color-ink); background: white; width: 100%; box-sizing: border-box; }
.form-input--sm { padding: var(--space-1) var(--space-2); font-size: var(--text-sm); }
.form-input--sort { width: 80px; }
.form-textarea { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); color: var(--color-ink); background: white; width: 100%; box-sizing: border-box; resize: vertical; }
.form-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: var(--space-1) 0 0; }
.form-actions { display: flex; gap: var(--space-3); margin-top: var(--space-4); }

.link-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid var(--color-line); flex-wrap: wrap; }
.link-platform { flex-shrink: 0; }
.platform-badge { font-size: var(--text-xs); font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.platform-badge--linkedin { background: #0a66c2; color: white; }
.platform-badge--youtube { background: #ff0000; color: white; }
.platform-badge--instagram { background: #e1306c; color: white; }
.platform-badge--facebook { background: #1877f2; color: white; }
.link-url-field { flex: 1; min-width: 200px; }
.link-sort-field { flex-shrink: 0; }
.link-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }
.link-error { font-size: var(--text-xs); color: #c0392b; margin: 2px 0 0; }

.empty-state { padding: var(--space-6); text-align: center; color: var(--color-ink-muted); font-size: var(--text-sm); }

.add-link-form { margin-top: var(--space-5); padding-top: var(--space-5); border-top: 1px dashed var(--color-line); }
.add-form-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink-muted); margin: 0 0 var(--space-4); }

.readonly-section { display: flex; flex-direction: column; gap: var(--space-3); }
.readonly-row { display: flex; align-items: baseline; gap: var(--space-4); }
.readonly-label { font-size: var(--text-sm); font-weight: 500; color: var(--color-ink); min-width: 120px; }
.readonly-value { font-size: var(--text-sm); color: var(--color-ink-muted); }
.readonly-value--pending { color: #e67e22; }
.readonly-value--ok { color: #0c6e4e; }
.readonly-value--muted { color: var(--color-ink-muted); font-style: italic; }

.loading-state { padding: var(--space-8); text-align: center; color: var(--color-ink-muted); font-size: var(--text-sm); }

.btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 500; cursor: pointer; border: 1px solid transparent; line-height: 1.4; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-sm { padding: var(--space-1) var(--space-2); font-size: var(--text-xs); }
.btn-primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-secondary { background: white; color: var(--color-primary); border-color: var(--color-primary); }
.btn-secondary:hover { background: #f0f9f5; }
.btn-ghost { background: transparent; color: var(--color-ink-muted); border-color: var(--color-line); }
.btn-ghost:hover { background: #f8f8f8; }
.btn-enabled { background: #d1f0e8; color: #0c6e4e; border-color: #a3dbc8; }
.btn-disabled-toggle { background: #f4f4f4; color: var(--color-ink-muted); border-color: var(--color-line); }
.btn-danger { background: #fdf0ee; color: #c0392b; border-color: #f5c6c2; }
.btn-danger:hover { background: #f5c6c2; }

.error-banner { background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); color: #C0392B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: 0; }
.success-banner { background: #D1F0E8; border: 1px solid #A3DBC8; border-radius: var(--radius-sm); color: #0F5C4B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: 0; }

@media (max-width: 767px) {
  .page { padding: var(--space-4); }
  .form-row { grid-template-columns: 1fr; }
  .link-row { flex-direction: column; align-items: flex-start; }
  .link-url-field { width: 100%; }
  .form-input--sort { width: 100%; }
  .btn { min-height: 44px; }
  .form-input, .form-textarea { min-height: 44px; }
}
</style>
