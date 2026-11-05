import React,{useEffect,useState} from 'react';
import {ChevronDown,LogOut,X} from 'lucide-react';

export default function HqSidebar({sections=[],view,onGo,onLogout,boot,open,onClose}){
 const activeSection=sections.find(s=>s.items.some(([k])=>k===view))?.key||sections[0]?.key;
 const [expanded,setExpanded]=useState([]);
 useEffect(()=>{if(activeSection)setExpanded([activeSection])},[activeSection]);
 const toggle=k=>setExpanded(e=>e.includes(k)?[]:[k]);
 const go=k=>{onGo(k);onClose?.()};
 return <>
  {open&&<div className="hq-side-scrim" onClick={onClose}/>}
  <aside className={'hq-side'+(open?' open':'')} aria-label="Főmenü">
   <div className="hq-side-brand">
    <img src="https://media.base44.com/images/public/6ad9a93f34c02a6be8e504f1/42e6f23c2_image_8_.png" alt="BRIGI HQ" className="hq-side-logo"/>
    <div><b>BRIGI HQ</b><span>Értékesítési vezérlő</span></div>
    <button className="hq-side-close" onClick={onClose} aria-label="Menü bezárása"><X size={16}/></button>
   </div>
   <nav className="hq-side-nav">
    {sections.map(s=>{const Icon=s.icon,single=s.items.length===1,isOpen=expanded.includes(s.key),isActive=activeSection===s.key;
     return <div key={s.key} className={'hq-side-group'+(isActive?' active':'')}>
      <button className="hq-side-head" onClick={()=>single?go(s.items[0][0]):toggle(s.key)} aria-expanded={single?undefined:isOpen}>
       <Icon size={16}/><span>{s.title}</span>{!single&&<ChevronDown size={14} className={isOpen?'rot':''}/>}
      </button>
      {!single&&isOpen&&<div className="hq-side-items">{s.items.map(([k,label,ItemIcon])=>
       <button key={k} className={'hq-side-item'+(view===k?' active':'')} onClick={()=>go(k)} aria-current={view===k?'page':undefined}>
        {ItemIcon&&<ItemIcon size={14}/>}<span>{label}</span>
       </button>)}</div>}
     </div>})}
   </nav>
   <div className="hq-side-foot">
    <b>{boot.employee}</b>
    <span>{boot.admin?'Adminisztrátor':boot.manager?'Vezető':'Értékesítő'}</span>
    <button className="hq-side-logout" onClick={onLogout}><LogOut size={13}/> Kilépés</button>
   </div>
  </aside>
 </>;
}