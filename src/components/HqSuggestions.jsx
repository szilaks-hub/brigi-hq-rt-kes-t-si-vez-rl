import React,{useState} from 'react';
import {Button} from '@/components/ui/button';
import {AlarmClock,ArrowRight,ThumbsDown} from 'lucide-react';

const T=kg=>Number(kg||0).toLocaleString('hu-HU',{maximumFractionDigits:2})+' t';

export default function HqSuggestions({data,loading,onPick,onSignal,onMore,busy}){
 const items=data?.items||[],total=data?.total||0,coverage=data?.coverage;
 return <section className="hq-card">
  <div className="hq-sectionhead"><h2>Kit hívj fel ma?</h2><span>{loading?'Számolás…':(items.length+' / '+total+' javaslat · '+((data?.scanned)||0)+' cég átnézve')}</span></div>
  {!loading&&!items.length&&<p className="hq-empty">Most nincs sürgős visszahívás. Ahogy naplózod a napokat, ide kerülnek a javaslatok.</p>}
  <ul className="grid gap-2 sm:grid-cols-2">{items.map(s=><li key={s.company_id+s.reason} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
   <div className="flex items-start justify-between gap-2"><b className="text-sm">{s.company}</b><span className="text-[11px] text-muted-foreground">{s.owner}</span></div>
   <div><p className="text-xs font-semibold">{s.reason}</p><p className="mt-1 text-xs text-muted-foreground">{s.detail}</p></div>
   <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
    <span className="hq-pill">{s.source}</span>
    {s.lastContact?<span>Utolsó napló: {s.lastContact}</span>:null}
    {s.traffic?<span>VECTORY: {T(s.traffic.kg)} ({s.traffic.month}){s.traffic.pct==null?'':' · '+s.traffic.pct+'%'}</span>:null}
   </div>
   <div className="flex flex-wrap gap-2">
    <Button className="hq-btn hq-primary" disabled={busy} onClick={()=>onPick(s)}>Teendő</Button>
    <Button variant="outline" disabled={busy} onClick={()=>onSignal(s.company_id,'snooze')}><AlarmClock size={13}/> Később</Button>
    <Button variant="outline" disabled={busy} onClick={()=>onSignal(s.company_id,'mute')}><ThumbsDown size={13}/> Nem releváns</Button>
   </div>
  </li>)}</ul>
  {total>items.length&&<div className="hq-actions"><Button variant="outline" disabled={busy} onClick={onMore}>További javaslatok <ArrowRight size={14}/></Button></div>}
  {coverage&&<p className="hq-hint">{coverage.period_to?('Forgalmi összehasonlítás alapja: '+(coverage.label||'aktív csomag')+', záródátum '+coverage.period_to+(coverage.scope==='partial'?' (részleges export)':'')):'Nincs jóváhagyott VECTORY forgalmi adat, ezért a rendszer forgalmi kimaradást nem állít.'}</p>}
 </section>;
}