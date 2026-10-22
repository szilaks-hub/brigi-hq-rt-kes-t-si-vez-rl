import { createClientFromRequest } from 'npm:@base44/sdk';
const actions=['Megrendelés','Ajánlat','Új cég','Kivitt hajlítás'];
const buckets=['0-4 t','4-8 t','8-15 t','15-24 t','24-50 t','50+ t'];
const clean=(s:any)=>String(s??'').trim();
const key=(s:any)=>clean(s).toLocaleLowerCase('hu').replace(/\s+/g,' ');
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status})};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function validDate(s:any){return /^20\d{2}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s}
async function all(entity:any,query:any={}){let out:any[]=[];for(let skip=0;;skip+=500){let a=await entity.filter(query,'created_date',500,skip);out.push(...a);if(a.length<500)break}return out}
async function unzip(s:string){let data=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return JSON.parse(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).text())}
async function zip(obj:any){let a=new Uint8Array(await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.slice(i,i+8192));return btoa(s)}
function safeRow(r:any){let out:any={company_id:clean(r.company_id),action:clean(r.action),bucket:clean(r.bucket),note:clean(r.note),client_key:clean(r.client_key)};if(!out.company_id)fail('Válassz céget a cégtörzsből.');if(!actions.includes(out.action))fail('Érvénytelen tevékenység.');if(out.bucket&&!buckets.includes(out.bucket))fail('Érvénytelen tonnasáv.');if(out.note.length>10000)fail('A megjegyzés legfeljebb 10000 karakter lehet.');for(let k of ['order_t','quote_t','bend_t']){let v=r[k];out[k]=(v===null||v===undefined||v==='')?null:Number(v);if(out[k]!==null&&(!Number.isFinite(out[k])||out[k]<0))fail('A tonnaérték nem lehet negatív.')}if(out.action==='Megrendelés'&&out.order_t===null)fail('A megrendelésnél add meg a rendelt tonnát.');return out}
function validateState(s:any){if(s?.version!==2||!Array.isArray(s.parts)||!s.settings)fail('Hibás kimutatásmentés.');let seen=new Set();for(let p of s.parts){if(!['sales','purchase','daily','requests','visits','registry','undated','newcompanies','monthlyKpi'].includes(p.kind)||!Array.isArray(p.rows)||p.key!==p.kind+':'+p.period||seen.has(p.key))fail('Hibás vagy ismétlődő adatcsomag.');seen.add(p.key);p.rows=p.rows.filter((r:any)=>!r.__hqLiveId);for(let r of p.rows){if(typeof r.company!=='string'||(p.period!=='all'&&r.p!==p.period))fail('Hibás adatsor.');if(['sales','purchase'].includes(p.kind)&&!Number.isFinite(r.kg))fail('Hibás súly.')}}return s}
Deno.serve(async(req)=>{try{
 const b=createClientFromRequest(req),user=await b.auth.me();if(!user)fail('Jelentkezz be.',401);
 const E=b.asServiceRole.entities,admin=user.role==='admin',email=key(user.email);
 const members=admin?await all(E.HQMember):await all(E.HQMember,{email});
 const member=members.find((m:any)=>key(m.email)===email&&m.active);
 if(!admin&&!member)fail('A hozzáférésed még nincs engedélyezve. Kérd az adminisztrátortól.',403);
 const manager=admin||member?.access==='manager',employee=member?.employee||user.full_name||user.email;
 const body=await req.json(),action=body.action;
 const requireAdmin=()=>{if(!admin)fail('Ehhez adminisztrátori jogosultság kell.',403)};
 const resolveEmployee=()=>{if(!admin)return employee;let n=clean(body.employee||employee);if(n.length<2||n.length>150)fail('Válassz kollégát.');return n};
 const ruleList=()=>all(E.HQRule);
 if(action==='bootstrap'){
  const [companies,rules,manifests]=await Promise.all([all(E.HQCompany),ruleList(),E.HQReport.filter({committed:true},'-created_date',1)]);
  return Response.json({user:{id:user.id,email:user.email,name:user.full_name},admin,manager,employee,members:admin?members:[],companies:companies.filter((c:any)=>c.active),rules,manifest:manifests[0]||null,actions,buckets,today:today()});
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
 if(action==='stageChunk'){
  requireAdmin();if(!/^[A-Za-z0-9-]{4,80}$/.test(body.revision)||!Number.isInteger(body.chunk_index)||body.chunk_index<0||body.chunk_index>1000||typeof body.payload!=='string'||body.payload.length>80000)fail('Hibás mentési csomag.');
  const old=(await all(E.HQChunk,{revision:body.revision,chunk_index:body.chunk_index}))[0];if(old){if(old.payload!==body.payload)fail('Ütköző mentési csomag.');return Response.json({ok:true})}
  await E.HQChunk.create({revision:body.revision,chunk_index:body.chunk_index,payload:body.payload});return Response.json({ok:true});
 }
 if(action==='commitReport'){
  requireAdmin();const latest=(await E.HQReport.filter({committed:true},'-created_date',1))[0];if((latest?.revision||null)!==(body.expected_revision||null))fail('A kimutatás időközben frissült. Töltsd újra a friss adatokat.',409);
  const chunks=(await all(E.HQChunk,{revision:body.revision})).sort((a:any,b:any)=>a.chunk_index-b.chunk_index);if(chunks.length!==body.chunk_count||chunks.some((c:any,i:number)=>c.chunk_index!==i))fail('Hiányos adatcsomag.');
  const s=validateState(await unzip(chunks.map((c:any)=>c.payload).join('')));const record=await E.HQReport.create({revision:body.revision,chunk_count:chunks.length,committed:true,source:'Adatközpont',rows:s.parts.reduce((n:number,p:any)=>n+p.rows.length,0)});return Response.json({manifest:record});
 }
 if(action==='report'){
  const manifest=(await E.HQReport.filter({committed:true},'-created_date',1))[0];if(!manifest)fail('Nincs betöltött kimutatás.');
  const chunks=(await all(E.HQChunk,{revision:manifest.revision})).sort((a:any,b:any)=>a.chunk_index-b.chunk_index);if(chunks.length!==manifest.chunk_count)fail('Hiányos mentés.');let s=validateState(await unzip(chunks.map((c:any)=>c.payload).join('')));
  if(!manager){for(let p of s.parts)p.rows=p.rows.filter((r:any)=>r.employee===employee);s.settings.monthlyKpis=(s.settings.monthlyKpis||[]).filter((r:any)=>r.employee===employee);s.settings.salesActions={};}
  const live=await all(E.HQActivity,manager?{archived:false}:{employee,archived:false});for(let r of live){let p=r.date.slice(0,7),part=s.parts.find((x:any)=>x.key==='daily:'+p);if(!part){part={key:'daily:'+p,kind:'daily',period:p,hash:'hq-live',source:'Base44 napi munkalap',rows:[],issues:[]};s.parts.push(part)}part.rows.push({p,date:r.date,employee:r.employee,company:r.company,action:r.action,bucket:r.bucket,orderT:r.order_t??null,quoteT:r.quote_t??null,bendT:r.bend_t??null,points:r.points??null,note:r.note||'',ref:'Base44!'+r.id,__hqLiveId:r.id})}
  s.updatedAt=Date.now();return Response.json({payload:await zip(s),manifest,admin,employee,manager});
 }
 fail('Ismeretlen művelet.');
}catch(e){return Response.json({error:e.message||'Hiba történt.'},{status:e.status||500})}});
