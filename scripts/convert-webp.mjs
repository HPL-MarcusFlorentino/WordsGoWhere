import sharp from 'sharp'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const jobs = [
  { src: resolve(root, 'bg_blue.png'),     dst: resolve(root, 'Assets/bg_blue.webp') },
  { src: resolve(root, 'bg_bluepurp.png'), dst: resolve(root, 'Assets/bg_bluepurp.webp') }
]

for (const { src, dst } of jobs) {
  if (!existsSync(src)) { console.log('skip (missing):', src); continue }
  const input = readFileSync(src)
  const output = await sharp(input).webp({ quality: 75 }).toBuffer()
  writeFileSync(dst, output)
  const inKB  = (input.length  / 1024).toFixed(1)
  const outKB = (output.length / 1024).toFixed(1)
  console.log(`${src} -> ${dst} (${inKB} KB -> ${outKB} KB)`)
  unlinkSync(src)
}
