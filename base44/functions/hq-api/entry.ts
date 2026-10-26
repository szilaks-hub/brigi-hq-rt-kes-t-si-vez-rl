import { createClientFromRequest } from 'npm:@base44/sdk';
const actions=['Megrendelés','Ajánlat','Új cég','Kivitt hajlítás'];
const buckets=['0-4 t','4-8 t','8-15 t','15-24 t','24-50 t','50+ t'];
const clean=(s:any)=>String(s??'').trim();
const key=(s:any)=>clean(s).toLocaleLowerCase('hu').replace(/\s+/g,' ');
const personKey=(s:any)=>key(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status})};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function validDate(s:any){return /^20\d{2}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s}
async function all(entity:any,query:any={}){let out:any[]=[];for(let skip=0;;skip+=500){let a=await entity.filter(query,'id',500,skip);out.push(...a);if(a.length<500)break}return out}
async function unzip(s:string){let data=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return JSON.parse(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).text())}
async function zip(obj:any){let a=new Uint8Array(await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.slice(i,i+8192));return btoa(s)}
function safeRow(r:any){let out:any={company_id:clean(r.company_id),action:clean(r.action),bucket:clean(r.bucket),note:clean(r.note),client_key:clean(r.client_key)};if(!out.company_id)fail('Válassz céget a cégtörzsből.');if(!actions.includes(out.action))fail('Érvénytelen tevékenység.');if(out.bucket&&!buckets.includes(out.bucket))fail('Érvénytelen tonnasáv.');if(out.note.length>10000)fail('A megjegyzés legfeljebb 10000 karakter lehet.');for(let k of ['order_t','quote_t','bend_t']){let v=r[k];out[k]=(v===null||v===undefined||v==='')?null:Number(v);if(out[k]!==null&&(!Number.isFinite(out[k])||out[k]<0))fail('A tonnaérték nem lehet negatív.')}if(out.action==='Megrendelés'&&out.order_t===null)fail('A megrendelésnél add meg a rendelt tonnát.');return out}
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
  const rows=await all(E.HQActivity,{date:day,employee:person,archived:false});return Response.json({sheet,rows});
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
  for(let c of body.companies){const name=clean(c.name);if(!name||name.length>500)fail('Hibás cégnév.');let data:any={name,source:clean(body.source),active:true};let old:any=map.get(key(name));for(let k of ['countries','owners','teams','types'])data[k]=Array.isArray(c[k])&&c[k].length?[...new Set(c[k].map(clean).filter(Boolean))]:(old?.[k]||[]);if(old){await E.HQCompany.update(old.id,data);updated++}else{const fresh=await E.HQCompany.create(data);map.set(key(name),fresh);added++}}return Response.json({added,updated});
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
  if(!manager){for(let p of s.parts)p.rows=p.rows.filter((r:any)=>r.employee===employee);s.settings.monthlyKpis=(s.settings.monthlyKpis||[]).filter((r:any)=>r.employee===employee);s.settings.salesActions={};}
  const live=await all(E.HQActivity,manager?{archived:false}:{employee,archived:false});for(let r of live){let p=r.date.slice(0,7),part=s.parts.find((x:any)=>x.key==='daily:'+p);if(!part){part={key:'daily:'+p,kind:'daily',period:p,hash:'hq-live',source:'Base44 napi munkalap',rows:[],issues:[]};s.parts.push(part)}part.rows.push({p,date:r.date,employee:r.employee,company:r.company,action:r.action,bucket:r.bucket,orderT:r.order_t??null,quoteT:r.quote_t??null,bendT:r.bend_t??null,points:r.points??null,note:r.note||'',ref:'Base44!'+r.id,__hqLiveId:r.id})}
  s.updatedAt=Date.now();return Response.json({payload:await zip(s),manifest,admin,employee,manager});
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