import React,{useState} from 'react';
import {base44} from '@/api/base44Client';
import {UserMinus,ArchiveRestore} from 'lucide-react';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message)}};

export default function InactiveCompanies({onChanged}){
 const [open,setOpen]=useState(false),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const load=async()=>{try{setError('');setData(await api('inactiveCompanies'))}catch(e){setError(e.message)}};
 const toggle=async()=>{const next=!open;setOpen(next);if(next&&!data)await load()};
 const restore=async c=>{setBusy(c.id);try{await api('setCompanyActive',{company_id:c.id,active:true});await load();if(onChanged)await onChanged()}catch(e){setError(e.message)}finally{setBusy('')}};
 return <div className="hq-inactive-list">
  <button className="hq-btn" onClick={toggle}><UserMinus size={14}/> Inaktív cégek{data?` (${data.total})`:''}</button>
  {open&&<div className="hq-inactive-body">
   {error&&<p className="hq-hint">{error}</p>}
   {!data&&!error&&<p className="hq-hint">Inaktív cégek betöltése…</p>}
   {data&&!data.total&&<p className="hq-hint">Jelenleg nincs inaktív cég.</p>}
   {data&&!!data.total&&<div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Cég</th><th>Indok</th><th>Ki inaktiválta</th><th>Mikor</th><th/></tr></thead><tbody>{data.companies.map(c=><tr key={c.id}><td>{c.name}</td><td className="hq-note-cell">{c.inactive_reason||'Nincs megadva'}</td><td>{c.inactive_by||'Nincs adat'}</td><td>{c.inactive_at||'Nincs adat'}</td><td><button className="hq-btn" disabled={busy===c.id} onClick={()=>restore(c)}><ArchiveRestore size={13}/> {busy===c.id?'Mentés…':'Visszaaktiválás'}</button></td></tr>)}</tbody></table></div>}
   {data&&data.total>data.companies.length&&<p className="hq-hint">A legutóbb inaktivált {data.companies.length} cég látható a {data.total} inaktív cégből.</p>}
  </div>}
 </div>;
}