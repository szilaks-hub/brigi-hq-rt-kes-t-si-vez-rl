// Megyék sematikus térképhez: x, y a vászon százalékában (nyugat->kelet, észak->dél).
export const HU_COUNTIES=[
 {key:'GS',name:'Győr-Moson-Sopron',x:16,y:30},
 {key:'VA',name:'Vas',x:6,y:50},
 {key:'ZA',name:'Zala',x:9,y:66},
 {key:'VE',name:'Veszprém',x:23,y:53},
 {key:'KE',name:'Komárom-Esztergom',x:32,y:34},
 {key:'FE',name:'Fejér',x:35,y:54},
 {key:'TO',name:'Tolna',x:35,y:73},
 {key:'SO',name:'Somogy',x:24,y:76},
 {key:'BA',name:'Baranya',x:31,y:92},
 {key:'NO',name:'Nógrád',x:50,y:21},
 {key:'HE',name:'Heves',x:60,y:29},
 {key:'BZ',name:'Borsod-Abaúj-Zemplén',x:69,y:10},
 {key:'SZ',name:'Szabolcs-Szatmár-Bereg',x:87,y:21},
 {key:'PE',name:'Pest',x:47,y:42},
 {key:'BP',name:'Budapest',x:41,y:33},
 {key:'JN',name:'Jász-Nagykun-Szolnok',x:62,y:48},
 {key:'HB',name:'Hajdú-Bihar',x:79,y:41},
 {key:'BE',name:'Békés',x:73,y:64},
 {key:'CS',name:'Csongrád-Csanád',x:60,y:78},
 {key:'BK',name:'Bács-Kiskun',x:48,y:69}
];
export const COUNTY_OPTIONS=[...HU_COUNTIES.map(c=>c.name),'Külföld'];
export const HU_COUNTY_NAMES=HU_COUNTIES.map(c=>c.name);