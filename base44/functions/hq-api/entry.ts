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
async function unzip(s:string){let data=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return JSON.parse(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).text())}
async function zip(obj:any){let a=new Uint8Array(await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.slice(i,i+8192));return btoa(s)}
function safeRow(r:any){let out:any={company_id:clean(r.company_id),action:clean(r.action),bucket:clean(r.bucket),note:clean(r.note),client_key:clean(r.client_key)};if(!out.company_id)fail('Válassz céget a cégtörzsből.');if(!actions.includes(out.action))fail('Érvénytelen tevékenység.');if(out.bucket&&!buckets.includes(out.bucket))fail('Érvénytelen tonnasáv.');if(out.note.length>10000)fail('A megjegyzés legfeljebb 10000 karakter lehet.');for(let k of ['order_t','quote_t','bend_t']){let v=r[k];out[k]=(v===null||v===undefined||v==='')?null:Number(v);if(out[k]!==null&&(!Number.isFinite(out[k])||out[k]<0))fail('A tonnaérték nem lehet negatív.')}if(out.action==='Megrendelés'&&out.order_t===null)fail('A megrendelésnél add meg a rendelt tonnát.');return out}
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
  const [companies,rules,manifests]=await Promise.all([all(E.HQCompany),ruleList(),E.HQReport.filter({committed:true},'-created_date',1)]);
  const assignedToEmployee=(c:any)=>admin||manager||(c.owners||[]).some((o:any)=>personKey(o)===personKey(employee));
  return Response.json({user:{id:user.id,email:user.email,name:user.full_name},admin,manager,employee,members:admin?members:[],companies:companies.filter((c:any)=>c.active&&assignedToEmployee(c)),rules,manifest:manifests[0]||null,actions,buckets,today:today()});
 }
 if(action==='getDay'||action==='openDay'||action==='setDayStatus'){
  let day=clean(body.date),person=resolveEmployee();if(!validDate(day))fail('Érvénytelen dátum.');
  let sheets=await all(E.HQDay,{date:day,employee:person}),sheet=sheets[0]||null;
  if(action==='openDay'&&!sheet){if(day>today())fail('Jövőbeli napra nem nyitható munkalap.');sheet=await E.HQDay.create({date:day,employee:person,owner_email:email,status:'open',key:person+'|'+day})}
  if(action==='setDayStatus'){
   if(!sheet)fail('Előbb nyisd meg a munkalapot.');if(body.status==='open'&&!admin)fail('Lezárt munkalapot csak az admin nyithat újra.',403);
   if(!['open','closed'].includes(body.status))fail('Hibás állapot.');sheet=await E.HQDay.update(sheet.id,{status:body.status});
  }
  const rows=await all(E.HQActivity,{date:day,employee:person,archived:false});
  const tasks=(await all(E.HQTask,{employee:person,archived:false})).sort((a:any,b:any)=>String(a.due_date).localeCompare(String(b.due_date))||String(b.created_date).localeCompare(String(a.created_date)));
  const teamTasks=admin?(await all(E.HQTask)).filter((t:any)=>t.status!=='done'&&!t.archived).sort((a:any,b:any)=>String(a.due_date).localeCompare(String(b.due_date))):[];
  return Response.json({sheet,rows,tasks,teamTasks});
 }
 if(action==='saveRow'||action==='archiveRow'){
  const person=resolveEmployee(),day=clean(body.date);if(!validDate(day)||day>today())fail('Érvénytelen munkanap.');
  const sheet=(await all(E.HQDay,{date:day,employee:person}))[0];if(!sheet||sheet.status!=='open')fail('Nyitott munkalap szükséges.');
  let previous=body.id?await E.HQActivity.get(body.id):null;
  if(previous&&(previous.employee!==person||previous.date!==day))fail('Másik munkalap sora nem módosítható.',403);
  if(previous&&body.expected_updated!==previous.updated_date)fail('Ezt a sort időközben módosították. Frissítsd a munkalapot.',409);
  if(action==='archiveRow'){if(!previous)fail('Nincs ilyen sor.');return Response.json({row:await E.HQActivity.update(previous.id,{archived:true})})}
  const data=safeRow(body.row),company=await E.HQCompany.get(data.company_id);if(!company?.active)fail('A cég nem aktív.');
  if(!admin&&!manager&&!(company.owners||[]).some((o:any)=>personKey(o)===personKey(employee)))fail('Ez a cég nincs hozzád rendelve.',403);
  if(!data.client_key)fail('Hiányzó sorazonosító.');
  if(!previous){const retry=(await all(E.HQActivity,{client_key:data.client_key,employee:person}))[0];if(retry)return Response.json({row:retry})}
  const candidates=(await ruleList()).filter((r:any)=>r.enabled&&r.action===data.action&&(!r.bucket||r.bucket===data.bucket)&&r.effective_from<=day).sort((a:any,b:any)=>(Number(!!b.bucket)-Number(!!a.bucket))||b.effective_from.localeCompare(a.effective_from)||b.created_date.localeCompare(a.created_date));
  const rule=candidates[0];Object.assign(data,{date:day,employee:person,owner_email:previous?.owner_email||email,company:company.name,points:rule?rule.points:null,rule_id:rule?.id||'',rule_label:rule?rule.action+' / '+(rule.bucket||'minden sáv')+' / '+rule.effective_from:'Nincs pontszabály',archived:false});
  const row=previous?await E.HQActivity.update(previous.id,data):await E.HQActivity.create(data);return Response.json({row});
 }
 if(action==='saveTask'||action==='closeTask'||action==='postponeTask'){
  const person=resolveEmployee();
  if(action==='saveTask'){
   const t=body.task||{},note=clean(t.note),due=clean(t.due_date)||plusDays(today(),7);
   if(!note)fail('Írd le, miről volt szó és mi a következő lépés.');if(note.length>2000)fail('A teendő legfeljebb 2000 karakter lehet.');
   if(!validDate(due))fail('Érvénytelen határidő.');
   const company=await E.HQCompany.get(clean(t.company_id)).catch(()=>null);if(!company?.active)fail('A cég nem aktív.');
   if(!admin&&!manager&&!(company.owners||[]).some((o:any)=>personKey(o)===personKey(employee)))fail('Ez a cég nincs hozzád rendelve.',403);
   const previous=t.id?await E.HQTask.get(clean(t.id)).catch(()=>null):null;if(previous&&previous.employee!==person)fail('Másik kolléga teendője nem módosítható.',403);
   const data={employee:person,owner_email:previous?.owner_email||email,company_id:company.id,company:company.name,note,due_date:due,archived:false};
   const task=previous?await E.HQTask.update(previous.id,data):await E.HQTask.create({...data,status:'open',outcome:'',closed_date:'',postpone_count:0,reminder_count:0});
   return Response.json({task});
  }
  const task=await E.HQTask.get(clean(body.id)).catch(()=>null);if(!task)fail('Nincs ilyen teendő.',404);
  if(task.employee!==person)fail('Ez nem a te teendőd.',403);
  if(action==='postponeTask'){
   const due=clean(body.due_date)||plusDays(today(),7);if(!validDate(due)||due<today())fail('Érvénytelen új határidő.');
   return Response.json({task:await E.HQTask.update(task.id,{due_date:due,status:'open',postpone_count:(task.postpone_count||0)+1})});
  }
  if(!['sikeres','sikertelen'].includes(body.outcome))fail('Hibás eredmény.');
  const updated=body.outcome==='sikeres'?await E.HQTask.update(task.id,{status:'done',outcome:'sikeres',closed_date:today()}):await E.HQTask.update(task.id,{status:'open',outcome:'sikertelen',closed_date:'',due_date:plusDays(today(),7),reminder_count:(task.reminder_count||0)+1});
  return Response.json({task:updated});
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
  for(let c of body.companies){const name=clean(c.name);if(!name||name.length>500)fail('Hibás cégnév.');let old:any=map.get(key(name));let data:any={name,source:clean(body.source),active:true,county:normCounty(c.county)||old?.county||'',city:clean(c.city)||old?.city||''};for(let k of ['countries','owners','teams','types'])data[k]=Array.isArray(c[k])&&c[k].length?[...new Set(c[k].map(clean).filter(Boolean))]:(old?.[k]||[]);if(old){await E.HQCompany.update(old.id,data);updated++}else{const fresh=await E.HQCompany.create(data);map.set(key(name),fresh);added++}}return Response.json({added,updated});
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
  return Response.json({company:{id:company.id,name:company.name,owners:company.owners||[],countries:company.countries||[],types:company.types||[]},count:rows.length,last:rows[0]?rows[0].date:'',daysSince:gap(rows[0]?rows[0].date:null),lastOrder:lastOrder?{date:lastOrder.date,order_t:num(lastOrder.order_t)}:null,lastOffer:lastOffer?{date:lastOffer.date,quote_t:num(lastOffer.quote_t),note:lastOffer.note||''}:null,offerOpen:!!lastOffer&&(!lastOrder||String(lastOffer.date)>String(lastOrder.date)),totals:{order_t:sum('order_t'),quote_t:sum('quote_t'),bend_t:sum('bend_t'),points:sum('points')},openTasks:tasks.filter((t:any)=>t.status!=='done'),recent:rows.slice(0,8).map((r:any)=>({id:r.id,date:r.date,action:r.action,bucket:r.bucket,order_t:r.order_t,quote_t:r.quote_t,points:r.points,note:r.note}))});
 }
 if(action==='suggestions'){
  const person=resolveEmployee(),day0=today(),num=(v:any)=>Number.isFinite(Number(v))?Number(v):0,gap=(d:any)=>Math.round((Date.parse(day0)-Date.parse(String(d)))/86400000);
  const rows=(await all(E.HQActivity,{employee:person,archived:false})).sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date)));
  const open=(await all(E.HQTask,{employee:person,archived:false})).filter((t:any)=>t.status!=='done');
  const map=new Map(),out:any[]=[];
  for(const r of rows){const k=r.company_id||r.company;if(!k)continue;let e:any=map.get(k);if(!e){e={company_id:r.company_id,company:r.company,lastContact:r.date,lastOrder:'',lastOffer:'',order_t:0};map.set(k,e)}const tons=num(r.order_t);if(tons>0){e.order_t+=tons;if(!e.lastOrder)e.lastOrder=r.date}if(r.action==='Ajánlat'&&!e.lastOffer)e.lastOffer=r.date}
  for(const t of open){const late=String(t.due_date)<day0;out.push({company_id:t.company_id,company:t.company,reason:(late?'Lejárt teendő ('+t.due_date+'): ':'Esedékes ('+t.due_date+'): ')+(t.note||'visszahívás'),priority:late?0:1,due:t.due_date,lastContact:'',openTasks:1})}
  const listed=new Set(open.map((t:any)=>t.company_id));
  for(const e of map.values()){if(listed.has(e.company_id))continue;const since=gap(e.lastContact);
   if(e.lastOffer&&(!e.lastOrder||e.lastOffer>e.lastOrder)&&gap(e.lastOffer)>=5){out.push({company_id:e.company_id,company:e.company,reason:'Ajánlatot adtál ('+e.lastOffer+'), azóta nincs rendelés — hívd vissza.',priority:2,due:'',lastContact:e.lastContact,openTasks:0})}
   else if(since>=21){out.push({company_id:e.company_id,company:e.company,reason:'Nincs kapcsolat '+since+' napja. Utolsó napló: '+e.lastContact+(e.lastOrder?' · utolsó rendelés: '+e.lastOrder+' ('+e.order_t+' t)':''),priority:3,due:'',lastContact:e.lastContact,openTasks:0})}}
  return Response.json({items:out.sort((a:any,b:any)=>a.priority-b.priority||String(a.due).localeCompare(String(b.due))).slice(0,12),scanned:map.size,open:open.length});
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
 fail('Ismeretlen művelet.');
}catch(e){return Response.json({error:e.message||'Hiba történt.'},{status:e.status||500})}});