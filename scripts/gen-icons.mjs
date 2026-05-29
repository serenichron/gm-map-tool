// Rasterize public/icon.svg into the PNG sizes the PWA manifest needs.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'public', 'icons')
const svg = readFileSync(join(root, 'public', 'icon.svg'))
mkdirSync(iconsDir, { recursive: true })

const sizes = [
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [180, 'apple-touch-icon.png'],
  [64, 'icon-64.png'],
]

for (const [size, name] of sizes) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(iconsDir, name))
  console.log('wrote', name)
}
console.log('done')
