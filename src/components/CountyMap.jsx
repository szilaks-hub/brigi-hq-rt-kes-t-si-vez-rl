import React,{useState} from 'react';
import {HU_COUNTIES} from '@/lib/hq-counties';

export const METRICS=[
 {k:'companies',label:'Cégek száma',unit:'cég'},
 {k:'order_t',label:'Forgalom (12 hó)',unit:'t'},
 {k:'points',label:'Pontok (12 hó)',unit:'pont'},
 {k:'neglected',label:'Figyelmet igényel',unit:'cég'}
];
const SHADE=['bg-muted text-muted-foreground','bg-primary/10 text-foreground','bg-primary/25 text-foreground','bg-primary/45 text-primary-foreground','bg-primary/70 text-primary-foreground'];
export const short=n=>{const v=Math.abs(n||0);if(v>=1000000)return (n/1000000).toFixed(1).replace('.',',')+'M';if(v>=1000)return (n/1000).toFixed(v>=10000?0:1).replace('.',',')+'e';return String(Math.round(n||0))};
const metricValue=(s,k)=>{if(!s)return 0;return k==='order_t'?s.order_t||0:k==='points'?s.points||0:k==='neglected'?s.neglected||0:s.companies||0};

export default function CountyMap({rows={},metric='companies',selected,onSelect,height='440px'}){
 const [hover,setHover]=useState('');
 const unit=(METRICS.find(m=>m.k===metric)||{}).unit||'';
 const max=Math.max(1,...HU_COUNTIES.map(c=>metricValue(rows[c.name],metric)));
 const bucket=v=>v<=0?0:v/max<=0.15?1:v/max<=0.35?2:v/max<=0.6?3:4;
 const info=hover?rows[hover]:null;
 return <div className="relative w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-accent/40 to-background" style={{height}}>
  {HU_COUNTIES.map(c=>{const s=rows[c.name],v=metricValue(s,metric),b=bucket(v),active=selected===c.name,small=c.key==='BP';
   return <button key={c.key} type="button" title={`${c.name} · ${short(v)} ${unit}${s?` · ${s.companies} cég`:''}`}
    onMouseEnter={()=>setHover(c.name)} onMouseLeave={()=>setHover('')} onClick={()=>onSelect&&onSelect(c.name)}
    style={{left:c.x+'%',top:c.y+'%',width:small?'8.5%':'12.5%',height:small?'9.5%':'14%',transform:'translate(-50%,-50%)',zIndex:active?30:small?20:10}}
    className={'absolute flex flex-col items-center justify-center rounded-lg border text-center transition hover:scale-105 '+SHADE[b]+(active?' border-primary ring-2 ring-primary':' border-transparent')}>
    <span className="text-[10px] font-semibold leading-none opacity-70">{c.key}</span>
    <span className="mt-1 text-sm font-bold leading-none">{short(v)}</span>
   </button>})}
  {!!hover&&<div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow">
   <b className="block">{hover}</b><span className="text-muted-foreground">{short(metricValue(info,metric))} {unit}{info?` · ${info.companies} cég · ${info.activities} aktivitás`:''}</span>
  </div>}
  <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-lg border border-border bg-card/95 px-2 py-1 text-[11px] text-muted-foreground shadow">
   <span>kevesebb</span>{SHADE.map((s,i)=><span key={i} className={'h-3 w-4 rounded-sm border border-border '+s.split(' ')[0]}/>)}<span>több</span>
  </div>
 </div>;
}