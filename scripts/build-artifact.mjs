/**
 * Bundles the built app into one self-contained HTML file.
 *
 * The published-artifact sandbox blocks every external request, so CSS, JS and
 * the font files are inlined — the result loads with no network at all. Run
 * `npm run build:artifact`; the output lands in `dist/artifact.html`.
 *
 * The file holds page content only (no <!doctype>, <html>, <head> or <body>) —
 * the artifact host supplies that shell at publish time.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
const TITLE = 'Piggy Expense Tracker'

const html = await readFile(resolve(DIST, 'index.html'), 'utf8')

const cssHref = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1]
const jsSrc = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1]
if (!cssHref || !jsSrc) throw new Error('Could not find the built CSS/JS in dist/index.html')

const read = (assetPath) => readFile(resolve(DIST, assetPath.replace(/^\//, '')), 'utf8')

let css = await read(cssHref)
let js = await read(jsSrc)

const MIME = {
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const dataUri = async (assetPath) => {
  const bytes = await readFile(resolve(DIST, assetPath.replace(/^\//, '')))
  const ext = assetPath.slice(assetPath.lastIndexOf('.')).toLowerCase()
  return `data:${MIME[ext] ?? 'application/octet-stream'};base64,${bytes.toString('base64')}`
}

/*
 * Every asset the page reaches for has to travel inside the file: the sandbox
 * blocks external requests, so an un-inlined image renders as a broken icon.
 * Fonts are referenced from the CSS; images are referenced from both the CSS
 * and the JS bundle's string literals.
 */
const ASSET_REF = /["'(](\/(?:fonts|art|icons)\/[A-Za-z0-9._-]+)["')]/g

const inlineAssets = async (source) => {
  const seen = new Map()
  for (const [, assetPath] of source.matchAll(ASSET_REF)) {
    if (!seen.has(assetPath)) seen.set(assetPath, await dataUri(assetPath))
  }
  let out = source
  for (const [assetPath, uri] of seen) out = out.replaceAll(assetPath, uri)
  return { source: out, count: seen.size }
}

const cssInlined = await inlineAssets(css)
css = cssInlined.source

const jsInlined = await inlineAssets(js)
js = jsInlined.source

/** Keeps an inline <script> from being closed early by its own contents. */
const escapeForInlineScript = (source) =>
  source.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--')

const out = `<title>${TITLE}</title>
<style>
${css}
</style>

<div id="root"></div>

<script type="module">
${escapeForInlineScript(js)}
</script>
`

const target = resolve(DIST, 'artifact.html')
await writeFile(target, out, 'utf8')
console.log(
  `artifact.html  ${(Buffer.byteLength(out) / 1024).toFixed(0)} kB  ` +
    `(${cssInlined.count + jsInlined.count} assets inlined)  ->  ${target}`,
)
