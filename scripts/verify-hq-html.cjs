// Prerequisite: npm install --prefix /tmp/brigi-check happy-dom
const fs=require('fs'),assert=require('assert/strict');
(async()=>{
const {Window}=await import('/tmp/brigi-check/node_modules/happy-dom/lib/index.js');
const w=new Window({url:'https://fixture.test',settings:{enableJavaScriptEvaluation:true,disableCSSFileLoading:true,disableJavaScriptFileLoading:true,disableIframePageLoading:true}});
const messages=[],parent={location:{origin:w.location.origin},postMessage:m=>{messages.push(m);if(m.type==='hq-save')setTimeout(()=>send({type:'hq-saved',id:m.id,ok:true}),0)}};
Object.defineProperty(w,'parent',{value:parent});
w.scrollTo=()=>{};w.print=()=>{};w.structuredClone=structuredClone;
const html=fs.readFileSync('public/hq-legacy.html','utf8');
const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(x=>!x[1].includes('application/octet-stream')).map(x=>x[2]);
w.document.write(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));
w.eval(scripts.join('\n;\n')+'\nwindow.__testPersist=next=>persistWorkspace(next);');
function send(data){w.dispatchEvent(new w.MessageEvent('message',{data,origin:w.location.origin,source:parent}))}
const row=(p,kg)=>({p,kg,value:kg*300,employee:'Éva',owner:'Éva',company:'Teszt Kft.',country:'Magyarország',currency:'HUF',shipping:'Normál',product:'Betonacél 12 mm',category:'Betonacél',team:'Brigi',date:p+'-12',ref:'fixture'});
const parts=['2026-08','2026-09'].map((p,i)=>({key:'sales:'+p,kind:'sales',period:p,source:'fixture',hash:p,issues:[],rows:[row(p,(i+1)*10000)]}));
parts.push({key:'daily:2026-09',kind:'daily',period:'2026-09',source:'fixture',hash:'daily',issues:[],rows:[{p:'2026-09',date:'2026-09-12',company:'Teszt Kft.',employee:'Éva',action:'Ajánlat',bucket:'4-8 t',orderT:null,quoteT:6,bendT:null,points:2,note:'Egyeztetés',ref:'fixture'}]});
const state={version:2,activitySchema:1,journalSchema:1,parts,settings:{money:'unknown',currency:'HUF',evalYear:2026,threshold:15,concentration:35,targets:{},aliases:{},monthlyKpis:[],dormantMonths:2},issues:[]};
send({type:'hq-init',state,admin:true});
assert(w.document.querySelector('#screen').textContent.length>100,w.document.querySelector('#screen').textContent);assert(messages.some(x=>x.type==='hq-initialized'));
for(const view of ['overview','attention','review','trends','team','companies','matching','countries','products','activity','ricsi','summary','data']){
send({type:'hq-route',view});assert(w.document.querySelector('#pageTitle').textContent.length>0,view);assert(messages.some(x=>x.type==='hq-navigation'&&x.snapshot.view===view),view);
}
assert(w.document.querySelector('#screen').textContent.includes('közös'));
await w.__testPersist({...state,settings:{...state.settings,monthlyKpis:[{p:'2026-09',employee:'Éva',metric:'customMesh',value:7,source:'Teszt'}]}});
assert(messages.some(x=>x.type==='hq-save'&&x.state.settings.monthlyKpis[0]?.value===7));
send({type:'hq-route',view:'summary'});assert(w.document.querySelectorAll('#screen table tfoot').length>0);
send({type:'hq-route',view:'trends'});assert(w.document.querySelectorAll('#screen svg').length>0);
send({type:'hq-route',view:'review',snapshot:{view:'review',f:{start:'2026-08',end:'2026-09',employee:'Éva',team:'Brigi',role:'employee',exchange:'exclude'},activityMode:'summary',scroll:0}});
assert.equal(w.document.querySelector('#femployee').value,'Éva');
await w.happyDOM.close();console.log('PASS: all 13 original report routes render, charts and summary totals remain, cloud KPI persistence, snapshot restoration. Synthetic fixture only.');
})().catch(e=>{console.error(e);process.exitCode=1});