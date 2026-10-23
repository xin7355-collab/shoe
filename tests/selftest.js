#!/usr/bin/env node
/* 丈量大師 離線自我測試：從 index.html 抽出 @@PURE 區塊（家具庫、範本、構想解析、用電估算）單獨驗證。
 * 用法：node tests/selftest.js　（不需網路、不需安裝套件） */
'use strict';
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=html.match(/\/\*@@PURE-START[\s\S]*?\*\/([\s\S]*?)\/\*@@PURE-END\*\//);
if(!m){console.error('✗ 找不到 @@PURE 區塊');process.exit(1)}
const {ROOM:R,RENDER:RD,FLOOR:FL}=new Function(m[1]+'\nreturn {ROOM,RENDER,FLOOR};')();
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
for(const t of R.PROJ)for(const [ty] of t.items)ok(['slide','fixed','casement','louver','door','canopy','shaped','room'].includes(ty),'整案範本類型：'+ty);

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

console.log(`${fail?'✗':'✓'} 自我測試：通過 ${pass}、失敗 ${fail}`);process.exit(fail?1:0);
