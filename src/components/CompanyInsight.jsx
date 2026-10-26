import React from 'react';

const fmt=(n,d=1)=>n==null||n===''?'Nincs adat':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});
function Stat({label,value,unit}){return <div className="hq-stat"><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>}

export default function CompanyInsight({insight,stats}){
 if(!insight)return null;
 if(insight.loading)return <section className="hq-card"><p className="hq-empty">{insight.name} korábbi adatainak betöltése…</p></section>;
 if(insight.error)return <section className="hq-card"><p className="hq-hint">A cég korábbi adatai nem töltődtek be: {insight.error}</p></section>;
 const c=insight.company||{},open=insight.openTasks||[],recent=insight.recent||[];
 return <section className="hq-card">
  <div className="hq-sectionhead"><h2>{c.name}</h2><span>{(c.owners||[]).join(', ')}{(c.countries||[]).length?' · '+(c.countries||[]).join(', '):''}</span></div>
  <div className="hq-stats">
   <Stat label="Utolsó kapcsolat" value={insight.last||'Nincs adat'} unit={insight.daysSince!=null?insight.daysSince+' napja':''}/>
   <Stat label="Utolsó rendelés" value={insight.lastOrder?insight.lastOrder.date:'Nincs adat'} unit={insight.lastOrder?fmt(insight.lastOrder.order_t,2)+' t':''}/>
   <Stat label="Utolsó ajánlat" value={insight.lastOffer?insight.lastOffer.date:'Nincs adat'} unit={insight.lastOffer?fmt(insight.lastOffer.quote_t,2)+' t':''}/>
   <Stat label="Nyitott teendő" value={open.length} unit="db"/>
   <Stat label="Naplózott aktivitás" value={insight.count} unit="db"/>
  </div>
  {insight.offerOpen&&<p className="hq-hint">Ajánlatot adtál ({insight.lastOffer.date}), de azóta nincs rendelés — ideje visszahívni.</p>}
  {!!stats&&<div className="hq-stats"><Stat label="Legutóbbi vásárlás a kimutatásból" value={stats.lastSale||'Nincs adat'}/><Stat label="Időszaki forgalom" value={fmt(stats.now,2)} unit="t"/><Stat label="Előző időszak" value={fmt(stats.prev,2)} unit="t"/><Stat label="Változás" value={stats.change==null?'Nincs bázis':fmt(stats.change,0)+'%'}/></div>}
  {!!(stats&&(stats.reasons||[]).length)&&<ul className="hq-hint">{stats.reasons.map((r,i)=><li key={i}><b>{r.label}:</b> {r.next}</li>)}</ul>}
  {!!open.length&&<div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Nyitott teendő</th><th>Határidő</th><th>Állapot</th></tr></thead><tbody>{open.map(x=><tr key={x.id}><td>{x.note}</td><td>{x.due_date}</td><td>{x.reminder_count?x.reminder_count+'× visszakerült':'Nyitott'}</td></tr>)}</tbody></table></div>}
  {!!recent.length&&<details className="hq-hint" open><summary>Legutóbbi bejegyzések ({recent.length})</summary><ul>{recent.map(r=><li key={r.id}><b>{r.date} · {r.action}</b>{r.order_t?' · rendelt '+fmt(r.order_t,2)+' t':''}{r.quote_t?' · ajánlat '+fmt(r.quote_t,2)+' t':''}{r.note?' — '+r.note:''}</li>)}</ul></details>}
  {!insight.count&&!open.length&&<p className="hq-hint">Ehhez a céghez még nincs naplózott aktivitásod — az első bejegyzés most készül.</p>}
 </section>;
}