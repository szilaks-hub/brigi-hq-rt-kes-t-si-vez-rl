import React,{useEffect,useMemo,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {parseTrafficFile,KIND_LABEL} from '@/lib/hq-vectory';
import {Upload,ShieldCheck,AlertTriangle,RefreshCw,Trash2,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};
const fmt=(n,d=1)=>n==null||!Number.isFinite(Number(n))?'–':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});
const T=(kg)=>fmt(Number(kg||0)/1000,2)+' t';
const STATUS={staged:'Előkészítve',active:'Aktív adatkészlet',superseded:'Lecserélve',withdrawn:'Visszavonva'};

export default function HqVectoryImport({boot,setNote,setError,onImported}){
 const [file,setFile]=useState(null),[parsed,setParsed]=useState(null),[progress,setProgress]=useState(''),[busy,setBusy]=useState(''),[localError,setLocalError]=useState('');
 const [revision,setRevision]=useState(''),[preview,setPreview]=useState(null),[currency,setCurrency]=useState(''),[confirmed,setConfirmed]=useState(false),[note,setLocalNote]=useState('');
 const [packages,setPackages]=useState([]),[active,setActive]=useState(null),[refreshKey,setRefreshKey]=useState(0);
 const fileRef=useRef(null);
 useEffect(()=>{let live=true;api('trafficPackages').then(d=>{if(live){setPackages(d.packages||[]);setActive(d.active||null)}}).catch(e=>setLocalError(e.message));return()=>{live=false}},[refreshKey]);

 const totals=useMemo(()=>{if(!parsed)return null;const agg=(kind)=>parsed.sheets.filter(s=>s.kind===kind).reduce((acc,s)=>({kg:acc.kg+s.stats.rows*0+ (s.aggregates.reduce((n,a)=>n+a.kg,0)),rows:acc.rows+s.stats.rows,zero:acc.zero+s.stats.zero,negative:acc.negative+s.stats.negative,processed:acc.processed+s.stats.processed,undated:acc.undated+s.stats.undated,companies:s.aggregates.length}),{kg:0,rows:0,zero:0,negative:0,processed:0,undated:0,companies:0});
  return {sales:agg('sales'),purchase:agg('purchase')}},[parsed]);

 const pick=async f=>{if(!f)return;setLocalError('');setPreview(null);setParsed(null);setRevision('');setConfirmed(false);setBusy('parse');setFile(f);
  try{const result=await parseTrafficFile(f,p=>setProgress(p));setParsed(result);setCurrency('');setProgress('')}
  catch(e){setLocalError(e.message);setFile(null)}finally{setBusy('')}};

 const stage=async()=>{if(!parsed)return;setBusy('stage');setLocalError('');const rev=crypto.randomUUID();setRevision(rev);
  try{
   setProgress('A nyers fájl privát mentése…');
   const up=await base44.integrations.Core.UploadPrivateFile({file});
   setProgress('Közös kimutatások frissítésének előkészítése…');
   const current=await api('report');
   const state=JSON.parse(await new Response(new Blob([Uint8Array.from(atob(current.payload),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
   for(const p of state.parts)p.rows=p.rows.filter(r=>!r.__hqLiveId);
   const incoming=new Map();
   for(const sheet of parsed.sheets)for(const r of sheet.reportRows){const k=sheet.kind+':'+r.p;if(!incoming.has(k))incoming.set(k,{key:k,kind:sheet.kind,period:r.p,source:parsed.fileName,hash:parsed.hash,rows:[],issues:[]});incoming.get(k).rows.push(r)}
   state.parts=state.parts.filter(p=>!incoming.has(p.key)).concat([...incoming.values()]);
   state.settings.money='unknown';
   const compressed=new Uint8Array(await new Response(new Blob([JSON.stringify(state)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());let binary='';for(let i=0;i<compressed.length;i+=8192)binary+=String.fromCharCode(...compressed.slice(i,i+8192));const payload=btoa(binary),chunks=Math.ceil(payload.length/8000);
   for(let i=0;i<chunks;i+=20){setProgress('Riportok előkészítése: '+Math.min(i+20,chunks)+' / '+chunks);await api('stageChunks',{revision:rev,chunks:Array.from({length:Math.min(20,chunks-i)},(_,j)=>({chunk_index:i+j,payload:payload.slice((i+j)*8000,(i+j+1)*8000)}))})}
   const rows=[];for(const sheet of parsed.sheets)for(const a of sheet.aggregates)rows.push({company:a.company,company_meta:sheet.companies.find(c=>c.name===a.company)||{},kind:sheet.kind,kg:a.kg,net:a.net||0,rows:a.rows,first_date:a.first_date,last_date:a.last_date,months:a.months});

   const meta={report_revision:rev,report_chunk_count:chunks,expected_report_revision:current.manifest?.revision||'',label:parsed.fileName+' · '+parsed.periodFrom+' – '+parsed.periodTo,file_name:parsed.fileName,file_uri:up?.file_uri||'',file_size:parsed.fileSize,fingerprint:parsed.hash,currency,period_from:parsed.periodFrom,period_to:parsed.periodTo,scope:'full',processed:parsed.sheets.reduce((n,s)=>n+s.stats.processed,0),zero:parsed.sheets.reduce((n,s)=>n+s.stats.zero,0),negative:parsed.sheets.reduce((n,s)=>n+s.stats.negative,0),undated:parsed.sheets.reduce((n,s)=>n+s.stats.undated,0),issues:[...(parsed.issues||[]),...parsed.sheets.filter(s=>s.ambiguity).map(s=>s.sheet+': '+s.ambiguity)].slice(0,20)};
   for(let i=0;i<rows.length;i+=200){setProgress('Feldolgozás: '+Math.min(i+200,rows.length)+' / '+rows.length+' cég');await api('trafficStage',{revision:rev,meta:i===0?meta:{},rows:rows.slice(i,i+200)})}
   setProgress('Ellenőrző összesítés…');
   const d=await api('trafficPreview',{revision:rev});setPreview(d.preview);setCurrency(d.preview.currency||currency);setNote('A forgalmi csomag előkészítve. Ellenőrizd az összesítést, utána hagyd jóvá.');
   setRefreshKey(k=>k+1);
  }catch(e){setLocalError(e.message);setError(e.message)}finally{setBusy('');setProgress('')}};

 const approve=async()=>{setBusy('approve');setLocalError('');
  try{const d=await api('trafficApprove',{revision,currency,currency_confirmed:confirmed&&!!currency.trim(),note});
   await onImported?.();
   setNote('A forgalmi csomag aktiválva. '+d.rows+' cégösszesítés él, '+d.superseded+' korábbi csomag lecserélve.');
   setParsed(null);setPreview(null);setFile(null);setRevision('');setLocalNote('');setConfirmed(false);if(fileRef.current)fileRef.current.value='';setRefreshKey(k=>k+1);
  }catch(e){setLocalError(e.message)}finally{setBusy('')}};

 const discard=async()=>{if(!revision)return;setBusy('discard');
  try{await api('trafficDiscard',{revision,reason:'Feltöltés visszavonva jóváhagyás előtt'});setNote('A feltöltés visszavonva, a forgalmi adatok törölve.');setParsed(null);setPreview(null);setFile(null);setRevision('');setRefreshKey(k=>k+1)}
  catch(e){setLocalError(e.message)}finally{setBusy('')}};

 const restore=async id=>{if(!confirm('Visszaállítod ezt a korábbi forgalmi csomagot aktív adatkészletként?'))return;setBusy('restore');
  try{await api('trafficRestore',{id,reason:'Korábbi csomag visszaállítása'});await onImported?.();setNote('A korábbi forgalmi csomag és a kimutatások visszaállítva. A napi munka és az ügyek megmaradtak.');setRefreshKey(k=>k+1)}
  catch(e){setLocalError(e.message)}finally{setBusy('')}};

 return <>
 <section className="hq-hero"><div><span className="hq-eyebrow">VECTORY DOK UP</span><h1>Forgalmi adat, ellenőrizve.</h1><p>Az értékesítési és beszerzési exportból cég szintű havi összesítés készül. A nyers fájl privát tárolóba kerül, a jóváhagyásig semmilyen kimutatás nem változik.</p></div>
  <div className="hq-orbit"><b>{active?T(active.kg_sales||0):'–'}</b><span>{active?'aktív értékesítés · záródátum '+active.period_to:'nincs jóváhagyott adat'}</span></div></section>

 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Heti frissítés a teljes Vectory-listából</h2><span>{active?'Aktív: '+(active.label||'')+' · '+active.period_from+' – '+active.period_to:'Még nincs jóváhagyott forgalmi adat'}</span></div>
  <div className="hq-controls">
   <label className="hq-btn"><Upload size={14}/> Fájl kiválasztása<input ref={fileRef} type="file" accept=".xlsx,.csv" hidden disabled={!!busy} onChange={e=>pick(e.target.files[0])}/></label>
   <span className="hq-pill">{busy==='parse'?(progress||'Beolvasás…'):file?file.name:'Nincs kiválasztott fájl'}</span>
   {!!parsed&&!preview&&<Button className="hq-primary" disabled={!!busy} onClick={stage}>{busy==='stage'?(progress||'Előkészítés…'):'Előkészítés ellenőrzésre'}</Button>}
  </div>
  <p className="hq-hint">Hetente a teljes, év elejétől vezetett listát töltsd fel, a csatolt mintához hasonlóan. Az érintett hónapok adatait lecseréljük, így nincs dupla forgalom. A cégek azonosítója, jegyzetei és ügyei megmaradnak. Csak egyetlen hetet tartalmazó részlista itt nem használható.</p>
  {(localError||progress&&busy==='stage')&&<p className="hq-hint">{localError||progress}</p>}
 </section>

 {!!parsed&&!preview&&<section className="hq-card">
  <div className="hq-sectionhead"><h2>Beolvasott munkalapok</h2><span>{parsed.periodFrom} – {parsed.periodTo}</span></div>
  <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Munkalap</th><th>Fajta</th><th className="num">Cég</th><th className="num">Sor</th><th className="num">Súly</th><th className="num">Nulla</th><th className="num">Negatív</th><th className="num">Dátum nélkül</th></tr></thead><tbody>
   {parsed.sheets.map(s=><tr key={s.sheet}><td>{s.sheet}</td><td>{KIND_LABEL[s.kind]||s.kind}</td><td className="num">{s.aggregates.length}</td><td className="num">{fmt(s.stats.rows,0)}</td><td className="num">{T(s.aggregates.reduce((n,a)=>n+a.kg,0))}</td><td className="num">{fmt(s.stats.zero,0)}</td><td className="num">{fmt(s.stats.negative,0)}</td><td className="num">{fmt(s.stats.undated,0)}</td></tr>)}
  </tbody></table></div>
  {!!parsed.issues.length&&<ul className="hq-hint">{parsed.issues.map((i,ix)=><li key={ix}><AlertTriangle size={12}/> {i}</li>)}</ul>}
  {!!totals&&<p className="hq-hint">Értékesítés: {T(totals.sales.kg)} · Beszerzés: {T(totals.purchase.kg)}. A tonnák a SZUM Súly oszlopból származnak (kg / 1000).</p>}
 </section>}

 {!!preview&&<section className="hq-card">
  <div className="hq-sectionhead"><h2>Ellenőrző összesítés</h2><span>{preview.period_from} – {preview.period_to} · {preview.scope==='full'?'teljes':'részleges'} export</span></div>
  {!!preview.duplicate.length&&<p className="hq-hint"><AlertTriangle size={13}/> Ez a fájl már szerepel a rendszerben: {preview.duplicate.map(d=>d.label+' ('+STATUS[d.status]+')').join(', ')}.</p>}
  <div className="hq-stats">
   <div className="hq-stat"><span>Értékesítés</span><strong>{T(preview.sales.kg)}<small>{fmt(preview.sales.companies,0)} cég</small></strong></div>
   <div className="hq-stat"><span>Beszerzés</span><strong>{T(preview.purchase.kg)}<small>{fmt(preview.purchase.companies,0)} cég</small></strong></div>
   <div className="hq-stat"><span>Nulla súlyú sor</span><strong>{fmt(preview.zero,0)}<small>tonnában 0, az érték megmarad</small></strong></div>
   <div className="hq-stat"><span>Negatív súly</span><strong>{fmt(preview.negative,0)}<small>stornó</small></strong></div>
   <div className="hq-stat"><span>Dátum nélkül</span><strong>{fmt(preview.undated,0)}<small>kimutatásban nem szerepel</small></strong></div>
  </div>
  {!!preview.diff&&<div className="hq-import-preview"><h3>Összehasonlítás az aktív adatkészlettel</h3><p>{preview.diff.previous.label} · {preview.diff.previous.period_from} – {preview.diff.previous.period_to}</p><ul><li>{preview.diff.changed} cég adata változik</li><li>{preview.diff.added} új cégösszesítés</li><li>{preview.diff.removed} cég kikerül az új exportból</li><li>Súlyváltozás: {fmt(preview.diff.deltaKg/1000,2)} t</li></ul></div>}
  <div className="grid gap-4 lg:grid-cols-2">
   <div><h3 className="text-sm font-semibold">Havi értékesítés</h3><div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Hónap</th><th className="num">Tonna</th><th className="num">Cég</th></tr></thead><tbody>{preview.monthly.map(m=><tr key={m.m}><td>{m.m}</td><td className="num">{T(m.kg)}</td><td className="num">{fmt(m.companies,0)}</td></tr>)}</tbody></table></div></div>
   <div><h3 className="text-sm font-semibold">Legnagyobb elmozdulások</h3>{!(preview.movers.up.length||preview.movers.down.length)&&<p className="hq-hint">Nincs összehasonlítható lezárt hónap.</p>}
    <ul className="mt-1 space-y-1 text-xs">{[...preview.movers.up.map(x=>({...x,dir:'+'})),...preview.movers.down.map(x=>({...x,dir:''}))].slice(0,10).map(x=><li key={x.company_key+x.month} className="flex justify-between gap-2 border-b border-border/60 pb-1"><span>{x.company} <small className="text-muted-foreground">({x.month})</small></span><b>{x.dir}{fmt(x.delta/1000,2)} t</b></li>)}</ul></div>
  </div>
  {!!preview.newCompanies.length&&<div className="hq-import-preview"><h3>Ismeretlen cégek a cégtörzsben ({preview.newCompanies.length})</h3><p>Jóváhagyáskor a valid Vectory-lista cégeit felvesszük a cégtörzsbe. A meglévő cégekhez tartozó ügyek és jegyzetek megmaradnak.</p><ul>{preview.newCompanies.slice(0,10).map(n=><li key={n.company}>{n.company} · {T(n.kg)}</li>)}</ul></div>}
  {!!preview.mismatch.length&&<div className="hq-import-preview"><h3>Eltérő írásmód ({preview.mismatch.length})</h3><ul>{preview.mismatch.slice(0,10).map((m,i)=><li key={i}>{m.staged} → cégtörzs: {m.master}</li>)}</ul></div>}
  {!!(preview.issues||[]).length&&<ul className="hq-hint">{preview.issues.map((i,ix)=><li key={ix}><AlertTriangle size={12}/> {i.text||i}</li>)}</ul>}
  <div className="hq-grid">
   <label className="hq-field"><span>A nettó érték pénzneme (ha ismert)</span><input value={currency} maxLength={8} onChange={e=>setCurrency(e.target.value)}/></label>
   <label className="hq-field"><span>Jóváhagyási megjegyzés</span><input value={note} maxLength={400} onChange={e=>setLocalNote(e.target.value)}/></label>
   <label className="hq-field"><span>Megerősítés</span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Az időszak teljes listája, az összesítés rendben van</label></label>
  </div>
  <div className="hq-actions">
   <Button className="hq-primary" disabled={!!busy||!confirmed} onClick={approve}><ShieldCheck size={14}/> {busy==='approve'?'Aktiválás…':'Jóváhagyás és aktiválás'}</Button>
   <Button variant="outline" disabled={!!busy} onClick={discard}><Trash2 size={14}/> Feltöltés visszavonása</Button>
  </div>
  {!confirmed&&<p className="hq-hint">A partner pénzneme önmagában nem igazolja a nettó érték pénznemét. Ismeretlen pénznemnél a forgalom tonnában használható. Az aktiválás a korábbi csomagot lecseréli, de nem törli.</p>}
 </section>}

 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Forgalmi csomagok</h2><button className="hq-btn" disabled={!!busy} onClick={()=>setRefreshKey(k=>k+1)}><RefreshCw size={14}/> Frissítés</button></div>
  <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Csomag</th><th>Időszak</th><th>Állapot</th><th className="num">Ért. t</th><th className="num">Beszerzés t</th><th>Feltöltve</th><th>Jóváhagyta</th><th/></tr></thead><tbody>
   {packages.map(p=><tr key={p.id}><td>{p.label||p.filename}<div className="text-xs text-muted-foreground">{p.filename}</div></td><td>{p.period_from} – {p.period_to}</td><td>{STATUS[p.status]||p.status}{p.currency_confirmed?'':p.currency?' · pénznem nincs megerősítve':''}</td><td className="num">{fmt(p.kg_sales/1000,2)}</td><td className="num">{fmt(p.kg_purchase/1000,2)}</td><td>{p.uploaded_at?new Date(p.uploaded_at).toLocaleDateString('hu-HU'):''}<div className="text-xs text-muted-foreground">{p.uploaded_by}</div></td><td>{p.approved_at?new Date(p.approved_at).toLocaleDateString('hu-HU'):'–'}<div className="text-xs text-muted-foreground">{p.approved_by}</div></td><td>{p.status==='superseded'&&<Button variant="outline" disabled={!!busy} onClick={()=>restore(p.id)}><RotateCcw size={13}/> Visszaállítás</Button>}</td></tr>)}
  </tbody></table></div>
  {!packages.length&&<p className="hq-empty">Még nincs feltöltött forgalmi csomag.</p>}
  <p className="hq-hint">Az aktív csomag adja a javaslatok forgalmi hivatkozásait. A záródátumon túli hónapokra a rendszer nem állít semmit.</p>
 </section>
 </>;
}