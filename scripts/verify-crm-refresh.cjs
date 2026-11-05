const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),zlib=require('node:zlib'),crypto=require('node:crypto');
const tables={},entities={};let n=0,user,handler;
const clone=x=>structuredClone(x),stamp=()=>new Date(1800000000000+(++n)*1000).toISOString();
for(const name of fs.readdirSync('base44/entities').map(f=>JSON.parse(fs.readFileSync('base44/entities/'+f,'utf8')).name)){
 tables[name]=[];entities[name]={
 filter:async(q={},sort='id',limit=500,skip=0)=>{let a=tables[name].filter(r=>Object.entries(q).every(([k,v])=>r[k]===v));const sign=sort.startsWith('-')?-1:1,k=sort.replace(/^-/,'');a.sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*sign);return clone(a.slice(skip,skip+limit))},
 get:async id=>clone(tables[name].find(r=>r.id===id)),
 create:async data=>{const at=stamp(),r={...clone(data),id:'r'+n,created_date:at,updated_date:at};tables[name].push(r);return clone(r)},
 update:async(id,data)=>{const r=tables[name].find(r=>r.id===id);assert(r,'record exists');Object.assign(r,clone(data),{updated_date:stamp()});return clone(r)},
 bulkCreate:async rows=>Promise.all(rows.map(r=>entities[name].create(r))),
 bulkUpdate:async rows=>Promise.all(rows.map(({id,...r})=>entities[name].update(id,r))),
 deleteMany:async q=>{tables[name]=tables[name].filter(r=>!Object.entries(q).every(([k,v])=>r[k]===v))}
 };
}
const code=ts.transpileModule(fs.readFileSync('base44/functions/hq-api/entry.ts','utf8').replace(/^import .*\n/,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{Deno:{serve:f=>handler=f},createClientFromRequest:()=>({auth:{me:async()=>user},asServiceRole:{entities}}),Response,Request,Blob,CompressionStream,DecompressionStream,atob,btoa,Uint8Array,Date,Intl,Set,Map,Number,String,Error,JSON,console,crypto});
const admin={email:'admin@example.test',role:'admin',full_name:'Admin'},eva={email:'eva@example.test',role:'user',full_name:'Éva'};
async function api(action,data={},status=200){const res=await handler(new Request('https://fixture.test',{method:'POST',body:JSON.stringify({action,...data})})),body=await res.json();assert.equal(res.status,status,action+': '+JSON.stringify(body));return body}
(async()=>{
user=admin;await entities.HQMember.create({email:eva.email,employee:'Éva',access:'employee',active:true});
const company=await entities.HQCompany.create({name:'Valid Partner Kft.',owners:['Éva'],active:true,county:'Pest',types:['vevő']});
user=eva;await api('openDay',{date:'2026-10-30'});
const row={client_key:'call-fixture',company_id:company.id,action:'Telefonhívás',note:'Betonacél igény egyeztetése',next_step:'Ajánlat elkészítése',next_due:'2026-11-10'};
const first=await api('saveRow',{date:'2026-10-30',row});assert(first.row.task_id);
await api('saveRow',{date:'2026-10-30',row});assert.equal(tables.HQTask.length,1);assert.equal(tables.HQActivity.length,1);
const second=await api('saveRow',{date:'2026-10-30',row:{...row,client_key:'call-2',task_id:first.row.task_id,action:'Ajánlat',quote_t:24}});
assert.equal(second.row.task_id,first.row.task_id);assert.equal(second.row.parent_activity_id,first.row.id);
const branch=await api('saveRow',{date:'2026-10-30',row:{...row,client_key:'call-3',task_id:first.row.task_id,parent_activity_id:first.row.id}});
assert.equal(branch.row.parent_activity_id,first.row.id);assert.equal(tables.HQTask.length,1);
let flow=await api('taskFlow',{id:first.row.task_id});assert.equal(flow.activities.length,3);
await api('closeTask',{id:first.row.task_id,outcome:'sikertelen',final:true,result:''},400);
await api('closeTask',{id:first.row.task_id,outcome:'sikertelen',due_date:'2099-01-01',result:'Nem értem el'});
assert.equal(tables.HQTask[0].status,'open');assert.equal(tables.HQTask[0].reminder_count,1);
await api('closeTask',{id:first.row.task_id,outcome:'sikeres',expected_updated:'stale'},409);
await api('closeTask',{id:first.row.task_id,outcome:'sikertelen',final:true,result:'A projektet törölték'});
assert.equal(tables.HQTask[0].status,'done');assert.equal((await api('taskFlow')).summary.lost,1);
await api('saveRow',{date:'2026-10-30',row:{...row,client_key:'closed-case',task_id:first.row.task_id}},400);
const won=await api('saveRow',{date:'2026-10-30',row:{...row,client_key:'new-case'}});
await api('closeTask',{id:won.row.task_id,outcome:'sikeres',result:'Megrendelve'});
assert.equal((await api('taskFlow')).summary.won,1);
await entities.HQTask.create({employee:'Más',company_id:company.id,archived:false,status:'open',note:'Other',due_date:'2099-01-01'});
assert.equal((await api('taskFlow')).tasks.length,2);
await api('taskFlow',{id:tables.HQTask[2].id},403);
await api('trafficApprove',{revision:'no-access'},403);
user=admin;
const state={version:2,parts:[{key:'sales:2026-10',kind:'sales',period:'2026-10',rows:[{p:'2026-10',company:company.name,kg:24000,employee:'Éva'}]}],settings:{money:'unknown',aliases:{keep:'kept'},monthlyKpis:[{employee:'Éva'}]}};
const payload=zlib.gzipSync(JSON.stringify(state)).toString('base64');
await api('stageChunks',{revision:'fixture-import',chunks:[{chunk_index:0,payload}]});
const meta={report_revision:'fixture-import',report_chunk_count:1,expected_report_revision:'',fingerprint:'same-content',file_name:'Forg.xlsx',scope:'full'};
const agg={company:company.name,company_meta:{owners:['Éva'],countries:['Magyarország'],teams:['Brigi'],types:['vevő']},kind:'sales',kg:24000,net:100,rows:1,first_date:'2026-10-30',last_date:'2026-10-30',months:[{m:'2026-10',kg:24000,net:100,rows:1}]};
await api('trafficStage',{revision:'fixture-import',meta,rows:[agg]});
await api('trafficStage',{revision:'fixture-import',meta:{},rows:[agg]});assert.equal(tables.HQTrafficAgg.length,1);
await api('trafficPreview',{revision:'fixture-import'});
await api('trafficApprove',{revision:'fixture-import',currency:'HUF',currency_confirmed:false});
assert.equal(tables.HQCompany.length,1);assert.equal(tables.HQCompany[0].id,company.id);assert.equal(tables.HQCompany[0].county,'Pest');assert.equal(tables.HQCompany[0].teams[0],'Brigi');
const decoded=JSON.parse(zlib.gunzipSync(Buffer.from((await api('report')).payload,'base64')));assert.equal(decoded.parts.find(p=>p.kind==='sales').rows.length,1);assert.equal(decoded.parts.find(p=>p.kind==='sales').rows[0].kg,24000);assert.equal(decoded.settings.aliases.keep,'kept');assert.equal(decoded.parts.find(p=>p.kind==='daily').rows.length,4);
await api('trafficStage',{revision:'fixture-repeat',meta:{fingerprint:'same-content'},rows:[agg]});
await api('trafficApprove',{revision:'fixture-repeat'},409);
await api('trafficStage',{revision:'fixture-stale',meta:{report_revision:'fixture-import',report_chunk_count:1,expected_report_revision:'old'},rows:[agg]});
await api('trafficApprove',{revision:'fixture-stale'},409);
assert.equal(tables.HQTrafficPackage.filter(x=>x.status==='active').length,1);
console.log('PASS: call-to-case persistence, save retry, continuation, branching, follow-up, won/lost closure, stale edit, employee isolation, exact company IDs, retained county/history, import deduplication, report synchronization and stale import. Isolated fixtures only.');
})().catch(e=>{console.error(e);process.exitCode=1});
