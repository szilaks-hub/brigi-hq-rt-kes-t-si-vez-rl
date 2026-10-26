import React,{useEffect,useMemo,useState} from 'react';
import {base44} from '@/api/base44Client';
import CountyMap,{METRICS,short} from '@/components/CountyMap';
import CountyRanking from '@/components/CountyRanking';
import CountyDetail from '@/components/CountyDetail';
import CountyCoverage from '@/components/CountyCoverage';
import UnassignedCompanies from '@/components/UnassignedCompanies';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};

export default function HqCounties({focus,onPickCompany,boot,onRefresh}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[metric,setMetric]=useState('companies'),[sel,setSel]=useState(focus||''),[autoBusy,setAutoBusy]=useState(false),[autoNote,setAutoNote]=useState('');
 const canEdit=!!(boot?.admin||boot?.manager);
 const load=()=>{setLoading(true);setError('');return api('countyStats').then(d=>{setData(d);setSel(s=>s||(d.attention[0]?.county||''))}).catch(e=>setError(e.message)).finally(()=>setLoading(false))};
 useEffect(()=>{load()},[]);
 const autoCounty=async()=>{setAutoBusy(true);setAutoNote('');try{const r=await api('autoCounty');setAutoNote(r.updated+' cég kapott megyét a városadatokból'+(r.noCity?' · '+r.noCity+' céghez nincs városadat a korábbi naplókban':'')+(r.unknownCity?' · '+r.unknownCity+' város nem azonosítható':'')+'.');await load();await onRefresh?.()}catch(e){setError(e.message)}finally{setAutoBusy(false)}};
 const saveCounty=async(id,county)=>{setError('');try{await api('saveCompanyCounty',{company_ids:[id],county});setAutoNote(county?'Megye beállítva: '+county+'.':'A megye törölve.');await load();await onRefresh?.()}catch(e){setError(e.message)}};
 const rows=useMemo(()=>{const o={};for(const c of data?.counties||[])o[c.county]=c;return o},[data]);
 const [detail,setDetail]=useState({county:'',companies:[],loading:false});
 useEffect(()=>{if(!sel)return;let live=true;setDetail({county:sel,companies:[],loading:true});api('countyStats',{county:sel}).then(d=>{if(live)setDetail({county:sel,companies:d.companies||[],loading:false})}).catch(()=>{if(live)setDetail({county:sel,companies:[],loading:false})});return()=>{live=false}},[sel]);
 const selStats=rows[sel]||null;
 const selCompanies=detail.county===sel?detail.companies:[];
 const selAttention=(data?.attention||[]).find(a=>a.county===sel)||null;
 const top=(data?.attention||[])[0]||null;
 return <>
 <section className="hq-hero"><div><span className="hq-eyebrow">MEGYEI TELJESÍTMÉNY</span><h1>Hol van szükség támogatásra?</h1><p>Megyénkénti céglefedettség, forgalom és aktivitás. Válassz megyét a térképen vagy a listából: látszik, hol szakadt meg a kapcsolat és hova kell erősítést küldeni.</p></div><div className="hq-orbit"><b>{data?short(data.totals.companies):'–'}</b><span>cég {data?data.counties.length+' megyében':''}</span></div></section>
 {!!error&&<p className="hq-hint">{error}</p>}
 <CountyCoverage coverage={data?.coverage} unassigned={data?.unassigned||0} canEdit={canEdit} busy={autoBusy} note={autoNote} onAuto={autoCounty}/>
 {!!data?.unassignedCompanies?.length&&<UnassignedCompanies companies={data.unassignedCompanies} canEdit={canEdit} onSave={saveCounty}/>}
 <section className="hq-card">
  <div className="hq-controls">
   <span className="hq-pill">{loading?'Betöltés…':(data.totals.companies+' cég · '+short(data.totals.order_t)+' t forgalom · '+short(data.totals.points)+' pont')}</span>
   {METRICS.map(m=><button key={m.k} className={'hq-btn'+(metric===m.k?' hq-primary':'')} onClick={()=>setMetric(m.k)}>{m.label}</button>)}
   {!!data?.unassigned&&<span className="hq-pill gold">{data.unassigned} cég megye nélkül</span>}
   {!!data?.foreign&&<span className="hq-pill">{data.foreign} külföldi cég</span>}
  </div>
  {!!top&&<p className="hq-hint">Leginkább a <b>{top.county}</b> megyére kell figyelni: {top.reasons.join(' · ')}.</p>}
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
   <CountyMap rows={rows} metric={metric} selected={sel} onSelect={setSel} height="480px"/>
   <CountyRanking rows={rows} attention={data?.attention||[]} selected={sel} onSelect={setSel} metric={metric}/>
  </div>
  </section>
 <CountyDetail county={sel} stats={selStats} companies={selCompanies} loading={detail.loading} attention={selAttention} onPickCompany={onPickCompany}/>
 </>;
}