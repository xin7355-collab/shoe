#!/usr/bin/env node
/* 丈量大師 離線自我測試：從 index.html 抽出 @@PURE 區塊（家具庫、範本、構想解析、用電估算、整層平面、DAE 寫出、DXF 匯入、裝修工項）單獨驗證。
 * 用法：node tests/selftest.js　（不需網路、不需安裝套件） */
'use strict';
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=html.match(/\/\*@@PURE-START[\s\S]*?\*\/([\s\S]*?)\/\*@@PURE-END\*\//);
if(!m){console.error('✗ 找不到 @@PURE 區塊');process.exit(1)}
const {ROOM:R,RENDER:RD,FLOOR:FL,DAE,CADIN,WORK:WK}=new Function(m[1]+'\nreturn {ROOM,RENDER,FLOOR,DAE,CADIN,WORK};')();
let fail=0,pass=0;
const ok=(c,msg)=>{if(c)pass++;else{fail++;console.error('✗ '+msg)}};
const near=(a,b,t)=>Math.abs(a-b)<=(t||0.01);

// 家具庫
const keys=new Set();for(const c of R.C){ok(!keys.has(c.k),'家具代號重複：'+c.k);keys.add(c.k);
  ok(c.w>0&&c.d>0,'尺寸需 >0：'+c.k);ok(R.CATS.includes(c.c),'類別不存在：'+c.k)}
ok(R.search('冷氣').length>=2,'搜尋「冷氣」要找到 2.8/5.0kW');
ok(R.search('','浴室').every(c=>c.c==='浴室'),'類別篩選');
ok(R.search('插座 防水').length===1,'多關鍵字 AND 搜尋');

// 用電：單一設備
let e=R.elec([{k:'ih'}]);let c=e.circuits[0];
ok(e.circuits.length===1&&c.v===220&&c.kind==='ded','IH 爐走 220V 專用迴路');
ok(near(c.I,3500/220,0.01)&&c.nfb===20&&c.wire==='2.0mm','IH 3500W：15.9A→×1.25=19.9A→NFB 20A、2.0mm');
ok(c.elcb,'廚房設備要漏電斷路器');
e=R.elec([{k:'wh'}]);ok(e.circuits[0].nfb===30&&e.circuits[0].wire==='5.5mm²','熱水器 4kW：18.2A→22.7A→NFB 30A、5.5mm²');
e=R.elec([{k:'ac'}]);ok(e.circuits[0].nfb===15,'2.8kW 冷氣耗電約 1kW：5.1A→NFB 15A');
// 一般插座分組：10 個 180W → 8 個上限 → 2 迴路
e=R.elec(Array.from({length:10},()=>({k:'out'})));ok(e.circuits.length===2&&e.circuits[0].items.length===8,'一般插座每迴路最多 8 個');
ok(e.circuits.every(x=>!x.elcb),'乾燥區插座不需 ELCB');
e=R.elec([{k:'out'},{k:'outW'}]);ok(e.circuits.length===2&&e.circuits.some(x=>x.elcb),'潮濕插座獨立分組並標 ELCB');
// 使用者指定迴路、覆寫瓦數
e=R.elec([{k:'out',circ:'A',watt:500},{k:'out',circ:'A',watt:500}]);ok(e.circuits.length===1&&e.circuits[0].W===1000,'手動指定同一迴路合併');
e=R.elec([{k:'out',watt:0}]);ok(e.circuits.length===0,'0W 不列入');
// 主開關與匯流排
e=R.elec(R.make('eoc').objs);ok(e.mainNfb>=30&&e.bus>=e.mainNfb,'匯流排額定 ≥ 主開關');
ok(e.dmdVA<=e.totVA+1e-6,'需量 ≤ 總量');
e=R.elec([{k:'wh'},{k:'oven'},{k:'ih'},{k:'dryer'},{k:'dish'},{k:'heatfan'},{k:'ac2'},{k:'ac2'},{k:'ac2'},{k:'wh'},{k:'wh'},{k:'wh'}]);
ok(e.notes.some(n=>n.includes('契約容量')),'主幹超過 100A 要提醒台電契約容量');

// 範本：每個物件中心都在房間內（門窗可在牆線上）
for(const t of R.TPL){const r=R.make(t.id);ok(r.W>=1200&&r.D>=1200,'房間尺寸：'+t.id);
  for(const o of r.objs){ok(R.byK[o.k],`範本 ${t.id} 用了不存在的家具 ${o.k}`);
    ok(o.x>=0&&o.x<=r.W&&o.y>=0&&o.y<=r.D,`範本 ${t.id} 的 ${o.k} 在房間外 (${o.x},${o.y})`)}}
const ids=new Set();for(const o of R.make('office').objs){ok(!ids.has(o.id),'物件 id 重複');ids.add(o.id)}

// 構想解析
let q=R.fromIdea('8人會議室 5x4米');ok(q.tpl==='meet'&&q.W===5000&&q.D===4000,'8人會議室 5x4米');
ok(q.objs.filter(o=>o.k==='mchair').length===8,'會議室 8 張椅');
q=R.fromIdea('中島廚房 4.5米乘4.2米');ok(q.tpl==='kitI'&&q.W===4500&&q.D===4200,'中島廚房 4.5米乘4.2米');
q=R.fromIdea('緊急應變中心 十二人');ok(q.tpl==='eoc'&&q.objs.filter(o=>o.k==='eocdesk').length===12,'應變中心 十二人 → 12 席');
q=R.fromIdea('開放式辦公室 20坪 16人');ok(q.tpl==='office'&&q.objs.filter(o=>o.k==='desk').length===16,'辦公室 16 人');
ok(R.parseIdea('20坪').W>0&&near(R.parseIdea('20坪').W*R.parseIdea('20坪').D/1e6,66.1,0.5),'20 坪 ≈ 66 m²');
q=R.fromIdea('乾濕分離浴室 長240 寬180公分');ok(q.tpl==='bath'&&q.W===2400,'浴室 長240 公分');
ok(R.parseIdea('L型廚房').tpl==='kitL'&&R.parseIdea('有浴缸的浴室').tpl==='bath2','L型廚房／浴缸');
ok(R.cnNum('二十')===20&&R.cnNum('十五')===15&&R.cnNum('八')===8,'中文數字');
ok(R.parseIdea('隨便').tpl==='blank','無法判斷時用空白房間');
for(const t of R.PROJ)for(const [ty,,pp] of t.items){ok(['slide','fixed','casement','louver','door','canopy','shaped','room','work'].includes(ty),'整案範本類型：'+ty);
  if(ty==='work'){const f=WK.find(pp.name);ok(f&&f.unit===pp.unit&&f.cat===pp.cat,`整案範本的工項在工項庫裡、類別與單位一致：${pp.name}`)}}
/* 裝修工項：工項庫完整、單位換算、尺寸優先、金額取整、匯入清理 */
{const names=new Set();let bad=0;for(const [c,l] of WK.LIB){ok(c&&l.length>0,'工項類別有內容：'+c);for(const [n,u] of l){if(!n||!WK.UM[u]||names.has(n))bad++;names.add(n)}}
  ok(!bad&&names.size>=70,`工項庫 ${names.size} 項：品名不重複、單位都在單位表裡`);ok(WK.CATS[WK.CATS.length-1]==='其他','類別最後是「其他」');
  const q=o=>WK.qty({unit:'式',a:0,b:0,n:0,...o});
  ok(q({unit:'坪',a:3305.8,b:1000})===1,'坪：330.58 × 100 公分＝1 坪');ok(q({unit:'m²',a:2500,b:2000})===5,'m²：2.5 × 2 公尺＝5 m²');
  ok(q({unit:'才',a:303,b:303})===1&&q({unit:'才',a:1800,b:1200})===23.53,'才：30.3 × 30.3 公分＝1 才（台尺見方）；180 × 120 公分＝23.53 才（跟門窗算法一樣）');ok(q({unit:'尺',a:2424.24})===8,'尺：242.4 公分＝8 台尺');ok(q({unit:'m',a:3500})===3.5,'m：350 公分＝3.5 m');
  ok(q({unit:'坪',a:3000,n:7.5})===7.5&&!WK.auto({unit:'坪',a:3000,b:0}),'坪只填一邊：不算尺寸，用手填的數量');
  ok(q({unit:'坪',a:3000,b:3000,n:99})===2.72,'坪兩邊都填：用尺寸算（取 2 位小數），忽略手填數量');ok(q({unit:'口',a:9999,b:9999,n:6})===6,'個數類單位不看尺寸');
  ok(WK.amount({unit:'坪',a:3000,b:3000,price:2800})===7616&&WK.amount({unit:'式',n:1,price:0})===0,'金額＝數量（2 位小數）× 單價，四捨五入到元');
  ok(q({unit:'式',n:-3})===0&&WK.amount({unit:'式',n:2,price:-50})===0,'負的數量、單價當 0');
  const c=WK.clean({cat:'<b>很長很長很長很長的類別</b>',name:'x'.repeat(99),spec:'y'.repeat(999),unit:'公斤',a:-5,b:'abc',n:1e9,price:'1e12',evil:'<img src=x>'});
  ok(c.cat.length===12&&c.name.length===40&&c.spec.length===300&&c.unit==='式'&&c.a===0&&c.b===0&&c.n===1e6&&c.price===1e8&&!('evil' in c),'匯入清理：字串限長、單位白名單、數字夾回範圍、不明欄位丟掉');
  ok(WK.clean(null).unit==='式'&&WK.clean({unit:'才',n:'2.456'}).n===2.46,'匯入清理：空資料給預設、數量 2 位小數')}

// AI 渲染提示詞
for(const c of R.C)ok(c.k in RD.EN,'家具缺英文名：'+c.k);
for(const t of R.TPL)ok(t.id in RD.TPL_EN,'範本缺英文名：'+t.id);
let pr=RD.compose({zh:'8 人會議室',en:'a meeting room',style:'nordic',light:'dusk',view:'eye',tool:'chatgpt',ref:'3d'});
ok(pr.text.includes('北歐')&&pr.text.includes('黃昏暖光')&&pr.text.includes('3D 截圖')&&pr.text.includes('8 人會議室'),'ChatGPT 中文提示詞含風格、光線、參考圖、內容');
pr=RD.compose({zh:'x',en:'a kitchen',style:'modern',tool:'gemini',ref:'none',lang:'en'});ok(/^Create a photorealistic/.test(pr.text)&&!pr.text.includes('screenshot'),'英文版、不附圖時不提截圖');
pr=RD.compose({en:'a bathroom',tool:'mj',ref:'3d'});ok(pr.text.includes('--ar 16:9')&&pr.text.includes('--iw')&&pr.text.includes('a bathroom'),'Midjourney 參數與參考圖權重');
pr=RD.compose({en:'an office',tool:'sd',ref:'3d'});ok(pr.neg.includes('watermark')&&pr.tip.includes('ControlNet'),'SD 有負面提示詞與 ControlNet 提示');
pr=RD.compose({zh:'採光罩',en:'a canopy',tool:'chatgpt',ref:'photo',kind:'exterior'});ok(pr.text.includes('建築外觀')&&pr.text.includes('現場照片'),'外觀＋現場照片版');
ok(RD.compose({en:'x',style:'不存在',tool:'不存在'}).text.length>0,'未知選項退回預設');
ok(RD.glassEn('5mm 霧面玻璃')==='frosted glass'&&RD.glassEn('')==='','玻璃英文');

// 整層平面：房間偵測
const base={FW:11000,FD:8200,ext:200,int:120,RH:2800,walls:[],openings:[],labels:[],objs:[]};
let rr=FL.rooms(base);ok(rr.regs.length===1&&near(rr.regs[0].area,10800*8000,1),'空白外框＝1 個空間（中心線面積）');
let pl={...base,walls:[{id:'h',x1:100,y1:4000,x2:10900,y2:4000}]};ok(FL.rooms(pl).regs.length===2,'一道貫穿牆分成 2 間');
pl={...base,walls:[{id:'h',x1:100,y1:4000,x2:6000,y2:4000}]};ok(FL.rooms(pl).regs.length===1,'沒接到牆的半截牆不分間');
pl={...base,walls:[{id:'h',x1:100,y1:4000,x2:10900,y2:4000},{id:'v',x1:5000,y1:100,x2:5000,y2:4000}]};ok(FL.rooms(pl).regs.length===3,'T 字牆分成 3 間');
pl={...base,walls:[{id:'h',x1:100,y1:4000,x2:10900,y2:4000,virt:true}],labels:[{id:'a',name:'客廳',type:'living',x:3000,y:2000},{id:'b',name:'餐廳',type:'dining',x:8000,y:6000}]};
rr=FL.rooms(pl);ok(rr.regs.length===2&&rr.labs.every(l=>l.reg>=0),'虛擬分區線也分區、標籤落在區內');
pl={...base,labels:[{id:'a',name:'客廳',type:'living',x:2000,y:4000},{id:'b',name:'餐廳',type:'dining',x:9000,y:4000}],walls:[{id:'v',x1:5500,y1:3000,x2:5500,y2:5000}]};
rr=FL.rooms(pl);ok(near(rr.labs[0].area+rr.labs[1].area,rr.regs[0].area,1)&&rr.labs[0].area>0&&rr.labs[1].area>0,'同區多房名：面積分給最近的房名、總和不變');
pl={...base,labels:[{id:'a',name:'客廳',type:'living',x:2750,y:4100},{id:'b',name:'餐廳',type:'dining',x:8250,y:4100}]};rr=FL.rooms(pl);
ok(Math.abs(rr.labs[0].area-rr.labs[1].area)<0.6e6,`同區兩房名對稱擺放時面積各半（${(rr.labs[0].area/1e6).toFixed(1)}／${(rr.labs[1].area/1e6).toFixed(1)} m²）——大格子要細分，不能整格判給一邊`);
// 門窗幾何
pl={...base,openings:[{id:'o',k:'door',wall:'S',s:99999,w:1000}]};let og=FL.opGeom(pl,pl.openings[0]);ok(og&&near(og.s,10800-500,1),'門位置超出牆長會夾回牆內');
let nw=FL.nearestWall(base,5000,8000);ok(nw&&nw.w.id==='S'&&near(nw.d,100,1),'找最近的牆（南牆）');
pl={...base,walls:[{id:'h',x1:100,y1:4000,x2:10900,y2:4000}],openings:[{id:'d',k:'door',wall:'h',s:3000,w:900,h:2100},{id:'w',k:'win',wall:'N',s:5000,w:1500,h:1200,sill:900}]};
let pcs=FL.wallPieces(pl);const fullLen=id=>pcs.filter(p=>p.wall===id&&p.full).reduce((a,p)=>a+(p.x1-p.x0),0);
ok(near(fullLen('h'),10800-900,1)&&pcs.some(p=>p.wall==='h'&&!p.full&&p.z0===2100),'內牆扣門洞、門上補牆');
ok(near(fullLen('N'),11000-1500,1)&&pcs.filter(p=>p.wall==='N'&&!p.full).length===2,'外牆扣窗洞、窗下窗上各補一塊');
// 連通檢查
pl={...base,walls:[{id:'h',x1:100,y1:4000,x2:10900,y2:4000}],labels:[{id:'a',name:'臥室',type:'bed',x:3000,y:2000}],openings:[{id:'e',k:'door',wall:'S',s:2000,w:1000,side:-1,entry:true}]};
let ck=FL.check(pl);ok(ck.warn.some(w=>w.includes('沒有門'))&&ck.warn.some(w=>w.includes('沒有對外窗')),'沒門、沒窗的房間會被抓出來');
pl.openings.push({id:'d',k:'door',wall:'h',s:3000,w:900,side:1},{id:'w',k:'win',wall:'N',s:3000,w:1500,h:1200,sill:900});ck=FL.check(pl);
ok(!ck.warn.length,'補上門和窗後沒有警告：'+ck.warn.join('；'));
ok(FL.check(base).warn.some(w=>w.includes('大門')),'沒有入口會提醒');
// 4 個方案
const boxOf=o=>{const c=R.byK[o.k],w=+o.w||c.w,d=+o.d||c.d;return o.r%180===0?[o.x-w/2,o.y-d/2,o.x+w/2,o.y+d/2]:[o.x-d/2,o.y-w/2,o.x+d/2,o.y+w/2]};
const solidObj=o=>{const c=R.byK[o.k];return !c.top&&!['glass','glassS'].includes(c.s)};
function planOK(P,tag){const plans=FL.gen(P);ok(plans.length>=1,tag+' 至少產生 1 個方案');
  for(const pp of plans){const p=pp.plan,b=FL.bounds(p),T=`${tag}/${pp.id}`;
    ok(p.FW===P.FW&&p.FD===P.FD,T+' 外框尺寸不變');
    ok(p.walls.every(w=>w.x1>=b.x0-1&&w.x2<=b.x1+1&&w.y1>=b.y0-1&&w.y2<=b.y1+1&&(w.x1===w.x2||w.y1===w.y2)),T+' 牆都在外框內且水平／垂直');
    ok(p.openings.every(o=>{const g=FL.opGeom(p,o);return g&&o.s>=o.w/2-1&&o.s<=g.L-o.w/2+1}),T+' 門窗都掛在牆上');
    ok(p.openings.filter(o=>o.entry).length===1,T+' 恰好 1 個入口');
    const ws=pp.warn.filter(w=>w.includes('沒有門')||w.includes('大門'));ok(!ws.length,T+' 每個房間都走得到：'+ws.join('；'));
    ok(pp.id==='S'||pp.sum.beds===P.beds,T+` 臥室數 ${pp.sum.beds}/${P.beds}`);
    ok(pp.sum.baths>=1&&pp.sum.baths<=P.baths,T+` 衛浴數 ${pp.sum.baths}`);
    ok(p.objs.every(o=>R.byK[o.k]&&o.x>=0&&o.x<=p.FW&&o.y>=0&&o.y<=p.FD),T+' 家具都在外框內');
    const fl=p.objs.filter(solidObj).map(boxOf);let ov=0;for(let i=0;i<fl.length;i++)for(let j=i+1;j<fl.length;j++){const a=fl[i],c=fl[j];if(a[0]<c[2]-2&&a[2]>c[0]+2&&a[1]<c[3]-2&&a[3]>c[1]+2)ov++}
    ok(ov===0,T+` 落地家具互不重疊（重疊 ${ov} 組）`);
    const ids=new Set();for(const x of [...p.walls,...p.openings,...p.labels,...p.objs]){ok(!ids.has(x.id),T+' id 重複');ids.add(x.id)}}
  return plans}
let pls=planOK({FW:11000,FD:8200,beds:3,baths:2,entry:'S',kitchen:'closed'},'三房兩衛');ok(pls.length===4,'標準尺寸給 4 個方案');
ok(pls.every(p=>p.id!=='S'),'標準尺寸不會退回小坪數格局');
for(const [P,n] of [[{FW:11000,FD:8200,beds:3,baths:2,entry:'E',kitchen:'open'},4],[{FW:11000,FD:8200,beds:3,baths:2,entry:'W',kitchen:'closed'},4],
  [{FW:9000,FD:7500,beds:2,baths:1,entry:'S',kitchen:'open'},4],[{FW:9000,FD:7500,beds:2,baths:1,entry:'S',kitchen:'closed'},4],[{FW:12000,FD:9000,beds:3,baths:2,entry:'N',kitchen:'closed'},4]]){
  const r=FL.gen(P);ok(r.length>=n&&r.every(p=>p.id!=='S'),`${JSON.stringify(P)} 要有 ${n} 個正常方案（實際 ${r.map(p=>p.id).join(',')}）`)}
ok(new Set(pls.map(p=>p.id)).size===4,'4 個方案各不相同');
// 廚房偏好與主臥大小：選「獨立廚房」卻放不下時，方案名稱要明講改開放式；符合偏好的非鏡射方案排前面
{const area=(pl,t)=>pl.sum.list.filter(r=>r.type===t).map(r=>r.m2);
  ok(pls.every(p=>/開放廚房/.test(p.name)===!!p.note),'改開放廚房的方案名稱與說明一致');
  const fi=pls.findIndex(p=>p.note);ok(fi<0||pls.slice(fi).every(p=>p.note||/′/.test(p.id)),'符合「獨立廚房」的方案排在改開放式的前面');
  ok(pls.some(p=>!p.note),'獨立廚房至少有一個方案做得到');
  for(const P of [{FW:11000,FD:8200,beds:3,baths:2,entry:'S',kitchen:'open'},{FW:12000,FD:9000,beds:3,baths:2,entry:'S',kitchen:'closed'},{FW:11000,FD:8200,beds:3,baths:2,entry:'E',kitchen:'open'}])
    for(const pl of FL.gen(P)){const mA=area(pl,'master')[0],bA=area(pl,'bed');ok(mA>0&&bA.every(a=>mA>=a-0.05),`${pl.id} 主臥（${mA&&mA.toFixed(1)} m²）不小於次臥（${bA.map(a=>a.toFixed(1)).join('/')}）`)}
  ok(FL.gen({FW:11000,FD:8200,beds:3,baths:2,entry:'S',kitchen:'open'}).every(p=>!p.note),'選開放式廚房時不會出現改廚房說明')}
for(const e of ['N','E','W'])planOK({FW:11000,FD:8200,beds:3,baths:2,entry:e,kitchen:'open'},'入口'+e);
planOK({FW:9000,FD:7500,beds:2,baths:1,entry:'S',kitchen:'open'},'兩房一衛');
planOK({FW:13000,FD:10000,beds:4,baths:2,entry:'S',kitchen:'closed'},'四房');
planOK({FW:5000,FD:6000,beds:1,baths:1,entry:'S',kitchen:'open'},'小套房');
const it2=FL.toItems(pls[0].plan);ok(it2.length===pls[0].plan.openings.length&&it2.some(x=>x.type==='door'&&x.loc==='入口玄關')&&it2.filter(x=>x.type==='slide').every(x=>x.p.W>=500&&x.p.H>=600),'門窗轉丈量項目');
{const pp=JSON.parse(JSON.stringify(pls[0].plan));let okAll=true;for(const l of pp.labels){const n=FL.furnishRoom(pp,l.id);if(n<0)okAll=false}
  ok(okAll&&pp.objs.every(o=>o.x>=0&&o.x<=pp.FW&&o.y>=0&&o.y<=pp.FD),'每個房間都能重新自動擺家具');
  const bed=pp.labels.find(l=>l.type==='master');const R0=FL.rooms(pp),reg=R0.labs.find(l=>l.id===bed.id).reg;ok(pp.objs.some(o=>R0.at(o.x,o.y)===reg&&/^bed/.test(o.k)),'主臥重新擺家具後有床');
  ok(FL.furnishRoom(pp,'不存在')===-1,'找不到房間回傳 -1')}
let pi=FL.parseIdea('三房兩廳兩衛 11x8.2米 入口在南邊 開放式廚房',{});ok(pi.beds===3&&pi.baths===2&&pi.FW===11000&&pi.FD===8200&&pi.entry==='S'&&pi.kitchen==='open','需求文字解析：'+JSON.stringify(pi));
ok(FL.parseIdea('2房1衛 大門朝東',{}).entry==='E'&&FL.parseIdea('2房1衛',{}).beds===2,'房數與東側入口');

// 繞一圈丈量：閉合、誤差分配、轉角檢查、方位、凹口（非室內）、門窗掛牆
{const R4=(a,b)=>({first:'S',walls:[{len:a,turn:'R'},{len:b,turn:'R'},{len:a,turn:'R'},{len:b,turn:'R'}]});let S=FL.survey(R4(5000,4000));
  ok(S.ok&&S.W===5000&&S.D===4000&&near(S.area,20e6,1),'矩形 5×4m 繞一圈');ok(S.pts[0][1]===4000&&S.pts[1][1]===4000,'第一面牆畫在下方（南）');
  let q=R4(5000,4000);q.walls[3].len=null;S=FL.survey(q);ok(S.ok&&S.autoLen===4000&&S.D===4000,'最後一面牆留白自動算');
  q=R4(5000,4000);q.walls[3].len=null;q.autoLast=false;ok(!FL.survey(q).ok,'關掉自動算時最後一面也要填');
  q=R4(5000,4000);q.walls[1].len=null;S=FL.survey(q);ok(!S.ok&&S.err.includes('第 2 面'),'中間的牆沒填長度會指出是第幾面');
  q=R4(5000,4000);q.walls[2].len=5030;S=FL.survey(q);ok(S.ok&&S.warn.some(w=>w.includes('閉合差'))&&S.W>5000&&S.W<5030&&S.pts.every(p=>p.every(Number.isInteger)),'閉合差 3 公分依比例分配、座標取整數');
  q=R4(5000,4000);q.walls[1].turn='L';S=FL.survey(q);ok(!S.ok&&S.err.includes('轉角'),'轉角選錯會被抓出來');
  q=R4(5000,4000);q.walls[2].len=6500;S=FL.survey(q);ok(!S.ok&&S.err.includes('沒有繞回'),'長度差太多會提醒');
  ok(!FL.survey({walls:[{len:1000},{len:1000},{len:1000}]}).ok&&!FL.survey(null).ok,'少於 4 面牆、空資料都不會當掉');
  S=FL.survey({first:'S',walls:[5000,4000,5000,4000].map(l=>({len:l,turn:'L'}))});ok(S.ok&&S.W===5000&&S.D===4000&&!S.cw,'往左繞（逆時針）也能算');
  for(const [f,w,h,y] of [['N',5000,4000,0],['E',4000,5000,null],['W',4000,5000,null]]){q=R4(5000,4000);q.first=f;S=FL.survey(q);ok(S.ok&&S.W===w&&S.D===h&&(y==null||S.pts[0][1]===y),'第一面牆在 '+f)}
  S=FL.survey({first:'S',autoLast:true,walls:[[4000,'R'],[3000,'R'],[5000,'L'],[4000,'R'],[1000,'R'],[1000,'R'],[3000,'L'],[null,'R']].map(([len,turn])=>({len,turn}))});ok(!S.ok&&S.err.includes('交叉'),'形狀打結（牆交叉）會被抓出來');
  const Lsv={first:'S',walls:[{len:10000,turn:'R',ops:[{k:'win',from:1000,w:1500,h:1200,sill:900}]},{len:8000,turn:'R',ops:[{k:'win',from:2000,w:1200,sill:''}]},{len:6000,turn:'R'},{len:3000,turn:'L'},
    {len:4000,turn:'R',ops:[{k:'door',from:500,w:900,entry:true},{k:'door',from:2000,w:900,entry:true}]},{len:5000,turn:'R'}]};
  const r=FL.fromSurvey(Lsv,{ext:200,int:120,RH:2800}),P=r.plan;
  ok(!r.err&&P.FW===10400&&P.FD===8400,'L 形：外框＝外接矩形＋兩倍外牆厚');
  ok(r.notch===2&&P.walls.every(w=>w.outer&&w.t===200)&&P.walls.some(w=>w.x1===6300&&w.y1===100&&w.y2===3200)&&P.walls.some(w=>w.y1===3100&&w.x1===6200&&w.x2===10300),'L 形：兩道凹口牆往外偏半個牆厚、凸角延長接上外牆中心線');
  ok(r.voids===1&&P.labels.filter(l=>l.type==='void').length===1&&P.labels.some(l=>l.name==='室內'&&l.type==='other'),'凹口標成「非室內」，其餘是一個室內空間');
  const sm=FL.summary(P);ok(near(sm.tot,71.64,0.01)&&sm.list.length===1,`非室內不計坪（${sm.tot.toFixed(2)} m²）`);
  ok(!FL.check(P).warn.length,'丈量出來的外框沒有格局警告：'+FL.check(P).warn.join('；'));
  const ops=P.openings;ok(ops.length===4&&ops.some(o=>o.wall==='S'&&o.s===8350&&o.w===1500)&&ops.some(o=>o.wall==='W'&&o.s===5500&&o.sill===900),'門窗依「距起點牆角」掛到正確的牆與位置（窗台留白用預設 90 公分）');
  const dr=ops.filter(o=>o.k==='door');ok(dr.length===2&&dr.filter(o=>o.entry).length===1&&dr[0].side===1&&P.walls.some(w=>w.id===dr[0].wall),'凹口牆上的大門往室內開、大門只會有一個');
  const pcs=FL.wallPieces(P);ok(Math.max(...pcs.filter(q=>q.wall==='N').map(q=>q.x1))===6400&&Math.min(...pcs.filter(q=>q.wall==='E').map(q=>q.y0))===3000,'外框貼著非室內的那段牆不蓋，退到凹口牆外緣');
  ok(pcs.filter(q=>P.walls.some(w=>w.id===q.wall)).every(q=>q.ext),'凹口牆照外牆畫（外牆顏色與剖面線）');
  ok(FL.toItems(P).every(x=>!x.loc.includes('非室內'))&&FL.toItems(P).some(x=>x.loc==='入口玄關'),'門窗轉丈量項目時位置不會寫成「非室內」');
  const rr=FL.fromSurvey(R4(3000,2500),{ext:150});ok(!rr.err&&rr.plan.FW===3300&&rr.plan.FD===2800&&rr.notch===0&&rr.voids===0,'小房間（3×2.5m）也能建立，不被最小尺寸卡住');
  ok(FL.fromSurvey({walls:[]},{}).err,'無效的丈量不會產生平面')}
// DXF 匯入（光達掃描 App 的平面圖）：各家寫法——公尺／公分／公釐、轉角度、矩形／雙線／單線牆、區塊門、同一層的門弧、房名編碼
{function dxf(ents,o){o=o||{};const L=[],g=(c,v)=>L.push(String(c),String(v));g(0,'SECTION');g(2,'HEADER');if(o.units){g(9,'$INSUNITS');g(70,o.units)}g(0,'ENDSEC');
    const ent=e=>{const ly=e.L||'0';if(e.T==='L'){g(0,'LINE');g(8,ly);g(10,e.a[0]);g(20,e.a[1]);g(11,e.b[0]);g(21,e.b[1])}
      else if(e.T==='LW'){g(0,'LWPOLYLINE');g(8,ly);g(90,e.v.length);g(70,e.cl?1:0);for(const p of e.v){g(10,p[0]);g(20,p[1])}}
      else if(e.T==='PL'){g(0,'POLYLINE');g(8,ly);g(66,1);g(70,e.cl?1:0);for(const p of e.v){g(0,'VERTEX');g(8,ly);g(10,p[0]);g(20,p[1])}g(0,'SEQEND')}
      else if(e.T==='A'){g(0,'ARC');g(8,ly);g(10,e.c[0]);g(20,e.c[1]);g(40,e.r);g(50,e.a0);g(51,e.a1)}
      else if(e.T==='X'){g(0,e.mt?'MTEXT':'TEXT');g(8,ly);g(10,e.p[0]);g(20,e.p[1]);g(40,e.h||0.2);g(1,e.s)}
      else if(e.T==='I'){g(0,'INSERT');g(8,ly);g(2,e.b);g(10,e.p[0]);g(20,e.p[1]);if(e.r)g(50,e.r)}};
    if(o.blocks){g(0,'SECTION');g(2,'BLOCKS');for(const b of o.blocks){g(0,'BLOCK');g(8,'0');g(2,b.name);g(10,b.base[0]);g(20,b.base[1]);b.ents.forEach(ent);g(0,'ENDBLK')}g(0,'ENDSEC')}
    g(0,'SECTION');g(2,'ENTITIES');ents.forEach(ent);g(0,'ENDSEC');g(0,'EOF');return L.join(o.crlf?'\r\n':'\n')+'\n'}
  function wallRect(x1,y1,x2,y2,t,gaps,layer,poly){const hz=Math.abs(y2-y1)<1e-9,out=[],a0=hz?Math.min(x1,x2):Math.min(y1,y2),a1=hz?Math.max(x1,x2):Math.max(y1,y2),c=hz?y1:x1,segs=[];let cur=a0;
    for(const [ga,gb] of gaps||[]){if(ga>cur)segs.push([cur,ga]);cur=gb}if(a1>cur)segs.push([cur,a1]);
    for(const [u,v] of segs){const P=(a,n)=>hz?[a,c+n]:[c+n,a],q=[P(u,-t/2),P(v,-t/2),P(v,t/2),P(u,t/2)];if(poly)out.push({T:poly,L:layer,v:q,cl:1});else for(let i=0;i<4;i++)out.push({T:'L',L:layer,a:q[i],b:q[(i+1)%4]})}return out}
  const t=0.15,W=5,D=4,E1=[...wallRect(-t,-t/2,W+t,-t/2,t,[[1.0,1.9]],'Walls'),...wallRect(-t,D+t/2,W+t,D+t/2,t,[[2.0,3.5]],'Walls'),...wallRect(-t/2,0,-t/2,D,t,[],'Walls'),...wallRect(W+t/2,0,W+t/2,D,t,[],'Walls'),
    {T:'L',L:'Doors',a:[1.0,0],b:[1.0,0.9]},{T:'A',L:'Doors',c:[1.0,0],r:0.9,a0:0,a1:90},...[-0.05,0,0.05].map(dy=>({T:'L',L:'Windows',a:[2.0,D+t/2+dy],b:[3.5,D+t/2+dy]})),
    {T:'PL',L:'Floor',v:[[0,0],[W,0],[W,D],[0,D]],cl:1},{T:'X',L:'Labels',p:[2.5,2],s:'\\fArial|b1;Living Room\\P',mt:1,h:0.25}];
  const chk1=(r,tag)=>{const P=r.plan,o=P&&P.openings;ok(!r.err&&P.FW===5300&&P.FD===4300&&P.ext===150&&P.walls.length===0,tag+'：外框 5.3×4.3m、外牆厚 15 公分');
    ok(o&&o.length===2&&o.some(x=>x.k==='door'&&x.wall==='S'&&x.s===1525&&x.w===900&&x.side===-1&&x.entry)&&o.some(x=>x.k==='win'&&x.wall==='N'&&x.s===2825&&x.w===1500),tag+'：門窗放進牆的缺口、門往室內開、設為大門');
    ok(P&&P.labels.length===1&&P.labels[0].name==='Living Room'&&P.labels[0].type==='living',tag+'：MTEXT 房名去掉格式碼、判斷成客廳')};
  const d1=dxf(E1),r1=CADIN.toPlan(CADIN.parse(d1));chk1(r1,'公尺＋矩形牆');ok(r1.info&&r1.info.unit==='公尺'&&r1.info.ua==='guess','沒有單位表頭時依尺寸判斷成公尺');
  const A=30*Math.PI/180,f=p=>[(p[0]*Math.cos(A)-p[1]*Math.sin(A))*100,(p[0]*Math.sin(A)+p[1]*Math.cos(A))*100];
  const E2=[...wallRect(-t,-t/2,W+t,-t/2,t,[[1.0,1.9]],'WALL','LW'),...wallRect(-t,D+t/2,W+t,D+t/2,t,[[2.0,3.5]],'WALL','LW'),...wallRect(-t/2,0,-t/2,D,t,[],'WALL','LW'),...wallRect(W+t/2,0,W+t/2,D,t,[],'WALL','LW'),...E1.filter(e=>e.L!=='Walls')]
    .map(e=>e.T==='L'?{...e,a:f(e.a),b:f(e.b)}:e.T==='A'?{...e,c:f(e.c),r:e.r*100,a0:e.a0+30,a1:e.a1+30}:e.T==='X'?{...e,p:f(e.p),h:e.h*100}:{...e,v:e.v.map(f)});
  const r2=CADIN.toPlan(CADIN.parse(dxf(E2,{crlf:true})));chk1(r2,'轉 30°＋公分＋LWPOLYLINE＋CRLF');ok(r2.info&&Math.abs(Math.abs(r2.info.rot)-30)<0.5&&r2.info.unit==='公分','偵測到轉了 30°、單位公分');
  const t3=150,ti=100,E3=[...wallRect(-t3,-t3/2,8000+t3,-t3/2,t3,[[6000,7000]],'A-WALL'),...wallRect(-t3,6000+t3/2,8000+t3,6000+t3/2,t3,[[1000,2500],[5000,6500]],'A-WALL'),...wallRect(-t3/2,0,-t3/2,6000,t3,[],'A-WALL'),
    ...wallRect(8000+t3/2,0,8000+t3/2,6000,t3,[],'A-WALL'),...wallRect(4000,0,4000,6000,ti,[[2500,3400]],'A-WALL'),{T:'A',L:'A-DOOR',c:[3950,2500],r:900,a0:90,a1:180},{T:'L',L:'A-DOOR',a:[3950,2500],b:[3050,2500]},
    {T:'A',L:'A-DOOR',c:[6000,0],r:1000,a0:0,a1:90},{T:'L',L:'A-DOOR',a:[6000,0],b:[6000,1000]},...[[1000,2500],[5000,6500]].flatMap(([a,b])=>[-40,0,40].map(dy=>({T:'L',L:'A-GLAZ',a:[a,6075+dy],b:[b,6075+dy]}))),
    {T:'X',L:'A-AREA-IDEN',p:[2000,3000],s:'主臥室',h:250},{T:'X',L:'A-AREA-IDEN',p:[2000,2600],s:'12.0 m²',h:150},{T:'X',L:'A-AREA-IDEN',p:[6000,3000],s:'\\U+5BA2\\U+5EF3',h:250},
    {T:'L',L:'A-ANNO-TTLB',a:[-2000,-2000],b:[12000,-2000]},{T:'L',L:'A-ANNO-TTLB',a:[12000,-2000],b:[12000,9000]},{T:'L',L:'A-WALL-PATT',a:[0,-150],b:[150,0]},{T:'L',L:'A-ANNO-DIMS',a:[0,-800],b:[8000,-800]}];
  const r3=CADIN.toPlan(CADIN.parse(dxf(E3,{units:4}))),P3=r3.plan;ok(!r3.err&&P3.FW===8300&&P3.FD===6300&&r3.info.ua==='header','兩房：讀表頭單位公釐、圖框／剖面線／尺寸線不當成牆');
  ok(P3&&P3.walls.length===1&&P3.walls[0].x1===4150&&P3.walls[0].y1===75&&P3.walls[0].y2===6225&&P3.walls[0].t===100,'隔間牆兩端接到外牆中心線（房間才分得開）、牆厚 10 公分');
  const S3=FL.summary(P3);ok(S3.list.length===2&&S3.list.some(x=>x.name==='主臥室'&&x.type==='master')&&S3.list.some(x=>x.name==='客廳'),'房名：\\U+ 中文解碼、面積文字不會被當成房名');
  ok(P3.openings.length===4&&P3.openings.filter(o=>o.entry).length===1&&P3.openings.some(o=>o.wall===P3.walls[0].id&&o.k==='door'&&o.w===900),'隔間門掛在隔間牆上、外框門窗都在、大門只有一個');ok(!FL.check(P3).warn.length,'匯入的兩房沒有格局警告');
  const L4=[[0,0],[10,0],[10,5],[6,5],[6,8],[0,8]],E4=L4.map((p,i)=>({T:'L',L:'0',a:p,b:L4[(i+1)%6]}));
  const r4=CADIN.toPlan(CADIN.parse(dxf([...E4,{T:'I',L:'DOORS',b:'DOOR90',p:[2,0]}],{blocks:[{name:'DOOR90',base:[0,0],ents:[{T:'A',L:'0',c:[0,0],r:0.9,a0:0,a1:90},{T:'L',L:'0',a:[0,0],b:[0,0.9]}]}]})));
  {const P=r4.plan,W=P.walls,v=W.find(w=>w.x1===w.x2),h=W.find(w=>w.y1===w.y2);
    ok(!r4.err&&r4.info.voids===1&&r4.info.ext1===4&&P.ext===200&&P.FW===10400&&P.FD===8400,'L 形單線牆：線當成室內牆面，外框往外加 20 公分牆厚');
    ok(W.length===2&&W.every(w=>w.outer&&w.t===200)&&v&&v.x1===6300&&v.y1===100&&v.y2===3100&&h&&h.y1===3100&&h.x1===6300&&h.x2===10300,'凹口牆也往非室內那側加牆厚、轉角對齊、接到外框中心線');
    ok(near(FL.summary(P).tot,71.64,0.01),'室內淨尺寸不變（10×8 公尺扣凹口 4×3＝68 m²，中心線計 71.64 m²）')}
  ok(r4.plan.openings.length===1&&r4.plan.openings[0].wall==='S'&&r4.plan.openings[0].entry,'區塊（INSERT）裡的門會展開，0 圖層繼承插入那層');
  const r6=CADIN.toPlan(CADIN.parse(dxf([...E4,{T:'A',L:'0',c:[2,0],r:0.9,a0:0,a1:90},{T:'L',L:'0',a:[2,0],b:[2,0.9]}])));
  ok(!r6.err&&r6.plan.openings.length===1&&r6.plan.walls.length===2,'全部畫在同一層：門弧認得出來、門扇線不會變成牆');
  const r7=CADIN.toPlan(CADIN.parse(d1),{unit:'cm'});ok(r7.err&&r7.err.includes('單位'),'單位選錯會提示改單位');
  ok(CADIN.parse('hello').err&&CADIN.toPlan(CADIN.parse(dxf([]))).err&&CADIN.toPlan(null).err,'不是 DXF、空檔案、沒資料都回清楚的錯誤');
  const bad=CADIN.toPlan(CADIN.parse(dxf([{T:'L',L:'Walls',a:[0,0],b:[3,3]},{T:'L',L:'Walls',a:[0,3],b:[3,0]}])));ok(bad.err||bad.warn.some(w=>w.includes('斜')),'只有斜線時不會當掉');
  {const txt=dxf(E2,{crlf:true}),P=CADIN.parser();for(let i=0;i<txt.length;i+=7)P.feed(txt.slice(i,i+7));ok(JSON.stringify(P.end())===JSON.stringify(CADIN.parse(txt)),'串流分段餵入（7 字元一段、CRLF 被切開）結果和整檔解析相同')}
  {const P=CADIN.parser();P.feed('AutoCAD Binary DXF\r\n\x1a\x00'+'x'.repeat(5000));ok(P.stop()&&P.end().err,'二進位 DXF 一開頭就停，不會整個讀完')}
  {const extra='0\nSECTION\n2\nOBJECTS\n0\nLINE\n8\nWalls\n10\n0\n20\n0\n11\n99\n21\n99\n0\nENDSEC\n0\nEOF\n',P=CADIN.parser();P.feed(d1.replace(/0\nEOF\n$/,''));ok(P.stop(),'圖元段讀完就停');P.feed(extra);ok(P.end().ents.length===CADIN.parse(d1).ents.length,'圖元段之後的 OBJECTS 段不讀')}
  ok(!CADIN.parse('\uFEFF\n'+d1).err&&CADIN.toPlan(CADIN.parse('\uFEFF'+d1)).plan.FW===5300,'開頭有 BOM 或空行也讀得到');
  {const r=CADIN.toPlan(CADIN.parse(dxf([...E1.filter(e=>e.T!=='X'),{T:'X',L:'Text',p:[2.5,2],s:'A\x01B\x07廚房',h:0.25}])));ok(r.plan.labels[0].name==='AB廚房','房名去掉控制字元（不然 DAE 的 XML 會壞）')}
  {const face='0\n3DFACE\n8\nMesh\n10\n1\n20\n2\n30\n0\n',txt=d1.replace('2\nENTITIES\n','2\nENTITIES\n'+face.repeat(120000)),D=CADIN.parse(txt),r=CADIN.toPlan(D);
    ok(!D.cut&&D.skip['3DFACE']===120000&&!r.err&&r.plan.FW===5300,'12 萬個 3D 網格面寫在平面圖前面：略過的不算進上限，牆線照樣讀到')}
  {const P=CADIN.parser();P.feed('x'.repeat(1100000));ok(P.stop()&&P.end().err,'沒有換行的大檔馬上停止')}
  /* 本 App 匯出 DXF 的畫法：外牆矩形在門窗處切開、內牆矩形伸進外牆中心線（端口短邊在牆裡面）、門弧是 16 段小直線、推拉門是兩片矩形、窗三條線、
     分區線在 A-AREA-BNDY、大門箭頭在 A-DOOR-IDEN、房名下面一行坪數 */
  {const e=200,i=120,E=[],R=(x0,y0,x1,y1,L)=>{const q=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];for(let k=0;k<4;k++)E.push({T:'L',L,a:q[k],b:q[(k+1)%4]})},Y=y=>-y;
    R(0,Y(0),1000,Y(e),'A-WALL-EXTR');R(1900,Y(0),7000,Y(e),'A-WALL-EXTR');R(0,Y(6000-e),2000,Y(6000),'A-WALL-EXTR');R(3500,Y(6000-e),7000,Y(6000),'A-WALL-EXTR');
    R(0,Y(e),e,Y(6000-e),'A-WALL-EXTR');R(7000-e,Y(e),7000,Y(6000-e),'A-WALL-EXTR');
    R(3500-i/2,Y(100),3500+i/2,Y(2500),'A-WALL-INTR');R(3500-i/2,Y(3400),3500+i/2,Y(5900),'A-WALL-INTR');
    const arc=(cx,cy,r,a0,a1,L)=>{for(let k=0;k<16;k++){const t0=(a0+(a1-a0)*k/16)*Math.PI/180,t1=(a0+(a1-a0)*(k+1)/16)*Math.PI/180;E.push({T:'L',L,a:[cx+r*Math.cos(t0),cy+r*Math.sin(t0)],b:[cx+r*Math.cos(t1),cy+r*Math.sin(t1)]})}};
    arc(3500,Y(2500),900,0,-90,'A-DOOR-SWNG');E.push({T:'L',L:'A-DOOR',a:[3500,Y(2500)],b:[3500+900*Math.cos(-Math.PI/2),Y(2500)-900]});
    R(2000,Y(5930),2800,Y(5960),'A-DOOR');R(2700,Y(5900),3500,Y(5930),'A-DOOR');
    for(const d of [50,100,150])E.push({T:'L',L:'A-GLAZ',a:[1000,Y(d)],b:[1900,Y(d)]});
    E.push({T:'L',L:'A-AREA-BNDY',a:[5000,Y(100)],b:[5000,Y(2000)]},{T:'L',L:'A-AREA-BNDY',a:[5000,Y(2000)],b:[6900,Y(2000)]});
    E.push({T:'L',L:'A-DOOR-IDEN',a:[6500,Y(6000)],b:[6500,Y(5000)]},{T:'X',L:'A-DOOR-IDEN',p:[6000,Y(6500)],s:'入口玄關',h:196});
    E.push({T:'X',L:'A-AREA-IDEN',p:[1700,Y(3000)],s:'主臥室',h:236},{T:'X',L:'A-AREA-IDEN',p:[1700,Y(3300)],s:'5.9 坪',h:180},{T:'X',L:'A-AREA-IDEN',p:[4300,Y(4500)],s:'客廳',h:236},
      {T:'X',L:'A-AREA-IDEN',p:[6000,Y(4500)],s:'餐廳',h:236},{T:'X',L:'A-AREA-IDEN',p:[6000,Y(1000)],s:'玄關',h:236},{T:'X',L:'A-FURN-IDEN',p:[1700,Y(1500)],s:'雙人床',h:185},
      {T:'X',L:'A-ANNO-NOTE',p:[4300,Y(5200)],s:'此處備註',h:90});
    const r=CADIN.toPlan(CADIN.parse(dxf(E,{units:4}))),P=r.plan||{},W=P.walls||[],O=P.openings||[],iw=W.filter(w=>!w.virt),vw=W.filter(w=>w.virt);
    ok(!r.err&&P.FW===7000&&P.FD===6000&&P.ext===200&&r.info.ext1===0,'矩形牆：外牆厚 20 公分，端口短邊不會配成假牆');
    ok(iw.length===1&&iw[0].x1===3500&&iw[0].y1===100&&iw[0].y2===5900&&iw[0].t===120,'內牆中心線、牆厚 12 公分、兩端接外牆中心線（門洞那段接起來）');
    ok(vw.length===2&&vw.some(w=>w.x1===5000&&w.y1===100&&w.y2===2000)&&vw.some(w=>w.y1===2000&&w.x1===5000&&w.x2===6900),'A-AREA-BNDY 變成分區線');
    ok(O.length===3&&O.some(o=>o.k==='door'&&o.wall===iw[0].id&&o.w===900)&&O.some(o=>o.k==='sdoor'&&o.wall==='S'&&o.w===1500&&o.entry)&&O.some(o=>o.k==='win'&&o.wall==='N'&&o.w===900),'16 段小直線的門弧認成平開門、兩片矩形是推拉門、大門箭頭不會變成門');
    const lab=(P.labels||[]).map(l=>l.name).sort().join(',');ok(lab==='主臥室,客廳,玄關,餐廳','房名：同一區的客廳／餐廳都留、坪數與家具名稱與小字備註不當房名（'+lab+'）');
    ok(FL.check(P).warn.every(w=>w.includes('對外窗')),'格局檢查只剩「客廳沒有對外窗」（這張測試圖本來就沒畫）')}
  /* 光達掃描 App 常見畫法：每面牆一條線（掃到的室內牆面）、窗直接畫在牆線上（沒切缺口）、門弧跨 0°（270°→0°） */
  {const E=[[0,0],[4.2,0],[4.2,3.6],[0,3.6]].map((p,i,a)=>({T:'L',L:'Wall',a:p,b:a[(i+1)%4]}));E.push({T:'L',L:'Window',a:[1.2,3.6],b:[2.7,3.6]},{T:'A',L:'Door',c:[3.3,0],r:0.8,a0:270,a1:0},{T:'L',L:'Door',a:[3.3,0],b:[4.1,0]},{T:'X',L:'Room Names',p:[2.1,1.8],s:'Bedroom\\P12.5 m²',mt:1,h:0.2});
    const r=CADIN.toPlan(CADIN.parse(dxf(E,{units:6})),{ext:150}),P=r.plan||{},O=P.openings||[];
    ok(!r.err&&P.FW===4500&&P.FD===3900&&P.ext===150&&r.info.ext1===4,'單線房間：室內 4.2×3.6 公尺不變，外牆厚用指定的 15 公分');
    ok(O.length===2&&O.some(o=>o.k==='win'&&o.wall==='N'&&o.w===1500&&o.s===2025)&&O.some(o=>o.k==='door'&&o.wall==='S'&&o.w===800&&o.s===3775&&o.entry),'牆線沒切缺口時，門窗照圖元自己的寬度擺；跨 0° 的門弧也認得');
    ok((P.labels||[]).length===1&&P.labels[0].name==='Bedroom'&&P.labels[0].type==='bed','房名後面的面積去掉')}
  {const r=CADIN.toPlan(CADIN.parse(dxf([...E1.filter(e=>e.T!=='X'),...['12.5 m² (3.8 坪)','3.0 坪','4,200 x 3,600','2.4m','Kitchen'].map((s,i)=>({T:'X',L:'Text',p:[0.5+i*0.8,1],s,h:0.25}))])));
    ok(!r.err&&r.plan.labels.length===1&&r.plan.labels[0].name==='Kitchen'&&r.plan.labels[0].type==='kitchen','純面積、尺寸文字（m²、坪、x、m）不當房名，真正的房名留下');
    ok(CADIN.typeOf('Master Bedroom')==='master'&&CADIN.typeOf('主臥衛浴')==='master'&&CADIN.typeOf('客用衛浴')==='bath'&&CADIN.typeOf('Living Room')==='living'&&CADIN.typeOf('倉庫')==='other','房名判斷房型')}
  /* Lagarsoft 那種 DXF：兩次掃描同一間（地板外框重疊）、門只有一條線、1.4 公尺的小浴室 */
  {const room=(dx,dy,dw,ww)=>{const P=[[0,0],[1.41,0],[1.41,1.32],[0,1.32]].map(([x,y])=>[x+dx,y+dy]);return [...P.map((p,i)=>({T:'L',L:'WALLS',a:p,b:P[(i+1)%4]})),{T:'PL',L:'FLOOR',v:P,cl:1},
      {T:'L',L:'DOORS',a:[0.3+dx,dy],b:[0.3+dw+dx,dy]},{T:'L',L:'WINDOWS',a:[0.4+dx,1.32+dy],b:[0.4+ww+dx,1.32+dy]},{T:'X',L:'DIMS',p:[0.7+dx,0.6+dy],s:'1.9 m2',h:0.13}]};
    const D=CADIN.parse(dxf([...room(0.64,-0.23,0.622,0.788),...room(0,0,0.642,0.752),{T:'X',L:'NORTH',p:[-0.4,2.4],s:'N',h:0.15}])),r1=CADIN.toPlan(D,{ext:200}),r0=CADIN.toPlan(D,{ext:200,pick:0});
    const ow=r=>r.plan.openings.map(o=>o.k+o.w).sort().join();
    ok(!r1.err&&r1.info.dup&&r1.info.dup.n===2&&r1.info.dup.pick===1&&r1.plan.FW===1810&&r1.plan.FD===1720&&ow(r1)==='door642,win752','兩次掃描重疊：預設用後面那次（室內 141×132、門 64.2、窗 75.2），不會配出假的厚牆');
    ok(!r0.err&&ow(r0)==='door622,win788'&&r0.warn.some(w=>w.includes('第 1 次')),'可以改用第 1 次掃描');
    ok(r1.plan.openings.find(o=>o.w===642).k==='door','門只有一條線（沒畫開門弧）：當一般門，不是拉門');
    ok(!r1.warn.some(w=>w.includes('不太對'))&&r1.plan.labels.length===1&&r1.plan.labels[0].name==='室內','1.4 公尺的浴室不算單位錯；指北針的「N」不當房名')}
  /* Apple RoomPlan（光達掃描原始資料）：合成一間轉 10° 的 3.2×2.6 m 臥室 */
  {const th=10*Math.PI/180,R=(x,z)=>[x*Math.cos(th)-z*Math.sin(th),x*Math.sin(th)+z*Math.cos(th)];
    const S=(id,cat,w,h,lx,lz,y,along,par)=>{const a=th+(along==='z'?Math.PI/2:0),[x,z]=R(lx,lz);return {identifier:id,parentIdentifier:par||null,category:{[cat]:cat==='door'?{isOpen:true}:{}},dimensions:[w,h,0],
      transform:[Math.cos(a),0,Math.sin(a),0,0,1,0,0,-Math.sin(a),0,Math.cos(a),0,x,y,z,1],polygonCorners:[],completedEdges:[],confidence:{high:{}},curve:null,story:0}};
    const room={walls:[S('wN','wall',3.2,2.8,0,-1.3,0),S('wS','wall',3.2,2.8,0,1.3,0),S('wW','wall',2.6,2.8,-1.6,0,0,'z'),S('wE','wall',2.6,2.8,1.6,0,0,'z')],
      doors:[S('d1','door',0.9,2.05,-0.8,1.3,-1.4+1.025,'x','wS')],windows:[S('n1','window',1.5,1.2,0.5,-1.3,-1.4+0.9+0.6,'x','wN'),S('n2','window',1.8,2.2,1.6,0.2,-1.4+1.1,'z','wE')],openings:[],
      objects:[{...S('b1','bed',1.52,0.5,-0.5,-0.36,-1.15),dimensions:[1.52,0.5,1.88]},{...S('f1','fireplace',1,1,0.8,0.5,-1)}],sections:[{label:'bedroom',center:[0,0,0],story:0}],
      floors:[{...S('fl','floor',3.2,2.6,0,0,-1.4),transform:[Math.cos(th),0,Math.sin(th),0,Math.sin(th),0,-Math.cos(th),0,0,1,0,0,0,-1.4,0,1],polygonCorners:[[-1.6,-1.3,0],[1.6,-1.3,0],[1.6,1.3,0],[-1.6,1.3,0]]}]};
    const r=CADIN.fromRP(room,{ext:200}),P=r.plan||{},O=P.openings||[],ob=(P.objs||[])[0]||{};
    ok(!r.err&&P.FW===3600&&P.FD===3000&&P.RH===2800&&Math.abs(r.info.rot)===10,'RoomPlan：轉正 10°、室內 3.2×2.6 m 不變（外框加牆厚）、天花板 2.8 m');
    ok(O.length===3&&O.some(o=>o.k==='door'&&o.wall==='S'&&o.w===900&&o.h===2050&&o.entry)&&O.some(o=>o.k==='win'&&o.wall==='N'&&o.w===1500&&o.h===1200&&o.sill===900),'門 90×205、窗 150×120 窗台 90，掛在正確的牆');
    ok(O.some(o=>o.k==='fwin'&&o.wall==='E'&&o.w===1800&&o.h===2200&&o.sill===0),'窗台貼地、2.2 m 高的窗變成落地窗');
    ok(P.labels.length===1&&P.labels[0].name==='臥室'&&P.labels[0].type==='bed','房間類型 bedroom → 臥室');
    ok(P.objs.length===1&&ob.k==='bedD'&&ob.r===0&&ob.w===1520&&ob.d===1880&&Math.abs(ob.x-(200+1100))<=2&&Math.abs(ob.y-(200+940))<=2,'床：152 寬 → 雙人床、床頭靠北牆、位置與大小照掃描');
    ok(r.warn.some(w=>w.includes('1 件設備')),'沒有對應圖塊的設備（壁爐）會說略過幾件');
    /* 兩間房共用一道牆、中間是沒有門的開口：牆切開成通道 */
    const two={walls:[S('a','wall',6,2.8,0,-1.5,0),S('b','wall',6,2.8,0,1.5,0),S('c','wall',3,2.8,-3,0,0,'z'),S('d','wall',3,2.8,3,0,0,'z'),S('m','wall',3,2.8,0,0,0,'z')],
      doors:[S('e','door',1,2.1,-1.5,1.5,-0.35,'x','b')],windows:[],openings:[S('o','opening',1,2.1,0,0,-0.35,'z','m')],objects:[],floors:[],
      sections:[{label:'livingRoom',center:[...R(-1.5,0).slice(0,1),0,R(-1.5,0)[1]]},{label:'diningRoom',center:[R(1.5,0)[0],0,R(1.5,0)[1]]}]};
    const r2=CADIN.fromRP(two,{ext:200}),iw=(r2.plan||{walls:[]}).walls.filter(w=>!w.virt);
    ok(!r2.err&&iw.length===2&&iw.every(w=>w.x1===w.x2&&w.x1===3200)&&r2.plan.openings.length===1,'沒有門的開口把中間那道牆切成兩段（通道），不會變成門');
    ok(r2.plan.labels.map(l=>l.name).sort().join()==='客廳,餐廳','兩個房間類型都留下');
    /* Lagarsoft 的 {rooms,structure}：有 structure 就用它；只有 rooms 時重疊的只留最後一次 */
    const sh=JSON.parse(JSON.stringify(room));for(const k of ['walls','doors','windows'])for(const o of sh[k])o.transform[12]+=0.3;
    const r3=CADIN.fromRP({rooms:[room,sh]},{ext:200}),r4=CADIN.fromRP({rooms:[room,sh],structure:room},{ext:200});
    ok(!r3.err&&r3.warn.some(w=>w.includes('重複掃描'))&&r3.plan.FW===3600&&!r4.err&&!r4.warn.some(w=>w.includes('重複')),'同一間掃兩次：沒有合併結構時只用最後一次；有 structure 直接用');
    ok(CADIN.fromRP(null).err&&CADIN.fromRP({walls:[]}).err&&CADIN.fromRP({foo:1}).err&&CADIN.fromRP({walls:[{category:{wall:{}},transform:'x'}]}).err,'不是掃描資料、沒有牆、矩陣壞掉都回清楚的錯誤');
    /* Lagarsoft 的 USDZ 是文字 USDA：轉回同樣的結構 */
    const usd=o=>{const T=o.transform,row=i=>`(${T.slice(i*4,i*4+4).join(', ')})`;const c=Object.keys(o.category)[0];
      return `def Xform "X" (\n    customData = {\n        string Category = "${c==='door'?'Door(Isopen: True)':c.charAt(0).toUpperCase()+c.slice(1)}"\n    }\n)\n{\n    def Cube "X"\n    {\n        double3 xformOp:scale = (${o.dimensions[0]}, ${o.dimensions[1]}, 0.0001)\n        matrix4d xformOp:transform = ( ${row(0)}, ${row(1)}, ${row(2)}, ${row(3)} )\n        uniform token[] xformOpOrder = ["xformOp:transform", "xformOp:scale"]\n    }\n}\n`};
    const tx=[...room.walls,...room.doors,...room.windows].map(usd);tx.push(`def Xform "Section_grp" (\n    kind = "group"\n)\n{\n    def Xform "bedroom0" (\n        kind = "assembly"\n    )\n    {\n        matrix4d xformOp:transform = ( (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1) )\n    }\n}\n`);
    const U=CADIN.fromUSDA(tx),r5=CADIN.fromRP(U,{ext:200});
    ok(!U.err&&U.walls.length===4&&U.doors.length===1&&U.windows.length===2&&U.sections[0].label==='bedroom','USDA：讀出 4 牆、1 門、2 窗、房間類型');
    ok(!r5.err&&r5.plan.FW===3600&&r5.plan.RH===2800&&r5.plan.openings.some(o=>o.k==='fwin')&&r5.plan.labels[0].name==='臥室','USDA 轉出的平面跟 RoomPlan JSON 一樣');
    ok(CADIN.fromUSDA(['#usda 1.0\n']).err&&CADIN.fromUSDA([]).err,'讀不出東西的 USDZ 回錯誤')}
  ok(['A-WALL-EXTR:wall','A-WALL-PATT:skip','A-DOOR-SWNG:door','A-GLAZ:window','Floor:floor','A-ANNO-TTLB:skip','0:other','窗:window','Furniture:skip'].every(x=>{const [l,r]=x.split(':');return CADIN.roleOf(l)===r}),'圖層名稱判斷用途')}
// DAE（COLLADA 1.4.1）寫出：結構、參照、數量、名稱合法性
{const sq={c:'#C8955E',mat:'木地板',p:[0,0,0,1,0,0,1,0,1,0,0,1],n:[0,1,0,0,1,0,0,1,0,0,1,0],i:[0,1,2,0,2,3]};
  const gl={c:'#8fc3e8',a:0.35,mat:'玻璃',p:[0,0,0,1,0,0,0,1,0],i:[0,1,2]};
  const tree={name:'王公館 3房2廳（測試）',children:[{name:'外牆 北（含窗）',parts:[sq,gl]},{name:'空群組',children:[{name:'',parts:[]}]},{name:'<b>&"x',parts:[sq]},{name:'12 號櫃',parts:[{c:'bad',p:[0,0,0,1,0,0,0,0,1],i:[0,1,2]}]}]};
  const x=DAE.write(tree,'2026-01-01T00:00:00Z');
  ok(x.startsWith('<?xml')&&x.includes('<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">'),'DAE 有 XML 宣告與 COLLADA 1.4.1 根元素');
  const names=[...x.matchAll(/ name="([^"]*)"/g)].map(q=>q[1]);ok(names.length>=6&&names.every(n=>/^[\p{L}_][\p{L}\p{Nd}._-]*$/u.test(n)),'所有 name 都是合法 NCName：'+names.join(','));
  ok(!x.includes('空群組'),'沒有幾何的空群組不輸出');
  const ids=[...x.matchAll(/ id="([^"]+)"/g)].map(q=>q[1]);ok(new Set(ids).size===ids.length,'id 不重複');
  const refs=[...x.matchAll(/(?:url|target|source)="#([^"]+)"/g)].map(q=>q[1]);ok(refs.length>0&&refs.every(r=>ids.includes(r)),'所有 # 參照都指得到');
  ok([...x.matchAll(/<triangles material="([^"]+)"/g)].every(q=>ids.includes(q[1])),'三角形的材質符號都有對應材質');
  ok([...x.matchAll(/<float_array id="[^"]+" count="(\d+)">([^<]*)<\/float_array>/g)].every(q=>+q[1]===q[2].trim().split(/\s+/).length),'float_array 的 count 與數字個數相符');
  ok([...x.matchAll(/<triangles material="[^"]+" count="(\d+)">[\s\S]*?<p>([^<]*)<\/p>/g)].every(q=>q[2].trim().split(/\s+/).length===+q[1]*6),'三角形 count 與索引數相符（頂點＋法向量兩組）');
  ok(x.includes('<transparent opaque="A_ONE">')&&(x.match(/<material /g)||[]).length===3,'玻璃輸出半透明、同色同透明度共用材質（3 種）');
  ok(x.includes('0.784 0.584 0.369 1'),'色碼轉成 0～1 的 RGB');
  ok(/<unit name="meter" meter="1"\/>/.test(x)&&x.includes('<up_axis>Y_UP</up_axis>'),'單位公尺、Y 軸朝上');
  const st=[];let bad=false;for(const q of x.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)){if(q[3])continue;if(q[1]){if(st.pop()!==q[2])bad=true}else st.push(q[2])}ok(!bad&&!st.length,'XML 標籤正確配對');
  let threw=false;try{DAE.write({name:'空',children:[{name:'x',parts:[{c:'#FFFFFF',p:[],i:[]}]}]})}catch(e){threw=true}ok(threw,'整棵樹沒有幾何時丟出錯誤（不交出空檔案）');
  ok(DAE.nc('12 牆')==='_12_牆'&&DAE.nc('外牆（北）')==='外牆_北'&&DAE.nc('')==='_'&&DAE.nc('-a')==='_-a','名稱轉 NCName 的邊界情況')}
console.log(`${fail?'✗':'✓'} 自我測試：通過 ${pass}、失敗 ${fail}`);process.exit(fail?1:0);
