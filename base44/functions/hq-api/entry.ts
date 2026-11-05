import { createClientFromRequest } from 'npm:@base44/sdk';
const actions=['Megrendelés','Ajánlat','Új cég','Kivitt hajlítás'];
const buckets=['0-4 t','4-8 t','8-15 t','15-24 t','24-50 t','50+ t'];
const huCounties=['Bács-Kiskun','Baranya','Békés','Borsod-Abaúj-Zemplén','Budapest','Csongrád-Csanád','Fejér','Győr-Moson-Sopron','Hajdú-Bihar','Heves','Jász-Nagykun-Szolnok','Komárom-Esztergom','Nógrád','Pest','Somogy','Szabolcs-Szatmár-Bereg','Tolna','Vas','Veszprém','Zala','Külföld'];
const clean=(s:any)=>String(s??'').trim();
const key=(s:any)=>clean(s).toLocaleLowerCase('hu').replace(/\s+/g,' ');
const personKey=(s:any)=>key(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status})};
const plusDays=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function validDate(s:any){return /^20\d{2}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s}
const normCounty=(v:any)=>{const s=clean(v).replace(/\s*megye\s*$/i,'');return huCounties.find((c:string)=>personKey(c)===personKey(s))||''};
const cityCandidates=(raw:any)=>{const s=clean(raw);if(!s)return[];const seg=clean(s.split(',')[0]);return [...new Set([s,seg,clean(seg.replace(/^\d{4}\s*/,'')).replace(/\s*\d{4}$/,''),seg.split(' ').slice(0,2).join(' '),seg.split(' ')[0]])].filter(Boolean)};
async function all(entity:any,query:any={}){let out:any[]=[];for(let skip=0;;skip+=500){let a=await entity.filter(query,'id',500,skip);out.push(...a);if(a.length<500)break}return out}
const num0=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const dayTime=()=>new Date().toISOString();
const TASK_TYPES=['megkereses','ajanlat_utani','dokumentumkeres','arfrissites','latogatas','muszaki_egyeztetes','rendeles_ellenorzes','visszaaktivitas','szallitas','reklamacio','egyeb'];
const SUSPENDABLE=new Set(['megkereses','ajanlat_utani','dokumentumkeres','arfrissites','latogatas','muszaki_egyeztetes','visszaaktivitas']);
async function audit(E:any,user:any,entry:any){try{await E.HQAudit.create({at:dayTime(),actor_email:key(user.email),actor:clean(user.full_name||user.email),action:clean(entry.action).slice(0,200),target_kind:clean(entry.target_kind),target_id:clean(entry.target_id),target_label:clean(entry.target_label).slice(0,300),before:entry.before||{},after:entry.after||{},reason:clean(entry.reason).slice(0,1000),revision:clean(entry.revision)})}catch{}}
function validRuleItems(items:any){if(!Array.isArray(items)||!items.length||items.length>200)fail('A ponttáblán 1 és 200 közötti szabály szerepelhet.');const seen=new Set(),out:any[]=[];for(const it of items){const action=clean(it?.action),bucket=clean(it?.bucket),points=Number(it?.points);if(!actions.includes(action))fail('Érvénytelen tevékenység a ponttáblán: '+action);if(bucket&&!buckets.includes(bucket))fail('Érvénytelen tonnasáv: '+bucket);if(!Number.isFinite(points)||points<0)fail('A pont nem lehet negatív.');const k=action+'|'+bucket;if(seen.has(k))fail('Ugyanaz a tevékenység és tonnasáv csak egyszer szerepelhet: '+action+(bucket?' / '+bucket:''));seen.add(k);const min=it?.min===''||it?.min===null||it?.min===undefined?null:Number(it.min),max=it?.max===''||it?.max===null||it?.max===undefined?null:Number(it.max);if(min!==null&&!Number.isFinite(min))fail('Hibás alsó határ.');if(max!==null&&!Number.isFinite(max))fail('Hibás felső határ.');if(min!==null&&max!==null&&min>max)fail('Az alsó határ nagyobb a felsőnél: '+action+(bucket?' / '+bucket:''));out.push({action,bucket,points:Math.round(points*100)/100,min,max,unit:clean(it?.unit).slice(0,20),once_key:clean(it?.once_key).slice(0,80),note:clean(it?.note).slice(0,300),active:it?.active!==false})}const bands=out.filter((i:any)=>i.min!==null&&i.max!==null);for(let i=0;i<bands.length;i++)for(let j=i+1;j<bands.length;j++){if(bands[i].action!==bands[j].action)continue;if(bands[i].min<=bands[j].max&&bands[j].min<=bands[i].max)fail('Átfedő tonnasáv ugyanabban a tevékenységben: '+bands[i].action)}return out}
async function closedRuleVersions(E:any,day:string){return (await all(E.HQRuleVersion,{status:'closed'})).filter((v:any)=>validDate(v.effective_from)&&v.effective_from<=day).sort((a:any,b:any)=>String(b.effective_from).localeCompare(String(a.effective_from))||String(b.closed_at||'').localeCompare(String(a.closed_at||'')))}
function pickRule(versions:any[],action:string,bucket:string){for(const v of versions){const items=(v.items||[]).filter((i:any)=>i.active!==false&&i.action===action&&(!i.bucket||i.bucket===bucket));if(!items.length)continue;const exact=bucket?items.find((i:any)=>i.bucket===bucket):null;const rule=exact||items.find((i:any)=>!i.bucket)||items[0];return{rule,version:v}}return null}
async function activePackage(E:any){return (await E.HQTrafficPackage.filter({status:'active'},'-approved_at',1))[0]||null}
function completeMonths(periodTo:string){const set=new Set<string>();if(!validDate(periodTo))return set;const d=new Date(periodTo+'T00:00:00Z'),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();if(d.getUTCDate()===last)set.add(periodTo.slice(0,7));let y=Number(periodTo.slice(0,4)),m=Number(periodTo.slice(5,7));while(set.size<36){m--;if(m<1){m=12;y--}if(y<2000)break;set.add(y+'-'+String(m).padStart(2,'0'))}return set}
function monthRows(sales:any[]){const map=new Map<string,any>();for(const r of sales)for(const m of r.months||[]){const e=map.get(m.m)||{m:m.m,kg:0,net:0,rows:0,companies:0};e.kg+=num0(m.kg);e.net+=num0(m.net);e.rows+=num0(m.rows);e.companies++;map.set(m.m,e)}return [...map.values()].sort((a,b)=>a.m.localeCompare(b.m)).map((e:any)=>({m:e.m,kg:Math.round(e.kg*1000)/1000,net:Math.round(e.net*100)/100,rows:e.rows,companies:e.companies}))}
function moversFrom(sales:any[],complete:Set<string>,limit=8){const list:any[]=[];for(const r of sales){const months=(r.months||[]).filter((m:any)=>complete.has(m.m));if(months.length<2)continue;const last=months[months.length-1],prev=months.slice(-4,-1),avg=prev.reduce((n:number,m:any)=>n+num0(m.kg),0)/Math.max(1,prev.length),delta=num0(last.kg)-avg;if(!avg&&!delta)continue;list.push({company:r.company,company_key:r.company_key,month:last.m,kg:Math.round(num0(last.kg)*1000)/1000,base:Math.round(avg*1000)/1000,delta:Math.round(delta*1000)/1000,pct:avg?Math.round((num0(last.kg)/avg-1)*100):null})}list.sort((a,b)=>b.delta-a.delta);return{up:list.filter(x=>x.delta>0).slice(0,limit),down:list.filter(x=>x.delta<0).slice(0,limit),compared:list.length}}
async function unzip(s:string){let data=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return JSON.parse(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).text())}
async function zip(obj:any){let a=new Uint8Array(await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.slice(i,i+8192));return btoa(s)}
function safeRow(r:any){let out:any={company_id:clean(r.company_id),action:clean(r.action),bucket:clean(r.bucket),note:clean(r.note),client_key:clean(r.client_key),contact:clean(r.contact).slice(0,200),product:clean(r.product).slice(0,200),deal_ref:clean(r.deal_ref).slice(0,120),outcome:clean(r.outcome).slice(0,500),next_step:clean(r.next_step).slice(0,500),next_due:clean(r.next_due)};if(out.next_due&&!validDate(out.next_due))fail('Érvénytelen következő határidő.');if(!out.company_id)fail('Válassz céget a cégtörzsből.');if(!actions.includes(out.action))fail('Érvénytelen tevékenység.');if(out.bucket&&!buckets.includes(out.bucket))fail('Érvénytelen tonnasáv.');if(out.note.length>10000)fail('A megjegyzés legfeljebb 10000 karakter lehet.');for(let k of ['order_t','quote_t','bend_t']){let v=r[k];out[k]=(v===null||v===undefined||v==='')?null:Number(v);if(out[k]!==null&&(!Number.isFinite(out[k])||out[k]<0))fail('A tonnaérték nem lehet negatív.')}if(out.action==='Megrendelés'&&out.order_t===null)fail('A megrendelésnél add meg a rendelt tonnát.');return out}
async function legacyState(E:any){
 const manifest=(await E.HQReport.filter({committed:true},'-created_date',1))[0];if(!manifest)return null;
 const chunks=(await all(E.HQChunk,{revision:manifest.revision})).sort((a:any,b:any)=>a.chunk_index-b.chunk_index);if(chunks.length!==manifest.chunk_count)fail('Hiányos mentés.');
 return {manifest,state:validateState(await unzip(chunks.map((c:any)=>c.payload).join('')))};
}
function validateState(s:any){if(s?.version!==2||!Array.isArray(s.parts)||!s.settings)fail('Hibás kimutatásmentés.');let seen=new Set();for(let p of s.parts){if(!['sales','purchase','daily','requests','visits','registry','undated','newcompanies','monthlyKpi'].includes(p.kind)||!Array.isArray(p.rows)||p.key!==p.kind+':'+p.period||seen.has(p.key))fail('Hibás vagy ismétlődő adatcsomag.');seen.add(p.key);p.rows=p.rows.filter((r:any)=>!r.__hqLiveId);for(let r of p.rows){if(typeof r.company!=='string'||(p.period!=='all'&&r.p!==p.period))fail('Hibás adatsor.');if(['sales','purchase'].includes(p.kind)&&!Number.isFinite(r.kg))fail('Hibás súly.')}}return s}
Deno.serve(async(req)=>{try{
 const b=createClientFromRequest(req),user=await b.auth.me();if(!user)fail('Jelentkezz be.',401);
 const E=b.asServiceRole.entities,admin=user.role==='admin',email=key(user.email);
 const members=admin?await all(E.HQMember):await all(E.HQMember,{email});
 let member=members.find((m:any)=>key(m.email)===email&&m.active);
 if(!member&&!admin){
  const tokenKey=(s:any)=>personKey(s).split(' ').filter(Boolean).sort().join(' ');
  const owners=(await all(E.HQCompany)).flatMap((c:any)=>c.owners||[]).map(clean).filter(Boolean);
  const named=owners.find((o:any)=>personKey(o)===personKey(user.full_name))||owners.find((o:any)=>tokenKey(o)===tokenKey(user.full_name));
  member=await E.HQMember.create({email,employee:clean(named||user.full_name||user.email),access:'employee',team:'',active:true});
  members.push(member);
 }
 if(!admin&&!member)fail('A hozzáférésed fel van függesztve. Szólj az adminisztrátornak.',403);
 const manager=admin||member?.access==='manager',employee=member?.employee||user.full_name||user.email;
 const body:any=req.headers.get('content-type')?.includes('multipart/form-data')?Object.fromEntries(await req.formData()):await req.json(),action=body.action;
 const requireAdmin=()=>{if(!admin)fail('Ehhez adminisztrátori jogosultság kell.',403)};
 const resolveEmployee=()=>{if(!admin)return employee;let n=clean(body.employee||employee);if(n.length<2||n.length>150)fail('Válassz kollégát.');return n};
 const ruleList=()=>all(E.HQRule);
 const documentCategories=['Ajánlat','Megrendelés','Műszaki dokumentum','Minőségi bizonylat','Forgalmi export','Napi jelentés','Egyéb'];
 const canReadDocument=(d:any)=>!!d&&(manager||key(d.owner_email)===email||d.visibility==='team');
 const publicDocument=(d:any)=>{const {file_uri,...meta}=d;return meta};
 if(action==='listDocuments'){
  const docs=await all(E.HQDocument);return Response.json({documents:docs.filter(canReadDocument).sort((a:any,b:any)=>b.created_date.localeCompare(a.created_date)).map(publicDocument)});
 }
 if(action==='uploadDocument'){
  const file=body.file;if(!(file instanceof File)||!file.size||file.size>25*1024*1024)fail('Legfeljebb 25 MB-os, nem üres fájl tölthető fel.');
  const filename=clean(file.name).replace(/[\\/\u0000-\u001f]/g,'_').slice(0,250);
  if(!/\.(pdf|docx?|xlsx?|csv|png|jpe?g|txt|json|html)$/i.test(filename))fail('Nem támogatott fájltípus.');
  const clientKey=clean(body.client_key);if(!/^[A-Za-z0-9-]{8,80}$/.test(clientKey))fail('Hiányzó feltöltésazonosító.');
  if(!validDate(body.document_date)||!documentCategories.includes(body.category)||!['team','private'].includes(body.visibility))fail('Ellenőrizd a dátumot, típust és hozzáférést.');
  const note=clean(body.note);if(note.length>5000)fail('A megjegyzés legfeljebb 5000 karakter lehet.');
  const previous=(await all(E.HQDocument,{client_key:clientKey,owner_email:email}))[0];if(previous)return Response.json({document:publicDocument(previous)});
  const company=body.company_id?await E.HQCompany.get(clean(body.company_id)):null;if(body.company_id&&!company?.active)fail('A kiválasztott cég nem aktív.');
  const uploaded=await b.asServiceRole.integrations.Core.UploadPrivateFile({file});if(!uploaded?.file_uri)fail('A fájl feltöltése nem sikerült.',502);
  const doc=await E.HQDocument.create({filename,file_uri:uploaded.file_uri,size_bytes:file.size,mime_type:file.type||'application/octet-stream',company_id:company?.id||'',company:company?.name||'',category:body.category,document_date:body.document_date,visibility:body.visibility,note,owner_email:email,employee,archived:false,client_key:clientKey});
  return Response.json({document:publicDocument(doc)});
 }
 if(action==='documentLink'||action==='archiveDocument'){
  const doc=await E.HQDocument.get(clean(body.id));if(!canReadDocument(doc))fail('A dokumentum nem érhető el.',403);
  if(action==='documentLink'){const link=await b.asServiceRole.integrations.Core.CreateFileSignedUrl({file_uri:doc.file_uri,expires_in:600});return Response.json({signed_url:link.signed_url,filename:doc.filename})}
  if(!admin&&key(doc.owner_email)!==email)fail('Csak saját dokumentumot archiválhatsz.',403);
  if(typeof body.archived!=='boolean')fail('Hibás állapot.');
  if(body.expected_updated!==doc.updated_date)fail('A dokumentum időközben változott. Frissítsd a listát.',409);
  const updated=await E.HQDocument.update(doc.id,{archived:body.archived});return Response.json({document:publicDocument(updated)});
 }

 if(action==='bootstrap'){
  const [companies,rules,manifests,ruleVersions,trafficPackages]=await Promise.all([all(E.HQCompany),ruleList(),E.HQReport.filter({committed:true},'-created_date',1),all(E.HQRuleVersion),E.HQTrafficPackage.filter({},'-created_date',40)]);
  const assignedToEmployee=(c:any)=>admin||manager||(c.owners||[]).some((o:any)=>personKey(o)===personKey(employee));
  const activePkg=trafficPackages.find((p:any)=>p.status==='active')||null;
  const draft=(ruleVersions.filter((v:any)=>v.status==='draft').sort((a:any,b:any)=>(Number(b.version)||0)-(Number(a.version)||0))[0]||null);
  const closedLatest=ruleVersions.filter((v:any)=>v.status==='closed').sort((a:any,b:any)=>String(b.closed_at||b.created_date).localeCompare(String(a.closed_at||a.created_date)))[0]||null;
  return Response.json({user:{id:user.id,email:user.email,name:user.full_name},admin,manager,employee,members:admin?members:[],companies:companies.filter((c:any)=>c.active&&assignedToEmployee(c)),inactiveOwn:companies.filter((c:any)=>!c.active&&!admin&&!manager&&(c.owners||[]).some((o:any)=>personKey(o)===personKey(employee))).length,rules,manifest:manifests[0]||null,actions,buckets,today:today(),ruleState:{draft:draft?{id:draft.id,version:draft.version,effective_from:draft.effective_from}:null,closed:closedLatest?{id:closedLatest.id,version:closedLatest.version,effective_from:closedLatest.effective_from,closed_at:closedLatest.closed_at||''}:null,count:ruleVersions.length},traffic:activePkg?{revision:activePkg.revision,label:activePkg.label||activePkg.file_name,period_from:activePkg.period_from,period_to:activePkg.period_to,approved_at:activePkg.approved_at||'',scope:activePkg.scope,currency:activePkg.currency||'',currency_confirmed:!!activePkg.currency_confirmed,kg_sales:Number(activePkg.kg_sales)||0,rows_sales:Number(activePkg.rows_sales)||0,companies_sales:Number(activePkg.companies_sales)||0}:null,trafficPackages:admin?trafficPackages.map((p:any)=>({id:p.id,revision:p.revision,label:p.label||p.file_name,status:p.status,scope:p.scope,period_from:p.period_from,period_to:p.period_to,kg_sales:Number(p.kg_sales)||0,kg_purchase:Number(p.kg_purchase)||0,uploaded_at:p.uploaded_at||'',approved_at:p.approved_at||'',currency:p.currency||'',currency_confirmed:!!p.currency_confirmed})):[]});
 }
 if(action==='getDay'||action==='openDay'||action==='setDayStatus'){
  let day=clean(body.date),person=resolveEmployee();if(!validDate(day))fail('Érvénytelen dátum.');
  let sheets=await all(E.HQDay,{date:day,employee:person}),sheet=sheets[0]||null;
  if(action==='openDay'&&!sheet){if(day>today())fail('Jövőbeli napra nem nyitható munkalap.');sheet=await E.HQDay.create({date:day,employee:person,owner_email:email,status:'open',key:person+'|'+day})}
  if(action==='setDayStatus'){
   if(!sheet)fail('Előbb nyisd meg a munkalapot.');if(!['open','closed'].includes(body.status))fail('Hibás állapot.');
   if(body.expected_updated&&body.expected_updated!==sheet.updated_date)fail('A munkalap időközben változott. Frissítsd az adatokat.',409);
   if(body.status==='closed'){
    if(sheet.status==='closed')fail('A munkalap már lezárt.');
    const rowsNow=await all(E.HQActivity,{date:day,employee:person,archived:false});
    const ruleLabels=[...new Set(rowsNow.map((r:any)=>clean(r.rule_label)).filter(Boolean))];
    const totals:any={rows:rowsNow.length,order_t:0,quote_t:0,bend_t:0,points:0,pending:0};
    for(const r of rowsNow){totals.order_t+=num0(r.order_t);totals.quote_t+=num0(r.quote_t);totals.bend_t+=num0(r.bend_t);if(r.points===null||r.points===undefined)totals.pending++;else totals.points+=num0(r.points)}
    const revision=crypto.randomUUID();
    const snapshot={date:day,employee:person,closed_at:dayTime(),rows:rowsNow.map((r:any)=>({id:r.id,company:r.company,company_id:r.company_id,action:r.action,bucket:r.bucket,order_t:r.order_t,quote_t:r.quote_t,bend_t:r.bend_t,points:r.points,rule_label:r.rule_label||'',rule_version:r.rule_version??null,note:r.note||''})),totals,rule_labels:ruleLabels};
    sheet=await E.HQDay.update(sheet.id,{status:'closed',revision,closed_at:dayTime(),closed_by:employee,closed_by_email:email,snapshot,rule_versions:ruleLabels});
    for(let i=0;i<rowsNow.length;i+=300)await E.HQActivity.bulkUpdate(rowsNow.slice(i,i+300).map((r:any)=>({id:r.id,day_revision:revision})));
    await audit(E,user,{action:'napi munkalap lezárása',target_kind:'hqday',target_id:sheet.id,target_label:person+' · '+day,revision,after:{rows:totals.rows,points:totals.points,order_t:totals.order_t,pending:totals.pending}});
   }else{
    if(!manager)fail('Lezárt munkalapot vezetői jogosultsággal lehet újranyitni.',403);
    if(sheet.status!=='closed')fail('A munkalap nincs lezárva.');
    const reason=clean(body.reason);if(reason.length<5)fail('Az újranyitás indoklása kötelező (legalább 5 karakter).');
    sheet=await E.HQDay.update(sheet.id,{status:'open',reopen_count:(sheet.reopen_count||0)+1,last_reopen_reason:reason,last_reopened_by:employee});
    await audit(E,user,{action:'napi munkalap újranyitása',target_kind:'hqday',target_id:sheet.id,target_label:person+' · '+day,reason,before:{status:'closed',revision:sheet.revision||'',closed_at:sheet.closed_at||''},after:{status:'open',reopen_count:sheet.reopen_count||0}});
   }
  }
  const rows=await all(E.HQActivity,{date:day,employee:person,archived:false});
  const tasks=(await all(E.HQTask,{employee:person,archived:false})).sort((a:any,b:any)=>String(a.due_date).localeCompare(String(b.due_date))||String(b.created_date).localeCompare(String(a.created_date)));
  const teamTasks=admin?(await all(E.HQTask)).filter((t:any)=>t.status!=='done'&&!t.archived).sort((a:any,b:any)=>String(a.due_date).localeCompare(String(b.due_date))):[];
  const dayVersions=await closedRuleVersions(E,day);
  const history=sheet?(await all(E.HQAudit,{target_id:sheet.id})).sort((a:any,b:any)=>String(b.at).localeCompare(String(a.at))).slice(0,20).map((e:any)=>({id:e.id,at:e.at,actor:e.actor,action:e.action,reason:e.reason||'',after:e.after||{}})):[];
  return Response.json({sheet,rows,tasks,teamTasks,activeRule:dayVersions.length?{version:dayVersions[0].version,effective_from:dayVersions[0].effective_from,closed_at:dayVersions[0].closed_at||'',items:(dayVersions[0].items||[]).length}:null,history});
 }
 if(action==='saveRow'||action==='archiveRow'){
  const person=resolveEmployee(),day=clean(body.date);if(!validDate(day)||day>today())fail('Érvénytelen munkanap.');
  const sheet=(await all(E.HQDay,{date:day,employee:person}))[0];if(!sheet)fail('Nyitott munkalap szükséges.');
  if(sheet.status!=='open')fail('A munkalap le van zárva, közvetlenül nem módosítható. Kérd az újranyitást indoklással.',423);
  let previous=body.id?await E.HQActivity.get(body.id):null;
  if(previous&&(previous.employee!==person||previous.date!==day))fail('Másik munkalap sora nem módosítható.',403);
  if(previous&&body.expected_updated!==previous.updated_date)fail('Ezt a sort időközben módosították. Frissítsd a munkalapot.',409);
  if(action==='archiveRow'){if(!previous)fail('Nincs ilyen sor.');const row=await E.HQActivity.update(previous.id,{archived:true});await audit(E,user,{action:'napi sor kivétele',target_kind:'hqactivity',target_id:row.id,target_label:previous.company+' · '+day,before:{order_t:previous.order_t,points:previous.points,note:previous.note}});return Response.json({row})}
  const data=safeRow(body.row),company=await E.HQCompany.get(data.company_id);if(!company?.active)fail('A cég nem aktív.');
  if(!admin&&!manager&&!(company.owners||[]).some((o:any)=>personKey(o)===personKey(employee)))fail('Ez a cég nincs hozzád rendelve.',403);
  if(!data.client_key)fail('Hiányzó sorazonosító.');
  if(!previous){const retry=(await all(E.HQActivity,{client_key:data.client_key,employee:person}))[0];if(retry)return Response.json({row:retry})}
  const versions=await closedRuleVersions(E,day),match=pickRule(versions,data.action,data.bucket);
  let points:number|null=null,rule_id='',rule_label='Nincs pontszabály',rule_version:number|null=null,rule_version_id='';
  if(match){rule_id=clean(match.rule.id)||match.version.id;rule_version=Number(match.version.version)||null;rule_version_id=match.version.id;points=Number(match.rule.points);rule_label=(match.version.version||'')+'. verzió · '+match.rule.action+' / '+(match.rule.bucket||'minden sáv')+' / '+match.version.effective_from}
  else{const legacy=(await ruleList()).filter((r:any)=>r.enabled&&r.action===data.action&&(!r.bucket||r.bucket===data.bucket)&&r.effective_from<=day).sort((a:any,b:any)=>(Number(!!b.bucket)-Number(!!a.bucket))||b.effective_from.localeCompare(a.effective_from)||b.created_date.localeCompare(a.created_date))[0];if(legacy){rule_id=legacy.id;points=Number(legacy.points);rule_label='Korábbi szabály · '+legacy.action+' / '+(legacy.bucket||'minden sáv')+' / '+legacy.effective_from}}
  if(points!==null&&data.action==='Megrendelés'&&!(num0(data.order_t)>0)){points=null;rule_label='Nincs pontszám: a rendelt tonna nulla vagy negatív'}
  Object.assign(data,{date:day,employee:person,owner_email:previous?.owner_email||email,company:company.name,points,rule_id,rule_label,rule_version,rule_version_id,day_revision:sheet.revision||'',archived:false});
  const row=previous?await E.HQActivity.update(previous.id,data):await E.HQActivity.create(data);
  await audit(E,user,{action:previous?'napi sor módosítása':'napi sor rögzítése',target_kind:'hqactivity',target_id:row.id,target_label:company.name+' · '+day+' · '+data.action,after:{order_t:row.order_t,quote_t:row.quote_t,bend_t:row.bend_t,bucket:row.bucket,points:row.points,rule_label:row.rule_label}});
  return Response.json({row});
 }
 if(action==='saveTask'||action==='closeTask'||action==='postponeTask'){
  const person=resolveEmployee();
  if(action==='saveTask'){
   const t=body.task||{},note=clean(t.note),due=clean(t.due_date);
   if(!note)fail('Írd le, miről volt szó és mi a következő lépés.');if(note.length>2000)fail('A teendő legfeljebb 2000 karakter lehet.');
   if(!due)fail('Add meg a teendő határidejét. A rendszer nem talál ki dátumot.');
   if(!validDate(due))fail('Érvénytelen határidő.');
   const taskType=clean(t.task_type)||'megkereses';if(!TASK_TYPES.includes(taskType))fail('Érvénytelen teendőtípus.');
   const priority=clean(t.priority)||'kozepes';if(!['magas','kozepes','alacsony'].includes(priority))fail('Érvénytelen prioritás.');
   const company=await E.HQCompany.get(clean(t.company_id)).catch(()=>null);if(!company?.active)fail('A cég nem aktív.');
   if(!admin&&!manager&&!(company.owners||[]).some((o:any)=>personKey(o)===personKey(employee)))fail('Ez a cég nincs hozzád rendelve.',403);
   const previous=t.id?await E.HQTask.get(clean(t.id)).catch(()=>null):null;if(previous&&previous.employee!==person)fail('Másik kolléga teendője nem módosítható.',403);
   const data={employee:person,owner_email:previous?.owner_email||email,company_id:company.id,company:company.name,note,due_date:due,archived:false,task_type:taskType,priority,next_step:clean(t.next_step).slice(0,500),origin:clean(t.origin).slice(0,200),suspended:false,suspended_reason:''};
   const task=previous?await E.HQTask.update(previous.id,data):await E.HQTask.create({...data,status:'open',outcome:'',closed_date:'',postpone_count:0,reminder_count:0});
   return Response.json({task});
  }
  const task=await E.HQTask.get(clean(body.id)).catch(()=>null);if(!task)fail('Nincs ilyen teendő.',404);
  if(task.employee!==person)fail('Ez nem a te teendőd.',403);
  if(action==='postponeTask'){
   const due=clean(body.due_date);if(!validDate(due)||due<today())fail('Add meg az új határidőt (mai vagy későbbi nap). A rendszer nem tolja el magától a teendőt.');
   const reason=clean(body.reason);if(reason.length<3)fail('A halasztás indoklása kötelező.');
   const updated=await E.HQTask.update(task.id,{due_date:due,previous_due:clean(task.due_date),postpone_reason:reason.slice(0,400),status:'open',suspended:false,postpone_count:(task.postpone_count||0)+1});
   await audit(E,user,{action:'teendő halasztása',target_kind:'hqtask',target_id:task.id,target_label:task.company+' · '+task.note,reason,before:{due_date:task.due_date},after:{due_date:due}});
   return Response.json({task:updated});
  }
  if(!['sikeres','sikertelen'].includes(body.outcome))fail('Hibás eredmény.');
  const result=clean(body.result).slice(0,500);
  if(clean(body.outcome)==='sikertelen'){
   const due=clean(body.due_date);if(!validDate(due)||due<today())fail('Válaszd ki a következő megkeresés napját. A rendszer nem tolja el automatikusan a teendőt.');
   const retry=await E.HQTask.update(task.id,{status:'open',outcome:'sikertelen',result,closed_date:'',previous_due:clean(task.due_date),due_date:due,postpone_reason:'sikertelen megkeresés',reminder_count:(task.reminder_count||0)+1});
   await audit(E,user,{action:'teendő sikertelen megkeresés',target_kind:'hqtask',target_id:task.id,target_label:task.company,reason:result,before:{due_date:task.due_date},after:{due_date:due}});
   return Response.json({task:retry});
  }
  const done=await E.HQTask.update(task.id,{status:'done',outcome:'sikeres',result,closed_date:today(),suspended:false});
  await audit(E,user,{action:'teendő lezárása',target_kind:'hqtask',target_id:task.id,target_label:task.company,after:{outcome:'sikeres',result}});
  return Response.json({task:done});
 }
 if(action==='saveRule'){
  requireAdmin();let r=body.rule;if(!actions.includes(r.action)||r.bucket&&!buckets.includes(r.bucket)||!validDate(r.effective_from)||!Number.isFinite(Number(r.points))||Number(r.points)<0)fail('Ellenőrizd a tevékenységet, dátumot és pontot.');
  const saved=await E.HQRule.create({action:r.action,bucket:r.bucket||'',points:Number(r.points),effective_from:r.effective_from,enabled:true});return Response.json({rule:saved});
 }
 if(action==='saveMember'){
  requireAdmin();let m=body.member,memail=key(m.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memail)||!clean(m.employee)||!['employee','manager'].includes(m.access))fail('E-mail, kolléganév és hozzáférés szükséges.');
  const other=members.find((x:any)=>x.employee===clean(m.employee)&&x.email!==memail&&x.active&&m.active!==false);if(other)fail('Ehhez a kolléganévhez már tartozik aktív e-mail.');
  let old=members.find((x:any)=>x.email===memail),data={email:memail,employee:clean(m.employee),access:m.access,active:m.active!==false,team:clean(m.team)};
  return Response.json({member:old?await E.HQMember.update(old.id,data):await E.HQMember.create(data)});
 }
 if(action==='companyBatch'){
  requireAdmin();if(!Array.isArray(body.companies)||body.companies.length>100)fail('Legfeljebb 100 cég tölthető fel egy részletben.');let existing=await all(E.HQCompany),map=new Map(existing.map((c:any)=>[key(c.name),c])),added=0,updated=0;
  for(let c of body.companies){const name=clean(c.name);if(!name||name.length>500)fail('Hibás cégnév.');let old:any=map.get(key(name));let data:any={name,source:clean(body.source),county:normCounty(c.county)||old?.county||'',city:clean(c.city)||old?.city||''};for(let k of ['countries','owners','teams','types'])data[k]=Array.isArray(c[k])&&c[k].length?[...new Set(c[k].map(clean).filter(Boolean))]:(old?.[k]||[]);if(clean(c.currency))data.currency=clean(c.currency).slice(0,8);if(old){if(old.active===false)data.review_date=today();await E.HQCompany.update(old.id,data);updated++}else{const fresh=await E.HQCompany.create({...data,active:true});map.set(key(name),fresh);added++}}return Response.json({added,updated,keptInactive:'Az inaktív cégeket az import nem aktiválja vissza, csak felülvizsgálati jelzést kapnak.'});
 }
 if(action==='stageChunks'){
  requireAdmin();if(!/^[A-Za-z0-9-]{4,80}$/.test(body.revision)||!Array.isArray(body.chunks)||!body.chunks.length||body.chunks.length>20)fail('Hibás mentési csomag.');
  const existing=await all(E.HQChunk,{revision:body.revision}),map=new Map(existing.map((c:any)=>[c.chunk_index,c.payload])),pending:any[]=[];
  for(let c of body.chunks){if(!Number.isInteger(c.chunk_index)||c.chunk_index<0||c.chunk_index>1000||typeof c.payload!=='string'||c.payload.length>8000)fail('Hibás adatrész.');if(map.has(c.chunk_index)){if(map.get(c.chunk_index)!==c.payload)fail('Ütköző adatrész.');}else{pending.push({revision:body.revision,chunk_index:c.chunk_index,payload:c.payload});map.set(c.chunk_index,c.payload)}}
  if(pending.length)await E.HQChunk.bulkCreate(pending);return Response.json({ok:true});
 }
 if(action==='stageChunk'){
  requireAdmin();if(!/^[A-Za-z0-9-]{4,80}$/.test(body.revision)||!Number.isInteger(body.chunk_index)||body.chunk_index<0||body.chunk_index>1000||typeof body.payload!=='string'||body.payload.length>8000)fail('Hibás mentési csomag.');
  const old=(await all(E.HQChunk,{revision:body.revision,chunk_index:body.chunk_index}))[0];if(old){if(old.payload!==body.payload)fail('Ütköző mentési csomag.');return Response.json({ok:true})}
  await E.HQChunk.create({revision:body.revision,chunk_index:body.chunk_index,payload:body.payload});return Response.json({ok:true});
 }
 if(action==='commitReport'){
  requireAdmin();const latest=(await E.HQReport.filter({committed:true},'-created_date',1))[0];if((latest?.revision||null)!==(body.expected_revision||null))fail('A kimutatás időközben frissült. Töltsd újra a friss adatokat.',409);
  const chunks=(await all(E.HQChunk,{revision:body.revision})).sort((a:any,b:any)=>a.chunk_index-b.chunk_index);if(chunks.length!==body.chunk_count||chunks.some((c:any,i:number)=>c.chunk_index!==i))fail('Hiányos adatcsomag.');
  const s=validateState(await unzip(chunks.map((c:any)=>c.payload).join('')));const record=await E.HQReport.create({revision:body.revision,chunk_count:chunks.length,committed:true,source:'Adatközpont',rows:s.parts.reduce((n:number,p:any)=>n+p.rows.length,0)});return Response.json({manifest:record});
 }
 if(action==='report'){
  const manifest=(await E.HQReport.filter({committed:true},'-created_date',1))[0];if(!manifest)return Response.json({payload:await zip({version:2,activitySchema:1,journalSchema:1,parts:[],settings:{money:'unknown',currency:'HUF',evalYear:new Date().getFullYear(),threshold:15,concentration:35,targets:{},aliases:{},monthlyKpis:[],dormantMonths:2},issues:[]}),manifest:null,admin,employee,manager});
  const chunks=(await all(E.HQChunk,{revision:manifest.revision})).sort((a:any,b:any)=>a.chunk_index-b.chunk_index);if(chunks.length!==manifest.chunk_count)fail('Hiányos mentés.');let s=validateState(await unzip(chunks.map((c:any)=>c.payload).join('')));
  if(!manager){for(let p of s.parts)p.rows=p.rows.filter((r:any)=>r.employee===employee);s.settings.monthlyKpis=(s.settings.monthlyKpis||[]).filter((r:any)=>r.employee===employee);s.settings.salesActions=Object.fromEntries(Object.entries(s.settings.salesActions||{}).filter(([,a]:any)=>!clean(a?.owner)||personKey(a.owner)===personKey(employee)));}
  const live=await all(E.HQActivity,manager?{archived:false}:{employee,archived:false});for(let r of live){let p=r.date.slice(0,7),part=s.parts.find((x:any)=>x.key==='daily:'+p);if(!part){part={key:'daily:'+p,kind:'daily',period:p,hash:'hq-live',source:'Base44 napi munkalap',rows:[],issues:[]};s.parts.push(part)}part.rows.push({p,date:r.date,employee:r.employee,company:r.company,action:r.action,bucket:r.bucket,orderT:r.order_t??null,quoteT:r.quote_t??null,bendT:r.bend_t??null,points:r.points??null,note:r.note||'',ref:'Base44!'+r.id,__hqLiveId:r.id})}
  s.updatedAt=Date.now();return Response.json({payload:await zip(s),manifest,admin,employee,manager});
 }
 if(action==='autoCounty'){
  if(!admin&&!manager)fail('Ehhez vezetői jogosultság kell.',403);
  const legacy=await legacyState(E);if(!legacy)fail('Nincs feltöltött forrásadat, amiből a városok kiolvashatók.');
  const state=legacy.state,cityOf=new Map<string,string>();
  for(const p of state.parts||[]){if(!['visits','newcompanies','undated'].includes(p.kind))continue;for(const r of p.rows||[]){const c=clean(r.city);if(!c||!clean(r.company))continue;const k=personKey(r.company);if(!cityOf.has(k))cityOf.set(k,c)}}
  const cityMap=new Map<string,string>((await all(E.HQCity)).map((c:any)=>[c.key,c.county])),companies=await all(E.HQCompany),patches:any[]=[],unknown:string[]=[];
  let withCity=0,noCity=0,unknownCity=0;
  for(const c of companies){if(!c.active||clean(c.county))continue;const raw=cityOf.get(personKey(c.name));if(!raw){noCity++;continue}withCity++;
   const county=cityCandidates(raw).map((x:string)=>cityMap.get(personKey(x))).find((x:any)=>!!x)||'';
   if(!county){unknownCity++;if(unknown.length<8)unknown.push(clean(c.name)+' · '+raw);continue}
   patches.push({id:c.id,county,city:clean(raw).slice(0,200)});
  }
  for(let i=0;i<patches.length;i+=200)await E.HQCompany.bulkUpdate(patches.slice(i,i+200));
  return Response.json({updated:patches.length,withCity,noCity,unknownCity,unknownSample:unknown,total:companies.filter((c:any)=>c.active).length});
 }
 if(action==='saveCompanyCounty'){
  if(!admin&&!manager)fail('Ehhez vezetői jogosultság kell.',403);
  const ids=Array.isArray(body.company_ids)?body.company_ids:[body.company_id];
  if(!ids.length||ids.length>500)fail('Egyszerre legfeljebb 500 cég megyéje állítható be.');
  const county=normCounty(body.county);if(clean(body.county)&&!county)fail('Válassz érvényes megyét.');
  let updated=0;for(const id of ids){const c=await E.HQCompany.get(clean(id)).catch(()=>null);if(!c)continue;await E.HQCompany.update(c.id,{county});updated++}
  return Response.json({updated,county});
 }
 if(action==='setCompanyActive'){
  const company=await E.HQCompany.get(clean(body.company_id)).catch(()=>null);if(!company)fail('Ismeretlen cég.',404);
  const canManage=admin||manager;
  if(!canManage&&!(company.owners||[]).some((o:any)=>personKey(o)===personKey(employee)))fail('Ez a cég nincs hozzád rendelve.',403);
  const activate=body.active===true;
  if(!!company.active===activate)fail(activate?'A cég már aktív.':'A cég már inaktív.');
  const openTasks=(await all(E.HQTask,{company_id:company.id,archived:false})).filter((t:any)=>t.status!=='done');
  const obligations=openTasks.filter((t:any)=>!SUSPENDABLE.has(clean(t.task_type)||'megkereses'));
  let data:any;
  if(activate){
   data={active:true,inactive_reason:'',inactive_by:'',inactive_at:'',reactivated_by:employee,reactivated_at:today(),review_date:''};
   for(const t of openTasks)if(t.suspended)await E.HQTask.update(t.id,{suspended:false,suspended_reason:''});
  }else{
   const reason=clean(body.reason);if(!['megszűnt','nem releváns','nem kér megkeresést','téves vagy duplikált rekord','egyéb'].includes(reason))fail('Válaszd ki az inaktiválás indokát.');
   const note=clean(body.note);if(note.length>1000)fail('Az indoklás legfeljebb 1000 karakter lehet.');
   const review=clean(body.review_date);if(review&&!validDate(review))fail('Érvénytelen felülvizsgálati dátum.');
   const label=reason+(note?' · '+note:'');
   data={active:false,inactive_reason:label,inactive_by:employee,inactive_at:today(),last_inactive_reason:label,last_inactive_by:employee,last_inactive_at:today(),review_date:review,reactivated_by:'',reactivated_at:''};
   for(const t of openTasks)if(SUSPENDABLE.has(clean(t.task_type)||'megkereses'))await E.HQTask.update(t.id,{suspended:true,suspended_reason:'A cég inaktiválva · '+reason});
  }
  const updated=await E.HQCompany.update(company.id,data);
  await audit(E,user,{action:activate?'cég visszaaktiválása':'cég inaktiválása',target_kind:'hqcompany',target_id:company.id,target_label:company.name,reason:activate?clean(body.reason):data.inactive_reason,before:{active:company.active,inactive_reason:company.inactive_reason||'',inactive_at:company.inactive_at||''},after:{active:updated.active,inactive_reason:updated.inactive_reason||'',inactive_at:updated.inactive_at||'',review_date:updated.review_date||''}});
  return Response.json({company:updated,suspended:activate?0:openTasks.filter((t:any)=>SUSPENDABLE.has(clean(t.task_type)||'megkereses')).length,obligations:obligations.map((t:any)=>({id:t.id,note:t.note,due_date:t.due_date,task_type:t.task_type||'megkereses'})),openTasks:openTasks.length});
 }
 if(action==='inactiveCompanies'){
  const scopeAll=admin||manager;
  const companies=(await all(E.HQCompany)).filter((c:any)=>!c.active&&(scopeAll||(c.owners||[]).some((o:any)=>personKey(o)===personKey(employee))));
  const canSee=(c:any)=>scopeAll||(c.owners||[]).some((o:any)=>personKey(o)===personKey(employee));
  return Response.json({scope:scopeAll?'mind':'saját',companies:companies.map((c:any)=>({id:c.id,name:c.name,county:clean(c.county),city:clean(c.city),owners:c.owners||[],inactive_reason:clean(c.inactive_reason),inactive_by:clean(c.inactive_by),inactive_at:clean(c.inactive_at),review_date:clean(c.review_date),previous_reason:clean(c.last_inactive_reason),previous_at:clean(c.last_inactive_at),mine:canSee(c)})).sort((a:any,b:any)=>String(b.inactive_at).localeCompare(String(a.inactive_at))||a.name.localeCompare(b.name,'hu')).slice(0,500),total:companies.length});
 }
 if(action==='ruleVersions'){
  if(!admin&&!manager)fail('Ehhez vezetői jogosultság kell.',403);
  const versions=(await all(E.HQRuleVersion)).sort((a:any,b:any)=>(Number(b.version)||0)-(Number(a.version)||0));
  return Response.json({versions:versions.map((v:any)=>({id:v.id,version:v.version,status:v.status,effective_from:v.effective_from,note:v.note||'',created_by:v.created_by||'',created_date:v.created_date,closed_by:v.closed_by||'',closed_at:v.closed_at||'',reopened_from:v.reopened_from||'',reopen_reason:v.reopen_reason||'',items:v.items||[]})),actions,buckets,legacy:(await all(E.HQRule)).length,today:today()});
 }
 if(action==='ruleDraftSave'){
  if(!admin&&!manager)fail('Ehhez vezetői jogosultság kell.',403);
  const items=validRuleItems(body.items),effective=clean(body.effective_from);
  if(!validDate(effective))fail('Add meg az érvényesség kezdő napját.');
  const note=clean(body.note);if(note.length>1000)fail('A megjegyzés legfeljebb 1000 karakter lehet.');
  const target=body.id?await E.HQRuleVersion.get(clean(body.id)).catch(()=>null):null;
  if(target&&target.status==='closed')fail('A lezárt ponttábla nem szerkeszthető. Nyisd fel szerkesztésre indoklással.',423);
  const sameDay=(await all(E.HQRuleVersion,{status:'closed',effective_from:effective})).filter((v:any)=>!target||v.id!==target.id);
  if(sameDay.length)fail('Erre a napra már van lezárt ponttábla. Válassz másik érvényesség-kezdő napot.',409);
  if(target){const saved=await E.HQRuleVersion.update(target.id,{items,effective_from:effective,note});await audit(E,user,{action:'ponttábla piszkozat mentése',target_kind:'hqruleversion',target_id:target.id,target_label:Number(target.version)+'. verzió',after:{items:items.length,effective_from:effective}});return Response.json({version:saved})}
  const next=(await all(E.HQRuleVersion)).reduce((n:number,v:any)=>Math.max(n,Number(v.version)||0),0)+1;
  const created=await E.HQRuleVersion.create({version:next,status:'draft',effective_from:effective,items,note,created_by:employee,created_by_email:email});
  await audit(E,user,{action:'ponttábla piszkozat létrehozása',target_kind:'hqruleversion',target_id:created.id,target_label:next+'. verzió',after:{items:items.length,effective_from:effective}});
  return Response.json({version:created});
 }
 if(action==='ruleVersionClose'){
  if(!admin&&!manager)fail('Ehhez vezetői jogosultság kell.',403);
  const v=await E.HQRuleVersion.get(clean(body.id)).catch(()=>null);if(!v)fail('Nincs ilyen ponttábla.',404);
  if(v.status==='closed')fail('Ez a ponttábla már lezárt.');
  const items=validRuleItems(Array.isArray(body.items)&&body.items.length?body.items:v.items);
  const conflicts=(await all(E.HQRuleVersion,{status:'closed',effective_from:v.effective_from})).filter((x:any)=>x.id!==v.id);
  if(conflicts.length)fail('Erre a napra már van lezárt ponttábla. Módosítsd az érvényesség kezdetét.',409);
  const closed=await E.HQRuleVersion.update(v.id,{status:'closed',items,closed_by:employee,closed_at:dayTime(),closed_from:v.status});
  await audit(E,user,{action:'ponttábla lezárása',target_kind:'hqruleversion',target_id:v.id,target_label:Number(v.version)+'. verzió',after:{items:items.length,effective_from:v.effective_from}});
  return Response.json({version:closed});
 }
 if(action==='ruleVersionReopen'){
  if(!admin&&!manager)fail('Ehhez vezetői jogosultság kell.',403);
  const reason=clean(body.reason);if(reason.length<5)fail('Az újranyitás indoklása kötelező (legalább 5 karakter).');
  const v=await E.HQRuleVersion.get(clean(body.id)).catch(()=>null);if(!v)fail('Nincs ilyen ponttábla.',404);
  if(v.status!=='closed')fail('Csak lezárt ponttábla nyitható fel szerkesztésre.');
  const next=(await all(E.HQRuleVersion)).reduce((n:number,x:any)=>Math.max(n,Number(x.version)||0),0)+1;
  const draft=await E.HQRuleVersion.create({version:next,status:'draft',effective_from:clean(body.effective_from)||v.effective_from,items:v.items||[],note:'Felnyitva a(z) '+Number(v.version)+'. lezárt verzióból. '+reason,created_by:employee,created_by_email:email,reopened_from:v.id,reopen_reason:reason});
  await audit(E,user,{action:'ponttábla felnyitása szerkesztésre',target_kind:'hqruleversion',target_id:v.id,target_label:Number(v.version)+'. verzió',reason,after:{draft:draft.id,draft_version:next}});
  return Response.json({version:draft,closed:{id:v.id,version:v.version}});
 }
 if(action==='ruleSeedDraft'){
  if(!admin&&!manager)fail('Ehhez vezetői jogosultság kell.',403);
  const legacy=(await all(E.HQRule)).sort((a:any,b:any)=>String(a.effective_from).localeCompare(String(b.effective_from))),seen=new Set<string>(),items:any[]=[];
  for(const r of legacy){const k=clean(r.action)+'|'+clean(r.bucket);if(seen.has(k))continue;seen.add(k);items.push({action:r.action,bucket:r.bucket||'',points:Number(r.points)||0,min:null,max:null,unit:'t',note:'Korábbi szabályból átvéve · érvényes '+r.effective_from})}
  if(!items.length)fail('Nincs átvehető korábbi pontszabály. Készítsd el kézzel az induló szabálykészletet.');
  const next=(await all(E.HQRuleVersion)).reduce((n:number,v:any)=>Math.max(n,Number(v.version)||0),0)+1;
  const draft=await E.HQRuleVersion.create({version:next,status:'draft',effective_from:clean(body.effective_from)||today(),items,note:'Induló szabálykészlet a korábbi pontszabályokból. Ellenőrizd a sávokat, majd zárd le.',created_by:employee,created_by_email:email});
  await audit(E,user,{action:'ponttábla induló piszkozat',target_kind:'hqruleversion',target_id:draft.id,target_label:next+'. verzió',after:{items:items.length}});
  return Response.json({version:draft});
 }
 if(action==='rulePreview'){
  const day=clean(body.day)||today();if(!validDate(day))fail('Érvénytelen dátum.');
  const wanted=clean(body.activity),versions=await closedRuleVersions(E,day),bands:any[]=[];
  for(const b of buckets){const m=pickRule(versions,wanted,b);bands.push({bucket:b,points:m?Number(m.rule.points):null,min:m?m.rule.min:null,max:m?m.rule.max:null,label:m?Number(m.version.version)+'. verzió · érvényes '+m.version.effective_from+' óta':'Nincs pontszabály'})}
  const general=pickRule(versions,wanted,''),match=pickRule(versions,wanted,clean(body.bucket));
  return Response.json({day,action:wanted,bucket:clean(body.bucket),points:match?Number(match.rule.points):null,label:match?Number(match.version.version)+'. verzió · érvényes '+match.version.effective_from+' óta':'Nincs pontszabály erre a napra.',general:general?{points:Number(general.rule.points),version:general.version.version,effective_from:general.version.effective_from}:null,bands,closed:versions.length,today:today()});
 }
 if(action==='auditList'){
  const query:any={};
  if(clean(body.target_kind))query.target_kind=clean(body.target_kind);
  if(clean(body.target_id))query.target_id=clean(body.target_id);
  if(manager){if(clean(body.actor_email))query.actor_email=key(body.actor_email)}else{query.actor_email=email}
  const limit=Math.min(Math.max(Number(body.limit)||100,1),300);
  const entries=(await all(E.HQAudit,query)).sort((a:any,b:any)=>String(b.at).localeCompare(String(a.at))).slice(0,limit);
  return Response.json({entries:entries.map((e:any)=>({id:e.id,at:e.at,actor:e.actor,actor_email:e.actor_email,action:e.action,target_kind:e.target_kind,target_id:e.target_id,target_label:e.target_label,before:e.before||{},after:e.after||{},reason:e.reason||'',revision:e.revision||''}))});
 }
 if(action==='companyHistory'){
  const id=clean(body.company_id),company=await E.HQCompany.get(id).catch(()=>null);if(!company)fail('Ismeretlen cég.',404);
  const entries=(await all(E.HQAudit,{target_id:id})).sort((a:any,b:any)=>String(b.at).localeCompare(String(a.at))).slice(0,60);
  return Response.json({company:{id:company.id,name:company.name,active:company.active!==false,inactive_reason:clean(company.inactive_reason),inactive_at:clean(company.inactive_at),last_inactive_reason:clean(company.last_inactive_reason),last_inactive_at:clean(company.last_inactive_at),snooze_until:clean(company.snooze_until),muted:company.muted===true},entries:entries.map((e:any)=>({id:e.id,at:e.at,actor:e.actor,action:e.action,target_kind:e.target_kind,target_label:e.target_label,before:e.before||{},after:e.after||{},reason:e.reason||''}))});
 }
 if(action==='companySignal'){
  const company=await E.HQCompany.get(clean(body.company_id)).catch(()=>null);if(!company)fail('Ismeretlen cég.',404);
  if(!admin&&!manager&&!(company.owners||[]).some((o:any)=>personKey(o)===personKey(employee)))fail('Ez a cég nincs hozzád rendelve.',403);
  const kind=clean(body.kind),reason=clean(body.reason).slice(0,400);
  if(kind==='snooze'){
   const until=clean(body.until);if(!validDate(until)||until<=today())fail('Add meg, meddig ne jelenjen meg a javaslatban (jövőbeli nap).');
   const updated=await E.HQCompany.update(company.id,{snooze_until:until});
   await audit(E,user,{action:'javaslat halasztása',target_kind:'hqcompany',target_id:company.id,target_label:company.name,reason,after:{snooze_until:until}});
   return Response.json({company:updated});
  }
  if(kind==='mute'||kind==='unmute'){
   const muted=kind==='mute',updated=await E.HQCompany.update(company.id,{muted,muted_reason:muted?(reason||'nem releváns megkeresés'):''});
   await audit(E,user,{action:muted?'cég kivétele a javaslatokból':'cég visszavétele a javaslatokba',target_kind:'hqcompany',target_id:company.id,target_label:company.name,reason});
   return Response.json({company:updated});
  }
  fail('Ismeretlen művelet.');
 }
 if(action==='trafficStage'){
  requireAdmin();
  const revision=clean(body.revision);if(!/^[A-Za-z0-9-]{8,80}$/.test(revision))fail('Hiányzó csomagazonosító.');
  const rows=Array.isArray(body.rows)?body.rows:[];if(!rows.length||rows.length>400)fail('Egy részletben 1 és 400 közötti cégösszesítés küldhető.');
  const meta=body.meta||{},found=(await all(E.HQTrafficPackage,{revision}))[0]||null;
  if(found&&found.status!=='staged')fail('Ez a forgalmi csomag már feldolgozott, nem módosítható.',409);
  const pkg=found||await E.HQTrafficPackage.create({revision,label:clean(meta.label).slice(0,200),status:'staged',scope:meta.scope==='partial'?'partial':'full',period_from:clean(meta.period_from),period_to:clean(meta.period_to),fingerprint:clean(meta.fingerprint).slice(0,120),file_name:clean(meta.file_name).slice(0,250),file_uri:clean(meta.file_uri),document_id:clean(meta.document_id),file_size:num0(meta.file_size),currency:clean(meta.currency).slice(0,8),currency_confirmed:false,uploaded_by:employee,uploaded_by_email:email,uploaded_at:dayTime(),issues:(Array.isArray(meta.issues)?meta.issues:[]).slice(0,20),note:clean(meta.note).slice(0,1000),zero_weight_rows:num0(meta.zero),negative_weight_rows:num0(meta.negative),processed_rows:num0(meta.processed),undated_rows:num0(meta.undated)});
  const cleanRows=rows.map((r:any)=>{const company=clean(r.company),company_key=personKey(company),kind=clean(r.kind)==='purchase'?'purchase':'sales';if(!company||company_key.length<2)fail('Hibás cégnév a forgalmi adatban.');const kg=Number(r.kg);if(!Number.isFinite(kg))fail('Hibás súly a forgalmi adatban.');const months=(Array.isArray(r.months)?r.months:[]).slice(0,60).map((m:any)=>{const mm=clean(m.m);if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mm))fail('Hibás hónap a forgalmi adatban: '+mm);const mkg=Number(m.kg);if(!Number.isFinite(mkg))fail('Hibás havi súly a forgalmi adatban.');return{m:mm,kg:Math.round(mkg*1000)/1000,net:Math.round((Number(m.net)||0)*100)/100,rows:num0(m.rows)}});if(!months.length&&kg)fail('A forgalmi adatból hiányzik a hónapbontás: '+company);return{package_revision:revision,kind,company,company_key,kg:Math.round(kg*1000)/1000,net:Math.round((Number(r.net)||0)*100)/100,rows:num0(r.rows),first_date:clean(r.first_date),last_date:clean(r.last_date),months,active:false,currency:clean(meta.currency).slice(0,8)}});
  const merged=new Map<string,any>();
  for(const r of cleanRows){const k=r.kind+'|'+r.company_key,cur:any=merged.get(k);if(!cur){merged.set(k,{...r,months:r.months.map((m:any)=>({...m}))});continue}cur.kg=Math.round((cur.kg+r.kg)*1000)/1000;cur.net=Math.round((cur.net+r.net)*100)/100;cur.rows+=r.rows;if(r.first_date&&(!cur.first_date||r.first_date<cur.first_date))cur.first_date=r.first_date;if(r.last_date&&(!cur.last_date||r.last_date>cur.last_date))cur.last_date=r.last_date;const mm=new Map(cur.months.map((m:any)=>[m.m,m]));for(const m of r.months){const e:any=mm.get(m.m);if(e){e.kg=Math.round((e.kg+m.kg)*1000)/1000;e.net=Math.round((e.net+m.net)*100)/100;e.rows+=m.rows}else mm.set(m.m,{...m})}cur.months=[...mm.values()].sort((a:any,b:any)=>a.m.localeCompare(b.m))}
  const mergedRows=[...merged.values()],existing=await all(E.HQTrafficAgg,{package_revision:revision}),byKey=new Map(existing.map((r:any)=>[clean(r.kind)+'|'+r.company_key,r])),create:any[]=[],update:any[]=[];
  for(const r of mergedRows){const k=r.kind+'|'+r.company_key,old:any=byKey.get(k);if(!old){create.push(r);byKey.set(k,r)}else if(num0(old.kg)!==r.kg||num0(old.net)!==r.net||num0(old.rows)!==r.rows||(old.months||[]).length!==r.months.length)update.push({id:old.id,...r})}
  if(create.length)await E.HQTrafficAgg.bulkCreate(create);
  for(let i=0;i<update.length;i+=200)await E.HQTrafficAgg.bulkUpdate(update.slice(i,i+200));
  return Response.json({ok:true,revision,stored:mergedRows.length,created:create.length,updated:update.length,package_id:pkg.id});
 }
 if(action==='trafficPreview'){
  requireAdmin();
  const revision=clean(body.revision),pkg=(await all(E.HQTrafficPackage,{revision}))[0];if(!pkg)fail('Nincs ilyen feltöltés.',404);
  const aggs=await all(E.HQTrafficAgg,{package_revision:revision}),sales=aggs.filter((r:any)=>r.kind==='sales'),purchase=aggs.filter((r:any)=>r.kind==='purchase');
  if(!sales.length&&!purchase.length)fail('A csomagban nincs feldolgozott forgalmi adat.',409);
  const sum=(list:any[])=>({companies:list.length,kg:Math.round(list.reduce((n:number,r:any)=>n+num0(r.kg),0)*1000)/1000,rows:list.reduce((n:number,r:any)=>n+num0(r.rows),0),net:Math.round(list.reduce((n:number,r:any)=>n+num0(r.net),0)*100)/100});
  const allRows=sales.concat(purchase),dates=allRows.flatMap((r:any)=>[clean(r.first_date),clean(r.last_date)]).filter((d:string)=>validDate(d)).sort();
  const period_from=dates[0]||'',period_to=dates[dates.length-1]||'',monthly=monthRows(sales),complete=completeMonths(period_to),movers=moversFrom(sales,complete);
  const companies=await all(E.HQCompany),byKey=new Map(companies.map((c:any)=>[personKey(c.name),c]));
  const newCompanies:any[]=[],mismatch:any[]=[];
  for(const r of allRows){const c:any=byKey.get(r.company_key);if(!c){if(newCompanies.length<40)newCompanies.push({company:r.company,kg:num0(r.kg),kind:r.kind,active:false})}else if(clean(c.name)!==clean(r.company)&&mismatch.length<40)mismatch.push({staged:r.company,master:c.name,active:c.active!==false})}
  const previous=(await all(E.HQTrafficPackage)).filter((p:any)=>p.status==='active'&&p.revision!==revision)[0]||null;
  let diff:any=null;
  if(previous){const oldAggs=await all(E.HQTrafficAgg,{package_revision:previous.revision}),oldMap=new Map(oldAggs.map((r:any)=>[clean(r.kind)+'|'+r.company_key,r]));let changed=0,deltaKg=0;
   for(const r of aggs){const o:any=oldMap.get(r.kind+'|'+r.company_key);if(!o)continue;changed++;deltaKg+=num0(r.kg)-num0(o.kg);oldMap.delete(r.kind+'|'+r.company_key)}
   diff={previous:{revision:previous.revision,label:previous.label||previous.file_name,period_from:previous.period_from,period_to:previous.period_to},changed,added:aggs.length-changed,removed:oldMap.size,deltaKg:Math.round(deltaKg*1000)/1000}}
  const duplicate=(await all(E.HQTrafficPackage)).filter((p:any)=>p.revision!==revision&&p.fingerprint&&p.fingerprint===pkg.fingerprint).map((p:any)=>({revision:p.revision,status:p.status,label:p.label||p.file_name,uploaded_at:p.uploaded_at}));
  const salesSum=sum(sales),purchaseSum=sum(purchase);
  const updated=await E.HQTrafficPackage.update(pkg.id,{period_from:period_from||pkg.period_from,period_to:period_to||pkg.period_to,kg_sales:salesSum.kg,kg_purchase:purchaseSum.kg,rows_sales:salesSum.rows,rows_purchase:purchaseSum.rows,companies_sales:salesSum.companies,companies_purchase:purchaseSum.companies,net_sales:salesSum.net,new_companies:newCompanies.length,mismatch_names:mismatch.length,changed_companies:diff?diff.changed:0,removed_companies:diff?diff.removed:0,delta_kg:diff?diff.deltaKg:0,months:monthly,movers});
  return Response.json({preview:{revision,label:updated.label||updated.file_name,fileName:updated.file_name,fileSize:num0(updated.file_size),scope:updated.scope,fingerprint:updated.fingerprint,period_from:updated.period_from,period_to:updated.period_to,sales:salesSum,purchase:purchaseSum,zero:num0(updated.zero_weight_rows),negative:num0(updated.negative_weight_rows),processed:num0(updated.processed_rows),undated:num0(updated.undated_rows),currency:updated.currency||'',currency_confirmed:!!updated.currency_confirmed,monthly,movers,newCompanies,mismatch,diff,duplicate,issues:updated.issues||[],status:updated.status}});
 }
 if(action==='trafficApprove'){
  requireAdmin();
  const revision=clean(body.revision),pkg=(await all(E.HQTrafficPackage,{revision}))[0];if(!pkg)fail('Nincs ilyen feltöltés.',404);
  if(pkg.status==='active')fail('Ez a csomag már az aktív adatkészlet.');
  if(pkg.status==='withdrawn')fail('Ez a csomag vissza van vonva.');
  const rows=await all(E.HQTrafficAgg,{package_revision:revision});if(!rows.length)fail('A csomag nem tartalmaz forgalmi adatot.',409);
  const currency=clean(body.currency).slice(0,8),confirmed=body.currency_confirmed===true;
  const others=(await all(E.HQTrafficPackage)).filter((p:any)=>p.status==='active'&&p.revision!==revision);
  for(const p of others){
   await E.HQTrafficPackage.update(p.id,{status:'superseded',superseded_at:dayTime()});
   const oldRows=await all(E.HQTrafficAgg,{package_revision:p.revision,active:true});
   for(let i=0;i<oldRows.length;i+=300)await E.HQTrafficAgg.bulkUpdate(oldRows.slice(i,i+300).map((r:any)=>({id:r.id,active:false})));
  }
  for(let i=0;i<rows.length;i+=300)await E.HQTrafficAgg.bulkUpdate(rows.slice(i,i+300).map((r:any)=>({id:r.id,active:true})));
  const updated=await E.HQTrafficPackage.update(pkg.id,{status:'active',approved_by:employee,approved_at:dayTime(),currency,currency_confirmed:confirmed,note:clean(body.note).slice(0,1000),superseded_at:''});
  await audit(E,user,{action:'VECTORY forgalmi csomag jóváhagyása',target_kind:'hqtrafficpackage',target_id:pkg.id,target_label:pkg.label||pkg.file_name,reason:clean(body.note),before:{status:pkg.status},after:{status:'active',currency,currency_confirmed:confirmed,rows:rows.length,superseded:others.map((p:any)=>p.revision)}});
  return Response.json({package:updated,superseded:others.length,rows:rows.length});
 }
 if(action==='trafficRestore'){
  requireAdmin();
  const pkg=await E.HQTrafficPackage.get(clean(body.id)).catch(()=>null);if(!pkg)fail('Nincs ilyen csomag.',404);
  if(pkg.status==='active')fail('Ez a csomag már aktív.');
  if(pkg.status==='withdrawn')fail('A visszavont csomag nem állítható vissza. Töltsd fel újra a fájlt.');
  const rows=await all(E.HQTrafficAgg,{package_revision:pkg.revision});if(!rows.length)fail('A csomaghoz nem tartozik forgalmi adat.',409);
  const others=(await all(E.HQTrafficPackage)).filter((p:any)=>p.status==='active'&&p.revision!==pkg.revision);
  for(const p of others){await E.HQTrafficPackage.update(p.id,{status:'superseded',superseded_at:dayTime()});const oldRows=await all(E.HQTrafficAgg,{package_revision:p.revision,active:true});for(let i=0;i<oldRows.length;i+=300)await E.HQTrafficAgg.bulkUpdate(oldRows.slice(i,i+300).map((r:any)=>({id:r.id,active:false})))}
  for(let i=0;i<rows.length;i+=300)await E.HQTrafficAgg.bulkUpdate(rows.slice(i,i+300).map((r:any)=>({id:r.id,active:true})));
  const restored=await E.HQTrafficPackage.update(pkg.id,{status:'active',approved_by:employee,approved_at:dayTime(),superseded_at:'',currency_confirmed:pkg.currency_confirmed===true});
  await audit(E,user,{action:'forgalmi csomag visszaállítása',target_kind:'hqtrafficpackage',target_id:pkg.id,target_label:pkg.label||pkg.file_name,reason:clean(body.reason),before:{status:pkg.status},after:{status:'active'}});
  return Response.json({package:restored,superseded:others.length});
 }
 if(action==='trafficDiscard'){
  requireAdmin();
  const revision=clean(body.revision),pkg=(await all(E.HQTrafficPackage,{revision}))[0];if(!pkg)fail('Nincs ilyen feltöltés.',404);
  if(pkg.status==='active')fail('Az aktív adatkészlet nem vonható vissza. Tölts fel új csomagot, vagy állíts vissza egy korábbit.');
  await E.HQTrafficAgg.deleteMany({package_revision:revision});
  const dropped=await E.HQTrafficPackage.update(pkg.id,{status:'withdrawn',note:clean(body.reason).slice(0,1000)});
  await audit(E,user,{action:'VECTORY csomag visszavonása',target_kind:'hqtrafficpackage',target_id:pkg.id,target_label:pkg.label||pkg.file_name,reason:clean(body.reason),before:{status:pkg.status},after:{status:'withdrawn'}});
  return Response.json({package:dropped});
 }
 if(action==='trafficPackages'){
  requireAdmin();
  const packages=(await all(E.HQTrafficPackage)).sort((a:any,b:any)=>String(b.created_date).localeCompare(String(a.created_date))).slice(0,40);
  const active=packages.find((p:any)=>p.status==='active')||null;
  return Response.json({active:active?{revision:active.revision,label:active.label||active.file_name,period_from:active.period_from,period_to:active.period_to,approved_at:active.approved_at||'',currency:active.currency||'',currency_confirmed:!!active.currency_confirmed}:null,packages:packages.map((p:any)=>({id:p.id,revision:p.revision,label:p.label||p.file_name,filename:p.file_name,status:p.status,scope:p.scope,period_from:p.period_from,period_to:p.period_to,rows_sales:num0(p.rows_sales),rows_purchase:num0(p.rows_purchase),kg_sales:num0(p.kg_sales),kg_purchase:num0(p.kg_purchase),companies_sales:num0(p.companies_sales),companies_purchase:num0(p.companies_purchase),new_companies:num0(p.new_companies),mismatch_names:num0(p.mismatch_names),changed_companies:num0(p.changed_companies),removed_companies:num0(p.removed_companies),delta_kg:num0(p.delta_kg),currency:p.currency||'',currency_confirmed:!!p.currency_confirmed,uploaded_by:p.uploaded_by||'',uploaded_at:p.uploaded_at||'',approved_by:p.approved_by||'',approved_at:p.approved_at||'',superseded_at:p.superseded_at||'',note:p.note||'',issues:(p.issues||[]).slice(0,10)}))});
 }
 if(action==='trafficStats'){
  const pkg=await activePackage(E);
  if(!pkg)return Response.json({package:null,monthly:[],movers:{up:[],down:[],compared:0},totals:null,coverage:{period_to:'',period_from:'',scope:'',currency:'',currency_confirmed:false}});
  return Response.json({package:{revision:pkg.revision,label:pkg.label||pkg.file_name,period_from:pkg.period_from,period_to:pkg.period_to,scope:pkg.scope,approved_at:pkg.approved_at||'',approved_by:pkg.approved_by||'',currency:pkg.currency||'',currency_confirmed:!!pkg.currency_confirmed,zero_weight_rows:num0(pkg.zero_weight_rows),negative_weight_rows:num0(pkg.negative_weight_rows),processed_rows:num0(pkg.processed_rows),undated_rows:num0(pkg.undated_rows)},totals:{kg_sales:num0(pkg.kg_sales),kg_purchase:num0(pkg.kg_purchase),rows_sales:num0(pkg.rows_sales),rows_purchase:num0(pkg.rows_purchase),companies_sales:num0(pkg.companies_sales),companies_purchase:num0(pkg.companies_purchase),net_sales:num0(pkg.net_sales)},monthly:pkg.months||[],movers:pkg.movers||{up:[],down:[],compared:0},coverage:{period_to:pkg.period_to||'',period_from:pkg.period_from||'',scope:pkg.scope||'',currency:pkg.currency||'',currency_confirmed:!!pkg.currency_confirmed}});
 }
 if(action==='trafficCompany'){
  const company=await E.HQCompany.get(clean(body.company_id)).catch(()=>null);if(!company)fail('Ismeretlen cég.',404);
  const pkg=await activePackage(E);if(!pkg)return Response.json({traffic:null,package:null});
  const aggs=await all(E.HQTrafficAgg,{package_revision:pkg.revision,company_key:personKey(company.name)});
  return Response.json({package:{revision:pkg.revision,label:pkg.label||pkg.file_name,period_to:pkg.period_to,currency:pkg.currency||'',currency_confirmed:!!pkg.currency_confirmed},traffic:aggs.map((r:any)=>({kind:r.kind,kg:num0(r.kg),net:num0(r.net),rows:num0(r.rows),first_date:r.first_date||'',last_date:r.last_date||'',months:r.months||[]}))});
 }
 if(action==='dashboard'){
  const person=resolveEmployee(),day0=today(),scopeAll=admin||manager,cut=plusDays(day0,-30);
  const [companies,activityRows,taskRows,dayRows,pkgRows]=await Promise.all([all(E.HQCompany),all(E.HQActivity,scopeAll?{archived:false}:{employee,archived:false}),all(E.HQTask,{employee:person,archived:false}),all(E.HQDay,{status:'closed'}),E.HQTrafficPackage.filter({status:'active'},'-approved_at',1)]);
  const recent=activityRows.filter((r:any)=>String(r.date)>=cut);
  const closedSet=new Set(dayRows.filter((d:any)=>String(d.date)>=cut).map((d:any)=>d.employee+'|'+d.date));
  const pts=(r:any)=>r.points===null||r.points===undefined?0:num0(r.points);
  const points=recent.reduce((n:number,r:any)=>n+pts(r),0),closedPoints=recent.filter((r:any)=>closedSet.has(r.employee+'|'+r.date)).reduce((n:number,r:any)=>n+pts(r),0);
  const open=taskRows.filter((t:any)=>t.status!=='done'&&!t.archived&&!t.suspended),overdue=open.filter((t:any)=>String(t.due_date)<day0),todayTasks=open.filter((t:any)=>String(t.due_date)===day0),week=open.filter((t:any)=>String(t.due_date)>day0&&String(t.due_date)<=plusDays(day0,7));
  const owned=(c:any)=>scopeAll||(c.owners||[]).some((o:any)=>personKey(o)===personKey(employee));
  const pkg=pkgRows[0]||null;
  return Response.json({today:day0,days:30,employee:person,scope:scopeAll?'mind':'saját',activity:{rows:recent.length,points:Math.round(points*100)/100,closedPoints:Math.round(closedPoints*100)/100,pending:recent.filter((r:any)=>r.points===null||r.points===undefined).length,overdue:overdue.length,today:todayTasks.length,week:week.length,open:open.length,overdueItems:overdue.slice(0,8).map((t:any)=>({id:t.id,company:t.company,company_id:t.company_id,due_date:t.due_date,note:t.note,task_type:t.task_type||'megkereses'})),todayItems:todayTasks.slice(0,8).map((t:any)=>({id:t.id,company:t.company,company_id:t.company_id,due_date:t.due_date,note:t.note,task_type:t.task_type||'megkereses'}))},portfolio:{companies:companies.filter((c:any)=>c.active&&owned(c)).length,inactive:companies.filter((c:any)=>!c.active&&owned(c)).length,suspendedTasks:taskRows.filter((t:any)=>t.suspended&&t.status!=='done').length,obligations:open.filter((t:any)=>!SUSPENDABLE.has(clean(t.task_type)||'megkereses')).length,noOwner:companies.filter((c:any)=>c.active&&!(c.owners||[]).length).length},traffic:pkg?{revision:pkg.revision,label:pkg.label||pkg.file_name,period_from:pkg.period_from,period_to:pkg.period_to,approved_at:pkg.approved_at||'',scope:pkg.scope,currency:pkg.currency||'',currency_confirmed:!!pkg.currency_confirmed,kg_sales:num0(pkg.kg_sales),kg_purchase:num0(pkg.kg_purchase),rows_sales:num0(pkg.rows_sales),rows_purchase:num0(pkg.rows_purchase),companies_sales:num0(pkg.companies_sales),months:pkg.months||[],movers:pkg.movers||{up:[],down:[],compared:0},zero_weight_rows:num0(pkg.zero_weight_rows),negative_weight_rows:num0(pkg.negative_weight_rows),undated_rows:num0(pkg.undated_rows)}:null});
 }
 if(action==='countyStats'){
  const person=resolveEmployee(),day0=today(),num=(v:any)=>Number.isFinite(Number(v))?Number(v):0,scopeAll=admin||manager,from='';
  const months:any[]=[];{const d=new Date(Date.UTC(Number(day0.slice(0,4)),Number(day0.slice(5,7))-1,1));d.setUTCMonth(d.getUTCMonth()-11);for(let i=0;i<12;i++){months.push(new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit'}).format(d).slice(0,7));d.setUTCMonth(d.getUTCMonth()+1)}}
  const start=months[0]+'-01';
  const companies=(await all(E.HQCompany)).filter((c:any)=>c.active&&(scopeAll||(c.owners||[]).some((o:any)=>personKey(o)===personKey(employee))));
  const rows=(await all(E.HQActivity,{archived:false})).filter((r:any)=>scopeAll||r.employee===employee);
  const tasks=(await all(E.HQTask,{archived:false})).filter((t:any)=>scopeAll||t.employee===person);
  const idCounty=new Map<string,string>(),nameCounty=new Map<string,string>();
  for(const c of companies){idCounty.set(c.id,clean(c.county));nameCounty.set(key(c.name),clean(c.county))}
  const countyOfRow=(r:any)=>idCounty.has(r.company_id)?idCounty.get(r.company_id):(nameCounty.get(key(r.company))||'');
  const stat=new Map<string,any>();
  const bucket=(n:string)=>{const k=clean(n);if(!stat.has(k))stat.set(k,{county:k,companies:0,order_t:0,quote_t:0,bend_t:0,points:0,activities:0,orders:0,offers:0,last:'',openTasks:0,overdue:0,neglected:0,owners:{},trend:months.map((m:string)=>({m,order_t:0,quote_t:0,points:0,activities:0}))});return stat.get(k)};
  for(const c of companies){const s=bucket(clean(c.county));s.companies++;for(const o of (c.owners||[])){const n=clean(o);if(n)s.owners[n]=(s.owners[n]||0)+1}}
  const perCompany=new Map<string,any>();
  for(const r of rows){const k=r.company_id||('n:'+key(r.company));let e=perCompany.get(k);if(!e){e={last:'',order_t:0,quote_t:0,points:0,activities:0,lastOffer:'',lastOrder:''};perCompany.set(k,e)}
   const d=String(r.date);e.activities++;if(d>e.last)e.last=d;if(d>=start){e.order_t+=num(r.order_t);e.quote_t+=num(r.quote_t);e.points+=num(r.points)}if(r.action==='Ajánlat'&&d>e.lastOffer)e.lastOffer=d;if(num(r.order_t)>0&&d>e.lastOrder)e.lastOrder=d;
   const s=bucket(countyOfRow(r)),t=s.trend.find((x:any)=>x.m===d.slice(0,7));s.activities++;if(d>s.last)s.last=d;if(d>=start&&t){const tons=num(r.order_t);t.order_t+=tons;t.quote_t+=num(r.quote_t);t.points+=num(r.points);t.activities++;s.order_t+=tons;s.quote_t+=num(r.quote_t);s.bend_t+=num(r.bend_t);s.points+=num(r.points);if(tons>0)s.orders++;if(r.action==='Ajánlat')s.offers++}}
  const legacy=await legacyState(E).catch(()=>null);
  if(legacy){const nameId=new Map<string,string>(),legacyCo=new Map<string,any>();
   for(const c of companies)nameId.set(key(c.name),c.id);
   for(const p of legacy.state.parts){if(p.kind!=='daily')continue;for(const r of p.rows||[]){const d=String(r.date||'').slice(0,10),k=key(r.company);if(!validDate(d)||!k)continue;let e=legacyCo.get(k);if(!e){e={last:'',order_t:0,quote_t:0,bend_t:0,points:0,activities:0,lastOffer:'',lastOrder:'',months:new Map()};legacyCo.set(k,e)}
    e.activities++;if(d>e.last)e.last=d;
    if(d>=start){const tons=num(r.orderT);e.order_t+=tons;e.quote_t+=num(r.quoteT);e.bend_t+=num(r.bendT);e.points+=num(r.points);const mm=d.slice(0,7),t=e.months.get(mm)||{order_t:0,quote_t:0,points:0,activities:0};t.order_t+=tons;t.quote_t+=num(r.quoteT);t.points+=num(r.points);t.activities++;e.months.set(mm,t)}
    if(r.action==='Ajánlat'&&d>e.lastOffer)e.lastOffer=d;if(num(r.orderT)>0&&d>e.lastOrder)e.lastOrder=d}}
   for(const [ck,e] of legacyCo){const county=nameCounty.get(ck);if(!county)continue;
    const s=bucket(county);s.activities+=e.activities;s.order_t+=e.order_t;s.quote_t+=e.quote_t;s.bend_t+=e.bend_t;s.points+=e.points;if(e.last>s.last)s.last=e.last;
    for(const [mm,t] of e.months){const target=s.trend.find((x:any)=>x.m===mm);if(target){target.order_t+=t.order_t;target.quote_t+=t.quote_t;target.points+=t.points;target.activities+=t.activities}}
    const kk=nameId.get(ck);if(!kk)continue;let pe=perCompany.get(kk);if(!pe){pe={last:'',order_t:0,quote_t:0,points:0,activities:0,lastOffer:'',lastOrder:''};perCompany.set(kk,pe)}
    pe.activities+=e.activities;pe.order_t+=e.order_t;pe.quote_t+=e.quote_t;pe.points+=e.points;if(e.last>pe.last)pe.last=e.last;if(e.lastOffer>pe.lastOffer)pe.lastOffer=e.lastOffer;if(e.lastOrder>pe.lastOrder)pe.lastOrder=e.lastOrder}
  }
  const gap=(d:any)=>d?Math.round((Date.parse(day0)-Date.parse(String(d)))/86400000):null;
  const companyRows=companies.map((c:any)=>{const e=perCompany.get(c.id)||{last:'',order_t:0,quote_t:0,points:0,activities:0,lastOffer:'',lastOrder:''},mine=tasks.filter((x:any)=>x.company_id===c.id&&x.status!=='done'),over=mine.filter((x:any)=>String(x.due_date)<day0).length,s=bucket(clean(c.county)),days=gap(e.last);
   if(!e.last||days>=60)s.neglected++;s.openTasks+=mine.length;s.overdue+=over;
   return {id:c.id,name:c.name,county:clean(c.county),city:clean(c.city),owner:(c.owners||[])[0]||'',last:e.last,daysSince:days,order_t:e.order_t,quote_t:e.quote_t,points:e.points,activities:e.activities,openTasks:mine.length,overdue:over,offerOpen:!!e.lastOffer&&(!e.lastOrder||e.lastOffer>e.lastOrder)}});
  const counties=[...stat.values()].filter((s:any)=>s.county!==''),totals:any={companies:companies.length,order_t:0,points:0,activities:0,neglected:0,orders:0};
  for(const s of counties){totals.order_t+=s.order_t;totals.points+=s.points;totals.activities+=s.activities;totals.neglected+=s.neglected;totals.orders+=s.orders}
  const monthly=months.map((m:string,i:number)=>{const o:any={m,order_t:0,quote_t:0,points:0,activities:0};for(const s of counties){const t=s.trend[i];o.order_t+=t.order_t;o.quote_t+=t.quote_t;o.points+=t.points;o.activities+=t.activities}return o});
  const attention:any[]=[];
  for(const s of counties){const reasons:string[]=[];let score=0;
   const last3=s.trend.slice(-3).reduce((n:number,t:any)=>n+t.order_t,0),prev3=s.trend.slice(-6,-3).reduce((n:number,t:any)=>n+t.order_t,0);
   if(s.neglected){reasons.push(s.neglected+' cég 60+ napja nem kapott kapcsolatot');score+=Math.min(8,s.neglected*2)}
   if(s.overdue){reasons.push(s.overdue+' lejárt teendő');score+=Math.min(6,s.overdue*2)}
   if(prev3>0&&last3<prev3*0.8){reasons.push('Az utolsó 3 hónap forgalma '+Math.round((last3/prev3-1)*100)+'% az előző 3 hónaphoz képest');score+=4}
   if(!s.order_t){reasons.push('Nincs rendelés az elmúlt 12 hónapban ('+s.companies+' cég)');score+=3}
   else if(s.activities<s.companies*0.5){reasons.push('Kevés aktivitás a cégekhez képest ('+s.activities+' aktivitás / '+s.companies+' cég)');score+=2}
   if(reasons.length)attention.push({county:s.county,level:score>=8?'magas':score>=4?'közepes':'alacsony',score,reasons,last3,prev3})}
  attention.sort((a:any,b:any)=>b.score-a.score);
  const coverage={total:companies.length,withCounty:companies.filter((c:any)=>clean(c.county)).length};
  const unassignedCompanies=companyRows.filter((c:any)=>!c.county).sort((a:any,b:any)=>b.order_t-a.order_t||b.activities-a.activities||a.name.localeCompare(b.name,'hu')).slice(0,60);
  return Response.json({today:day0,months,counties,companies:clean(body.county)?companyRows.filter((c:any)=>c.county===clean(body.county)):[],totals,monthly,attention,coverage,unassignedCompanies,unassigned:companies.filter((c:any)=>!clean(c.county)).length,foreign:(stat.get('Külföld')||{companies:0}).companies});
 }
 if(action==='companyInfo'){
  const person=resolveEmployee(),day0=today(),num=(v:any)=>Number.isFinite(Number(v))?Number(v):0,gap=(d:any)=>d?Math.round((Date.parse(day0)-Date.parse(String(d)))/86400000):null;
  const company=await E.HQCompany.get(clean(body.company_id)).catch(()=>null);if(!company)fail('Ismeretlen cég.',404);
  const rows=(await all(E.HQActivity,{company_id:company.id,employee:person,archived:false})).sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date)));
  const tasks=(await all(E.HQTask,{company_id:company.id,employee:person,archived:false})).sort((a:any,b:any)=>String(a.due_date).localeCompare(String(b.due_date)));
  const lastOrder=rows.find((r:any)=>num(r.order_t)>0)||null,lastOffer=rows.find((r:any)=>r.action==='Ajánlat')||null,sum=(k:string)=>rows.reduce((n:number,r:any)=>n+num(r[k]),0);
  const pkg=await activePackage(E);let traffic=null;
  if(pkg){const agg=(await all(E.HQTrafficAgg,{package_revision:pkg.revision,company_key:personKey(company.name)}))[0];if(agg)traffic={kg:num(agg.kg),net:num(agg.net),rows:num(agg.rows),first_date:agg.first_date||'',last_date:agg.last_date||'',months:agg.months||[],currency:pkg.currency||'',currency_confirmed:!!pkg.currency_confirmed,package_label:pkg.label||pkg.file_name||'',period_to:pkg.period_to||'',scope:pkg.scope||''}}
  const auditTrail=(await all(E.HQAudit,{target_id:company.id})).sort((a:any,b:any)=>String(b.at).localeCompare(String(a.at))).slice(0,10).map((e:any)=>({id:e.id,at:e.at,actor:e.actor,action:e.action,reason:e.reason||''}));
  return Response.json({company:{id:company.id,name:company.name,owners:company.owners||[],countries:company.countries||[],types:company.types||[]},count:rows.length,last:rows[0]?rows[0].date:'',daysSince:gap(rows[0]?rows[0].date:null),lastOrder:lastOrder?{date:lastOrder.date,order_t:num(lastOrder.order_t)}:null,lastOffer:lastOffer?{date:lastOffer.date,quote_t:num(lastOffer.quote_t),note:lastOffer.note||''}:null,offerOpen:!!lastOffer&&(!lastOrder||String(lastOffer.date)>String(lastOrder.date)),totals:{order_t:sum('order_t'),quote_t:sum('quote_t'),bend_t:sum('bend_t'),points:sum('points')},openTasks:tasks.filter((t:any)=>t.status!=='done'),recent:rows.slice(0,8).map((r:any)=>({id:r.id,date:r.date,action:r.action,bucket:r.bucket,order_t:r.order_t,quote_t:r.quote_t,points:r.points,note:r.note})),traffic,auditTrail});
 }
 if(action==='suggestions'){
  const person=resolveEmployee(),day0=today(),limit=Math.min(Math.max(Number(body.limit)||10,1),30),scopeAll=admin||manager;
  const [companies,rows,openRows,pkgRows]=await Promise.all([all(E.HQCompany),all(E.HQActivity,{employee:person,archived:false}),all(E.HQTask,{employee:person,archived:false}),E.HQTrafficPackage.filter({status:'active'},'-approved_at',1)]);
  const open=openRows.filter((t:any)=>t.status!=='done'&&!t.archived&&!t.suspended);
  const eligible=new Map<string,any>();
  for(const c of companies){if(c.active===false||c.muted===true)continue;if(String(c.snooze_until||'')>=day0)continue;if(!scopeAll&&!(c.owners||[]).some((o:any)=>personKey(o)===personKey(employee)))continue;eligible.set(c.id,c)}
  const pkg=pkgRows[0]||null,complete=pkg?completeMonths(pkg.period_to):new Set<string>(),aggOf=new Map<string,any>();
  if(pkg){for(const a of await all(E.HQTrafficAgg,{package_revision:pkg.revision,kind:'sales'}))aggOf.set(a.company_key,a)}
  const coverage=pkg?('VECTORY adat: '+(pkg.label||pkg.file_name)+', záródátum '+pkg.period_to+(pkg.scope==='partial'?' (részleges export)':'')):'Nincs jóváhagyott VECTORY forgalmi adat, ezért forgalmi összehasonlítás nem készül.';
  const contact=new Map<string,any>();
  for(const r of rows){const k=r.company_id;if(!k||!eligible.has(k))continue;let e:any=contact.get(k);if(!e){e={lastContact:'',lastOrder:'',lastOffer:'',offerId:'',orderId:''};contact.set(k,e)}if(String(r.date)>String(e.lastContact))e.lastContact=String(r.date);if(num0(r.order_t)>0&&String(r.date)>String(e.lastOrder)){e.lastOrder=String(r.date);e.orderId=r.id}if(r.action==='Ajánlat'&&String(r.date)>String(e.lastOffer)){e.lastOffer=String(r.date);e.offerId=r.id}}
  const out:any[]=[];
  const push=(c:any,reason:string,detail:string,priority:number,extra:any)=>{if(out.length<limit*4)out.push({company_id:c.id,company:c.name,owner:clean((c.owners||[])[0]),reason,detail,priority,...extra})};
  for(const t of open){const c=eligible.get(t.company_id);if(!c)continue;const late=String(t.due_date)<day0;
   push(c,(late?'Lejárt teendő':'Ma esedékes teendő')+' ('+t.due_date+')',clean(t.note),late?0:1,{due:t.due_date,task_id:t.id,task_type:t.task_type||'megkereses',source:'Teendő · '+(t.task_type||'megkereses'),source_id:t.id,lastContact:(contact.get(c.id)||{}).lastContact||'',traffic:null});
  }
  for(const c of eligible.values()){
   if(out.some((x:any)=>x.company_id===c.id))continue;
   const e=contact.get(c.id)||{lastContact:'',lastOrder:'',lastOffer:'',offerId:'',orderId:''};
   const agg=aggOf.get(personKey(c.name))||null;
   let traffic:any=null,trafficReason='',trafficDetail='';
   if(agg){const months=(agg.months||[]).filter((m:any)=>complete.has(m.m));
    if(months.length){const last=months[months.length-1],prev=months.slice(-4,-1),avg=prev.length?prev.reduce((n:number,m:any)=>n+num0(m.kg),0)/prev.length:0;
     traffic={month:last.m,kg:Math.round(num0(last.kg)*1000)/1000,base:Math.round(avg*1000)/1000,pct:avg?Math.round((num0(last.kg)/avg-1)*100):null,last_date:agg.last_date||'',rows:num0(agg.rows),period_to:pkg.period_to};
     if(avg>0&&num0(last.kg)<avg*0.6){trafficReason='Forgalom-visszaesés ('+last.m+')';trafficDetail='VECTORY értékesítés: '+traffic.kg+' t, az előző hónapok átlaga '+traffic.base+' t'+(traffic.pct===null?'':' ('+traffic.pct+'%)')+'. '+coverage}
     else if(avg>0&&num0(last.kg)>avg*1.4){trafficReason='Növekvő vevő ('+last.m+')';trafficDetail='VECTORY értékesítés: '+traffic.kg+' t, az előző hónapok átlaga '+traffic.base+' t. '+coverage}
    }}
   if(e.lastOffer&&(!e.lastOrder||e.lastOffer>e.lastOrder)){const since=Math.round((Date.parse(day0)-Date.parse(e.lastOffer))/86400000);
    push(c,'Nyitott ajánlat, nincs rendelés','Ajánlat: '+e.lastOffer+' · '+since+' napja. '+(e.lastOrder?'Utolsó rendelés: '+e.lastOrder:'A naplóban nincs rendelés.'),2,{due:'',source:'Napi napló · ajánlat',source_id:e.offerId,offer_date:e.lastOffer,lastContact:e.lastContact,traffic});continue}
   if(trafficReason){push(c,trafficReason,trafficDetail,3,{due:'',source:'VECTORY forgalom · '+(pkg?pkg.period_to:''),source_id:pkg?pkg.revision:'',lastContact:e.lastContact,traffic});continue}
   if(!e.lastContact){push(c,'Nincs kapcsolat rögzítve','Ehhez a céghez nincs naplózott megkeresés.'+(traffic?' VECTORY forgalom: '+traffic.kg+' t ('+traffic.month+').':'')+' '+coverage,4,{due:'',source:'Cégtörzs',source_id:c.id,lastContact:'',traffic});continue}
   const since=Math.round((Date.parse(day0)-Date.parse(e.lastContact))/86400000);
   if(since>=21)push(c,'Régen nem keresett partner','Nincs kapcsolat '+since+' napja. Utolsó napló: '+e.lastContact+(e.lastOrder?' · utolsó rendelés: '+e.lastOrder:'')+(traffic?' · VECTORY: '+traffic.kg+' t ('+traffic.month+')':''),5,{due:'',source:'Napi napló',source_id:'',lastContact:e.lastContact,traffic});
  }
  const items=out.sort((a:any,b:any)=>a.priority-b.priority||String(a.due||'9999-12-31').localeCompare(String(b.due||'9999-12-31'))||num0(b.traffic?b.traffic.kg:0)-num0(a.traffic?a.traffic.kg:0)).slice(0,limit);
  return Response.json({items,total:out.length,limit,scanned:eligible.size,open:open.length,coverage:{period_to:pkg?pkg.period_to:'',period_from:pkg?pkg.period_from:'',scope:pkg?pkg.scope:'',label:pkg?(pkg.label||pkg.file_name):'',approved_at:pkg?pkg.approved_at:''},note:coverage});
 }
 if(action==='plan'){
  const person=resolveEmployee();let month=clean(body.month);if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))month=today().slice(0,7);
  const day0=today(),rows=(await all(E.HQActivity,{employee:person,archived:false})).filter((r:any)=>String(r.date).slice(0,7)===month),tasks=await all(E.HQTask,{employee:person,archived:false}),days:any={};
  const cell=(k:string)=>{if(!days[k])days[k]={date:k,tasks:[],activities:[],points:0,order_t:0,quote_t:0};return days[k]};
  for(const r of rows){const c=cell(String(r.date)),tons=Number(r.order_t)||0;c.points+=Number(r.points)||0;c.order_t+=tons;c.quote_t+=Number(r.quote_t)||0;c.activities.push({id:r.id,company:r.company,company_id:r.company_id,action:r.action,bucket:r.bucket,order_t:r.order_t,quote_t:r.quote_t,points:r.points,note:r.note})}
  for(const t of tasks){cell(String(t.due_date)).tasks.push({id:t.id,company:t.company,company_id:t.company_id,note:t.note,status:t.status,outcome:t.outcome,due_date:t.due_date,reminder_count:t.reminder_count||0})}
  return Response.json({month,today:day0,days:Object.values(days).sort((a:any,b:any)=>a.date.localeCompare(b.date)),open:tasks.filter((t:any)=>t.status!=='done').sort((a:any,b:any)=>String(a.due_date).localeCompare(String(b.due_date)))});
 }
 if(action==='myResults'){
  const person=resolveEmployee(),from=clean(body.from),to=clean(body.to);
  if((from&&!validDate(from))||(to&&!validDate(to)))fail('Érvénytelen időszak.');
  const rows=(await all(E.HQActivity,{employee:person,archived:false})).filter((r:any)=>(!from||r.date>=from)&&(!to||r.date<=to));
  const num=(v:any)=>Number.isFinite(v)?Number(v):0,actions:any={},companies:any={},months:any={};
  const bump=(bag:any,k:string,extra:any,p:number,r:any)=>{if(!bag[k])bag[k]={...extra,count:0,points:0,order_t:0,quote_t:0,bend_t:0};const e=bag[k];e.count++;e.points+=p;e.order_t+=num(r.order_t);e.quote_t+=num(r.quote_t);e.bend_t+=num(r.bend_t)};
  let points=0,order_t=0,quote_t=0,bend_t=0,pending=0;
  for(const r of rows){const p=r.points==null?0:Number(r.points);if(r.points==null)pending++;points+=p;order_t+=num(r.order_t);quote_t+=num(r.quote_t);bend_t+=num(r.bend_t);
   bump(actions,clean(r.action)||'Nincs megadva',{action:clean(r.action)||'Nincs megadva'},p,r);
   bump(companies,clean(r.company)||'Nincs cég',{company:clean(r.company)||'Nincs cég'},p,r);
   bump(months,String(r.date).slice(0,7),{month:String(r.date).slice(0,7)},p,r)}
  const ranked=(bag:any)=>Object.values(bag).sort((a:any,b:any)=>b.points-a.points||b.count-a.count);
  return Response.json({employee:person,rows:rows.length,pending,totals:{points,order_t,quote_t,bend_t},byAction:ranked(actions),byCompany:ranked(companies).slice(0,12),byMonth:Object.values(months).sort((a:any,b:any)=>b.month.localeCompare(a.month))});
 }
 if(action==='teamCompare'){
 const scopeAll=admin||manager,from=clean(body.from),to=clean(body.to);
 if((from&&!validDate(from))||(to&&!validDate(to)))fail('Érvénytelen időszak.');
 if(from&&to&&from>to)fail('A kezdő dátum későbbi a záró dátumnál.');
 const day0=today(),wanted=clean(body.team);
 const [memberRows,rowsAll,taskRows,dayRows]=await Promise.all([all(E.HQMember),all(E.HQActivity,{archived:false}),all(E.HQTask,{archived:false}),all(E.HQDay)]);
 const memberTeam=new Map<string,string>();
 for(const m of memberRows)if(m.active!==false&&clean(m.employee))memberTeam.set(key(m.employee),clean(m.team));
 const teams=[...new Set(memberRows.filter((m:any)=>m.active!==false).map((m:any)=>clean(m.team)).filter(Boolean))].sort((a:string,b:string)=>a.localeCompare(b,'hu'));
 const map=new Map<string,any>();
 const bucket=(raw:any)=>{const k=key(raw);if(!map.has(k))map.set(k,{employee:clean(raw),team:memberTeam.get(k)||'',activities:0,points:0,pending:0,order_t:0,quote_t:0,bend_t:0,orders:0,offers:0,openTasks:0,overdue:0,closedDays:0,last:''});return map.get(k)};
 const rows=rowsAll.filter((r:any)=>(scopeAll||r.employee===employee)&&(from?String(r.date)>=from:true)&&(to?String(r.date)<=to:true));
 for(const r of rows){const e=bucket(r.employee);e.activities++;if(r.points===null||r.points===undefined)e.pending++;else e.points+=num0(r.points);e.order_t+=num0(r.order_t);e.quote_t+=num0(r.quote_t);e.bend_t+=num0(r.bend_t);if(num0(r.order_t)>0)e.orders++;if(r.action==='Ajánlat')e.offers++;if(String(r.date)>e.last)e.last=String(r.date)}
 for(const m of memberRows){if(m.active===false||!clean(m.employee))continue;if(!scopeAll&&m.employee!==employee)continue;bucket(m.employee)}
 for(const t of taskRows){if(clean(t.status)==='done')continue;if(!scopeAll&&t.employee!==employee)continue;const e=bucket(t.employee);e.openTasks++;if(String(t.due_date)<day0)e.overdue++}
 for(const d of dayRows){if(clean(d.status)!=='closed')continue;if(!scopeAll&&d.employee!==employee)continue;const dd=String(d.date||'');if((from&&dd<from)||(to&&dd>to))continue;bucket(d.employee).closedDays++}
 let list=[...map.values()].filter((e:any)=>scopeAll||e.employee===employee);
 if(wanted)list=list.filter((e:any)=>e.team===wanted);
 const scopedRows=wanted?rows.filter((r:any)=>memberTeam.get(key(r.employee))===wanted):rows;
 const trendMap=new Map<string,any>();
 for(const r of scopedRows){const m=String(r.date||'').slice(0,7);if(!m)continue;if(!trendMap.has(m))trendMap.set(m,{month:m,activities:0,points:0,pending:0,order_t:0,quote_t:0});const t=trendMap.get(m);t.activities++;if(r.points===null||r.points===undefined)t.pending++;else t.points+=num0(r.points);t.order_t+=num0(r.order_t);t.quote_t+=num0(r.quote_t)}
 const trend=[...trendMap.values()].map((t:any)=>({...t,points:Math.round(t.points*100)/100,order_t:Math.round(t.order_t*100)/100,quote_t:Math.round(t.quote_t*100)/100})).sort((a:any,b:any)=>a.month.localeCompare(b.month)).slice(-12);
 const compMap=new Map<string,any>();
 for(const r of scopedRows){const k=key(r.company);if(!k)continue;if(!compMap.has(k))compMap.set(k,{company:clean(r.company),activities:0,points:0,order_t:0,quote_t:0});const c=compMap.get(k);c.activities++;if(r.points!==null&&r.points!==undefined)c.points+=num0(r.points);c.order_t+=num0(r.order_t);c.quote_t+=num0(r.quote_t)}
 const topCompanies=[...compMap.values()].map((c:any)=>({...c,points:Math.round(c.points*100)/100,order_t:Math.round(c.order_t*100)/100})).sort((a:any,b:any)=>b.order_t-a.order_t||b.points-a.points||b.activities-a.activities).slice(0,10);
 list=list.map((e:any)=>({...e,points:Math.round(e.points*100)/100,order_t:Math.round(e.order_t*1000)/1000,quote_t:Math.round(e.quote_t*1000)/1000,bend_t:Math.round(e.bend_t*1000)/1000})).sort((a:any,b:any)=>b.points-a.points||b.order_t-a.order_t||a.employee.localeCompare(b.employee,'hu'));
 const totals=list.reduce((o:any,e:any)=>{for(const k of ['activities','points','order_t','quote_t','bend_t','orders','offers','openTasks','overdue','closedDays','pending'])o[k]+=e[k];return o},{activities:0,points:0,order_t:0,quote_t:0,bend_t:0,orders:0,offers:0,openTasks:0,overdue:0,closedDays:0,pending:0});
 totals.people=list.length;totals.avgPoints=list.length?Math.round(totals.points/list.length*100)/100:0;
 return Response.json({from,to,team:wanted,teams,today:day0,scope:scopeAll?'mind':'saját',employees:list,totals,trend,topCompanies});
 }
 fail('Ismeretlen művelet.');
 }catch(e){return Response.json({error:e.message||'Hiba történt.'},{status:e.status||500})}});