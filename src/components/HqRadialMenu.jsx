import React,{useEffect,useRef,useState} from 'react';
import {LayoutDashboard,Building2,ClipboardList,CalendarDays,FileSignature,TrendingUp,Award,FileText,ArrowUpToLine,LayoutGrid} from 'lucide-react';

const ICONS={overview:LayoutDashboard,directory:Building2,daily:ClipboardList,plan:CalendarDays,offers:FileSignature,reports:TrendingUp,results:Award,documents:FileText,vectory:ArrowUpToLine,more:LayoutGrid};
const ang=(i,n)=>n<2?45:90*i/(n-1);
const at=(a,r)=>({left:Math.round(Math.cos(a*Math.PI/180)*r*100)/100,bottom:Math.round(Math.sin(a*Math.PI/180)*r*100)/100});
const R_OUT=196,R_IN=118,STEP_IN=20;

export default function HqRadialMenu({segments=[],tools=[],groups=[],view,onGo,onTool}){
 const [open,setOpen]=useState(false),[more,setMore]=useState(false),[narrow,setNarrow]=useState(false);
 const box=useRef(null);
 useEffect(()=>{const fit=()=>setNarrow(window.innerWidth<820);fit();window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit)},[]);
 useEffect(()=>{
  const key=e=>{if(e.key==='Escape'){setOpen(false);setMore(false)}};
  const away=e=>{if(open&&box.current&&!box.current.contains(e.target)){setOpen(false);setMore(false)}};
  document.addEventListener('keydown',key);
  document.addEventListener('pointerdown',away);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',away)};
 },[open]);
 const hide=o=>o?{opacity:1,pointerEvents:'auto',transform:'translate(-50%,50%) scale(1)'}:{opacity:0,pointerEvents:'none',transform:'translate(-50%,50%) scale(.55)'};
 const pick=k=>{setOpen(false);setMore(false);onGo(k)};
 const tool=k=>{setOpen(false);setMore(false);onTool(k)};
 if(narrow)return <div className="hq-radial hq-radial-narrow" ref={box}>
  <button className={'hq-radial-orb-small'+(open?' on':'')} aria-expanded={open} aria-label={open?'Menü bezárása':'BRIGI HQ CRM menü megnyitása'} onClick={()=>{setOpen(!open);setMore(false)}}><span>BRIGI HQ</span><b>CRM</b><i/></button>
  {open&&<div className="hq-radial-sheet" role="menu" aria-label="Főmenü">
   <div className="hq-radial-sheet-head"><b>BRIGI HQ · CRM</b><button className="hq-btn" onClick={()=>{setOpen(false);setMore(false)}}>Bezárás</button></div>
   <div className="hq-radial-sheet-grid">{segments.map(s=>{const Icon=ICONS[s.key]||LayoutGrid;return <button key={s.key} role="menuitem" className={'hq-radial-big'+(view===s.key?' active':'')} aria-current={view===s.key?'page':undefined} onClick={()=>pick(s.key)}><Icon size={20}/><span>{s.label}</span></button>})}</div>
   <div className="hq-radial-sheet-tools">{tools.map(t=>{const Icon=ICONS[t.key]||FileText;return <button key={t.key} role="menuitem" className={'hq-radial-big'+(t.prominent?' prominent':'')} title={t.hint||''} onClick={()=>tool(t.key)}><Icon size={20}/><span>{t.label}</span></button>})}</div>
   {groups.map(g=><div key={g.title} className="hq-radial-sheet-group"><p>{g.title}</p>{g.items.map(([k,label,Icon])=><button key={k} role="menuitem" className={'hq-radial-big'+(view===k?' active':'')} aria-current={view===k?'page':undefined} onClick={()=>pick(k)}><Icon size={18}/><span>{label}</span></button>)}</div>)}
  </div>}
 </div>;
 return <div className="hq-radial" ref={box}>
  <div className="hq-radial-fan">
   {segments.map((s,i)=>{const Icon=ICONS[s.key]||LayoutGrid,p=at(ang(i,segments.length),R_OUT);return <button key={s.key} role="menuitem" className={'hq-radial-item'+(view===s.key?' active':'')} style={{left:p.left,bottom:p.bottom,...hide(open)}} aria-current={view===s.key?'page':undefined} aria-hidden={!open} tabIndex={open?0:-1} onClick={()=>pick(s.key)}><Icon size={16}/><span>{s.label}</span></button>})}
   {tools.map((t,j)=>{const Icon=ICONS[t.key]||FileText,p=at(90-STEP_IN*j,R_IN);return <button key={t.key} role="menuitem" className={'hq-radial-tool'+(t.prominent?' prominent':'')} style={{left:p.left,bottom:p.bottom,...hide(open)}} title={t.hint||''} aria-hidden={!open} tabIndex={open?0:-1} onClick={()=>tool(t.key)}><Icon size={15}/><span>{t.label}</span></button>})}
   <button role="menuitem" className="hq-radial-tool" style={{...at(90-STEP_IN*tools.length,R_IN),...hide(open)}} aria-hidden={!open} tabIndex={open?0:-1} onClick={e=>{e.stopPropagation();setMore(true);setOpen(false)}}><LayoutGrid size={15}/><span>Minden menü</span></button>
  </div>
  <button className="hq-radial-orb" aria-expanded={open} aria-haspopup="menu" aria-label={open?'Menü bezárása':'BRIGI HQ CRM menü megnyitása'} onClick={()=>{setOpen(!open);setMore(false)}}><span>BRIGI HQ</span><strong>CRM</strong><i/></button>
  {more&&<div className="hq-radial-panel" role="menu" aria-label="Minden menüpont"><div className="hq-radial-panel-head"><b>Minden menüpont</b><button className="hq-btn" onClick={()=>setMore(false)}>Bezárás</button></div>{groups.map(g=><div key={g.title} className="hq-navgroup"><p>{g.title}</p>{g.items.map(([k,label,Icon])=><button key={k} role="menuitem" className={view===k?'active':''} aria-current={view===k?'page':undefined} onClick={()=>{setMore(false);onGo(k)}}><Icon size={16}/><span>{label}</span></button>)}</div>)}</div>}
 </div>;
}