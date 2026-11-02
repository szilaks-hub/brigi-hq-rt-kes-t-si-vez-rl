import React,{useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {RotateCcw,ChevronDown,ChevronUp} from 'lucide-react';

const api=async(action,data={})=>{try{const r=await base44.functions.invoke('hq-api',{action,...data});if(r.data?.error)throw Error(r.data.error);return r.data}catch(e){throw Error(e.response?.data?.error||e.message||'A művelet nem sikerült.')}};

export default function InactiveCompanies({onChanged}){
 const [data,setData]=useState(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>{try{setData(await api('inactiveCompanies'))}catch(e){setError(e.message)}};
 useEffect(()=>{load()},[]);
 const restore=async c=>{if(!confirm('Visszaaktiválod a céget: '+c.name+'?'))return;setBusy(true);
  try{const d=await api('setCompanyActive',{company_id:c.id,active:true,reason:'Visszaaktiválás az inaktív listából'});await load();await onChanged?.();setError(d.suspended?'':'')}
  catch(e){setError(e.message)}finally{setBusy(false)}};
 return <section className="hq-card">
  <div className="hq-sectionhead"><h2>Inaktív cégek</h2><Button variant="outline" onClick={()=>setOpen(o=>!o)}>{open?<ChevronUp size={14}/>:<ChevronDown size={14}/>} {open?'Bezárás':'Megnyitás'}{data?' ('+data.total+')':''}</Button></div>
  {!open&&<p className="hq-hint">Az inaktív cégek forgalmi előzménye megmarad, de nem jelennek meg a javaslatokban.</p>}
  {open&&<>
   {!!error&&<p className="hq-hint">{error}</p>}
   {data?.scope==='saját'&&<p className="hq-hint">A saját érdekeltségű inaktív cégeidet látod. A teljes listát a vezető kezeli.</p>}
   <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Cég</th><th>Indok</th><th>Inaktív</th><th>Felülvizsgálat</th><th>Korábbi indok</th><th/></tr></thead><tbody>
    {(data?.companies||[]).map(c=><tr key={c.id}><td>{c.name}<div className="text-xs text-muted-foreground">{[c.county,c.city].filter(Boolean).join(' · ')}{c.owners?.length?' · '+c.owners.join(', '):''}</div></td>
     <td>{c.inactive_reason}<div className="text-xs text-muted-foreground">{c.inactive_by}</div></td><td>{c.inactive_at}</td><td>{c.review_date||'–'}</td>
     <td className="text-xs text-muted-foreground">{c.previous_reason?(c.previous_reason+(c.previous_at?' · '+c.previous_at:'')):'–'}</td>
     <td><Button variant="outline" disabled={busy} onClick={()=>restore(c)}><RotateCcw size={13}/> Visszaaktiválás</Button></td></tr>)}
   </tbody></table></div>
   {!data?.companies?.length&&<p className="hq-empty">Nincs inaktív cég.</p>}
  </>}
 </section>;
}