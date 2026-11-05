import React,{useEffect,useMemo,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Lock,Unlock,Save,Sparkles,Calculator} from 'lucide-react';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};
const fmt=(n,d=1)=>n==null||!Number.isFinite(Number(n))?'–':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});

export default function HqPointTable({boot,setNote}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[draft,setDraft]=useState(null);
 const [previewDay,setPreviewDay]=useState(boot.today),[previewAction,setPreviewAction]=useState(boot.actions[0]),[previewBucket,setPreviewBucket]=useState(''),[preview,setPreview]=useState(null),[reopenAt,setReopenAt]=useState('');

 const blank=d=>({id:'',effective_from:boot.today,note:'',status:'draft',version:null,g:Object.fromEntries(d.actions.map(a=>[a,{general:'',buckets:Object.fromEntries(d.buckets.map(b=>[b,'']))}]))});
 const fromVersion=(v,d)=>{const g=Object.fromEntries(d.actions.map(a=>[a,{general:'',buckets:Object.fromEntries(d.buckets.map(b=>[b,'']))}]));
  for(const it of v.items||[]){if(!g[it.action])continue;if(!it.bucket)g[it.action].general=it.points==null?'':String(it.points);else if(g[it.action].buckets[it.bucket]!==undefined)g[it.action].buckets[it.bucket]=it.points==null?'':String(it.points)}
  return {id:v.id,effective_from:v.effective_from,note:v.note||'',status:v.status,version:v.version,g}};

 const load=async()=>{const d=await api('ruleVersions');setData(d);
  const dft=d.versions.find(v=>v.status==='draft');
  setDraft(dft?fromVersion(dft,d):blank(d));
  return d};
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);

 const itemsOf=(state)=>{const out=[];for(const a of data.actions){const row=state.g[a]||{};if(row.general!==''&&row.general!=null)out.push({action:a,bucket:'',points:Number(row.general)});for(const b of data.buckets){const v=row.buckets?.[b];if(v!==''&&v!=null)out.push({action:a,bucket:b,points:Number(v)})}}return out};
 const cell=(a,b)=>{const row=draft?.g?.[a];return b?row?.buckets?.[b]??'':row?.general??''};
 const setCell=(a,b,val)=>setDraft(s=>{const g=structuredClone(s.g);if(b)g[a].buckets[b]=val;else g[a].general=val;return{...s,g}});

 const run=async(label,fn)=>{setBusy(label);setError('');try{await fn()}catch(e){setError(e.message)}finally{setBusy('')}};
 const save=()=>run('save',async()=>{const items=itemsOf(draft);if(!items.length)throw Error('Adj meg legalább egy pontértéket.');
  await api('ruleDraftSave',{id:draft.id||undefined,items,effective_from:draft.effective_from,note:draft.note});
  await load();setNote('A ponttábla piszkozata mentve. A pontok csak lezárás után érvényesek.')});
 const close=()=>run('close',async()=>{if(!draft.id)throw Error('Előbb mentsd a piszkozatot.');if(!confirm('Lezárod ezt a ponttáblát? A lezárás után a napi jelentések ezt a verziót használják, és a korábbi pontok nem változnak.'))return;
  await api('ruleVersionClose',{id:draft.id,items:itemsOf(draft)});await load();setNote('A ponttábla lezárva és érvénybe lépett a megadott naptól.')});
 const reopen=()=>run('reopen',async()=>{if(reopenAt.length<5)throw Error('Az újranyitás indoklása kötelező (legalább 5 karakter).');
  const d=await api('ruleVersionReopen',{id:draft.id,reason:reopenAt});setReopenAt('');await load();
  const fresh=(await api('ruleVersions')).versions.find(v=>v.id===d.version.id);if(fresh)setDraft(fromVersion(fresh,data));setNote('Új piszkozat készült a lezárt verzió alapján. A lezárt verzió érintetlen.')});
 const seed=()=>run('seed',async()=>{await api('ruleSeedDraft',{effective_from:boot.today});const d=await load();const dft=d.versions.find(v=>v.status==='draft');if(dft)setDraft(fromVersion(dft,d));setNote('Az induló szabálykészlet a korábbi pontszabályokból készült el. Ellenőrizd, majd zárd le.')});
 const previewRule=()=>run('preview',async()=>setPreview(await api('rulePreview',{activity:previewAction,bucket:previewBucket,day:previewDay})));

 const versions=useMemo(()=>data?[...data.versions].sort((a,b)=>(b.version||0)-(a.version||0)):[],[data]);
 const locked=draft?.status==='closed';

 return <>
 <section className="hq-hero"><div><span className="hq-eyebrow">PONTOZÁS</span><h1>Verziózott ponttábla.</h1><p>Pont tevékenységenként és tonnasávonként. A pont a munkanap napján érvényes, lezárt verzióból számolódik, ezért egy korábbi nap újraszerkesztése nem írja át a szabályt.</p></div>
  <div className="hq-orbit"><b>{boot.ruleState?.closed?boot.ruleState.closed.version+'.':'–'}</b><span>{boot.ruleState?.closed?'érvényes verzió · '+boot.ruleState.closed.effective_from+' óta':'nincs lezárt ponttábla'}</span></div></section>

 <section className="hq-card">
  <div className="hq-sectionhead"><h2>{locked?'Lezárt ponttábla':'Ponttábla szerkesztése'}</h2>
   <span>{draft?.version?draft.version+'. verzió':'új piszkozat'}{locked?' · zárolva':''}</span></div>
  {!data?<p className="hq-empty">{error||'Betöltés…'}</p>:<>
  <div className="hq-controls">
   <label className="hq-field"><span>Érvényes ettől a munkanaptól</span><input type="date" value={draft?.effective_from||''} disabled={locked||!!busy} onChange={e=>setDraft({...draft,effective_from:e.target.value})}/></label>
   <label className="hq-field"><span>Megjegyzés</span><input maxLength={400} value={draft?.note||''} disabled={locked||!!busy} onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
   <span className={'hq-pill '+(locked?'gold':'')}>{locked?'Zárolt verzió':'Szerkeszthető piszkozat'}</span>
  </div>
  <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Tevékenység</th><th className="num">Minden sáv</th>{data.buckets.map(b=><th key={b} className="num">{b}</th>)}</tr></thead><tbody>
   {data.actions.map(a=><tr key={a}><td>{a}</td>
    <td className="num"><input type="number" min="0" step="0.1" className="w-20" disabled={locked||!!busy} value={cell(a,'')} onChange={e=>setCell(a,'',e.target.value)}/></td>
    {data.buckets.map(b=><td key={b} className="num"><input type="number" min="0" step="0.1" className="w-20" disabled={locked||!!busy} value={cell(a,b)} onChange={e=>setCell(a,b,e.target.value)}/></td>)}
   </tr>)}
  </tbody></table></div>
  <p className="hq-hint">A pontos sáv szabálya megelőzi a „minden sáv” értéket. Üres cella azt jelenti, hogy arra a sávra nincs pontszabály, és a pont helyén hiányzó adat jelenik meg. A már rögzített pontokat a rendszer nem számolja újra.</p>
  <div className="hq-actions">
   {!locked&&<><Button className="hq-primary" disabled={!!busy} onClick={save}><Save size={14}/> {busy==='save'?'Mentés…':'Piszkozat mentése'}</Button>
    <Button variant="outline" disabled={!!busy||!draft?.id} onClick={close}><Lock size={14}/> Lezárás és érvénybe lépés</Button></>}
   {locked&&<><input className="hq-input" style={{maxWidth:340}} placeholder="Újranyitás indoklása (kötelező)" value={reopenAt} onChange={e=>setReopenAt(e.target.value)}/>
    <Button variant="outline" disabled={!!busy} onClick={reopen}><Unlock size={14}/> Felnyitás új piszkozatként</Button></>}
   {!versions.length&&<Button variant="outline" disabled={!!busy} onClick={seed}><Sparkles size={14}/> Induló szabálykészlet a korábbi beállításokból</Button>}
  </div>
  {!!error&&<p className="hq-hint">{error}</p>}
  </>}
 </section>

 {!!data&&<section className="hq-card">
  <div className="hq-sectionhead"><h2>Melyik szabály él egy napon?</h2><span>Ellenőrzés mentés előtt</span></div>
  <div className="hq-controls">
   <label className="hq-field"><span>Munkanap</span><input type="date" value={previewDay} onChange={e=>setPreviewDay(e.target.value)}/></label>
   <label className="hq-field"><span>Tevékenység</span><select value={previewAction} onChange={e=>setPreviewAction(e.target.value)}>{data.actions.map(a=><option key={a}>{a}</option>)}</select></label>
   <label className="hq-field"><span>Tonnasáv</span><select value={previewBucket} onChange={e=>setPreviewBucket(e.target.value)}><option value="">Nincs megadva</option>{data.buckets.map(b=><option key={b}>{b}</option>)}</select></label>
   <Button variant="outline" disabled={!!busy} onClick={previewRule}><Calculator size={14}/> Pontszám ellenőrzése</Button>
  </div>
  {!!preview&&<><p className="hq-hint"><b>{preview.points==null?'Nincs pontszabály':fmt(preview.points,2)+' pont'}</b> · {preview.label} · lezárt verziók: {preview.closed}</p>
   <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Tonnasáv</th><th className="num">Pont</th><th>Forrás</th></tr></thead><tbody>{preview.bands.map(b=><tr key={b.bucket}><td>{b.bucket}</td><td className="num">{b.points==null?'–':fmt(b.points,2)}</td><td>{b.label}</td></tr>)}</tbody></table></div></>}
 </section>}

 {!!data&&<section className="hq-card">
  <div className="hq-sectionhead"><h2>Verziók és napló</h2><span>{versions.length} verzió</span></div>
  <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Verzió</th><th>Állapot</th><th>Érvényes ettől</th><th className="num">Szabály</th><th>Létrehozta</th><th>Lezárta</th><th/></tr></thead><tbody>
   {versions.map(v=><tr key={v.id}><td>{v.version}.{v.reopened_from?' · felnyitva':''}</td><td>{v.status==='closed'?'Lezárt':'Piszkozat'}</td><td>{v.effective_from}</td><td className="num">{(v.items||[]).length}</td><td>{v.created_by||''}<div className="text-xs text-muted-foreground">{v.note||''}</div></td><td>{v.closed_by||'–'}<div className="text-xs text-muted-foreground">{v.closed_at?new Date(v.closed_at).toLocaleString('hu-HU'):''}</div></td>
    <td><Button variant="outline" disabled={!!busy} onClick={()=>setDraft(fromVersion(v,data))}>{v.status==='closed'?'Megtekintés':'Szerkesztés'}</Button></td></tr>)}
  </tbody></table></div>
  {!versions.length&&<p className="hq-empty">Még nincs ponttábla-verzió. Készíts piszkozatot, ellenőrizd a napi pontszámot, majd zárd le.</p>}
  {!!data.legacy&&<p className="hq-hint">{data.legacy} korábbi pontszabály található a régi táblában. Ezek csak addig érvényesek, amíg nincs lezárt ponttábla-verzió.</p>}
 </section>}
 </>;
}