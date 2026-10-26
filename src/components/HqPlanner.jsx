import React,{useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {ChevronLeft,ChevronRight} from 'lucide-react';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};
const fmt=(n,d=1)=>n==null?'Nincs adat':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});
const dayKey=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest'}).format(new Date(Date.now()+(n||0)*86400000));
const WEEK=['H','K','Sze','Cs','P','Szo','V'];
const MONTHS=['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];
const monthLabel=m=>{const[y,mm]=m.split('-');return y+'. '+MONTHS[Number(mm)-1]};
const shiftMonth=(m,n)=>{const[y,mm]=m.split('-').map(Number);const d=new Date(y,mm-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};

export default function HqPlanner({onPickCompany}){
 const today=dayKey(0),[month,setMonth]=useState(today.slice(0,7)),[data,setData]=useState(null),[loading,setLoading]=useState(true),[picked,setPicked]=useState(today),[error,setError]=useState('');
 useEffect(()=>{let live=true;setLoading(true);setError('');api('plan',{month}).then(d=>{if(live)setData(d)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[month]);
 const byDate={};for(const d of data?.days||[])byDate[d.date]=d;
 const [y,m]=month.split('-').map(Number),len=new Date(y,m,0).getDate(),lead=(new Date(y,m-1,1).getDay()+6)%7;
 const cells=[...Array(lead).fill(''),...Array.from({length:len},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))];
 const sel=byDate[picked],open=data?.open||[],late=open.filter(t=>String(t.due_date)<today);
 return <>
 <section className="hq-hero"><div><span className="hq-eyebrow">NAPTÁR ÉS TEENDŐK</span><h1>A hónapod egy lapon.</h1><p>Mikor vettél fel magadnak teendőt, mit naplóztál aznap, és mi esedékes. A lejárt teendőket a rendszer naponta újra előveszi.</p></div><div className="hq-orbit"><b>{open.length}</b><span>nyitott teendő</span></div></section>
 {!!error&&<p className="hq-hint">{error}</p>}
 <section className="hq-card">
  <div className="hq-controls">
   <button className="hq-btn" onClick={()=>setMonth(shiftMonth(month,-1))}><ChevronLeft size={16}/> Előző hónap</button>
   <b>{monthLabel(month)}</b>
   <button className="hq-btn" onClick={()=>setMonth(shiftMonth(month,1))}>Következő hónap <ChevronRight size={16}/></button>
   <button className="hq-btn" onClick={()=>{setMonth(today.slice(0,7));setPicked(today)}}>Ma</button>
   <span className="hq-pill">{loading?'Betöltés…':open.length+' nyitott teendő'}</span>
   {!!late.length&&<span className="hq-pill gold">{late.length} lejárt</span>}
  </div>
  <div className="overflow-x-auto"><div className="min-w-[720px]">
   <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">{WEEK.map(w=><div key={w} className="px-2 py-1 font-semibold">{w}</div>)}</div>
   <div className="grid grid-cols-7 gap-1">
    {cells.map((k,i)=>{if(!k)return <div key={'u'+i}/>;const c=byDate[k],tasks=(c?.tasks||[]).filter(t=>t.status!=='done'),overdue=k<today&&tasks.length>0;
     return <button key={k} className={'min-h-[86px] rounded-lg border p-2 text-left text-xs transition '+(k===picked?'border-primary ring-1 ring-primary':overdue?'border-destructive':'border-border')+' '+(k===today?'bg-accent':'bg-card')} onClick={()=>setPicked(k)}>
      <span className="flex items-center justify-between"><b className="text-sm">{Number(k.slice(-2))}</b>{overdue?<span className="text-destructive">lejárt</span>:null}</span>
      {!!(c?.activities||[]).length&&<span className="mt-1 block text-muted-foreground">napló: {(c.activities).length} · {fmt(c.order_t,1)} t</span>}
      {!!tasks.length&&<span className={'mt-1 block font-semibold '+(overdue?'text-destructive':'text-primary')}>{tasks.length} teendő</span>}
      {!!c?.points&&<span className="mt-1 block text-muted-foreground">{fmt(c.points,0)} pont</span>}
     </button>})}
   </div>
  </div></div>
 </section>
 <section className="hq-card">
  <div className="hq-sectionhead"><h2>{picked} napja</h2><span>{sel?(sel.tasks||[]).length+' teendő · '+(sel.activities||[]).length+' napló':'Nincs bejegyzés'}</span></div>
  {!!(sel?.tasks||[]).length&&<div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Teendő</th><th>Cég</th><th>Állapot</th><th/></tr></thead><tbody>{sel.tasks.map(t=><tr key={t.id}><td>{t.note}</td><td>{t.company}</td><td>{t.status==='done'?'Lezárva':String(t.due_date)<today?'Lejárt':'Nyitott'}</td><td><button className="hq-btn" onClick={()=>onPickCompany({company_id:t.company_id,company:t.company})}>Új feladat ide</button></td></tr>)}</tbody></table></div>}
  {!!(sel?.activities||[]).length&&<div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Cég</th><th>Teendő</th><th className="num">Rendelt, t</th><th className="num">Ajánlati, t</th><th className="num">Pont</th><th>Megjegyzés</th></tr></thead><tbody>{sel.activities.map(a=><tr key={a.id}><td>{a.company}</td><td>{a.action}</td><td className="num">{fmt(a.order_t,2)}</td><td className="num">{fmt(a.quote_t,2)}</td><td className="num">{fmt(a.points,2)}</td><td className="hq-note-cell">{a.note}</td></tr>)}</tbody></table></div>}
  {!sel&&<p className="hq-empty">Erre a napra nincs rögzített teendő vagy napló.</p>}
 </section>
 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Nyitott teendők</h2><span>{open.length} db</span></div>
  <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Határidő</th><th>Cég</th><th>Megbeszélés</th><th>Állapot</th><th/></tr></thead><tbody>{open.map(t=><tr key={t.id}><td>{t.due_date}</td><td>{t.company}</td><td className="hq-note-cell">{t.note}</td><td>{String(t.due_date)<today?'Lejárt':t.reminder_count?t.reminder_count+'× visszakerült':'Nyitott'}</td><td><button className="hq-btn" onClick={()=>onPickCompany({company_id:t.company_id,company:t.company})}>Új feladat ide</button></td></tr>)}</tbody></table></div>
  {!open.length&&<p className="hq-empty">Nincs nyitott teendőd.</p>}
 </section>
 </>;
}