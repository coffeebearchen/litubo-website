<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()

onMounted(async () => {
  try {
    await $fetch('/api/admin/auth/me')
    router.replace('/admin/products')
  } catch {
    // Not logged in, stay on login page
  }
})

async function submit() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = '请输入邮箱和密码'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/admin/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    router.push('/admin/products')
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string }; statusCode?: number }
    if (fe.statusCode === 429) {
      error.value = fe.data?.message ?? '登录尝试过多，请稍后重试'
    } else if (fe.statusCode === 403) {
      error.value = '该账号无管理员权限'
    } else {
      error.value = '邮箱或密码错误'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-shell">
    <div class="login-card">
      <div class="login-brand">
        <span class="brand-mark">L</span>
        <div>
          <p class="brand-title">LITUBO Admin</p>
          <p class="brand-sub">产品管理后台</p>
        </div>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <div class="field">
          <label class="label">管理员邮箱</label>
          <input
            v-model="email"
            class="input"
            type="email"
            autocomplete="email"
            required
            placeholder="name@company.com"
          >
        </div>

        <div class="field">
          <label class="label">密码</label>
          <input
            v-model="password"
            class="input"
            type="password"
            autocomplete="current-password"
            required
          >
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="submit-btn" type="submit" :disabled="loading">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  background: #F4F6F5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.login-card {
  background: white;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-menu);
  padding: var(--space-10);
  width: 100%;
  max-width: 400px;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.brand-mark {
  width: 40px;
  height: 40px;
  background: var(--color-primary);
  color: white;
  font-weight: 700;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  flex-shrink: 0;
}

.brand-title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
}

.brand-sub {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: 0;
}

.login-form { display: flex; flex-direction: column; gap: var(--space-4); }

.field { display: flex; flex-direction: column; gap: var(--space-1); }

.label { font-size: var(--text-sm); font-weight: 500; color: var(--color-ink); }

.input {
  padding: var(--space-3) var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  transition: border-color var(--transition-fast);
}

.input:focus { outline: none; border-color: var(--color-primary); }

.error-msg {
  font-size: var(--text-sm);
  color: #C0392B;
  background: #FDF0EE;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}

.submit-btn {
  padding: var(--space-3);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast);
  margin-top: var(--space-2);
}

.submit-btn:hover:not(:disabled) { background: var(--color-primary-deep); }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
