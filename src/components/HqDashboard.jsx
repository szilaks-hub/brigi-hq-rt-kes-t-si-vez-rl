import React,{useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {AlertTriangle,CalendarDays,ClipboardList,TrendingUp,TrendingDown,MapPin,Upload,ArrowRight} from 'lucide-react';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};
const fmt=(n,d=1)=>n==null||!Number.isFinite(Number(n))?'–':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});
const T=kg=>fmt(Number(kg||0)/1000,2)+' t';
const daysSince=d=>{if(!d)return null;return Math.round((Date.parse(new Date().toISOString().slice(0,10))-Date.parse(d))/86400000)};

export default function HqDashboard({boot,onGo,onOpenDocuments}){
 const [data,setData]=useState(null),[sug,setSug]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;api('dashboard').then(d=>{if(live)setData(d)}).catch(e=>{if(live)setError(e.message)});
  api('suggestions',{limit:5}).then(d=>{if(live)setSug(d)}).catch(()=>{});return()=>{live=false}},[]);
 const traffic=data?.traffic||null;
 const lag=traffic?daysSince(traffic.period_to):null;
 const months=(traffic?.months||[]).slice(-12);
 const maxKg=Math.max(1,...months.map(m=>Number(m.kg)||0));
 if(error)return <section className="hq-card"><p className="hq-hint">Az áttekintés nem töltődött be: {error}</p></section>;
 if(!data)return <section className="hq-card"><p className="hq-hint">Áttekintés betöltése…</p></section>;
 const a=data.activity||{},p=data.portfolio||{};
 return <>
 <section className="hq-hero"><div><span className="hq-eyebrow">ÁTTEKINTÉS · {data.today}</span><h1>Szia, {data.employee.split(' ')[0]}!</h1><p>Az elmúlt 30 nap munkája, a mai teendők és a legfrissebb forgalmi adat egy helyen. A pontok csak lezárt munkalapból számítanak.</p></div>
  <div className="hq-orbit"><b>{fmt(a.closedPoints,1)}</b><span>lezárt pont · 30 nap</span></div></section>

 <div className="hq-stats">
  <div className="hq-stat"><span>Lezárt aktivitáspont</span><strong>{fmt(a.closedPoints,1)}<small>{fmt(a.rows,0)} rögzített sor</small></strong></div>
  <div className="hq-stat"><span>Pontra vár</span><strong>{fmt(a.pending,0)}<small>sor</small></strong></div>
  <div className="hq-stat"><span>Lejárt teendő</span><strong>{fmt(a.overdue,0)}<small>db</small></strong></div>
  <div className="hq-stat"><span>Mai teendő</span><strong>{fmt(a.today,0)}<small>db</small></strong></div>
  <div className="hq-stat"><span>Következő 7 nap</span><strong>{fmt(a.week,0)}<small>teendő</small></strong></div>
 </div>

 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Mai és lejárt teendők</h2><span>{p.suspendedTasks?p.suspendedTasks+' felfüggesztve (inaktív cég)':'nincs felfüggesztett teendő'}</span></div>
  {(a.overdueItems.length||a.todayItems.length)?<div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Cég</th><th>Teendő</th><th>Határidő</th><th/></tr></thead><tbody>
   {[...a.overdueItems,...a.todayItems].slice(0,10).map(t=><tr key={t.id}><td>{t.company}</td><td className="hq-note-cell">{t.note}</td><td><span className={'hq-pill '+(t.due_date<data.today?'gold':'')}>{t.due_date}</span></td><td><Button variant="outline" onClick={()=>onGo('daily')}>Megnyitás</Button></td></tr>)}
  </tbody></table></div>:<p className="hq-empty">Ma nincs esedékes teendőd.</p>}
  <div className="hq-actions"><Button className="hq-primary" onClick={()=>onGo('daily')}><ClipboardList size={14}/> Napi jelentés</Button><Button variant="outline" onClick={()=>onGo('plan')}><CalendarDays size={14}/> Naptár és teendők</Button>{p.obligations>0&&<span className="hq-pill gold">{p.obligations} vállalt operatív teendő</span>}</div>
 </section>

 <div className="grid gap-4 lg:grid-cols-2">
  <section className="hq-card">
   <div className="hq-sectionhead"><h2>Forgalmi adat</h2><span>{traffic?(traffic.label||'aktív csomag'):'nincs jóváhagyott adat'}</span></div>
   {!traffic?<p className="hq-empty">Amíg nincs jóváhagyott VECTORY forgalmi adat, a javaslatok forgalmat nem említenek.{boot.admin?' Tölts fel exportot a VECTORY menüben.':''}</p>:<>
    <div className="hq-stats">
     <div className="hq-stat"><span>Értékesítés</span><strong>{T(traffic.kg_sales)}<small>{fmt(traffic.companies_sales,0)} cég</small></strong></div>
     <div className="hq-stat"><span>Beszerzés</span><strong>{T(traffic.kg_purchase)}<small>{fmt(traffic.rows_purchase,0)} sor</small></strong></div>
     <div className="hq-stat"><span>Adat záródátuma</span><strong>{traffic.period_to}<small>{lag!=null?lag+' napos':''}</small></strong></div>
    </div>
    {lag!=null&&lag>45&&<p className="hq-hint"><AlertTriangle size={13}/> A forgalmi adat {lag} napos. Az ennél frissebb hónapokról a rendszer nem állít semmit, tölts fel új exportot.</p>}
    <div className="mt-2 flex items-end gap-1" style={{height:70}}>{months.map(m=><div key={m.m} className="flex-1 rounded-t bg-primary/70" title={m.m+': '+T(m.kg)} style={{height:Math.max(4,(Number(m.kg)/maxKg)*64)+'px'}}/>)}</div>
    <div className="flex justify-between text-[11px] text-muted-foreground"><span>{months[0]?.m||''}</span><span>{months[months.length-1]?.m||''}</span></div>
    {!traffic.currency_confirmed&&<p className="hq-hint">A pénznem nincs megerősítve az aktív csomagnál.</p>}
    {!!traffic.movers?.up?.length&&<p className="hq-hint"><TrendingUp size={13}/> Növekvő: {traffic.movers.up.slice(0,3).map(x=>x.company+' ('+fmt(x.delta/1000,1)+' t)').join(', ')}</p>}
    {!!traffic.movers?.down?.length&&<p className="hq-hint"><TrendingDown size={13}/> Csökkenő: {traffic.movers.down.slice(0,3).map(x=>x.company+' ('+fmt(x.delta/1000,1)+' t)').join(', ')}</p>}
   </>}
  </section>

  <section className="hq-card">
   <div className="hq-sectionhead"><h2>Kit hívj fel ma?</h2><span>{sug?(sug.total+' javaslat · '+sug.scanned+' cég'):'Számolás…'}</span></div>
   {sug?.items?.length?<ul className="space-y-2">{sug.items.map(s=><li key={s.company_id+s.reason} className="rounded-lg border border-border p-2 text-xs">
    <div className="flex items-start justify-between gap-2"><b>{s.company}</b><span className="text-muted-foreground">{s.owner}</span></div>
    <p className="mt-1 font-semibold">{s.reason}</p><p className="text-muted-foreground">{s.detail}</p>
    <small className="text-muted-foreground">Forrás: {s.source}{s.traffic?' · '+T(s.traffic.kg)+' ('+s.traffic.month+')':''}</small>
   </li>)}</ul>:<p className="hq-empty">Most nincs sürgős visszahívás.</p>}
   <div className="hq-actions"><Button variant="outline" onClick={()=>onGo('daily')}>Összes javaslat <ArrowRight size={14}/></Button>{onOpenDocuments&&<Button variant="outline" onClick={()=>onOpenDocuments({})}>Dokumentumok</Button>}</div>
  </section>
 </div>

 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Portfólió</h2><span>{data.scope==='mind'?'teljes cégtörzs':'saját cégek'}</span></div>
  <div className="hq-stats">
   <div className="hq-stat"><span>Aktív cég</span><strong>{fmt(p.companies,0)}<small>db</small></strong></div>
   <div className="hq-stat"><span>Inaktív cég</span><strong>{fmt(p.inactive,0)}<small>db</small></strong></div>
   <div className="hq-stat"><span>Felelős nélkül</span><strong>{fmt(p.noOwner,0)}<small>cég</small></strong></div>
  </div>
  <div className="hq-actions">
   <Button variant="outline" onClick={()=>onGo('directory')}>Cégtörzs</Button>
   <Button variant="outline" onClick={()=>onGo('counties')}><MapPin size={14}/> Megyei térkép</Button>
   {boot.admin&&<Button variant="outline" onClick={()=>onGo('vectory')}><Upload size={14}/> VECTORY feltöltés</Button>}
   <Button variant="outline" onClick={()=>onGo(boot.manager?'trends':'results')}>Kimutatások</Button>
  </div>
 </section>
 </>;
}