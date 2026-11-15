#!/usr/bin/env node
// Offline migration review artifact only. Never read by public Nuxt routes.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)), 'private-product-source')
const output = resolve(root, 'review-site')
const plan = JSON.parse(await readFile(resolve(root, 'migration-plan/plan.json'), 'utf8'))
const media = JSON.parse(await readFile(resolve(root, 'wix-media/manifest.json'), 'utf8'))
if (plan.version !== 1 || plan.issues.some(issue => issue.severity === 'error')) throw new Error('Resolve export errors before generating review pages')
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const slugs = new Set()
for (const item of plan.products) {
  const slug = item.product.slug
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) throw new Error('Invalid or duplicate review page slug')
  slugs.add(slug)
}
await mkdir(resolve(output, 'images'), { recursive: true })
const images = new Map()
const copied = new Set()
for (const file of media.filter(file => file.ok)) {
  if (!/^[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(file.filename)) continue
  if (!copied.has(file.filename)) {
    await copyFile(resolve(root, 'wix-media', file.filename), resolve(output, 'images', file.filename))
    copied.add(file.filename)
  }
  images.set(file.uri, `images/${file.filename}`)
}
const css = `*{box-sizing:border-box}body{margin:0;background:#faf8f3;color:#18332b;font:16px/1.7 system-ui,sans-serif}a{color:#0f5c4b}header{background:#fff;border-bottom:1px solid #d9ddd6;padding:18px 6%;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}.brand{font:700 26px Georgia;letter-spacing:2px}.notice{background:#fff3d6;padding:10px 6%;font-size:13px}main{max-width:1200px;padding:36px 24px;margin:auto}h1,h2{font-family:Georgia,serif;line-height:1.2}h1{font-size:clamp(28px,4vw,46px)}h2{font-size:28px}h3{line-height:1.3}.intro{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}.image{height:350px;background:white;display:flex;align-items:center;justify-content:center;padding:24px;border:1px solid #d9ddd6}.image img{width:100%;height:100%;object-fit:contain}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.card{background:white;border:1px solid #d9ddd6;padding:20px;text-decoration:none}.card img{width:100%;height:180px;object-fit:contain}.model{color:#0f5c4b;font-weight:600}.section{margin:36px 0;background:white;padding:28px;border:1px solid #d9ddd6}.body{white-space:pre-line}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:12px;border-bottom:1px solid #d9ddd6;overflow-wrap:anywhere}th{width:35%}.meta{font-size:13px;overflow-wrap:anywhere;color:#4a5e58}details{margin-top:30px}footer{padding:28px 6%;border-top:1px solid #d9ddd6}@media(max-width:700px){.intro,.grid{grid-template-columns:1fr}.image{height:280px}.section{padding:18px}main{padding:24px 16px}}`
await writeFile(resolve(output, 'style.css'), css)
const shell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(title)} — LITUBO review</title><link rel="stylesheet" href="style.css"></head><body><header><a class="brand" href="index.html">LITUBO</a><span>Food & Packaging Inspection</span></header><div class="notice">内部资料预览 · 来源为Wix导出 · 未入库、未发布 · 参数和配置由公司人员再次确认</div><main>${body}</main><footer>Internal migration review. This package does not submit inquiries or connect to a CRM.</footer></body></html>`
const imageFor = item => images.get(item.media.find(file => file.role === 'hero')?.uri)
const imageTag = item => imageFor(item) ? `<img src="${escape(imageFor(item))}" alt="${escape(item.product.name_en)}" loading="lazy">` : '<span>Product image to be supplied</span>'
const categories = [...new Set(plan.products.map(item => item.categoryName))]
const cards = categories.map(category => `<section><h2>${escape(category)}</h2><div class="grid">${plan.products.filter(item => item.categoryName === category).map(item => `<a class="card" href="${escape(item.product.slug)}.html">${imageTag(item)}<p class="model">${escape(item.product.model_or_series)}</p><h3>${escape(item.product.name_en)}</h3><span>View product →</span></a>`).join('')}</div></section>`).join('')
await writeFile(resolve(output, 'index.html'), shell('Product catalogue', `<h1>Inspection Equipment</h1><p>${plan.products.length} products from the saved Wix source. This is a content review, not a live backend preview.</p>${cards}`))
for (const item of plan.products) {
  const sections = item.sections.map(section => `<section class="section"><h2>${escape(section.title_en)}</h2><p class="body">${escape(section.body_en)}</p></section>`).join('')
  const specs = item.specifications.length ? `<section class="section"><h2>Technical specifications</h2><table><tbody>${item.specifications.map(row => `<tr><th>${escape(row.label_en)}</th><td>${escape(row.value_en)}</td></tr>`).join('')}</tbody></table></section>` : ''
  const review = `<details><summary>Source and review items / 来源与待核对项</summary><p class="meta">${escape(item.source)}</p><ul>${item.issues.map(issue => `<li>${escape(issue.code)}: ${escape(issue.detail)}</li>`).join('')}</ul></details>`
  await writeFile(resolve(output, `${item.product.slug}.html`), shell(item.product.name_en, `<p><a href="index.html">← Product catalogue</a></p><div class="intro"><div><p class="model">${escape(item.product.model_or_series)}</p><h1>${escape(item.product.name_en)}</h1><p>${escape(item.product.summary_en)}</p><p class="meta">Final configuration and suitability are confirmed with our team for your product and production line.</p></div><div class="image">${imageTag(item)}</div></div>${sections}${specs}${review}`))
}
await writeFile(resolve(output, 'README.txt'), '解压整个文件夹后，用浏览器打开 index.html。无需安装依赖或启动服务器。\n这是37份真实来源产品的内部资料预览，不是正式网站，不含后台、表单提交或客户资料。\n图片使用已保存文件，不再请求Wix。不代表产品已导入Directus。\n')
console.log(JSON.stringify({ products: plan.products.length, images: copied.size, output, databaseWrites: 0 }))
