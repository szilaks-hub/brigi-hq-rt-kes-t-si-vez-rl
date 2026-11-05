import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ClipboardList,FileText,Search,X} from 'lucide-react';

const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

export default function HqMasterSearch({boot,onStartTask,onOpenDocuments,onGo}){
 const [q,setQ]=useState(''),[open,setOpen]=useState(false),[idx,setIdx]=useState(0);
 const box=useRef(null);
 const results=useMemo(()=>{const n=norm(q);if(n.length<2)return [];
  return boot.companies.filter(c=>norm([c.name,c.county,c.city,...(c.countries||[])].filter(Boolean).join(' ')).includes(n)).slice(0,8)},[q,boot]);
 useEffect(()=>{const h=e=>{if(!box.current?.contains(e.target))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[]);
 useEffect(()=>{setIdx(0)},[q]);
 const pick=c=>{setOpen(false);setQ('');onStartTask(c)};
 const docs=c=>{setOpen(false);setQ('');onOpenDocuments({company:c.name})};
 const keys=e=>{
  if(e.key==='Escape'){setOpen(false);return}
  if(!results.length)return;
  if(e.key==='ArrowDown'){e.preventDefault();setIdx(i=>(i+1)%results.length)}
  if(e.key==='ArrowUp'){e.preventDefault();setIdx(i=>(i-1+results.length)%results.length)}
  if(e.key==='Enter'){e.preventDefault();pick(results[Math.min(idx,results.length-1)])}
 };
 return <div className="hq-master" ref={box}>
  <div className="hq-master-field">
   <Search size={16} className="hq-master-icon"/>
   <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} onKeyDown={keys}
    placeholder="Partner keresése név, megye vagy város szerint…" aria-label="Partner keresése" autoComplete="off"/>
   {q&&<button className="hq-master-clear" onClick={()=>{setQ('');setOpen(false)}} aria-label="Keresés törlése"><X size={14}/></button>}
   <span className="hq-master-hint">{boot.companies.length} cég</span>
  </div>
  <div className="hq-master-actions">
   <button className="hq-btn hq-primary" onClick={()=>onGo('daily')}><ClipboardList size={14}/> Napi jelentés</button>
   <button className="hq-btn" onClick={()=>onOpenDocuments({})}><FileText size={14}/> Dokumentumok</button>
  </div>
  {open&&q.trim().length>=2&&<div className="hq-master-results" role="listbox">
   {results.length?results.map((c,i)=><div key={c.id} className={'hq-master-hit'+(i===idx?' active':'')} onMouseEnter={()=>setIdx(i)}>
    <button className="hq-master-hit-main" onClick={()=>pick(c)} role="option" aria-selected={i===idx}>
     <b>{c.name}</b>
     <small>{[c.county,c.city,(c.countries||[]).join(', ')].filter(Boolean).join(' · ')||'Nincs megadva megye'}</small>
    </button>
    <div className="hq-master-hit-actions">
     <button title="Aktivitás rögzítése" onClick={()=>pick(c)}><ClipboardList size={14}/></button>
     <button title="Cég dokumentumai" onClick={()=>docs(c)}><FileText size={14}/></button>
    </div>
   </div>):<p className="hq-master-empty">Nincs találat. Ellenőrizd a pontos cégnevet a cégtörzsben.</p>}
  </div>}
 </div>;
}