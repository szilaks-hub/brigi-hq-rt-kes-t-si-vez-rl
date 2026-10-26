import React,{useState} from 'react';
import {COUNTY_OPTIONS} from '@/lib/hq-counties';

export default function CompanyCountyBulk({count,onSave}){
 const [county,setCounty]=useState(''),[busy,setBusy]=useState(false);
 return <div className="hq-actions">
  <select value={county} onChange={e=>setCounty(e.target.value)} aria-label="Megye"><option value="">Megye választása…</option>{COUNTY_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}</select>
  <button className="hq-btn" disabled={!county||!count||busy} onClick={async()=>{setBusy(true);try{await onSave(county);setCounty('')}finally{setBusy(false)}}}>{busy?'Mentés…':'Megye beállítása a listában látható '+count+' cégnek'}</button>
  <span className="hq-hint">A kereséssel vagy a „Csak megye nélkül" szűrővel szűkítsd előbb a listát. Egyszerre legfeljebb 500 cég.</span>
 </div>;
}