const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),zlib=require('zlib');
(async()=>{
const {Window}=await import('/tmp/brigi-check/node_modules/happy-dom/lib/index.js');
const w=new Window({url:'https://fixture.test',settings:{disableIframePageLoading:true,enableJavaScriptEvaluation:false}});
Object.assign(global,{window:w,document:w.document,HTMLElement:w.HTMLElement,Event:w.Event,location:w.location,IS_REACT_ACT_ENVIRONMENT:true,confirm:()=>true});
Object.defineProperty(global,'navigator',{value:w.navigator,configurable:true});
w.HTMLElement.prototype.scrollIntoView=function(){};
const React=require('react'),{createRoot}=require('react-dom/client'),{act}=React;
const state={version:2,parts:[],settings:{}},boot={user:{email:'admin@example.test'},admin:true,manager:true,employee:'Admin',today:'2026-11-05',members:[],companies:[{id:'c1',name:'Pontos Cég Kft.',countries:['HU'],owners:['Admin'],teams:['Brigi'],types:['vevő']}],actions:['Telefonhívás','Ajánlat','Megrendelés'],buckets:['4-8 t'],rules:[]};
let calls=[],messages=[],sheet=null,rows=[];
const api=async(name,data)=>{calls.push(data);switch(data.action){
case 'bootstrap':return {data:boot};
case 'report':return {data:{payload:zlib.gzipSync(JSON.stringify(state)).toString('base64'),manifest:{revision:'r1'}}};
case 'getDay':return {data:{sheet,rows,tasks:[],teamTasks:[]}};
case 'openDay':sheet={status:'open',date:boot.today};return {data:{sheet,rows}};
case 'saveRow':rows.push({...data.row,id:'a1',employee:'Admin',company:boot.companies[0].name,task_id:'t1'});return {data:{row:rows.at(-1)}};
case 'taskFlow':return {data:{tasks:[],summary:{open:2,overdue:1,won:3,lost:1}}};
case 'suggestions':return {data:{items:[{company_id:'c1',company:boot.companies[0].name,reason:'Visszahívás',detail:'Ígért időpont'}]}};
case 'companyInfo':return {data:{}};
default:throw Error('Unexpected fixture API '+data.action)}};
global.fetch=async()=>({ok:true,text:async()=>'<html><body>Report test frame</body></html>'});
const actual=new Set(['HqSidebar','HqMasterSearch','HqFilterBar','HqWorkSummary']);
const cache={};function load(file){if(cache[file])return cache[file].exports;let module={exports:{}};cache[file]=module;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const req=n=>{
if(n==='lucide-react')return new Proxy({},{get:(_,k)=>()=>React.createElement('svg',{'data-icon':k})});
if(n.endsWith('.css'))return {};
if(n==='@/api/base44Client')return {base44:{functions:{invoke:api}}};
if(n==='@/lib/AuthContext')return {useAuth:()=>({user:{email:boot.user.email},logout(){},navigateToLogin(){}})};
if(n==='@/lib/hq-xlsx')return {readCsv(){},readXlsx(){}};
if(n==='./Documents')return ()=>null;
if(n.startsWith('@/components/')){const name=n.split('/').at(-1);return actual.has(name)?load('src/components/'+name+'.jsx'):()=>null}
return require(n)};
vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(req,module,module.exports);return module.exports}
const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container),App=load('src/pages/HQApp.jsx').default;
const pause=()=>new Promise(r=>setTimeout(r,25));async function settle(fn=()=>{}){await act(async()=>{await fn();await pause()})}
const button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t&&!b.closest('[hidden]'));
const nav=t=>[...document.querySelectorAll('.hq-side button')].find(b=>b.textContent===t);
const change=(input,value)=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value').set.call(input,value);input.dispatchEvent(new w.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}))};
await settle(()=>root.render(React.createElement(App)));await settle();
assert.equal(document.querySelectorAll('.hq-side-head').length,5);assert.equal(document.querySelector('[aria-current=page]').textContent,'Vezérlőpult');
const iframe=document.querySelector('iframe.hq-reportframe');assert(iframe);iframe.contentWindow.postMessage=d=>messages.push(d);
iframe.contentDocument.body.innerHTML='<div id="filters"><label>Év<select id="fyear"><option value="2025">2025</option><option value="2026" selected>2026</option></select></label></div><button id="ytd">Év eddig</button><button id="resetFilters">Alaphelyzet</button>';
function msg(data){window.dispatchEvent(new w.MessageEvent('message',{source:iframe.contentWindow,origin:location.origin,data}))}
await settle(()=>msg({type:'hq-ready'}));assert(messages.some(m=>m.type==='hq-init'&&m.view==='overview'));
await settle(()=>msg({type:'hq-navigation',snapshot:{view:'overview',f:{end:'2026-10'}}}));
assert.equal(document.querySelector('.hq-filterbar select').value,'2026');
let filterEvents=0;iframe.contentDocument.getElementById('fyear').addEventListener('change',()=>filterEvents++);
await settle(()=>change(document.querySelector('.hq-filterbar select'),'2025'));
assert.equal(iframe.contentDocument.getElementById('fyear').value,'2025');assert.equal(filterEvents,1);
await settle(()=>nav('Kimutatások').click());await settle(()=>nav('Havi összehasonlítás').click());
assert(messages.some(m=>m.type==='hq-route'&&m.view==='trends'));assert.equal(document.querySelector('[aria-current=page]').textContent,'Havi összehasonlítás');
const search=document.querySelector('input[aria-label="Partner keresése"]');
await settle(()=>change(search,'pontos'));assert.equal(document.querySelectorAll('.hq-master-hit').length,1);
await settle(()=>document.querySelector('.hq-master-hit-main').click());await settle();
assert.equal(document.querySelector('.hq-editor input[list=hq-companies]').value,'Pontos Cég Kft.');
assert.equal(document.querySelector('.hq-editor select').value,'');
assert.equal(document.querySelector('.hq-editor select:nth-of-type(1)')?.value,'');
assert(document.querySelector('.hq-daily-support'));
await settle(()=>button('Sor mentése').click());await settle();
const saved=calls.filter(c=>c.action==='saveRow');assert.equal(saved.length,1);assert.equal(saved[0].row.company_id,'c1');assert.equal(saved[0].row.action,'Telefonhívás');assert.equal(calls.filter(c=>c.action==='saveTask').length,0);
assert(!document.querySelector('.hq-editor'));assert(container.textContent.includes('A bejegyzés és a kapcsolódó ügy mentve'));
await settle(()=>nav('Vezérlőpult').click());assert.equal(document.querySelector('iframe.hq-reportframe'),iframe);
await settle(()=>root.unmount());await w.happyDOM.close();
console.log('PASS: five sidebar sections, overview routing, fixed filter bridge, report route retention, master partner search, prefilled call and single case-saving action. Isolated UI fixtures only.');
})().catch(e=>{console.error(e);process.exitCode=1});
