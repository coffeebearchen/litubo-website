/**
 * 给已发布文章补 SEO 标题与描述（posts.seo_title_en / seo_description_en）。
 *
 * 为什么需要：25 篇已发布文章的这两栏全空，而页面刚刚接上这两个字段（在此之前即使填了也不会被读取）。
 *
 * 规则（都在代码里强制，不靠模型自觉）：
 *   · 只用文章自己的标题、摘要、正文（去 HTML 后的前 1200 字）作为素材，不引入外部事实
 *   · seoTitle 30–65 字符；seoDescription 70–165 字符
 *   · 不许出现 URL、换行、引号、惊叹号，不许出现夸张词（best / #1 / world's leading / guaranteed …）
 *   · 逐条调用、逐条校验；任何一条不合规就跳过并报告，不写库
 *
 * 用法：
 *   node scripts/backfill-seo.mjs --dry-run            # 只生成并打印候选
 *   node scripts/backfill-seo.mjs --apply              # 写库（先写 backup/ 快照）
 *   node scripts/backfill-seo.mjs --apply --limit 3    # 只处理前 3 篇
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const LIMIT = Number((args[args.indexOf('--limit') + 1] ?? '').match(/^\d+$/)?.[0] ?? Infinity)
const ONLY = args.includes('--only') ? String(args[args.indexOf('--only') + 1] ?? '') : ''

function env(path = '.env') {
  const map = new Map()
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (m) map.set(m[1], m[2].trim().replace(/^["']|["']$/g, ''))
  }
  return map
}

const E = env()
const DIRECTUS = E.get('DIRECTUS_URL') ?? 'http://127.0.0.1:8055'
const KEY = E.get('DEEPSEEK_API_KEY')
const MODEL = E.get('DEEPSEEK_MODEL') ?? 'deepseek-chat'
if (!KEY) { console.error('缺少 DEEPSEEK_API_KEY'); process.exit(1) }

const login = await fetch(`${DIRECTUS}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: E.get('DIRECTUS_ADMIN_EMAIL'), password: E.get('DIRECTUS_ADMIN_PASSWORD') }),
}).then(r => r.json())
const TOKEN = login?.data?.access_token
if (!TOKEN) { console.error('Directus 登录失败'); process.exit(1) }
const dh = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

const BANNED = [/https?:\/\//i, /\bbest\b/i, /#1\b/, /world'?s leading/i, /guarantee/i, /revolutionary/i, /cutting[- ]edge/i, /!\s*$/, /["“”]/]

function strip(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, '\'')
    .replace(/\s+/g, ' ').trim()
}

function validate(title, description) {
  const problems = []
  const t = String(title ?? '').trim()
  const d = String(description ?? '').trim()
  if (t.length < 30 || t.length > 65) problems.push(`seoTitle 长度 ${t.length} 不在 30–65`)
  if (d.length < 70 || d.length > 165) problems.push(`seoDescription 长度 ${d.length} 不在 70–165`)
  for (const v of [t, d]) {
    if (!v) problems.push('空值')
    if (/[\r\n]/.test(v)) problems.push('含换行')
    for (const re of BANNED) if (re.test(v)) problems.push(`含禁用内容 ${re}`)
  }
  return problems
}

const res = await fetch(`${DIRECTUS}/items/posts?filter[status][_eq]=published&fields=id,slug,title_en,excerpt_en,body_en,content_type&limit=100&sort=id`, { headers: dh }).then(r => r.json())
const posts = (res.data ?? []).filter(p => !ONLY || p.slug === ONLY).slice(0, LIMIT)
console.log(`待处理 ${posts.length} 篇（apply=${APPLY}）`)

const results = []
for (const [i, post] of posts.entries()) {
  const source = [
    `Working title: ${post.title_en ?? ''}`,
    `Existing summary: ${strip(post.excerpt_en)}`,
    `Body excerpt: ${strip(post.body_en).slice(0, 1200)}`,
  ].join('\n')

  const prompt = [
    'You write SEO metadata for an industrial equipment manufacturer (food and packaging inspection:',
    'metal detection, checkweighers, X-ray, combination systems). Use ONLY the material below.',
    'Do not invent numbers, certifications, customer names or claims.',
    'Return JSON: {"seoTitle": string, "seoDescription": string}.',
    'seoTitle: 30-65 characters, states what the article helps the reader do, no trailing period, no',
    '  site name suffix. seoDescription: 70-165 characters, one or two sentences, concrete, no hype,',
    '  no exclamation mark, no quotes.',
    '',
    source,
  ].join('\n')

  let proposal = null
  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You return only valid JSON. No prose, no markdown fences.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 2000,
      }),
    })
    if (!r.ok) throw new Error(`provider ${r.status} ${(await r.text()).slice(0, 160)}`)
    const body = await r.json()
    proposal = JSON.parse(body.choices?.[0]?.message?.content ?? '{}')
  }
  catch (error) {
    console.log(`  [${i + 1}/${posts.length}] ${post.slug}  调用失败：${error.message}`)
    results.push({ post, proposal: null, problems: ['调用失败'] })
    continue
  }

  const problems = validate(proposal.seoTitle, proposal.seoDescription)
  console.log(`  [${i + 1}/${posts.length}] ${post.slug}`)
  console.log(`      title(${String(proposal.seoTitle ?? '').length}): ${proposal.seoTitle ?? ''}`)
  console.log(`      desc(${String(proposal.seoDescription ?? '').length}): ${proposal.seoDescription ?? ''}`)
  if (problems.length) console.log(`      跳过：${problems.join('; ')}`)
  results.push({ post, proposal, problems })
}

const good = results.filter(r => r.proposal && r.problems.length === 0)
console.log(`\n通过校验 ${good.length} / ${results.length}`)
if (!APPLY) { console.log('dry-run：未写库'); process.exit(0) }
if (good.length === 0) { console.log('没有可写入的条目'); process.exit(0) }

const dir = join(process.cwd(), 'backup', '2026-11-17')
mkdirSync(dir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = join(dir, `posts-seo-before-${stamp}.json`)
writeFileSync(backupPath, JSON.stringify(results.map(r => ({
  id: r.post.id, slug: r.post.slug,
  before: { seo_title_en: null, seo_description_en: null },
  proposed: r.proposal,
  problems: r.problems,
})), null, 2), 'utf8')
console.log(`备份：${backupPath}`)

let written = 0
for (const { post, proposal } of good) {
  const r = await fetch(`${DIRECTUS}/items/posts/${post.id}`, {
    method: 'PATCH', headers: dh,
    body: JSON.stringify({
      seo_title_en: proposal.seoTitle.trim(),
      seo_description_en: proposal.seoDescription.trim(),
    }),
  })
  if (!r.ok) { console.log(`  写入失败 ${post.slug}: ${r.status} ${(await r.text()).slice(0, 120)}`); continue }
  written++
}
console.log(`已写入 ${written} 篇`)
