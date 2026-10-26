import React,{useMemo,useState} from 'react';
import {ComposedChart,Bar,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {AlertTriangle,PhoneCall} from 'lucide-react';
import {short} from '@/components/CountyMap';

const fmt=(n,d=1)=>n==null?'–':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});
const LEVEL={'magas':'border-destructive text-destructive','közepes':'border-primary text-foreground','alacsony':'border-border text-muted-foreground'};
const SORTS=[['order_t','Forgalom szerint'],['daysSince','Legrégebbi kapcsolat'],['points','Pontok szerint']];

export default function CountyDetail({county,stats,companies=[],attention,onPickCompany}){
 const [sort,setSort]=useState('order_t'),[onlyAttention,setOnlyAttention]=useState(false);
 const list=useMemo(()=>{
  let l=[...companies];
  if(onlyAttention)l=l.filter(c=>(c.daysSince==null||c.daysSince>=60)||c.overdue>0||c.offerOpen);
  return l.sort((a,b)=>sort==='daysSince'?((b.daysSince??9999)-(a.daysSince??9999)):(b[sort]||0)-(a[sort]||0));
 },[companies,sort,onlyAttention]);
 const owners=Object.entries(stats?.owners||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
 const trend=(stats?.trend||[]).map(t=>({...t,label:t.m.slice(5)+'.'}));
 const attentionCount=companies.filter(c=>(c.daysSince==null||c.daysSince>=60)||c.overdue>0||c.offerOpen).length;
 if(!county)return <section className="hq-card"><p className="hq-empty">Válassz megyét a térképen vagy a listából.</p></section>;
 return <>
 <section className="hq-card">
  <div className="hq-sectionhead"><h2>{county}</h2><span>{attention?<span className={'hq-pill '+LEVEL[attention.level]}>{attention.level} figyelem</span>:'rendben'}</span></div>
  {!!attention&&<ul className="hq-hint">{attention.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul>}
  <div className="hq-stats">
   <div className="hq-stat"><span>Cég a megyében</span><strong>{stats?stats.companies:0}<small>db</small></strong></div>
   <div className="hq-stat"><span>Forgalom (12 hó)</span><strong>{short(stats?.order_t)}<small>t</small></strong></div>
   <div className="hq-stat"><span>Aktivitás (12 hó)</span><strong>{stats?stats.activities:0}<small>db</small></strong></div>
   <div className="hq-stat"><span>Pont (12 hó)</span><strong>{short(stats?.points)}<small>pont</small></strong></div>
   <div className="hq-stat"><span>Utolsó kapcsolat</span><strong>{stats?.last||'nincs'}</strong></div>
   <div className="hq-stat"><span>Figyelmet igényel</span><strong>{attentionCount}<small>cég</small></strong></div>
   <div className="hq-stat"><span>Nyitott teendő</span><strong>{stats?stats.openTasks:0}<small>db</small></strong></div>
   <div className="hq-stat"><span>Lejárt teendő</span><strong>{stats?stats.overdue:0}<small>db</small></strong></div>
  </div>
 </section>
 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Forgalom alakulása</h2><span>elmúlt 12 hónap · oszlop: tonna · vonal: pont</span></div>
  <ResponsiveContainer width="100%" height={240}>
   <ComposedChart data={trend} margin={{top:8,right:8,bottom:0,left:0}}>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
    <XAxis dataKey="label" tick={{fontSize:11}} stroke="hsl(var(--muted-foreground))"/>
    <YAxis yAxisId="t" tick={{fontSize:11}} stroke="hsl(var(--muted-foreground))" width={48}/>
    <YAxis yAxisId="p" orientation="right" tick={{fontSize:11}} stroke="hsl(var(--chart-1))" width={44}/>
    <Tooltip formatter={(v,n)=>[fmt(v,n==='Forgalom'?2:0),n]} labelFormatter={l=>l}/>
    <Bar yAxisId="t" dataKey="order_t" name="Forgalom" fill="hsl(var(--primary))" radius={[3,3,0,0]}/>
    <Line yAxisId="p" dataKey="points" name="Pont" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false}/>
   </ComposedChart>
  </ResponsiveContainer>
  {!!owners.length&&<p className="hq-hint">Kik felelnek itt: {owners.map(([n,c])=>n+' ('+c+')').join(' · ')}.</p>}
 </section>
 <section className="hq-card">
  <div className="hq-sectionhead"><h2>Cégek a megyében</h2><span>{list.length} / {companies.length} cég</span></div>
  <div className="hq-controls">
   <label className="hq-field"><span>Rendezés</span><select value={sort} onChange={e=>setSort(e.target.value)}>{SORTS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyAttention} onChange={e=>setOnlyAttention(e.target.checked)}/> Csak figyelmet igénylő cégek ({attentionCount})</label>
  </div>
  <div className="hq-tablewrap">
   <table className="hq-table"><thead><tr><th>Cég</th><th>Felelős</th><th>Utolsó kapcsolat</th><th className="num">Forgalom (12 hó)</th><th className="num">Pont</th><th className="num">Teendő</th><th/></tr></thead>
    <tbody>{list.map(c=>{const needs=(c.daysSince==null||c.daysSince>=60)||c.overdue>0||c.offerOpen;return <tr key={c.id}>
     <td>{c.name}</td>
     <td>{c.owner||'–'}</td>
     <td>{c.last?(c.last+' · '+c.daysSince+' napja'):'még nem volt kapcsolat'}</td>
     <td className="num">{fmt(c.order_t,2)} t</td>
     <td className="num">{fmt(c.points,1)}</td>
     <td className="num">{c.openTasks}{c.overdue?' / '+c.overdue+' lejárt':''}</td>
     <td><div className="hq-row-actions">{needs&&<span className="hq-pill gold"><AlertTriangle size={12}/> {c.offerOpen?'nyitott ajánlat':c.overdue?'lejárt teendő':'nincs kapcsolat'}</span>}<button className="hq-btn" onClick={()=>onPickCompany({company_id:c.id,company:c.name})}><PhoneCall size={13}/> Teendő</button></div></td>
    </tr>})}</tbody></table>
  </div>
  {!list.length&&<p className="hq-empty">{onlyAttention?'Ebben a megyében most nincs figyelmet igénylő cég.':'Ebben a megyében még nincs cég.'}</p>}
 </section>
 </>;
}