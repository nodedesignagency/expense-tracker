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
const js = await read(jsSrc)

// Fonts become data URIs so the page needs no font host.
for (const match of [...css.matchAll(/url\((\/fonts\/[^)]+\.woff2)\)/g)]) {
  const [full, fontPath] = match
  const bytes = await readFile(resolve(DIST, fontPath.replace(/^\//, '')))
  css = css.replaceAll(full, `url(data:font/woff2;base64,${bytes.toString('base64')})`)
}

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
console.log(`artifact.html  ${(Buffer.byteLength(out) / 1024).toFixed(0)} kB  ->  ${target}`)
