import React,{useState} from 'react';
import {MAP_VIEWBOX,HU_SHAPES,HU_LABEL_POS,HU_CALLOUT} from '@/lib/hu-county-shapes';

export const METRICS=[
 {k:'companies',label:'Cégek száma',unit:'cég'},
 {k:'order_t',label:'Forgalom (12 hó)',unit:'t'},
 {k:'points',label:'Pontok (12 hó)',unit:'pont'},
 {k:'neglected',label:'Figyelmet igényel',unit:'cég'}
];
export const short=n=>{const v=Math.abs(n||0);if(v>=1000000)return (n/1000000).toFixed(1).replace('.',',')+'M';if(v>=1000)return (n/1000).toFixed(v>=10000?0:1).replace('.',',')+'e';return String(Math.round(n||0))};
const value=(s,k)=>{if(!s)return 0;return k==='order_t'?s.order_t||0:k==='points'?s.points||0:k==='neglected'?s.neglected||0:s.companies||0};
const STEPS=[0.14,0.3,0.48,0.68,0.9];
const bucket=(v,max)=>{if(v<=0)return -1;const r=v/max;return r<=0.15?0:r<=0.35?1:r<=0.6?2:r<=0.85?3:4};
const VIEW=MAP_VIEWBOX.split(' ').map(Number),VW=VIEW[2],VH=VIEW[3];

export default function CountyMap({rows={},metric='companies',selected,onSelect,height}){
 const [hover,setHover]=useState('');
 const meta=METRICS.find(m=>m.k===metric)||METRICS[0];
 const max=Math.max(1,...HU_SHAPES.map(s=>value(rows[s.name],metric)));
 const labelOf=s=>{const c=HU_CALLOUT[s.name];if(c)return{cx:c.x,cy:c.y,anchor:c.anchor,outside:true};const p=HU_LABEL_POS[s.name]||[s.cx,s.cy];return{cx:p[0],cy:p[1],anchor:'middle',outside:false}};
 const hovered=HU_SHAPES.find(s=>s.name===hover);
 const hlabel=hovered?labelOf(hovered):null,hstat=hovered?rows[hovered.name]:null;
 return <div className={'relative w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-accent/50 via-background to-accent/30 '+(height?'':'aspect-[1000/627]')} style={height?{height}:undefined}>
  <svg viewBox={MAP_VIEWBOX} preserveAspectRatio="xMidYMid meet" role="img" aria-label={'Magyarország megyéi · '+meta.label} className="block h-full w-full">
   {HU_SHAPES.map(s=>{const stat=rows[s.name],v=value(stat,metric),b=bucket(v,max),active=selected===s.name,focus=hover===s.name;
    return <path key={s.key} d={s.d} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={s.name+(stat?' · '+short(v)+' '+meta.unit:' · nincs adat')}
     onMouseEnter={()=>setHover(s.name)} onMouseLeave={()=>setHover(h=>h===s.name?'':h)} onFocus={()=>setHover(s.name)} onBlur={()=>setHover(h=>h===s.name?'':h)}
     onClick={()=>onSelect&&onSelect(s.name)} onKeyDown={e=>{if(onSelect&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(s.name)}}}
     style={{fill:stat?'hsl(var(--primary))':'hsl(var(--muted))',fillOpacity:stat?STEPS[b]:0.55,stroke:active||focus?'hsl(var(--primary))':'hsl(var(--foreground))',strokeOpacity:active?1:focus?0.5:0.18,strokeWidth:active?2.6:focus?1.8:1,strokeLinejoin:'round',cursor:onSelect?'pointer':'default',transition:'fill-opacity .35s, stroke-opacity .2s'}}/>})}
   {HU_SHAPES.map(s=>{const l=labelOf(s),stat=rows[s.name],v=value(stat,metric),dim=!hover||hover===s.name;
    return <g key={s.key} className="pointer-events-none" opacity={dim?1:0.45}>
     {l.outside&&<line x1={HU_CALLOUT[s.name].from[0]} y1={HU_CALLOUT[s.name].from[1]} x2={s.cx} y2={s.cy} stroke="hsl(var(--foreground))" strokeOpacity=".45" strokeWidth=".8" strokeDasharray="3 2"/>}
     {l.outside&&<circle cx={s.cx} cy={s.cy} r="2.4" fill="hsl(var(--foreground))"/>}
     <text x={l.cx} y={l.cy-3} textAnchor={l.anchor} fill="hsl(var(--muted-foreground))" stroke="hsl(var(--card))" strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke" style={{fontSize:12.5,fontWeight:600,letterSpacing:1}}>{s.key}</text>
     <text x={l.cx} y={l.cy+16} textAnchor={l.anchor} fill="hsl(var(--foreground))" stroke="hsl(var(--card))" strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke" style={{fontSize:19,fontWeight:700}}>{stat?short(v):'–'}</text>
    </g>})}
  </svg>
  <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-border bg-card/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">{meta.label}</div>
  {!!hovered&&<div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg" style={{left:(hlabel.cx/VW*100)+'%',top:(hlabel.cy/VH*100)+'%',marginTop:'-6px'}}>
   <b className="block">{hovered.name}</b>
   <span className="text-muted-foreground">{hstat?short(value(hstat,metric))+' '+meta.unit+' · '+hstat.companies+' cég · '+short(hstat.activities)+' aktivitás':'Nincs adat'}</span>
   {!!(hstat&&hstat.neglected)&&<span className="mt-1 block font-semibold text-primary">{hstat.neglected} cég 60+ napja nem kapott kapcsolatot</span>}
   {!!(hstat&&hstat.overdue)&&<span className="mt-1 block font-semibold text-primary">{hstat.overdue} lejárt teendő</span>}
  </div>}
  <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-lg border border-border bg-card/95 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
   <span>kevesebb</span>{STEPS.map((o,i)=><span key={i} className="h-3 w-4 rounded-sm border border-border" style={{background:'hsl(var(--primary))',opacity:o}}/>)}<span>több</span>
   <span className="ml-1 h-3 w-4 rounded-sm border border-border" style={{background:'hsl(var(--muted))'}}/><span>nincs adat</span>
  </div>
 </div>;
}