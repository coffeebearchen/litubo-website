import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile,writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const {chromium}=createRequire(import.meta.url)('playwright'),root=import.meta.dirname
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root+'/'))throw Error('Invalid path');res.setHeader('Content-Type',p.endsWith('.webp')?'image/webp':'text/html; charset=utf-8');res.end(await readFile(p))}catch{res.writeHead(404);res.end()}})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[]
try{
await page.goto(base+'/header-ui.html?view=home');await page.locator('#language-open').click();checks.push({page:'Header language',locales:await page.locator('[data-locale]').evaluateAll(es=>es.map(e=>e.dataset.locale))});await page.screenshot({path:resolve(root,'UI-01-header-three-languages.png')})
await page.goto(base+'/admin-ui.html');await page.screenshot({path:resolve(root,'UI-02-inquiries.png')});await page.goto(base+'/admin-ui.html?view=products');checks.push({page:'Admin content language',locales:await page.locator('[data-locale]').evaluateAll(es=>es.map(e=>e.dataset.locale))});await page.screenshot({path:resolve(root,'UI-03-product-three-languages.png')});if(checks.some(c=>c.locales.join(',')!=='en,es,ar'))throw Error('Locale mismatch');await writeFile(resolve(root,'prototype-check.json'),JSON.stringify({scope:'Static UI only',checks},null,2));console.log(JSON.stringify(checks))
}finally{await browser.close();server.close()}
