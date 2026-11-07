// Build a CSP-compatible, offline editor from a pinned upstream checkout.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
const root = resolve(import.meta.dirname, '..')
const upstream = resolve(process.env.DRAWIO_DIR || '/tmp/orca-drawio-upstream')
const revision = '84487b4891cbc0f32d7e30f34cf878c87cb1f414'
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim() !== revision) throw Error('Use the pinned upstream revision: ' + revision)
const web = resolve(upstream, 'src/main/webapp')
const read = p => readFileSync(resolve(web, p), 'utf8')
const mime = {'.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2'}
const asset = p => {
  p = p.replace(/^\.\.\//, '')
  if (!mime[extname(p)] || !existsSync(resolve(web, p))) return null
  return `data:${mime[extname(p)]};base64,${readFileSync(resolve(web,p)).toString('base64')}`
}
// The sidebar only exposes general, UML, ER, BPMN, flowchart, basic and arrows.
// All except classic BPMN are implemented by app.min.js/shapes-14-6-5.min.js.
// Keep the stencil decoder, but discard the hundreds of hidden cloud, network,
// electrical and mockup libraries bundled in upstream stencils.min.js.
const offlineStencils = new Set(['bpmn.xml'])
let stencils = read('js/stencils.min.js')
const stencilAssignment = /f\['([^']+)'\] = '[^']*';\n?/g
const bundledStencils = new Set([...stencils.matchAll(stencilAssignment)].map(match => match[1]))
for (const name of offlineStencils) {
  if (!bundledStencils.has(name)) throw Error(`Missing required offline stencil: ${name}`)
}
stencils = stencils.replace(stencilAssignment, (source, name) => offlineStencils.has(name) ? source : '')
const retainedStencils = [...stencils.matchAll(stencilAssignment)].map(match => match[1])
if (retainedStencils.length !== offlineStencils.size) throw Error('Unexpected offline stencil set: ' + retainedStencils.join(', '))
let app = read('js/app.min.js')
const shapes = read('js/shapes-14-6-5.min.js')
// Upstream uses relative image names in constructors and CSS. Embed those assets.
app = app.replace(/(['"])((?:images|img|mxgraph\/images)\/[^'"\s]+)\1/g, (all,q,p) => asset(p) ? q + asset(p) + q : all)
new vm.Script([app,shapes,stencils].join('\n;\n'))
const resources = Object.fromEntries(['resources/dia.txt','styles/default.xml','styles/dark-default.xml'].map(p => [p,read(p)]))
let css = ['styles/grapheditor.css','mxgraph/css/common.css'].map(p => read(p).replace(/url\(['"]?([^)'"\s]+)['"]?\)/g, (all,path) => {
  const a = asset(resolve(web,dirname(p),path).slice(web.length+1))
  return a ? `url("${a}")` : all
})).join('\n')
const boot = readFileSync(resolve(import.meta.dirname,'src/bootstrap.js'),'utf8')
const editor = readFileSync(resolve(import.meta.dirname,'src/editor.js'),'utf8')
const editorDir = resolve(root,'editor')
const vendorDir = resolve(editorDir,'vendor')
const imageDir = resolve(editorDir,'images')
rmSync(resolve(editorDir,'payload'),{recursive:true,force:true})
rmSync(resolve(editorDir,'loader.js'),{force:true})
rmSync(vendorDir,{recursive:true,force:true})
mkdirSync(vendorDir,{recursive:true})
rmSync(imageDir,{recursive:true,force:true})
mkdirSync(imageDir,{recursive:true})
writeFileSync(resolve(imageDir,'github-logo.svg'),readFileSync(resolve(web,'images/github-logo.svg')))
const html = `<meta charset="utf-8"><link rel="stylesheet" href="styles.css"><style>html,body{height:100%;margin:0;overflow:hidden}#message{position:fixed;inset:0;display:grid;place-content:center;background:var(--orca-background,#fff);color:var(--orca-foreground,#222);font:14px system-ui;z-index:99999;padding:32px;white-space:pre-wrap}#message[hidden]{display:none}</style><div id="message" role="status">Loading draw.io…</div><script src="bootstrap.js"></script><script src="resources.js"></script><script src="vendor/app.min.js"></script><script src="vendor/shapes.min.js"></script><script src="vendor/stencils.min.js"></script><script src="editor.js"></script>`
if (Buffer.byteLength(html)>10*1024*1024) throw Error('Editor exceeds Orca entry limit')
writeFileSync(resolve(editorDir,'index.html'),html)
writeFileSync(resolve(editorDir,'bootstrap.js'),boot)
writeFileSync(resolve(editorDir,'resources.js'),`window.drawioResources=${JSON.stringify(resources)};`)
writeFileSync(resolve(editorDir,'styles.css'),css)
writeFileSync(resolve(editorDir,'editor.js'),editor)
writeFileSync(resolve(vendorDir,'app.min.js'),app)
writeFileSync(resolve(vendorDir,'shapes.min.js'),shapes)
writeFileSync(resolve(vendorDir,'stencils.min.js'),stencils)
writeFileSync(resolve(root,'THIRD_PARTY_NOTICES.txt'),`draw.io ${readFileSync(resolve(upstream,'VERSION'),'utf8').trim()}\nhttps://github.com/jgraph/drawio\nRevision: ${revision}\n\n`+readFileSync(resolve(upstream,'LICENSE'),'utf8'))
console.log(`Built editor/index.html (${Buffer.byteLength(html)} bytes), local scripts (${Buffer.byteLength(app)+Buffer.byteLength(shapes)+Buffer.byteLength(stencils)} bytes)`)
