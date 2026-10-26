import React,{useState} from 'react';
import {AlarmClock,Check,Plus,RotateCcw} from 'lucide-react';

const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const dayKey=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest'}).format(new Date(Date.now()+(n||0)*86400000));

export default function HqTasks({tasks=[],teamTasks=[],admin,companies=[],busy,onSave,onClose,onPostpone,setNote,setError}){
 const [lookup,setLookup]=useState(''),[note,setNoteText]=useState(''),[due,setDue]=useState('');
 const today=dayKey(0),open=tasks.filter(t=>t.status!=='done').sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))),closed=tasks.filter(t=>t.status==='done').slice(0,5),late=open.filter(t=>String(t.due_date)<today);
 const state=t=>String(t.due_date)<today?'Lejárt':t.reminder_count?(t.reminder_count+'× visszakerült'):t.outcome==='sikertelen'?'Nem sikerült':'Nyitott';
 const add=()=>{const c=companies.find(x=>x.name===lookup);if(!c){setError('Válassz pontos cégnevet a javaslatokból.');return}if(!note.trim()){setError('Írd le, miről volt szó és mi a következő lépés.');return}setError('');setNote('');onSave({company_id:c.id,company:c.name,note:note.trim(),due_date:due||dayKey(7)});setLookup('');setNoteText('');setDue('')};
 return <>
 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Teendőim</h2><span>{open.length} nyitott{late.length?' · '+late.length+' lejárt':''}</span></div>
  {!!late.length&&<p className="hq-hint">Lejárt teendő: {late.map(t=>t.company).join(', ')}. Zárd le, vagy halaszd el — ha nem sikerült, a rendszer 7 nap múlva újra előveszi.</p>}
  <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Cég</th><th>Megbeszélés és következő lépés</th><th>Határidő</th><th>Állapot</th><th/></tr></thead><tbody>
  {open.map(t=><tr key={t.id}><td>{t.company}</td><td className="hq-note-cell">{t.note}</td><td><input type="date" value={t.due_date||''} disabled={busy} onChange={e=>onPostpone(t,e.target.value)}/></td><td>{state(t)}</td><td><div className="hq-row-actions"><button disabled={busy} onClick={()=>onClose(t,'sikeres')}><Check size={14}/> Sikerült</button><button disabled={busy} onClick={()=>onClose(t,'sikertelen')}><RotateCcw size={14}/> Nem sikerült</button><button disabled={busy} onClick={()=>onPostpone(t,dayKey(7))}><AlarmClock size={14}/> +7 nap</button></div></td></tr>)}
  </tbody></table></div>
  {!open.length&&<p className="hq-empty">Nincs nyitott teendőd. A lenti űrlapon vehetsz fel újat a mai megbeszéléseidből.</p>}
  <div className="hq-grid">
   <label className="hq-field"><span>Cég a cégtörzsből</span><input list="hq-task-companies" placeholder="Kezdd el gépelni a cég nevét…" value={lookup} onChange={e=>setLookup(e.target.value)}/><datalist id="hq-task-companies">{companies.filter(c=>!lookup||norm(c.name).includes(norm(lookup))).slice(0,100).map(c=><option key={c.id} value={c.name}/>)}</datalist></label>
   <label className="hq-field"><span>Mit beszéltetek meg, mi a következő lépés</span><textarea rows="2" maxLength="2000" value={note} onChange={e=>setNoteText(e.target.value)}/></label>
   <label className="hq-field"><span>Határidő</span><input type="date" min={today} value={due} onChange={e=>setDue(e.target.value)}/></label>
  </div>
  <div className="hq-actions"><button className="hq-btn hq-primary" disabled={busy} onClick={add}><Plus size={14}/> Teendő felvétele</button><span className="hq-hint">Ha nem adsz meg dátumot, 7 nap múlva esedékes.</span></div>
  {!!closed.length&&<div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Lezárt teendő</th><th>Eredmény</th><th>Lezárva</th></tr></thead><tbody>{closed.map(t=><tr key={t.id}><td>{t.company} · {t.note}</td><td>{t.outcome==='sikeres'?'Sikerült':'Nem sikerült'}</td><td>{t.closed_date||''}</td></tr>)}</tbody></table></div>}
 </section>
 {admin&&<section className="hq-card"><div className="hq-sectionhead"><h2>Csapat nyitott teendői</h2><span>{teamTasks.length} nyitott</span></div><div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Kolléga</th><th>Cég</th><th>Megbeszélés</th><th>Határidő</th><th>Állapot</th></tr></thead><tbody>{teamTasks.map(t=><tr key={t.id}><td>{t.employee}</td><td>{t.company}</td><td className="hq-note-cell">{t.note}</td><td>{t.due_date}</td><td>{state(t)}</td></tr>)}</tbody></table></div>{!teamTasks.length&&<p className="hq-empty">Jelenleg nincs nyitott teendő a csapatban.</p>}</section>}
 </>;
}