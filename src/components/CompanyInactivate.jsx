import React,{useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Ban,AlertTriangle,Check} from 'lucide-react';

const REASONS=['megszűnt','nem releváns','nem kér megkeresést','téves vagy duplikált rekord','egyéb'];
const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};

export default function CompanyInactivate({company,onDone,setNote,setError}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(REASONS[0]),[note,setLocalNote]=useState(''),[review,setReview]=useState(''),[busy,setBusy]=useState(false),[error,setLocalError]=useState(''),[info,setInfo]=useState(null);
 const start=async()=>{setOpen(true);setLocalError('');setInfo(null);try{setInfo(await api('companyInfo',{company_id:company.id}))}catch(e){setLocalError(e.message)}};
 const submit=async()=>{setBusy(true);setLocalError('');
  try{const d=await api('setCompanyActive',{company_id:company.id,active:false,reason,note,review_date:review});
   setNote('A cég inaktív. '+(d.suspended?d.suspended+' kapcsolattartó teendő felfüggesztve.':'')+(d.obligations?.length?' '+d.obligations.length+' vállalt operatív teendő továbbra is nyitva marad.':''));
   setOpen(false);await onDone?.();
  }catch(e){setLocalError(e.message);setError?.(e.message)}finally{setBusy(false)}};
 if(!open)return <Button variant="outline" onClick={start}><Ban size={13}/> Inaktiválás</Button>;
 const tasks=info?.openTasks||[];
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" role="dialog" aria-modal="true">
  <div className="hq-card w-full max-w-lg">
   <div className="hq-sectionhead"><h2>Cég inaktiválása</h2><span>{company.name}</span></div>
   {!info&&!error?<p className="hq-hint">Nyitott tételek ellenőrzése…</p>:<>
   {!!tasks.length&&<div className="hq-import-preview"><h3>Nyitott tételek</h3><ul>{tasks.slice(0,8).map(t=><li key={t.id}>{t.note} · {t.due_date}</li>)}</ul>
    <p className="hq-hint">A kapcsolattartó teendők felfüggesztve maradnak, és a cég visszaaktiválásakor újra előkerülnek. A vállalt operatív feladatok (szállítás, reklamáció, műszaki egyeztetés) nyitva maradnak.</p></div>}
   {!tasks.length&&<p className="hq-hint">Ennek a cégnek nincs nyitott teendője.</p>}
   <div className="hq-grid">
    <label className="hq-field"><span>Indok</span><select value={reason} onChange={e=>setReason(e.target.value)}>{REASONS.map(r=><option key={r}>{r}</option>)}</select></label>
    <label className="hq-field"><span>Felülvizsgálat dátuma (nem kötelező)</span><input type="date" value={review} onChange={e=>setReview(e.target.value)}/></label>
    <label className="hq-field"><span>Megjegyzés</span><textarea rows="2" maxLength="900" value={note} onChange={e=>setLocalNote(e.target.value)}/></label>
   </div>
   <p className="hq-hint"><AlertTriangle size={13}/> Az inaktiválás nem töröl adatot: a forgalmi előzmény, a napló és a dokumentumok megmaradnak, és a döntés a naplóba kerül.</p>
   {!!error&&<p className="hq-hint">{error}</p>}
   <div className="hq-actions"><Button className="hq-primary" disabled={busy} onClick={submit}><Check size={14}/> {busy?'Mentés…':'Inaktiválás'}</Button><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Mégse</Button></div>
   </>}
  </div>
 </div>;
}