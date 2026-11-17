#!/usr/bin/env node
/**
 * 把一个或几个密钥从本地 .env 同步到腾讯云服务器上的服务环境文件，然后重启服务。
 *
 * 为什么需要它：AI 的 key 只存在于服务器的环境变量里（不进数据库、不进浏览器、没有后台输入框），
 * 所以换 key 只有一条路——改服务器上的 env 文件并重启。手改容易漏、容易忘重启，这个脚本把
 * 「读取本地 → 替换远端同名行 → 重启 → 验证」串成一步，并且**从不打印密钥值**。
 *
 * 用法：
 *   node scripts/sync-ai-env.mjs --host 43.165.125.203 --user ubuntu
 *   node scripts/sync-ai-env.mjs --host ... --user ... --keys DEEPSEEK_API_KEY,DEEPSEEK_MODEL
 *
 * 可选参数：
 *   --env-file <path>    本地 env 文件（默认 .env）
 *   --remote-env <path>  远端 env 文件（默认 /etc/litubo/litubo.env）
 *   --service <name>     远端 systemd 服务名（默认 litubo）
 *   --dry-run            只显示将要做什么，不连服务器
 *
 * 退出码：0 成功；1 参数或本地文件问题；2 远端操作失败。
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const AI_KEYS = ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'AI_DEFAULT_PROVIDER']

function fail(code, message) {
  console.error(`FAIL: ${message}`)
  process.exit(code)
}

function parseArgs(argv) {
  const out = { 'env-file': '.env', 'remote-env': '/etc/litubo/litubo.env', service: 'litubo', keys: AI_KEYS.join(','), 'dry-run': false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const name = arg.slice(2)
    if (name === 'dry-run') { out['dry-run'] = true; continue }
    const value = argv[++i]
    if (value === undefined) fail(1, `--${name} 缺少值`)
    out[name] = value
  }
  return out
}

function readEnv(path) {
  const map = new Map()
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    map.set(m[1], m[2].trim().replace(/^["']|["']$/g, ''))
  }
  return map
}

const sha8 = v => createHash('sha256').update(v).digest('hex').slice(0, 8)

const args = parseArgs(process.argv.slice(2))
if (!args.host || !args.user) fail(1, '必须给 --host 和 --user')

const wanted = args.keys.split(',').map(k => k.trim()).filter(Boolean)
const local = readEnv(args['env-file'])

const rows = []
for (const key of wanted) {
  const value = local.get(key)
  if (!value) fail(1, `本地 ${args['env-file']} 里没有 ${key}（或为空）`)
  rows.push({ key, value, fingerprint: sha8(value) })
}

console.log(`本地 ${args['env-file']} → ${args.user}@${args.host}:${args['remote-env']}`)
for (const r of rows) console.log(`  ${r.key.padEnd(22)} sha256:${r.fingerprint}`)

if (args['dry-run']) {
  console.log('dry-run：未连接服务器')
  process.exit(0)
}

const payload = rows.map(r => `${r.key}=${r.value}`).join('\n') + '\n'
const tmp = join(tmpdir(), `litubo-env-${process.pid}.env`)
writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 })

const sshBase = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', `${args.user}@${args.host}`]

try {
  execFileSync('scp', ['-q', tmp, `${args.user}@${args.host}:/tmp/litubo-env-sync-${process.pid}.env`], { stdio: 'inherit' })

  const remote = `
set -eu
ENVF=${args['remote-env']}
PAYLOAD=/tmp/litubo-env-sync-${process.pid}.env
[ -f "$PAYLOAD" ] || { echo "payload 未上传"; exit 3; }
for k in ${wanted.join(' ')}; do sudo sed -i "/^$k=/d" "$ENVF"; done
sudo tee -a "$ENVF" < "$PAYLOAD" > /dev/null
sudo chown root:litubo "$ENVF"
sudo chmod 640 "$ENVF"
rm -f "$PAYLOAD"
sudo systemctl restart ${args.service}
sleep 4
printf 'service: '; systemctl is-active ${args.service}
for k in ${wanted.join(' ')}; do
  v=$(sudo grep "^$k=" "$ENVF" | head -1 | cut -d= -f2-)
  printf '%s sha256:%s\\n' "$k" "$(printf '%s' "$v" | sha256sum | cut -c1-8)"
done
`
  const output = execFileSync('ssh', [...sshBase, 'bash -s'], { input: remote, encoding: 'utf8' })
  process.stdout.write(output.replace(/^/gm, '  '))

  // 指纹必须与本地一致，否则说明远端拿到的值与本地不同
  let ok = true
  for (const r of rows) {
    if (!output.includes(`${r.key} sha256:${r.fingerprint}`)) { ok = false; console.error(`  ✗ ${r.key} 远端指纹与本地不一致`) }
  }
  process.exit(ok ? 0 : 2)
}
catch (error) {
  console.error('远端操作失败：', error instanceof Error ? error.message : String(error))
  process.exit(2)
}
finally {
  try { unlinkSync(tmp) } catch {}
}
