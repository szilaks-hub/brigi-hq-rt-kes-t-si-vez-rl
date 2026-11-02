import React from 'react';
import {LayoutDashboard,Building2,ClipboardList,CalendarDays,FileSignature,TrendingUp,Award,FileText,ArrowUpToLine,LayoutGrid} from 'lucide-react';

const ICONS={overview:LayoutDashboard,directory:Building2,daily:ClipboardList,plan:CalendarDays,offers:FileSignature,reports:TrendingUp,results:Award,documents:FileText,vectory:ArrowUpToLine};

export default function HqMenuPanel({segments=[],tools=[],groups=[],view,onGo,onTool}){
 return <>
  <div className="hq-menu-grid">{segments.map(s=>{const Icon=ICONS[s.key]||LayoutGrid;return <button key={s.key} role="menuitem" className={'hq-menu-tile'+(view===s.key?' active':'')} aria-current={view===s.key?'page':undefined} onClick={()=>onGo(s.key)}><Icon size={16}/><span>{s.label}</span></button>})}</div>
  {!!tools.length&&<div className="hq-menu-grid hq-menu-tools">{tools.map(t=>{const Icon=ICONS[t.key]||FileText;return <button key={t.key} role="menuitem" className={'hq-menu-tile'+(t.prominent?' prominent':'')} title={t.hint||''} onClick={()=>onTool(t.key)}><Icon size={16}/><span>{t.label}</span></button>})}</div>}
  {groups.map(g=><div key={g.title} className="hq-navgroup"><p>{g.title}</p>{g.items.map(([k,label,Icon])=><button key={k} role="menuitem" className={view===k?'active':''} aria-current={view===k?'page':undefined} onClick={()=>onGo(k)}><Icon size={16}/><span>{label}</span></button>)}</div>)}
 </>;
}