import React,{useEffect,useMemo,useState} from 'react';
import {base44} from '@/api/base44Client';
import CountyMap,{short} from '@/components/CountyMap';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};

export default function CountyOverview({canOpen,onOpen,onOpenCounty}){
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;api('countyStats').then(d=>{if(live)setData(d)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[]);
 const rows=useMemo(()=>{const o={};for(const c of data?.counties||[])o[c.county]=c;return o},[data]);
 const top=(data?.attention||[]).slice(0,3);
 if(error)return <section className="hq-card"><p className="hq-hint">A megyei adatok nem töltődtek be: {error}</p></section>;
 return <section className="hq-card">
  <div className="hq-sectionhead"><h2>Megyei lefedettség</h2><span>{data?(short(data.totals.companies)+' cég · '+short(data.totals.order_t)+' t forgalom (12 hó)'):'Betöltés…'}</span></div>
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
   <CountyMap rows={rows} metric="companies" height="420px" onSelect={c=>onOpenCounty&&onOpenCounty(c)}/>
   <div>
    <h3 className="text-sm font-semibold">Figyelmet igényel</h3>
    {!top.length&&<p className="hq-hint">{data?'Most nincs kiemelt megye.':'Betöltés…'}</p>}
    <ul className="mt-2 space-y-2">{top.map(a=><li key={a.county} className="rounded-lg border border-border p-2 text-xs">
     <button className="font-semibold" onClick={()=>onOpenCounty&&onOpenCounty(a.county)}>{a.county} ↗</button>
     <ul className="mt-1 list-disc pl-4 text-muted-foreground">{a.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul>
    </li>)}</ul>
    {!!data?.unassigned&&<p className="hq-hint">{data.unassigned} cégnek még nincs megyéje — a Cégtörzsben állítható be.</p>}
    {canOpen&&<button className="hq-btn hq-primary mt-3" onClick={onOpen}>Megyei teljesítmény megnyitása</button>}
   </div>
  </div>
 </section>;
}