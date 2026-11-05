import React,{useEffect,useMemo,useState} from 'react';
import {base44} from '@/api/base44Client';
import {ArrowRight,Trophy} from 'lucide-react';
import {Bar,ComposedChart,CartesianGrid,Line,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};
const fmt=(n,d=1)=>n==null||!Number.isFinite(Number(n))?'–':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const PERIODS=[['month','Ez a hónap'],['prev','Előző hónap'],['ytd','Ez az év'],['all','Teljes időszak']];
const range=k=>{const n=new Date(),y=n.getFullYear(),m=n.getMonth();
 if(k==='month')return[ymd(new Date(y,m,1)),ymd(new Date(y,m+1,0))];
 if(k==='prev')return[ymd(new Date(y,m-1,1)),ymd(new Date(y,m,0))];
 if(k==='ytd')return[ymd(new Date(y,0,1)),ymd(new Date(y,m+1,0))];
 return['',''];};
const monthLabel=m=>{const [y,mm]=String(m||'').split('-');return y?y+'. '+mm+'.':'–'};

export default function HqTeamReports({boot,onGo,setError}){
 const [period,setPeriod]=useState('month'),[team,setTeam]=useState(''),[data,setData]=useState(null),[loading,setLoading]=useState(true);
 const teams=useMemo(()=>[...new Set(boot.members.map(m=>m.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'hu')),[boot]);
 useEffect(()=>{let live=true;const r=range(period);setLoading(true);
  api('teamCompare',{from:r[0],to:r[1],team}).then(d=>{if(live)setData(d)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false}},[period,team]);
 const totals=data?.totals||{},ranking=(data?.employees||[]).slice(0,8),companies=data?.topCompanies||[],trend=data?.trend||[];
 const maxTons=Math.max(1,...companies.map(c=>Number(c.order_t)||0));
 const chart=trend.map(t=>({name:monthLabel(t.month),order_t:Number(t.order_t)||0,points:Number(t.points)||0}));
 return <>
 <section className="hq-card hq-controls hq-overview-controls">
  <label className="hq-field"><span>Időszak</span><select value={period} onChange={e=>setPeriod(e.target.value)}>{PERIODS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
  {teams.length>0&&<label className="hq-field"><span>Csapat</span><select value={team} onChange={e=>setTeam(e.target.value)}><option value="">Minden csapat</option>{teams.map(t=><option key={t}>{t}</option>)}</select></label>}
  <span className="hq-pill">{loading?'Számolás…':(data?.scope==='mind'?'Teljes csapat · '+(data?.to||''):'Saját eredmény')}</span>
  <div className="hq-actions"><button className="hq-btn" onClick={()=>onGo('compare')}>Kolléga összehasonlítás <ArrowRight size={13}/></button></div>
 </section>

 <div className="hq-stats">
  <div className="hq-stat"><span>Aktivitás</span><strong>{fmt(totals.activities,0)}<small>rögzített sor</small></strong></div>
  <div className="hq-stat"><span>Összegyűjtött pont</span><strong>{fmt(totals.points,1)}<small>pont</small></strong></div>
  <div className="hq-stat"><span>Rendelt mennyiség</span><strong>{fmt(totals.order_t,2)}<small>tonna</small></strong></div>
  <div className="hq-stat"><span>Rendelések</span><strong>{fmt(totals.orders,0)}<small>db</small></strong></div>
  <div className="hq-stat"><span>Nyitott teendő</span><strong>{fmt(totals.openTasks,0)}<small>{totals.overdue?totals.overdue+' lejárt':'nincs lejárt'}</small></strong></div>
 </div>

 <div className="hq-overview-grid">
  <section className="hq-card">
   <div className="hq-sectionhead"><h2>Forgalom és pontok alakulása</h2><span>havi bontás</span></div>
   <div style={{width:'100%',height:270}}>{chart.length?<ResponsiveContainer><ComposedChart data={chart} margin={{top:10,right:10,left:0,bottom:0}}>
    <CartesianGrid strokeDasharray="3 3" stroke="#dce6f3" vertical={false}/>
    <XAxis dataKey="name" tick={{fontSize:11}}/>
    <YAxis yAxisId="left" tick={{fontSize:11}} width={44}/>
    <YAxis yAxisId="right" orientation="right" tick={{fontSize:11}} width={40}/>
    <Tooltip formatter={(v,name)=>[fmt(v,2),name==='order_t'?'rendelt tonna':'pont']}/>
    <Bar yAxisId="left" dataKey="order_t" fill="#7fa8dd" radius={[5,5,0,0]} name="order_t"/>
    <Line yAxisId="right" type="monotone" dataKey="points" stroke="#e0a33a" strokeWidth={2.5} dot={{r:2.5}} name="points"/>
   </ComposedChart></ResponsiveContainer>:<p className="hq-empty">Ebben az időszakban nincs rögzített aktivitás.</p>}</div>
  </section>

  <section className="hq-card">
   <div className="hq-sectionhead"><h2>Kollégák rangsora</h2><span>pont szerint</span></div>
   {ranking.length?<ol className="hq-rank">{ranking.map((e,i)=><li key={e.employee} className={e.employee===boot.employee?'me':''}>
    <span className="hq-rank-no">{i===0?<Trophy size={13}/>:i+1}</span>
    <span className="hq-rank-name"><b>{e.employee}</b><small>{e.team||'nincs csapat'} · {fmt(e.activities,0)} aktivitás</small></span>
    <span className="hq-rank-bar"><i style={{width:Math.max(4,Math.round((Number(e.points)||0)/Math.max(1,Number(ranking[0]?.points)||1)*100))+'%'}}/></span>
    <span className="hq-rank-value">{fmt(e.points,1)}<small>pont</small></span>
   </li>)}</ol>:<p className="hq-empty">Ebben az időszakban nincs értékelhető aktivitás.</p>}
  </section>

  <section className="hq-card">
   <div className="hq-sectionhead"><h2>Legnagyobb forgalmú partnerek</h2><span>rendelt tonna</span></div>
   {companies.length?<ul className="hq-toplist">{companies.map(c=><li key={c.company}>
    <span className="hq-toplist-name"><b>{c.company}</b><small>{fmt(c.activities,0)} aktivitás · {fmt(c.points,1)} pont</small></span>
    <span className="hq-toplist-bar"><i style={{width:Math.max(4,Math.round((Number(c.order_t)||0)/maxTons*100))+'%'}}/></span>
    <span className="hq-toplist-value">{fmt(c.order_t,2)} t</span>
   </li>)}</ul>:<p className="hq-empty">Nincs rögzített rendelés ebben az időszakban.</p>}
  </section>

  <section className="hq-card">
   <div className="hq-sectionhead"><h2>Kimutatások</h2><span>egy kattintással</span></div>
   <div className="hq-quick">
    {[['overview','Vezetői összesítő'],['trends','Havi összehasonlítás'],['team','Csapat és kollégák'],['products','Termékek'],['countries','Országok'],['companies','Vevőmegtartás'],['counties','Megyei térkép'],['activity','Napló és eredmény']].map(([k,l])=>
     <button key={k} className="hq-quick-tile" onClick={()=>onGo(k)}>{l}<ArrowRight size={13}/></button>)}
   </div>
  </section>
 </div>
 </>;
}