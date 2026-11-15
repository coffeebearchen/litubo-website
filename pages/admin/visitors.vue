<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Live visitors — LITUBO Admin' })

interface VisitorRow {
  id: number
  path: string
  referrer: string | null
  source: string | null
  country: string | null
  duration_ms: number | null
  session_id: string | null
  created_at: string
}

interface VisitorsPayload {
  liveCount: number
  live: VisitorRow[]
  recent: VisitorRow[]
  totals: { todayViews: number; todayCountries: number }
  topPages: { path: string; views: number; seconds: number }[]
  countries: { code: string; count: number }[]
  sources: { name: string; count: number }[]
}

const { data, status, error, refresh } = await useFetch<VisitorsPayload>('/api/admin/visitors')

// Auto-refresh so the board behaves like a live view.
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => refresh(), 30_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const countryName = (code: string) => {
  if (!code || code === 'XX') return 'Unknown'
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'region' })
    return display.of(code) || code
  }
  catch {
    return code
  }
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const duration = (ms: number | null) => {
  const s = Math.round((ms ?? 0) / 1000)
  if (!s) return '—'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
</script>

<template>
  <section class="visitors">
    <header>
      <div>
        <h1>Live visitors</h1>
        <p>Anonymous page views — no cookies, no IP addresses. Updates every 30 seconds.</p>
      </div>
      <button type="button" @click="refresh()">Refresh</button>
    </header>

    <p v-if="error" role="alert">Could not load visitor data. Check the CMS connection.</p>
    <p v-else-if="status === 'pending'">Loading visitor data…</p>

    <template v-else-if="data">
      <div class="cards">
        <div class="card">
          <span class="card__value">{{ data.liveCount }}</span>
          <span class="card__label">Online now (5 min)</span>
        </div>
        <div class="card">
          <span class="card__value">{{ data.totals.todayViews }}</span>
          <span class="card__label">Page views (24 h)</span>
        </div>
        <div class="card">
          <span class="card__value">{{ data.totals.todayCountries }}</span>
          <span class="card__label">Countries (24 h)</span>
        </div>
      </div>

      <div class="panels">
        <div class="panel">
          <h2>Online now</h2>
          <p v-if="!data.live.length" class="empty">No visitors in the last five minutes.</p>
          <ul v-else class="list">
            <li v-for="row in data.live" :key="row.id">
              <span class="list__main">{{ row.path }}</span>
              <span class="list__meta">{{ countryName(row.country || 'XX') }} · {{ row.source }} · {{ time(row.created_at) }}</span>
            </li>
          </ul>
        </div>

        <div class="panel">
          <h2>Top pages (24 h)</h2>
          <p v-if="!data.topPages.length" class="empty">No page views yet.</p>
          <ul v-else class="list">
            <li v-for="page in data.topPages" :key="page.path">
              <span class="list__main">{{ page.path }}</span>
              <span class="list__meta">{{ page.views }} views · {{ page.seconds }}s total</span>
            </li>
          </ul>
        </div>

        <div class="panel">
          <h2>Countries (24 h)</h2>
          <p v-if="!data.countries.length" class="empty">No data yet.</p>
          <ul v-else class="list">
            <li v-for="c in data.countries" :key="c.code">
              <span class="list__main">{{ countryName(c.code) }}</span>
              <span class="list__meta">{{ c.count }} views</span>
            </li>
          </ul>
        </div>

        <div class="panel">
          <h2>Sources (24 h)</h2>
          <p v-if="!data.sources.length" class="empty">No data yet.</p>
          <ul v-else class="list">
            <li v-for="s in data.sources" :key="s.name">
              <span class="list__main">{{ s.name }}</span>
              <span class="list__meta">{{ s.count }} views</span>
            </li>
          </ul>
        </div>
      </div>

      <h2 class="recent-title">Recent views</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Page</th><th>Country</th><th>Source</th><th>Duration</th></tr></thead>
          <tbody>
            <tr v-for="row in data.recent" :key="row.id">
              <td>{{ time(row.created_at) }}</td>
              <td class="mono">{{ row.path }}</td>
              <td>{{ countryName(row.country || 'XX') }}</td>
              <td>{{ row.source }}</td>
              <td>{{ duration(row.duration_ms) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.visitors { display: flex; flex-direction: column; gap: 20px; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
h1 { font-size: 24px; margin: 0 0 4px; }
header p { margin: 0; color: #5b6b64; font-size: 14px; }
h2 { font-size: 15px; margin: 0 0 10px; }

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.card { background: #fff; border: 1px solid #dde3dd; border-radius: 6px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.card__value { font-size: 30px; font-weight: 700; color: #1B4224; }
.card__label { font-size: 12px; color: #5b6b64; }

.panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.panel { background: #fff; border: 1px solid #dde3dd; border-radius: 6px; padding: 16px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.list li { display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid #eef1ee; padding-bottom: 6px; }
.list li:last-child { border-bottom: 0; }
.list__main { font-size: 13px; color: #18332B; word-break: break-all; }
.list__meta { font-size: 12px; color: #6b7a73; }

.recent-title { margin-top: 8px; }
.table-wrap { overflow-x: auto; background: #fff; border: 1px solid #dde3dd; border-radius: 6px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eef1ee; }
th { background: #f6f8f6; font-weight: 600; color: #3c4b45; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.empty { color: #6b7a73; font-size: 13px; margin: 0; }
</style>
