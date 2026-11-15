#!/usr/bin/env node
/**
 * DSH — Wix 产品媒体上传到 Directus Media Library（本地开发库）。
 * 只读 plan.json + manifest.json，把 wix-media/ 下的图片上传，并关联：
 *   - role=hero    → products.hero_image（单文件外键）
 *   - role=gallery → products_files 联结表（file_role='gallery'）
 * 幂等：文件以 filename 为 title 去重；联结记录按 (products_id, directus_files_id) 去重。
 * 凭证经环境变量 WIX_MEDIA_UPLOAD_TOKEN 注入，不读 .env，不打印 token。
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), 'private-product-source')
const base = 'http://127.0.0.1:8055'
const token = process.env.WIX_MEDIA_UPLOAD_TOKEN
if (!token) throw new Error('WIX_MEDIA_UPLOAD_TOKEN not set; no network call made.')
const H = { Authorization: `Bearer ${token}` }
const J = { 'Content-Type': 'application/json' }

const plan = JSON.parse(await readFile(resolve(root, 'migration-plan/plan.json'), 'utf8'))
const manifest = JSON.parse(await readFile(resolve(root, 'wix-media/manifest.json'), 'utf8'))
const uriToFile = new Map()
for (const m of manifest) if (m.ok) uriToFile.set(m.uri, m.filename)

// products slug -> id
const prodRes = await fetch(`${base}/items/products?fields=id,slug&limit=100`, { headers: H })
const products = (await prodRes.json()).data
const slugToId = new Map(products.map(p => [p.slug, p.id]))

// 已有文件 title -> id（幂等）
const filesRes = await fetch(`${base}/files?fields=id,title&limit=-1`, { headers: H })
const existingFiles = (await filesRes.json()).data
const titleToId = new Map(existingFiles.map(f => [f.title, f.id]))

const stats = { uploaded: 0, reused: 0, heroes: 0, gallery: 0, skipped: 0, noImage: 0 }

async function ensureFile(filename) {
  if (titleToId.has(filename)) { stats.reused++; return titleToId.get(filename) }
  const bytes = await readFile(resolve(root, 'wix-media', filename))
  const form = new FormData()
  form.append('title', filename)
  form.append('file', new Blob([bytes], { type: 'image/png' }), filename)
  const res = await fetch(`${base}/files`, { method: 'POST', headers: H, body: form })
  if (!res.ok) throw new Error(`upload failed ${filename}: HTTP ${res.status}`)
  const id = (await res.json()).data.id
  titleToId.set(filename, id)
  stats.uploaded++
  return id
}

for (const item of plan.products) {
  const pid = slugToId.get(item.product.slug)
  if (!pid) { stats.skipped++; continue }
  if (!item.media || item.media.length === 0) { stats.noImage++; continue }
  for (const m of item.media) {
    const fn = uriToFile.get(m.uri)
    if (!fn) continue
    const fid = await ensureFile(fn)
    if (m.role === 'hero') {
      const res = await fetch(`${base}/items/products/${pid}`, { method: 'PATCH', headers: { ...H, ...J }, body: JSON.stringify({ hero_image: fid }) })
      if (res.ok) stats.heroes++
    } else {
      const q = `${base}/items/products_files?filter[products_id][_eq]=${pid}&filter[directus_files_id][_eq]=${fid}&limit=1`
      const jr = await fetch(q, { headers: H })
      const jd = (await jr.json()).data
      if (jd.length === 0) {
        const body = { products_id: pid, directus_files_id: fid, file_role: 'gallery', alt_en: item.product.name_en, sort: 1, enabled: true }
        await fetch(`${base}/items/products_files`, { method: 'POST', headers: { ...H, ...J }, body: JSON.stringify(body) })
        stats.gallery++
      }
    }
  }
}

console.log(JSON.stringify(stats))
