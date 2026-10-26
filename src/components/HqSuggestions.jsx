import React from 'react';

export default function HqSuggestions({items=[],loading,onPick}){
 return <section className="hq-card">
  <div className="hq-sectionhead"><h2>Kit hívj fel ma?</h2><span>{loading?'Számolás…':items.length+' javaslat'}</span></div>
  {!loading&&!items.length&&<p className="hq-empty">Most nincs sürgős visszahívás. Ahogy naplózod a napokat, ide kerülnek a javaslatok.</p>}
  <ul className="grid gap-2 sm:grid-cols-2">{items.map(s=><li key={s.company_id||s.company} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
   <div><b className="block text-sm">{s.company}</b><p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>{s.lastContact&&<small className="mt-1 block text-xs text-muted-foreground">Utolsó kapcsolat: {s.lastContact}</small>}</div>
   <button className="hq-btn hq-primary" onClick={()=>onPick(s)}>Teendő</button>
  </li>)}</ul>
 </section>;
}