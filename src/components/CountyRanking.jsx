import React from 'react';
import {HU_COUNTIES} from '@/lib/hq-counties';
import {short} from '@/components/CountyMap';

const change=(s)=>{
 if(!s)return null;
 const last3=s.trend.slice(-3).reduce((n,t)=>n+t.order_t,0),prev3=s.trend.slice(-6,-3).reduce((n,t)=>n+t.order_t,0);
 if(!prev3)return null;
 return Math.round((last3/prev3-1)*100);
};
const LEVEL={'magas':'border-destructive text-destructive','közepes':'border-primary text-foreground','alacsony':'border-border text-muted-foreground'};

export default function CountyRanking({rows={},attention=[],selected,onSelect,metric}){
 const list=HU_COUNTIES.map(c=>({...c,stats:rows[c.name]||null,alert:attention.find(a=>a.county===c.name)||null}))
  .sort((a,b)=>((b.stats?.[metric]||0)-(a.stats?.[metric]||0)));
 return <div className="hq-tablewrap max-h-[480px] overflow-auto">
  <table className="hq-table">
   <thead><tr><th>Megye</th><th className="num">Cég</th><th className="num">Forgalom</th><th className="num">Vált.</th><th className="num">Figyelem</th></tr></thead>
   <tbody>{list.map(c=>{const ch=change(c.stats);return <tr key={c.key} className={selected===c.name?'hq-row-active':''}>
    <td><button className="hq-company-doc-link" onClick={()=>onSelect(c.name)}>{c.name}</button></td>
    <td className="num">{c.stats?c.stats.companies:0}</td>
    <td className="num">{c.stats?short(c.stats.order_t):'–'}</td>
    <td className={'num '+(ch!=null&&ch<0?'text-destructive':'')}>{ch==null?'–':(ch>0?'+':'')+ch+'%'}</td>
    <td>{c.alert?<span className={'hq-pill '+LEVEL[c.alert.level]}>{c.alert.level}</span>:(c.stats&&c.stats.companies?<span className="hq-pill">rendben</span>:'–')}</td>
   </tr>})}</tbody>
  </table>
 </div>;
}