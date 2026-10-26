import React from 'react';
import {Sparkles} from 'lucide-react';

export default function CountyCoverage({coverage,unassigned,canEdit,busy,note,onAuto}){
 const total=coverage?.total||0,done=coverage?.withCounty||0,pct=total?Math.round(done/total*100):0;
 return <section className="hq-card">
  <div className="hq-sectionhead"><h2>Megyei lefedettség</h2><span>{done} / {total} cég · {pct}%</span></div>
  <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
   <i className="block h-full rounded-full bg-primary transition-all" style={{width:pct+'%'}}/>
  </div>
  <p className="hq-hint">{unassigned?unassigned+' cégnek még nincs megyéje, ezért nem jelenik meg a térképen.':'Minden aktív cég megkapja a megyéjét a térképen.'} A megye a Cégtörzsben is átállítható, vagy az Excel-importból (Megye oszlop) töltődik.</p>
  {canEdit&&<div className="hq-actions">
   <button className="hq-btn hq-primary" disabled={busy} onClick={onAuto}><Sparkles size={14}/> {busy?'Kitöltés…':'Megye kitöltése a naplók városadataiból'}</button>
   <span className="hq-hint">A korábbi napijelentés-sorok városmezőjéből pótolja a hiányzó megyéket. A kézzel beállított megyéket nem írja felül.</span>
  </div>}
  {!!note&&<p className="hq-hint">{note}</p>}
 </section>;
}