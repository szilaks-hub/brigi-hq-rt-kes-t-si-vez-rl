import * as pako from 'pako';
/* XLSX reader: ZIP central directory + streamed row parsing. No external requests. */
async function fileHash(buffer){
 if(typeof crypto!=='undefined'&&crypto.subtle){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('')}
 const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 let input=new Uint8Array(buffer),padded=new Uint8Array(Math.ceil((input.length+9)/64)*64);padded.set(input);padded[input.length]=128;let dv=new DataView(padded.buffer);dv.setUint32(padded.length-8,Math.floor(input.length/0x20000000));dv.setUint32(padded.length-4,(input.length*8)>>>0);let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],W=new Uint32Array(64),ro=(v,n)=>(v>>>n)|(v<<(32-n));
 for(let o=0;o<padded.length;o+=64){for(let i=0;i<16;i++)W[i]=dv.getUint32(o+i*4);for(let i=16;i<64;i++){let x=W[i-15],y=W[i-2];W[i]=(W[i-16]+(ro(x,7)^ro(x,18)^(x>>>3))+W[i-7]+(ro(y,17)^ro(y,19)^(y>>>10)))>>>0}let [a,b,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){let t1=(h+(ro(e,6)^ro(e,11)^ro(e,25))+((e&f)^(~e&g))+K[i]+W[i])>>>0,t2=((ro(a,2)^ro(a,13)^ro(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}H=[a,b,c,d,e,f,g,h].map((v,i)=>(H[i]+v)>>>0)}
 return H.map(v=>v.toString(16).padStart(8,'0')).join('');
}
async function readXlsx(buffer,progress=()=>{}){
const bytes=new Uint8Array(buffer),view=new DataView(buffer),td=new TextDecoder(),entries={};
let end=bytes.length-22;while(end>=Math.max(0,bytes.length-65557)&&view.getUint32(end,true)!==0x06054b50)end--;
if(end<0)throw Error('Sérült vagy nem XLSX fájl. A régi XLS formátumot mentsd XLSX-ként.');
let pos=view.getUint32(end+16,true),count=view.getUint16(end+10,true);
for(let n=0;n<count;n++){if(view.getUint32(pos,true)!==0x02014b50)throw Error('Érvénytelen ZIP könyvtár');let len=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true);let name=td.decode(bytes.subarray(pos+46,pos+46+len));entries[name]={size:view.getUint32(pos+20,true),raw:view.getUint32(pos+24,true),offset:view.getUint32(pos+42,true),method:view.getUint16(pos+10,true)};pos+=46+len+extra+comment}
function textFile(name){let e=entries[name];if(!e)return '';if(e.raw>300*1024*1024)throw Error('A munkalap 300 MB feletti. Bontsd havi exportokra.');let p=e.offset+30+view.getUint16(e.offset+26,true)+view.getUint16(e.offset+28,true),data=bytes.subarray(p,p+e.size);if(e.method===8)return pako.inflateRaw(data,{to:'string'});if(e.method===0)return td.decode(data);throw Error('Nem támogatott XLSX tömörítés')}
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-f]+|#\d+);/gi,x=>{let a={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};return a[x]??String.fromCodePoint(parseInt(x.slice(x[2]==='x'?3:2,-1),x[2]==='x'?16:10))});
const texts=s=>[...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');
const parse=s=>new DOMParser().parseFromString(s,'application/xml');
let wb=parse(textFile('xl/workbook.xml')),rels=parse(textFile('xl/_rels/workbook.xml.rels')),relations={};
for(let el of rels.getElementsByTagName('Relationship')){let target=el.getAttribute('Target');relations[el.getAttribute('Id')]=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'')}
progress('Excel szövegek feldolgozása…');await new Promise(r=>setTimeout(r,0));
let shared=textFile('xl/sharedStrings.xml'),strings=[];for(let m of shared.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g))strings.push(texts(m[1]));shared='';
let result={};for(let el of wb.getElementsByTagName('sheet')){let name=el.getAttribute('name'),path=relations[el.getAttribute('r:id')];if(!path)continue;progress(name+' munkalap beolvasása…');await new Promise(r=>setTimeout(r,0));let xml=textFile(path),rows=[],rx=/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g,m,n=0;
 while((m=rx.exec(xml))){if(!m[2]||!/<(?:v|t)(?:>|\s)/.test(m[2]))continue;let rowNum=Number(m[1].match(/\br="(\d+)"/)?.[1])||rows.length+1;let row=[];for(let cell of m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){if(cell[2]===undefined)continue;let ref=cell[1].match(/\br="([A-Z]+)\d+"/)?.[1];if(!ref)continue;let col=0;for(let ch of ref)col=col*26+ch.charCodeAt(0)-64;let type=cell[1].match(/\bt="([^"]+)"/)?.[1],v=cell[2].match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];if(type==='e')throw Error(`${name}!${ref}${rowNum}: Excel képlethiba (${v}).`);if(v!==undefined)row[col-1]=type==='s'?strings[+v]:type==='str'?decode(v):v.trim()===''?null:Number(v);else if(type==='str'&&/<v\s*\/>/.test(cell[2]))row[col-1]='';else if(type==='inlineStr')row[col-1]=texts(cell[2]);else if(/<f[ >]/.test(cell[2]))throw Error(`${name}!${ref}${rowNum}: nincs mentett képleteredmény. Nyisd meg és mentsd az Excelt.`)}
  if(row.length)rows[rowNum-1]=row;if(++n%3000===0){progress(`${name}: ${n.toLocaleString('hu-HU')} adatsor…`);await new Promise(r=>setTimeout(r,0))}
 }
 result[name]=Array.from({length:rows.length},(_,i)=>rows[i]||[]);xml='';
}
return result;
}
function readCsv(text){text=text.replace(/^\uFEFF/,'');let first=text.split(/\r?\n/)[0],sep=first.split(';').length>=first.split(',').length?';':',';let rows=[],r=[],v='',quoted=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){v+='"';i++}else quoted=!quoted}else if(c===sep&&!quoted){r.push(v);v=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;r.push(v);rows.push(r);r=[];v=''}else v+=c}if(v||r.length){r.push(v);rows.push(r)}return rows}

export {readXlsx,readCsv};
