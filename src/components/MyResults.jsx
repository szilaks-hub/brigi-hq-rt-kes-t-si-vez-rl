import React,{useEffect,useMemo,useState} from 'react';
import {base44} from '@/api/base44Client';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};
const fmt=(n,d=1)=>n==null?'Nincs adat':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const MONTHS=[['month','Ez a hónap'],['prev','Előző hónap'],['ytd','Ez az év'],['all','Teljes időszak']];
const range=k=>{const n=new Date(),y=n.getFullYear(),m=n.getMonth();
 if(k==='month')return[ymd(new Date(y,m,1)),ymd(new Date(y,m+1,0))];
 if(k==='prev')return[ymd(new Date(y,m-1,1)),ymd(new Date(y,m,0))];
 if(k==='ytd')return[ymd(new Date(y,0,1)),ymd(new Date(y,m+1,0))];
 return['',''];};
const Stat=({label,value,unit})=><div className="hq-stat"><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>;

export default function MyResults({boot,setError}){
 const [period,setPeriod]=useState('month'),[person,setPerson]=useState(boot.employee),[data,setData]=useState(null),[loading,setLoading]=useState(true);
 const people=useMemo(()=>[...new Set([boot.employee,...boot.members.map(m=>m.employee)])].sort((a,b)=>a.localeCompare(b,'hu')),[boot]);
 useEffect(()=>{let live=true;const from=range(period);setLoading(true);
  api('myResults',{employee:person,from:from[0],to:from[1]}).then(r=>{if(live)setData(r)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false}},[period,person]);
 const totals=data?.totals||{},byMonth=data?.byMonth||[],empty=!loading&&!byMonth.length;
 return <>
 <section className="hq-hero"><div><span className="hq-eyebrow">SAJÁT EREDMÉNY</span><h1>A pontjaid és az eredményeid.</h1><p>A napi munkalapon rögzített aktivitásaid összesítve. A pontot minden sorhoz a munkanapjára érvényes pontszabály adja.</p></div><div className="hq-orbit"><b>{fmt(totals.points,0)}</b><span>pont</span></div></section>
 <div className="hq-card hq-controls">
  <label className="hq-field"><span>Időszak</span><select value={period} onChange={e=>setPeriod(e.target.value)}>{MONTHS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
  {boot.admin&&<label className="hq-field"><span>Kolléga</span><select value={person} onChange={e=>setPerson(e.target.value)}>{people.map(p=><option key={p}>{p}</option>)}</select></label>}
  <span className="hq-pill">{loading?'Betöltés…':(data?.employee||person)+' · '+(data?.rows||0)+' aktivitás'}</span>
 </div>
 <div className="hq-stats"><Stat label="Összegyűjtött pont" value={fmt(totals.points,2)} unit="pont"/><Stat label="Rögzített aktivitás" value={data?.rows||0} unit="db"/><Stat label="Naplózott rendelés" value={fmt(totals.order_t,2)} unit="t"/><Stat label="Ajánlati mennyiség" value={fmt(totals.quote_t,2)} unit="t"/><Stat label="Kivitt hajlítás" value={fmt(totals.bend_t,2)} unit="t"/></div>
 {!!data?.pending&&<p className="hq-hint">{data.pending} sorhoz a munkanapján még nem volt érvényes pontszabály, ezért ezek pont nélkül szerepelnek az összesítésben.</p>}
 <section className="hq-card"><div className="hq-sectionhead"><h2>Havi bontás</h2><span>legfrissebb elöl</span></div><div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Hónap</th><th className="num">Aktivitás</th><th className="num">Rendelt, t</th><th className="num">Ajánlati, t</th><th className="num">Hajlítás, t</th><th className="num">Pont</th></tr></thead><tbody>{byMonth.map(m=><tr key={m.month}><td>{m.month}</td><td className="num">{m.count}</td><td className="num">{fmt(m.order_t,2)}</td><td className="num">{fmt(m.quote_t,2)}</td><td className="num">{fmt(m.bend_t,2)}</td><td className="num">{fmt(m.points,2)}</td></tr>)}</tbody></table></div>{empty&&<p className="hq-empty">Ebben az időszakban még nincs rögzített aktivitás.</p>}</section>
 <section className="hq-card"><div className="hq-sectionhead"><h2>Tevékenységek szerint</h2><span>{data?.byAction?.length||0} tevékenységtípus</span></div><div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Tevékenység</th><th className="num">Aktivitás</th><th className="num">Rendelt, t</th><th className="num">Ajánlati, t</th><th className="num">Pont</th></tr></thead><tbody>{(data?.byAction||[]).map(a=><tr key={a.action}><td>{a.action}</td><td className="num">{a.count}</td><td className="num">{fmt(a.order_t,2)}</td><td className="num">{fmt(a.quote_t,2)}</td><td className="num">{fmt(a.points,2)}</td></tr>)}</tbody></table></div>{empty&&<p className="hq-empty">Nincs mit bontani.</p>}</section>
 <section className="hq-card"><div className="hq-sectionhead"><h2>Legjobb cégek</h2><span>a pontok szerint</span></div><div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Cég</th><th className="num">Aktivitás</th><th className="num">Rendelt, t</th><th className="num">Pont</th></tr></thead><tbody>{(data?.byCompany||[]).map(c=><tr key={c.company}><td>{c.company}</td><td className="num">{c.count}</td><td className="num">{fmt(c.order_t,2)}</td><td className="num">{fmt(c.points,2)}</td></tr>)}</tbody></table></div>{empty&&<p className="hq-empty">Nincs mit bontani.</p>}</section>
 </>;
}