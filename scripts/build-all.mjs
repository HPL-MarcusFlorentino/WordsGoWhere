import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

const PROJECT_SLUG = 'wgw'
const ITERATION = '01'
const FILENAME_PARTS = {
  type: 'real',
  ugc: 'nougc',
  season: 'noseason',
  lang: 'en',
  length: 'full',
  region: 'na'
}

const NETWORKS = [
  { tag: 'al',  folder: 'AppLovin',   injectHead: '<script src="mraid.js"></script>' },
  { tag: 'gg',  folder: 'GoogleAds',  injectHead: '<script src="exitapi.js"></script>', zip: true },
  { tag: 'is',  folder: 'IronSource', injectHead: '<script src="mraid.js"></script>' },
  { tag: 'mtg', folder: 'Mintegral',  bodyAttr: ' onload="gameReady()"', zip: true },
  { tag: 'fb',  folder: 'Facebook' },
  { tag: 'un',  folder: 'Unity' },
  { tag: 'vu',  folder: 'Vungle',     injectHead: '<script>window.__VUNGLE__=true;</script>', zip: true },
  { tag: 'mo',  folder: 'Moloco' },
  { tag: 'tt',  folder: 'TikTok',     injectHead: '<script>window.__TIKTOK__=true;</script>' }
]

function buildFilename(tag) {
  const { type, ugc, season, lang, length: lng, region } = FILENAME_PARTS
  return `cm_mip_${PROJECT_SLUG}_${ITERATION}_${type}_${ugc}_${season}_${lang}_${lng}_${region}_${tag}.html`
}

function transformHtml(html, network) {
  let out = html
    .replace(/\s+type="module"/g, '')
    .replace(/\s+crossorigin/g, '')
  if (network.injectHead) {
    out = out.replace(/<\/head>/i, `${network.injectHead}</head>`)
  }
  if (network.bodyAttr) {
    out = out.replace(/<body([^>]*)>/i, `<body$1${network.bodyAttr}>`)
  }
  return out
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f)
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f)
  return { time, date }
}

function makeZip(filename, contentBuf) {
  const data = deflateRawSync(contentBuf, { level: 9 })
  const crc = crc32(contentBuf)
  const { time, date } = dosTime()
  const nameBuf = Buffer.from(filename, 'utf8')

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0, 6)
  local.writeUInt16LE(8, 8)
  local.writeUInt16LE(time, 10)
  local.writeUInt16LE(date, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(contentBuf.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  local.writeUInt16LE(0, 28)
  const localPart = Buffer.concat([local, nameBuf, data])

  const cdh = Buffer.alloc(46)
  cdh.writeUInt32LE(0x02014b50, 0)
  cdh.writeUInt16LE(0x031e, 4)
  cdh.writeUInt16LE(20, 6)
  cdh.writeUInt16LE(0, 8)
  cdh.writeUInt16LE(8, 10)
  cdh.writeUInt16LE(time, 12)
  cdh.writeUInt16LE(date, 14)
  cdh.writeUInt32LE(crc, 16)
  cdh.writeUInt32LE(data.length, 20)
  cdh.writeUInt32LE(contentBuf.length, 24)
  cdh.writeUInt16LE(nameBuf.length, 28)
  cdh.writeUInt16LE(0, 30)
  cdh.writeUInt16LE(0, 32)
  cdh.writeUInt16LE(0, 34)
  cdh.writeUInt16LE(0, 36)
  cdh.writeUInt32LE(0, 38)
  cdh.writeUInt32LE(0, 42)
  const cdPart = Buffer.concat([cdh, nameBuf])

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(cdPart.length, 12)
  eocd.writeUInt32LE(localPart.length, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([localPart, cdPart, eocd])
}

console.log('> Running vite build...')
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' })

const baseHtmlPath = join(DIST, 'index.html')
if (!existsSync(baseHtmlPath)) {
  console.error('dist/index.html not found after build')
  process.exit(1)
}
const baseHtml = readFileSync(baseHtmlPath, 'utf8')

if (/type="module"/.test(baseHtml) === false && /crossorigin/.test(baseHtml) === false) {
  // already clean - fine
}

console.log(`> Generating ${NETWORKS.length} network variants...`)
for (const net of NETWORKS) {
  const outDir = join(DIST, net.folder)
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const filename = buildFilename(net.tag)
  const html = transformHtml(baseHtml, net)
  const htmlBuf = Buffer.from(html, 'utf8')
  writeFileSync(join(outDir, filename), htmlBuf)

  let line = `  [${net.tag}] ${net.folder}/${filename} (${(htmlBuf.length / 1024).toFixed(0)} KB)`
  if (net.zip) {
    const zipName = filename.replace(/\.html$/, '.zip')
    const zipBuf = makeZip(filename, htmlBuf)
    writeFileSync(join(outDir, zipName), zipBuf)
    line += ` + ${zipName} (${(zipBuf.length / 1024).toFixed(0)} KB)`
  }
  console.log(line)
}

console.log('> Done.')
