import React,{useMemo,useState} from 'react';
import CompanyCountyCell from '@/components/CompanyCountyCell';

const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const fmt=(n,d=1)=>n==null?'–':Number(n).toLocaleString('hu-HU',{maximumFractionDigits:d});

export default function UnassignedCompanies({companies=[],canEdit,onSave}){
 const [search,setSearch]=useState('');
 const rows=useMemo(()=>companies.filter(c=>norm(c.name+' '+(c.city||'')+' '+(c.owner||'')).includes(norm(search))),[companies,search]);
 return <section className="hq-card">
  <div className="hq-sectionhead"><h2>Megye nélküli cégek</h2><span>{rows.length} megjelenítve</span></div>
  <div className="hq-controls">
   <input placeholder="Cég, város vagy felelős keresése…" value={search} onChange={e=>setSearch(e.target.value)}/>
   <span className="hq-hint">A legnagyobb forgalmú cégek elöl: itt pár kattintással a térképre kerülnek. A többi cég a Cégtörzsben állítható be.</span>
  </div>
  <div className="hq-tablewrap"><table className="hq-table"><thead><tr><th>Cég</th><th>Város</th><th>Felelős</th><th className="num">Aktivitás</th><th className="num">Forgalom, t</th><th>Utolsó kapcsolat</th><th>Megye</th></tr></thead><tbody>
  {rows.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.city||'Nincs adat'}</td><td>{c.owner||'–'}</td><td className="num">{c.activities||0}</td><td className="num">{fmt(c.order_t,2)}</td><td>{c.last?c.last+' · '+c.daysSince+' napja':'Nincs napló'}</td><td><CompanyCountyCell company={{id:c.id,county:''}} canEdit={canEdit} onSave={county=>onSave(c.id,county)}/></td></tr>)}
  </tbody></table></div>
  {!rows.length&&<p className="hq-empty">Nincs találat.</p>}
 </section>;
}