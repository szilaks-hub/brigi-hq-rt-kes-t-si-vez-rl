import React from 'react';
import {ChevronsLeft,ChevronsRight,LogOut} from 'lucide-react';

export default function HqSidebar({groups=[],view,onGo,boot,onLogout,collapsed,onToggleCollapse}){
 return <aside className={'hq-sidebar'+(collapsed?' is-collapsed':'')}>
  <div className="hq-sidebrand">
   <img src="/brigi-logo.png" alt="BRIGI HQ"/>
   <span>ÉRTÉKESÍTÉSI VEZÉRLŐ</span>
   <small>{boot.manager?'Vezetői műszerfal':'Saját munkaterület'}</small>
   <button className="hq-sidebar-toggle" onClick={onToggleCollapse} title={collapsed?'Menü kinyitása':'Menü összecsukása'} aria-label={collapsed?'Menü kinyitása':'Menü összecsukása'}>{collapsed?<ChevronsRight size={15}/>:<ChevronsLeft size={15}/>}</button>
  </div>
  <nav aria-label="Főmenü">
   {groups.map(g=><div className="hq-navgroup" key={g.title}>
    <p>{g.title}</p>
    {g.items.map(([key,label,Icon])=><button key={key} className={view===key?'active':''} title={label} aria-current={view===key?'page':undefined} onClick={()=>onGo(key)}>{Icon?<Icon size={16}/>:null}<span>{label}</span></button>)}
   </div>)}
  </nav>
  <div className="hq-sidefoot">
   <b>{boot.employee}</b><small>{boot.manager?'Teljes kimutatás':'Saját eredmény'}</small>
   <button onClick={onLogout} title="Kilépés"><LogOut size={15}/><span>Kilépés</span></button>
  </div>
 </aside>;
}