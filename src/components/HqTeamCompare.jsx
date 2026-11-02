import React,{useEffect,useMemo,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {Trophy} from 'lucide-react';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};
const fmt=(n,d=1)=>n==null?'Nincs adat':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const MONTHS=[['month','Ez a hónap'],['prev','Előző hónap'],['ytd','Ez az év'],['all','Teljes időszak']];
const METRICS=[['points','Pont'],['activities','Aktivitás'],['order_t','Rendelt tonna'],['quote_t','Ajánlati tonna'],['orders','Rendelések'],['closedDays','Lezárt munkanap']];
const range=k=>{const n=new Date(),y=n.getFullYear(),m=n.getMonth();
 if(k==='month')return[ymd(new Date(y,m,1)),ymd(new Date(y,m+1,0))];
 if(k==='prev')return[ymd(new Date(y,m-1,1)),ymd(new Date(y,m,0))];
 if(k==='ytd')return[ymd(new Date(y,0,1)),ymd(new Date(y,m+1,0))];
 return['',''];};
const Stat=({label,value,unit})=><div className="hq-stat"><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>;

export default function HqTeamCompare({boot,setError}){
 const [period,setPeriod]=useState('month'),[team,setTeam]=useState(''),[sort,setSort]=useState('points'),[data,setData]=useState(null),[loading,setLoading]=useState(true);
 const teams=useMemo(()=>[...new Set(boot.members.map(m=>m.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'hu')),[boot]);
 useEffect(()=>{let live=true;const from=range(period);setLoading(true);
  api('teamCompare',{from:from[0],to:from[1],team}).then(r=>{if(live)setData(r)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false}},[period,team]);
 const list=data?.employees||[],totals=data?.totals||{},empty=!loading&&!list.length;
 const sorted=[...list].sort((a,b)=>(Number(b[sort])||0)-(Number(a[sort])||0)||a.employee.localeCompare(b.employee,'hu'));
 const chart=list.slice(0,12).map(e=>({name:e.employee.split(' ')[0]||e.employee,points:Number(e.points)||0}));
 return <>
  <section className="hq-hero"><div><span className="hq-eyebrow">KOLLÉGA ÖSSZEHASONLÍTÓ</span><h1>Ki hogyan teljesít.</h1><p>Ugyanarra az időszakra, ugyanazokból a napi munkalapokból: aktivitás, pont és forgalom kollégánként.</p></div><div className="hq-orbit"><b>{list.length}</b><span>kolléga</span></div></section>
  <div className="hq-card hq-controls">
   <label className="hq-field"><span>Időszak</span><select value={period} onChange={e=>setPeriod(e.target.value)}>{MONTHS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   <label className="hq-field"><span>Csapat</span><select value={team} onChange={e=>setTeam(e.target.value)}><option value="">Minden csapat</option>{teams.map(t=><option key={t}>{t}</option>)}</select></label>
   <label className="hq-field"><span>Rendezés</span><select value={sort} onChange={e=>setSort(e.target.value)}>{METRICS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   <span className="hq-pill">{loading?'Számolás…':(data?.scope==='mind'?'Teljes csapat':'Saját eredmény')}</span>
  </div>
  <div className="hq-stats"><Stat label="Összes pont" value={fmt(totals.points,2)} unit="pont"/><Stat label="Egy főre jutó pont" value={fmt(totals.avgPoints,2)} unit="pont"/><Stat label="Rögzített aktivitás" value={totals.activities||0} unit="db"/><Stat label="Rendelt mennyiség" value={fmt(totals.order_t,2)} unit="t"/><Stat label="Nyitott teendő" value={totals.openTasks||0} unit="db"/></div>
  <section className="hq-card"><div className="hq-sectionhead"><h2>Pontok kollégánként</h2><span>{loading?'Betöltés…':(data?.from||'')+(data?.to?' – '+data.to:'')}</span></div><div style={{width:'100%',height:280}}>{chart.length?<ResponsiveContainer><BarChart data={chart} margin={{top:8,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="name" tick={{fontSize:11}} interval={0} angle={chart.length>8?-30:0} textAnchor={chart.length>8?'end':'middle'} height={chart.length>8?60:30}/><YAxis tick={{fontSize:11}} width={44}/><Tooltip formatter={v=>[fmt(v,2),'pont']}/><Bar dataKey="points" fill="#2b4a76" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>:<p className="hq-empty">Ebben az időszakban nincs rögzített pont.</p>}</div></section>
  <section className="hq-card"><div className="hq-sectionhead"><h2>Kollégák rangsora</h2><span>{sort==='points'?'pont szerint':'a választott mutató szerint'}</span></div>
   <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>#</th><th>Kolléga</th><th>Csapat</th><th className="num">Aktivitás</th><th className="num">Pont</th><th className="num">Rendelt, t</th><th className="num">Ajánlati, t</th><th className="num">Rendelés</th><th className="num">Lezárt nap</th><th className="num">Nyitott teendő</th></tr></thead>
    <tbody>{sorted.map((e,i)=><tr key={e.employee} className={e.employee===boot.employee?'hq-missing-row':''}><td>{i===0?<Trophy size={14}/>:i+1}</td><td><b>{e.employee}</b></td><td>{e.team||'—'}</td><td className="num">{e.activities}</td><td className="num"><b>{fmt(e.points,2)}</b></td><td className="num">{fmt(e.order_t,2)}</td><td className="num">{fmt(e.quote_t,2)}</td><td className="num">{e.orders}</td><td className="num">{e.closedDays}</td><td className="num">{e.openTasks}{e.overdue>0&&<span className="hq-missing-tag">{e.overdue} lejárt</span>}</td></tr>)}</tbody>
    <tfoot><tr><th colSpan="3">Összesen · {sorted.length} kolléga</th><td className="num">{totals.activities||0}</td><td className="num">{fmt(totals.points,2)}</td><td className="num">{fmt(totals.order_t,2)}</td><td className="num">{fmt(totals.quote_t,2)}</td><td className="num">{totals.orders||0}</td><td className="num">{totals.closedDays||0}</td><td className="num">{totals.openTasks||0}</td></tr></tfoot></table></div>
   {empty&&<p className="hq-empty">Ebben az időszakban egyik kollégának sincs rögzített aktivitása.</p>}
   {!!totals.pending&&<p className="hq-hint">{totals.pending} sorhoz a munkanapján még nem volt érvényes pontszabály, ezért ezek pont nélkül szerepelnek.</p>}
  </section></>;
}