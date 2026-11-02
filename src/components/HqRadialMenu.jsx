import React,{useEffect,useRef,useState} from 'react';
import HqMenuPanel from '@/components/HqMenuPanel';

export default function HqRadialMenu({segments=[],tools=[],groups=[],view,onGo,onTool}){
 const [open,setOpen]=useState(false);
 const box=useRef(null);
 useEffect(()=>{
  const key=e=>{if(e.key==='Escape')setOpen(false)};
  const away=e=>{if(open&&box.current&&!box.current.contains(e.target))setOpen(false)};
  document.addEventListener('keydown',key);
  document.addEventListener('pointerdown',away);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',away)};
 },[open]);
 const pick=k=>{setOpen(false);onGo(k)};
 const tool=k=>{setOpen(false);onTool(k)};
 return <div className="hq-radial" ref={box}>
  {open&&<div className="hq-radial-panel hq-menu-panel" role="menu" aria-label="Főmenü">
   <div className="hq-radial-panel-head"><b>BRIGI HQ · CRM</b><button className="hq-btn" onClick={()=>setOpen(false)}>Bezárás</button></div>
   <HqMenuPanel segments={segments} tools={tools} groups={groups} view={view} onGo={pick} onTool={tool}/>
  </div>}
  <button className="hq-radial-orb" aria-expanded={open} aria-haspopup="menu" aria-label={open?'Menü bezárása':'BRIGI HQ CRM menü megnyitása'} onClick={()=>setOpen(!open)}><span>BRIGI HQ</span><strong>CRM</strong><i/></button>
 </div>;
}