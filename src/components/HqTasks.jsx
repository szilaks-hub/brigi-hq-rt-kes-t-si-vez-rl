import React,{useState} from 'react';
import {AlarmClock,Check,Plus,RotateCcw,CalendarClock} from 'lucide-react';

const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const dayKey=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest'}).format(new Date(Date.now()+(n||0)*86400000));
const TYPES={megkereses:'Megkeresés',ajanlat_utani:'Ajánlat után',dokumentumkeres:'Dokumentumkérés',arfrissites:'Árfrissítés',latogatas:'Látogatás',muszaki_egyeztetes:'Műszaki egyeztetés',rendeles_ellenorzes:'Rendelés ellenőrzés',visszaaktivitas:'Visszaaktiválás',szallitas:'Szállítás',reklamacio:'Reklamáció',egyeb:'Egyéb'};
const PRIORITY={magas:'Magas',kozepes:'Közepes',alacsony:'Alacsony'};

export default function HqTasks({tasks=[],teamTasks=[],admin,companies=[],busy,onSave,onClose,onPostpone,setNote,setError}){
 const [lookup,setLookup]=useState(''),[note,setNoteText]=useState(''),[due,setDue]=useState(dayKey(1)),[type,setType]=useState('megkereses'),[priority,setPriority]=useState('kozepes'),[nextStep,setNextStep]=useState('');
 const [row,setRow]=useState({});
 const today=dayKey(0),open=tasks.filter(t=>t.status!=='done'&&!t.suspended).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))),closed=tasks.filter(t=>t.status==='done').slice(0,5),late=open.filter(t=>String(t.due_date)<today);
 const suspended=tasks.filter(t=>t.status!=='done'&&t.suspended);
 const state=t=>String(t.due_date)<today?'Lejárt':t.reminder_count?(t.reminder_count+'× visszakerült'):t.outcome==='sikertelen'?'Nem sikerült':'Nyitott';
 const cell=id=>row[id]||{};
 const put=(id,patch)=>setRow(r=>({...r,[id]:{...(r[id]||{}),...patch}}));
 const add=()=>{const c=companies.find(x=>x.name===lookup);if(!c){setError('Válassz pontos cégnevet a javaslatokból.');return}if(!note.trim()){setError('Írd le, miről volt szó és mi a következő lépés.');return}if(!due){setError('Add meg a határidőt, a rendszer nem talál ki dátumot.');return}setError('');setNote('');
  onSave({company_id:c.id,company:c.name,note:note.trim(),due_date:due,task_type:type,priority,next_step:nextStep.trim()});
  setLookup('');setNoteText('');setDue(dayKey(1));setNextStep('');setType('megkereses');setPriority('kozepes')};
 const fail=id=>{const c=cell(id);if(!c.date){setError('A sikertelen hívásnál válaszd ki a következő megkeresés napját.');return}setError('');onClose(tasks.find(t=>t.id===id),'sikertelen',{due_date:c.date,result:c.text||''})};
 const done=id=>{const c=cell(id);setError('');onClose(tasks.find(t=>t.id===id),'sikeres',{result:c.text||''})};
 const later=id=>{const c=cell(id);if(!c.date){setError('Az elhalasztáshoz add meg az új határidőt.');return}if(!c.text||c.text.trim().length<3){setError('Az elhalasztás indoklása kötelező.');return}setError('');onPostpone(tasks.find(t=>t.id===id),c.date,c.text.trim())};
 return <>
 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Teendőim</h2><span>{open.length} nyitott{late.length?' · '+late.length+' lejárt':''}{suspended.length?' · '+suspended.length+' felfüggesztve':''}</span></div>
  {!!late.length&&<p className="hq-hint">Lejárt teendő: {late.map(t=>t.company).join(', ')}. Nem sikerült hívásnál te választod ki a következő időpontot, a rendszer nem tolja el magától.</p>}
  <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Cég</th><th>Típus</th><th>Megbeszélés</th><th>Határidő</th><th>Állapot</th><th>Következő időpont és indoklás</th><th/></tr></thead><tbody>
  {open.map(t=><tr key={t.id}>
   <td>{t.company}{t.priority==='magas'&&<div className="text-xs font-semibold text-primary">Magas prioritás</div>}</td>
   <td>{TYPES[t.task_type||'megkereses']||'Megkeresés'}</td>
   <td className="hq-note-cell">{t.note}{t.next_step?<div className="text-xs text-muted-foreground">Következő lépés: {t.next_step}</div>:null}</td>
   <td>{t.due_date}{t.previous_due?<div className="text-xs text-muted-foreground">korábban: {t.previous_due}</div>:null}</td>
   <td>{state(t)}</td>
   <td><div className="flex flex-col gap-1"><input type="date" min={today} value={cell(t.id).date||''} disabled={busy} onChange={e=>put(t.id,{date:e.target.value})}/><input placeholder="Eredmény vagy indoklás" value={cell(t.id).text||''} maxLength={300} disabled={busy} onChange={e=>put(t.id,{text:e.target.value})}/></div></td>
   <td><div className="hq-row-actions"><button disabled={busy} onClick={()=>done(t.id)}><Check size={14}/> Sikerült</button><button disabled={busy} onClick={()=>fail(t.id)}><RotateCcw size={14}/> Nem sikerült</button><button disabled={busy} onClick={()=>later(t.id)}><AlarmClock size={14}/> Elhalasztás</button></div></td>
  </tr>)}
  </tbody></table></div>
  {!open.length&&<p className="hq-empty">Nincs nyitott teendőd. A lenti űrlapon vehetsz fel újat a mai megbeszéléseidből.</p>}
  {!!suspended.length&&<p className="hq-hint">{suspended.length} teendő felfüggesztve, mert a cég inaktív. A cég visszaaktiválásakor újra előkerülnek.</p>}
  <div className="hq-grid">
   <label className="hq-field"><span>Cég a cégtörzsből</span><input list="hq-task-companies" placeholder="Kezdd el gépelni a cég nevét…" value={lookup} onChange={e=>setLookup(e.target.value)}/><datalist id="hq-task-companies">{companies.filter(c=>!lookup||norm(c.name).includes(norm(lookup))).slice(0,100).map(c=><option key={c.id} value={c.name}/>)}</datalist></label>
   <label className="hq-field"><span>Teendő típusa</span><select value={type} onChange={e=>setType(e.target.value)}>{Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="hq-field"><span>Prioritás</span><select value={priority} onChange={e=>setPriority(e.target.value)}>{Object.entries(PRIORITY).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="hq-field"><span>Mit beszéltetek meg</span><textarea rows="2" maxLength="2000" value={note} onChange={e=>setNoteText(e.target.value)}/></label>
   <label className="hq-field"><span>Következő lépés</span><input maxLength={400} value={nextStep} onChange={e=>setNextStep(e.target.value)}/></label>
   <label className="hq-field"><span>Határidő</span><input type="date" min={today} value={due} onChange={e=>setDue(e.target.value)}/></label>
  </div>
  <div className="hq-actions"><button className="hq-btn hq-primary" disabled={busy} onClick={add}><Plus size={14}/> Teendő felvétele</button><span className="hq-hint"><CalendarClock size={12}/> A határidőt te adod meg, a rendszer nem talál ki dátumot.</span></div>
  {!!closed.length&&<div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Lezárt teendő</th><th>Eredmény</th><th>Lezárva</th></tr></thead><tbody>{closed.map(t=><tr key={t.id}><td>{t.company} · {t.note}</td><td>{t.result||(t.outcome==='sikeres'?'Sikerült':'Nem sikerült')}</td><td>{t.closed_date||''}</td></tr>)}</tbody></table></div>}
 </section>
 {admin&&<section className="hq-card"><div className="hq-sectionhead"><h2>Csapat nyitott teendői</h2><span>{teamTasks.length} nyitott</span></div><div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Kolléga</th><th>Cég</th><th>Típus</th><th>Megbeszélés</th><th>Határidő</th><th>Állapot</th></tr></thead><tbody>{teamTasks.map(t=><tr key={t.id}><td>{t.employee}</td><td>{t.company}</td><td>{TYPES[t.task_type||'megkereses']||''}</td><td className="hq-note-cell">{t.note}</td><td>{t.due_date}</td><td>{state(t)}</td></tr>)}</tbody></table></div>{!teamTasks.length&&<p className="hq-empty">Jelenleg nincs nyitott teendő a csapatban.</p>}</section>}
 </>;
}