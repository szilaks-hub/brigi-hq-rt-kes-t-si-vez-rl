import {readXlsx,readCsv} from '@/lib/hq-xlsx';

/* VECTORY forgalmi export feldolgozó. A nyers fájl privát marad, ide csak a normalizált sorok és
   a cég szintű havi összesítés kerül. Mértékegység: kg (SZUM Súly), tonna = kg / 1000. */
export const KIND_LABEL={sales:'Értékesítés',purchase:'Beszerzés'};
const KIND_HINTS={sales:['ertekesites','eladas','sales','vevo'],purchase:['beszerzes','purchase','szallito']};
const FIELDS={
 company:['ugyf hosszu nev','ugyfel hosszu nev','ugyfeltorzs','ugyfel','cegnev','ceg','vevo','partner nev','partner','name'],
 date:['forg kelte','kelte','teljesites datuma','bizonylat datuma','szamla datuma','datum','kelt','teljesites'],
 kg:['szum','szum suly','suly kg','suly','nettosuly','nettos suly'],
 net:['forg netto ert','forg netto ertek','forgnettoert','netto ert','netto ertek','forgalmi netto'],
 qty:['forg mennyiseg','mennyiseg','darab','db','menny'],
 unitWeight:['cikk brutto kg','egysegsuly','egyseg suly','suly db'],
 orderAdmin:['forg sajat ugyintezo rendelesen','rendelesi ugyintezo','ugyintezo','rendelesiugyintezo','rendelo'],
 owner:['ugyf felelos ugyintezo','ugyf felelos','ugyfel felelos','felelos ugyintezo','felelos'],
 group:['csapat','ertekesitesi csoport','csoport','csapat'],
 status:['forg allapot','szamla allapota','szamla statusza','statusz','allapot'],
 currency:['ugyf penznem','penznem','deviza','currency'],
 city:['ugyf varos','varos','telepules'],
 product:['cikk cikknev','cikknev','termek','cikk'],
 category:['cikk cikkcsoport2','cikkcsoport','termekcsoport'], country:['ugyf orszag','orszag'],shipping:['forg szallitasi mod','szallitasi mod'],warehouse:['forg raktar','raktar'],days:['ugyf haladek','haladek'],movement:['forg mozgasnem','mozgasnem']
};
const REQUIRED=['company','date','kg'];
export const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.:()_\/\\-]+/g,' ').replace(/\s+/g,' ').trim();
const MONTHS={januar:1,februar:2,marcius:3,aprilis:4,majus:5,junius:6,julius:7,augusztus:8,szeptember:9,oktober:10,november:11,december:12,'jan':1,'febr':2,'marc':3,'apr':4,'jun':6,'jul':7,'aug':8,'szept':9,'okt':10,'nov':11,'dec':12};
const pad=n=>String(n).padStart(2,'0');
export function num(v){
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 let s=String(v).replace(/[\s\u00a0]/g,'').replace(/[^0-9.,\-]/g,'');
 if(!s||s==='-')return null;
 const lastC=s.lastIndexOf(','),lastD=s.lastIndexOf('.');
 if(lastC>-1&&lastD>-1){s=lastC>lastD?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')}
 else if(lastC>-1){s=s.replace(',','.')}
 const n=Number(s);
 return Number.isFinite(n)?n:null;
}
/* Vegyes dátumok: nap, hónap vagy csak év. Napot nem találunk ki. */
export function excelDate(v){
 if(typeof v==='number'&&v>20000&&v<90000){const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);const s=d.toISOString().slice(0,10);return{date:s,month:s.slice(0,7),precision:'day'}}
 const raw=String(v??'').trim();
 let m=raw.match(/^(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})/);
 if(m){const s=`${m[1]}-${pad(m[2])}-${pad(m[3])}`;return{date:s,month:s.slice(0,7),precision:'day'}}
 m=raw.match(/^(\d{4})[.\-\/\s](\d{1,2})[.\s]*\.?$/);
 if(m)return{date:'',month:`${m[1]}-${pad(m[2])}`,precision:'month'};
 m=raw.match(/^(\d{4})[.\s]+([a-záéíóöőúüű]+)/i);
 if(m){const key=norm(m[2]),mm=MONTHS[key]||MONTHS[key.slice(0,8)]||MONTHS[key.slice(0,3)];if(mm)return{date:'',month:`${m[1]}-${pad(mm)}`,precision:'month'}}
 m=raw.match(/^(\d{4})$/);
 if(m)return{date:'',month:'',precision:'year'};
 return{date:'',month:'',precision:'none'};
}
function headerRow(rows){
 let best={score:0,index:-1};
 for(let i=0;i<Math.min(rows.length,25);i++){const cells=(rows[i]||[]).map(norm);let score=0;for(const k of Object.keys(FIELDS))if(cells.some(c=>FIELDS[k].some(h=>c===h)))score++;if(score>best.score)best={score,index:i}}
 return best;
}
function columnMap(header){
 const cells=(header||[]).map(norm),map={},amb=[];
 for(const field of Object.keys(FIELDS)){
  const hits=[];for(let i=0;i<cells.length;i++){if(FIELDS[field].includes(cells[i]))hits.push(i)}
  if(field==='kg'){const preferred=hits.filter(i=>cells[i].includes('szum'));if(preferred.length)hits.splice(0,hits.length,...preferred)}
  if(hits.length>1)amb.push(field+': '+hits.map(i=>(header[i]||'')).join(' / '));
  if(hits.length)map[field]=hits[0];
 }
 return{map,amb};
}
export function sheetKind(name){
 const n=norm(name);
 for(const kind of Object.keys(KIND_HINTS))if(KIND_HINTS[kind].some(h=>n.includes(h)))return kind;
 return '';
}
function aggregate(rows){
 const map=new Map();let rowsTotal=0,zero=0,negative=0,processed=0,undated=0,mismatch=0;const statusMix={},samples=[];
 for(const r of rows){
  rowsTotal++;
  if(r.kg===0)zero++;
  if(r.kg<0)negative++;
  if(norm(r.status).includes('feldolgoz'))processed++;
  statusMix[r.status||'Nincs megadva']=(statusMix[r.status||'Nincs megadva']||0)+1;
  if(r.qty&&r.unitWeight&&r.kg&&Math.abs(r.qty*r.unitWeight-r.kg)>Math.max(0.02*r.kg,1)){mismatch++;if(samples.length<8)samples.push(`${r.company}: ${r.qty} × ${r.unitWeight} = ${(r.qty*r.unitWeight).toFixed(1)} kg, a SZUM Súly ${r.kg} kg (${r.date||r.month||'nincs dátum'})`)}
  if(!r.month){undated++;continue}
  let e=map.get(r.key);
  if(!e){e={company:r.company,company_key:r.key,kg:0,net:0,rows:0,first_date:'',last_date:'',months:{}};map.set(r.key,e)}
  e.kg+=r.kg;e.net+=r.net||0;e.rows++;
  if(r.date&&(!e.first_date||r.date<e.first_date))e.first_date=r.date;
  if(r.date&&(!e.last_date||r.date>e.last_date))e.last_date=r.date;
  const m=e.months[r.month]||{m:r.month,kg:0,net:0,rows:0};
  m.kg+=r.kg;m.net+=r.net||0;m.rows++;e.months[r.month]=m;
 }
 const aggregates=[...map.values()].map(e=>({company:e.company,company_key:e.company_key,kg:Math.round(e.kg*1000)/1000,net:Math.round(e.net*100)/100,rows:e.rows,first_date:e.first_date,last_date:e.last_date,months:Object.values(e.months).sort((a,b)=>a.m.localeCompare(b.m)).map(m=>({m:m.m,kg:Math.round(m.kg*1000)/1000,net:Math.round(m.net*100)/100,rows:m.rows}))}));
 return{aggregates,stats:{rows:rowsTotal,zero,negative,processed,undated,mismatch,statusMix,mismatchSample:samples,companies:aggregates.length}};
}
function normalizeSheet(rows,kind,meta){
 let issue='';
 const header=headerRow(rows);
 if(header.index<0||header.score<4)throw Error(`A(z) „${meta}” munkalap fejléce nem ismerhető fel. Ellenőrizd, hogy a VECTORY exportot változatlanul töltötted fel.`);
 const {map,amb}=columnMap(rows[header.index]);
 const missing=REQUIRED.filter(k=>map[k]===undefined);
 if(missing.length)throw Error(`A(z) „${meta}” munkalapból hiányzik: ${missing.map(k=>k==='kg'?'SZUM Súly (kg)':k==='company'?'ügyfélnév':'dátum').join(', ')}.`);
 if(amb.length)issue='Több azonos nevű oszlop: '+amb.join(' · ')+'. Az első előfordulást használtam.';
 const out=[];
 for(let i=header.index+1;i<rows.length;i++){
  const row=rows[i];if(!row||!row.length)continue;
  const company=String(row[map.company]??'').trim();
  if(!company||['osszesen','vegosszeg','total'].includes(norm(company)))continue;
  const kg=num(row[map.kg]);
  if(kg===null)continue;
  const d=excelDate(row[map.date]);
  if(!d.month)throw Error(meta+' '+(i+1)+'. sor: hiányzó vagy érvénytelen dátum.');
  const value=k=>map[k]!==undefined?String(row[map[k]]??'').trim():'';
  out.push({country:value('country'),category:value('category').split(' / ')[0]||'Egyéb / szolgáltatás',shipping:value('shipping'),warehouse:value('warehouse'),days:num(value('days')),movement:value('movement'),ref:meta+'!'+(i+1),company,key:norm(company),kg,net:map.net!==undefined?num(row[map.net]):null,date:d.date,month:d.month,precision:d.precision,status:map.status!==undefined?String(row[map.status]??'').trim():'',city:map.city!==undefined?String(row[map.city]??'').trim():'',owner:map.owner!==undefined?String(row[map.owner]??'').trim():'',orderAdmin:map.orderAdmin!==undefined?String(row[map.orderAdmin]??'').trim():'',group:map.group!==undefined?String(row[map.group]??'').trim():'',currency:map.currency!==undefined?String(row[map.currency]??'').trim():'',product:map.product!==undefined?String(row[map.product]??'').trim():'',qty:map.qty!==undefined?num(row[map.qty]):null,unitWeight:map.unitWeight!==undefined?num(row[map.unitWeight]):null});
 }
 const built=aggregate(out);
 const companyMap=new Map();for(const r of out){const c=companyMap.get(r.key)||{name:r.company,owners:[],teams:[],countries:[],types:[]};for(const [field,value] of [['owners',r.owner],['teams',r.group],['countries',r.country],['types',kind==='sales'?'vevő':'szállító']])if(value&&!c[field].includes(value))c[field].push(value);companyMap.set(r.key,c)}
 const reportRows=out.map(r=>({p:r.month,date:r.date,kg:r.kg,value:r.net,employee:r.orderAdmin,owner:r.owner,company:r.company,country:r.country||'Nincs megadva',currency:/^(ft|huf)$/i.test(r.currency)?'HUF':r.currency||'Ismeretlen',shipping:r.shipping||'Nincs megadva',product:r.product||'Nincs megadva',category:r.category,team:r.group||'Nincs megadva',days:r.days,warehouse:r.warehouse||'Nincs megadva',status:r.status||'Nincs megadva',ref:r.ref}));
 return{kind,sheet:meta,reportRows,companies:[...companyMap.values()],headers:(rows[header.index]||[]).map((x,i)=>`${i+1}: ${String(x??'').trim()}`).filter(x=>x.length>3),ambiguity:issue,...built};
}
export async function fingerprintFile(file){
 const buf=await file.arrayBuffer();
 const digest=crypto?.subtle?await crypto.subtle.digest('SHA-256',buf):null;
 return{bytes:buf,hash:digest?[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''):`${file.name}|${file.size}|${file.lastModified}`};
}
export async function parseTrafficFile(file,onProgress=()=>{}){
 if(file.size>60*1024*1024)throw Error('Legfeljebb 60 MB-os export tölthető fel. Nagyobb fájlnál bontsd havi vagy heti exportra.');
 const {bytes,hash}=await fingerprintFile(file);
 onProgress('Fájl beolvasása…');
 const sheets=/\.csv$/i.test(file.name)?{CSV:readCsv(await file.text())}:await readXlsx(bytes,onProgress);
 const parsed=[],issues=[];
 for(const [name,rows] of Object.entries(sheets)){
  const kind=sheetKind(name);
  if(!kind){issues.push(`„${name}”: a munkalap nem azonosítható értékesítési vagy beszerzési lapként.`);continue}
  if(!rows.length){issues.push(`„${name}”: üres munkalap.`);continue}
  onProgress(`„${name}” feldolgozása…`);
  parsed.push(normalizeSheet(rows,kind,name));
 }
 if(!parsed.length)throw Error(issues.join(' ')||'A fájlban nem található feldolgozható munkalap.');
 return{hash,fileName:file.name,fileSize:file.size,sheets:parsed,issues,periodFrom:parsed.map(s=>s.aggregates.map(a=>a.first_date)).flat().filter(Boolean).sort()[0]||'',periodTo:parsed.map(s=>s.aggregates.map(a=>a.last_date)).flat().filter(Boolean).sort().pop()||''};
}