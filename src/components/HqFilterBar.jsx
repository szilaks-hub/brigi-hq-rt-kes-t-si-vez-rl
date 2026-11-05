import React from 'react';
export default function HqFilterBar({fields=[],onChange,onAction}){
 if(!fields.length)return null;
 return <div className="hq-filterbar" aria-label="Kimutatások közös szűrői">{fields.map(f=><label key={f.id}>{f.label}<select value={f.value} onChange={e=>onChange(f.id,e.target.value)}>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<button className="hq-btn" onClick={()=>onAction('ytd')}>Év eddig</button><button className="hq-btn" onClick={()=>onAction('resetFilters')}>Alaphelyzet</button></div>;
}