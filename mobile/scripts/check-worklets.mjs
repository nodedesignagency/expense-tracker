/*
 * Finds ordinary functions being called from inside worklets.
 *
 * A worklet runs on the UI thread and may only call other worklets. Reference
 * an ordinary function of your own — a module-scope helper, or anything
 * imported from a relative path — and Reanimated captures it in the closure;
 * calling it there aborts the process. There is no red box and no message:
 * Expo Go simply quits the moment the view mounts, and the bundle builds
 * clean because none of it is exercised until then.
 *
 * That has shipped twice (`recedeLift` in App.tsx, `pinLeft` in
 * SlideAction.tsx), each time costing a round and a crash on the owner's
 * device. It is invisible to `tsc`, invisible in the browser — react-native-web
 * has no second thread, so the illegal call simply works — and invisible to a
 * bundle build. This is the only cheap way to see it.
 *
 *   node scripts/check-worklets.mjs
 *
 * Exits non-zero and names file:line on a finding.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import ts from 'typescript'

/** Functions that take a worklet, so their function argument is one. */
const WORKLET_HOOKS = new Set([
  'useAnimatedStyle',
  'useDerivedValue',
  'useAnimatedProps',
  'useAnimatedReaction',
  'useAnimatedScrollHandler',
  'useFrameCallback',
  'runOnUI',
])

/** Gesture builder methods whose callbacks run on the UI thread. */
const GESTURE_CALLBACKS = new Set([
  'onBegin',
  'onStart',
  'onUpdate',
  'onChange',
  'onEnd',
  'onFinalize',
  'onTouchesDown',
  'onTouchesMove',
  'onTouchesUp',
])

/** Modules whose exports are already worklets. */
const SAFE_MODULES = [/^react-native-reanimated/, /^react-native-worklets/]

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkFiles(full, out)
    else if (['.ts', '.tsx'].includes(extname(name))) out.push(full)
  }
  return out
}

/** Does this function body open with a 'worklet' directive? */
function isWorkletized(node) {
  const body = node.body
  if (!body || !ts.isBlock(body)) return false
  const first = body.statements[0]
  return (
    first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'worklet'
  )
}

function check(file) {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  /* Names this file defines or imports that are NOT worklets. */
  const suspect = new Map()

  for (const st of src.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && !isWorkletized(st)) {
      suspect.set(st.name.text, 'declared here')
    }
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue
        const init = d.initializer
        const isFn = ts.isArrowFunction(init) || ts.isFunctionExpression(init)
        if (isFn && !isWorkletized(init)) suspect.set(d.name.text, 'declared here')
      }
    }
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      const from = st.moduleSpecifier.text
      if (!from.startsWith('.')) continue
      if (SAFE_MODULES.some((re) => re.test(from))) continue
      const named = st.importClause?.namedBindings
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) suspect.set(el.name.text, `imported from ${from}`)
      }
    }
  }

  const findings = []

  /* Every call inside this function body whose callee is a suspect name. */
  function scanBody(node, why) {
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const name = n.expression.text
        if (suspect.has(name)) {
          const { line } = src.getLineAndCharacterOfPosition(n.getStart())
          findings.push({ line: line + 1, name, origin: suspect.get(name), why })
        }
      }
      ts.forEachChild(n, visit)
    }
    ts.forEachChild(node, visit)
  }

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      /* A hook that takes a worklet. */
      if (ts.isIdentifier(callee) && WORKLET_HOOKS.has(callee.text)) {
        for (const arg of node.arguments) {
          if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
            scanBody(arg, `${callee.text}()`)
          }
        }
      }
      /* A gesture callback, or a with*() completion callback. */
      if (ts.isPropertyAccessExpression(callee) && GESTURE_CALLBACKS.has(callee.name.text)) {
        for (const arg of node.arguments) {
          if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
            scanBody(arg, `Gesture .${callee.name.text}()`)
          }
        }
      }
    }
    /* Anything hand-marked as a worklet. */
    if (
      (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) &&
      isWorkletized(node)
    ) {
      scanBody(node, "'worklet' function")
    }
    ts.forEachChild(node, visit)
  }
  visit(src)

  return findings
}

const root = process.argv[2] ?? '.'
const files = [...walkFiles(join(root, 'src')), join(root, 'App.tsx')]
let bad = 0

for (const file of files) {
  for (const f of check(file)) {
    bad += 1
    console.error(
      `${file}:${f.line}  calls ${f.name}() inside ${f.why} — ${f.name} is not a worklet (${f.origin})`,
    )
  }
}

if (bad) {
  console.error(
    `\n${bad} non-worklet call${bad === 1 ? '' : 's'} on the UI thread. ` +
      `Each one aborts the app when the view mounts.\n` +
      `Work the value out in the component body and let the worklet close over the number.`,
  )
  process.exit(1)
}
console.log(`worklets clean — ${files.length} files checked`)
