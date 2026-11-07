// Exercise the real upstream editor inside Orca's isolated-frame CSP sandbox.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, extname } from 'node:path'
let chromium
try {
  const require = createRequire(resolve(process.env.ORCA_DIR || '/data/LinDoo/orca','package.json'))
  chromium = require('playwright').chromium
} catch {
  const require = createRequire(import.meta.url)
  chromium = require('playwright').chromium
}
const editorRoot=new URL('../../editor/',import.meta.url)
const html=readFileSync(new URL('index.html',editorRoot),'utf8')
const template=readFileSync(new URL('../../templates/empty.drawio',import.meta.url),'utf8')
const chromePath = process.env.CHROME_BIN || (existsSync('/bin/google-chrome') ? '/bin/google-chrome' : undefined)
const browser=await chromium.launch({headless:true,executablePath:chromePath,args:['--no-sandbox']})
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  const errors=[]
  page.on('pageerror', e=>errors.push(e.message))
  const requests=[]
  page.on('request', r=>{if (/^https?:/.test(r.url())&&!r.url().startsWith('https://plugin.test/')) requests.push(r.url())})
  const prelude=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src data:; base-uri 'none'; form-action 'none'"><script>
  window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.violatedDirective+': '+e.blockedURI));window.edits=[];window.current={version:1,readOnly:false,content:{kind:'text',text:${JSON.stringify(template)}}};
  window.orca={document:{onDidChange(fn){window.receive=fn;fn(current)},async applyEdit(edit){if(window.rejectEdit)throw Error('conflict');if(edit.baseVersion!==current.version)throw Error('stale version');edits.push(edit);current={...current,version:current.version+1,content:edit.content};receive(current)}},on(name,fn){window.flush=fn}};
  </script>`
  await page.route('https://plugin.test/**',route=>{
    const path=new URL(route.request().url()).pathname.slice(1)||'index.html'
    const body=path==='index.html'?Buffer.from(prelude+html):readFileSync(new URL(path,editorRoot))
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.bin':'application/octet-stream','.svg':'image/svg+xml'}[extname(path)]||'application/octet-stream'
    return route.fulfill({status:200,contentType:type,body})
  })
  await page.setContent('<iframe sandbox="allow-scripts allow-same-origin" src="https://plugin.test/index.html" style="width:100%;height:980px;border:0"></iframe>')
  await page.waitForSelector('iframe')
  const frame=page.frames()[1]
  await frame.waitForFunction(()=>document.getElementById('message')?.hidden,null,{timeout:30000})
  assert.equal(await frame.evaluate(()=>edits.length),0,'opening must not dirty the document')
  assert.ok(await frame.locator('.geSidebarContainer').first().evaluate(el=>el.clientWidth)>100,'sidebar visible')
  assert.ok(await frame.locator('.geSidebar a').count()>10,'shape palette populated')
  assert.ok(await frame.evaluate(()=>Object.keys(drawioUi.sidebar.palettes).filter(name=>name.startsWith('bpmn2')).length)>=5,'visible BPMN palettes registered')
  assert.equal(await frame.evaluate(()=>{
    mxStencilRegistry.loadStencilSet('stencils/bpmn.xml')
    return Object.keys(mxStencilRegistry.stencils).some(name=>name.startsWith('mxgraph.bpmn.'))
  }),true,'retained classic BPMN stencils load for existing diagrams')
  assert.deepEqual(await frame.evaluate(()=>['mermaid','plantUml','importVisio','generate'].filter(name=>{
    const action=drawioUi.actions.get(name);return action?.isEnabled() || action?.isVisible?.()
  })),[],'unsupported actions must be hidden and disabled')
  await frame.locator('.geSidebar a.geItem').first().click()
  await frame.evaluate(()=>flush())
  assert.equal(await frame.evaluate(()=>drawioUi.editor.graph.getModel().getChildCount(drawioUi.editor.graph.getDefaultParent())),1,'palette click inserts a shape')
  // Background synchronization must not terminate an active label edit.
  assert.equal(await frame.evaluate(async()=>{
    const g=drawioUi.editor.graph;
    const cell=g.insertVertex(g.getDefaultParent(),'active-edit','typing',20,20,100,40);
    g.startEditingAtCell(cell);
    await new Promise(resolve=>setTimeout(resolve,350));
    return g.isEditing();
  }),true)
  await frame.evaluate(()=>flush())
  assert.equal(await frame.evaluate(()=>drawioUi.editor.graph.isEditing()),false,'explicit flush commits active editing')
  await frame.evaluate(template=>{current={version:5,readOnly:false,content:{kind:'text',text:template}};receive(current);edits.length=0},template)
  await frame.evaluate(async()=>{
    const g=drawioUi.editor.graph;
    g.insertVertex(g.getDefaultParent(),'test-cell','Hello Draw.io',80,80,180,60);
    await flush();
  })
  assert.equal(await frame.evaluate(()=>edits.length),1)
  assert.match(await frame.evaluate(()=>current.content.text),/Hello Draw.io/)
  await frame.evaluate(()=>flush())
  assert.equal(await frame.evaluate(()=>edits.length),1,'unchanged save must not create edits')
  await frame.evaluate(async()=>{drawioUi.editor.undoManager.undo();await flush()})
  assert.equal(await frame.evaluate(()=>drawioUi.editor.graph.model.getCell('test-cell')==null),true)
  await frame.evaluate(async()=>{drawioUi.editor.undoManager.redo();await flush()})
  assert.equal(await frame.evaluate(()=>drawioUi.editor.graph.model.getCell('test-cell').value),'Hello Draw.io')
  await frame.evaluate(async()=>{drawioUi.setBackgroundColor('#ffcccc');await flush()})
  assert.match(await frame.evaluate(()=>current.content.text),/#ffcccc/)
  // Compressed multi-page diagrams must retain both pages and their identifiers.
  await frame.evaluate(()=>{
    const model='<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
    current={version:20,readOnly:false,content:{kind:'text',text:'<mxfile custom="preserve"><diagram id="one" name="一">'+Graph.compress(model)+'</diagram><diagram id="two" name="二">'+Graph.compress(model)+'</diagram></mxfile>'}};
    receive(current);
  })
  assert.equal(await frame.evaluate(()=>drawioUi.pages.length),2)
  await frame.evaluate(async()=>{const g=drawioUi.editor.graph;g.insertVertex(g.getDefaultParent(),'new','multi',20,20,90,40);await flush()})
  assert.match(await frame.evaluate(()=>current.content.text),/id="two"/)
  assert.match(await frame.evaluate(()=>current.content.text),/custom="preserve"/)
  // Highly compressible pages must be rejected before they can exhaust the frame.
  await frame.evaluate(()=>{
    const bomb=Graph.compress('x'.repeat(17*1024*1024));
    receive({version:21,readOnly:false,content:{kind:'text',text:'<mxfile><diagram>'+bomb+'</diagram></mxfile>'}});
  })
  assert.equal(await frame.locator('#message').isVisible(),true)
  assert.match(await frame.locator('#message').textContent(),/16 MB/)
  await frame.evaluate(template=>{current={version:22,readOnly:false,content:{kind:'text',text:template}};receive(current)},template)
  // Rejection must remain visible to editor.flush, and allow a later retry.
  await frame.evaluate(()=>{window.rejectEdit=true;const g=drawioUi.editor.graph;g.insertVertex(g.getDefaultParent(),'retry','retry',10,10,50,40)})
  assert.equal(await frame.evaluate(async()=>{try{await flush();return false}catch{return true}}),true)
  await frame.evaluate(async()=>{window.rejectEdit=false;await flush()})
  assert.match(await frame.evaluate(()=>current.content.text),/retry/)
  // Outside replacements discard pending local changes and reset undo history.
  await frame.evaluate(template=>{current={version:40,readOnly:true,content:{kind:'text',text:template}};receive(current)},template)
  assert.equal(await frame.evaluate(()=>drawioUi.editor.graph.isEnabled()),false)
  const count=await frame.evaluate(()=>edits.length)
  await frame.evaluate(()=>flush())
  assert.equal(await frame.evaluate(()=>edits.length),count)
  await frame.evaluate(()=>receive({version:41,readOnly:false,content:{kind:'text',text:'<not-a-diagram/>'}}))
  assert.equal(await frame.locator('#message').isVisible(),true)
  await frame.evaluate(()=>flush())
  assert.equal(await frame.evaluate(()=>edits.length),count,'invalid input is never overwritten')
  await frame.evaluate(template=>{current={version:42,readOnly:false,content:{kind:'text',text:template}};receive(current);document.documentElement.classList.add('dark')},template)
  await page.waitForTimeout(300)
  assert.equal(await frame.evaluate(()=>Editor.isDarkMode()),true)
  await frame.evaluate(()=>{const g=drawioUi.editor.graph;const p=g.getDefaultParent();g.model.beginUpdate();try{const a=g.insertVertex(p,'orca','Orca',100,100,150,60,'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;');const b=g.insertVertex(p,'drawio','Draw.io Offline Editor',370,100,180,60,'rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;');g.insertEdge(p,null,'Document Sync',a,b,'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;');}finally{g.model.endUpdate()}})
  await frame.evaluate(()=>flush())
  await page.screenshot({path:process.env.DRAWIO_SCREENSHOT || '/tmp/orca-drawio-tested.png'})
  assert.deepEqual(await frame.evaluate(()=>violations),[],'core editor must not violate host CSP')
  assert.deepEqual(errors,[])
  assert.deepEqual(requests,[],'editor must not issue network requests')
  console.log('PASS: offline CSP, palette/actions, autosync editing, edits/flush, undo/redo, settings, bounded compressed pages, metadata, conflicts/retry, read-only, invalid XML, theme')
} finally {await browser.close()}
