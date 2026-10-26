import React,{useState} from 'react';
import {COUNTY_OPTIONS} from '@/lib/hq-counties';

export default function CompanyCountyCell({company,canEdit,onSave}){
 const [busy,setBusy]=useState(false);
 const current=company.county||'';
 if(!canEdit)return <span>{current||'Nincs megadva'}</span>;
 const opts=current&&!COUNTY_OPTIONS.includes(current)?[current,...COUNTY_OPTIONS]:COUNTY_OPTIONS;
 return <select value={current} disabled={busy} onChange={async e=>{const v=e.target.value;setBusy(true);try{await onSave(v)}finally{setBusy(false)}}}>
  <option value="">Nincs megadva</option>
  {opts.map(c=><option key={c} value={c}>{c}</option>)}
 </select>;
}