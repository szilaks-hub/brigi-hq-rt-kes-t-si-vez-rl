import React,{useState} from 'react';
import {createPortal} from 'react-dom';
import {base44} from '@/api/base44Client';
import {Ban} from 'lucide-react';

const REASONS=['megszűnt','nem releváns','nem kér megkeresést','téves vagy duplikált rekord','egyéb'];
const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message)}};

export default function CompanyInactivate({company,onDone,setNote,setError}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(REASONS[0]),[text,setText]=useState(''),[busy,setBusy]=useState(false);
 const submit=async()=>{setBusy(true);try{await api('setCompanyActive',{company_id:company.id,active:false,reason,note:text});await onDone();setOpen(false);setNote(company.name+' inaktiválva. Indok: '+reason+'.')}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <>
  <button className="hq-btn hq-inactive-open" onClick={()=>setOpen(true)}><Ban size={13}/> Inaktiválás</button>
  {open&&createPortal(<div className="hq-modal-shade" onClick={()=>!busy&&setOpen(false)}>
   <div className="hq-modal" role="dialog" aria-modal="true" aria-label={'Cég inaktiválása: '+company.name} onClick={e=>e.stopPropagation()}>
    <b className="hq-modal-title">{company.name}</b>
    <p className="hq-hint">Az inaktív cég kikerül a javasolt hívásokból, a napi listákból és az automatikus emlékeztetőkből. A forgalmi előzményei a kimutatásban megmaradnak. Az indoklás és a dátum naplózva lesz, és bármikor visszaaktiválható.</p>
    <label className="hq-field"><span>Inaktiválás indoka (kötelező)</span><select value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}>{REASONS.map(r=><option key={r}>{r}</option>)}</select></label>
    <label className="hq-field"><span>Kiegészítés (opcionális)</span><input maxLength={1000} value={text} disabled={busy} placeholder="Miért nem keresendő tovább?" onChange={e=>setText(e.target.value)}/></label>
    <div className="hq-actions"><button className="hq-btn hq-primary" disabled={busy} onClick={submit}>{busy?'Mentés…':'Inaktiválás'}</button><button className="hq-btn" disabled={busy} onClick={()=>setOpen(false)}>Mégse</button></div>
   </div>
  </div>,document.body)}
 </>;
}