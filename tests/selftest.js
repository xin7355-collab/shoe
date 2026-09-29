#!/usr/bin/env node
/* 丈量大師 離線自我測試：從 index.html 抽出 @@PURE 區塊（家具庫、範本、構想解析、用電估算）單獨驗證。
 * 用法：node tests/selftest.js　（不需網路、不需安裝套件） */
'use strict';
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=html.match(/\/\*@@PURE-START[\s\S]*?\*\/([\s\S]*?)\/\*@@PURE-END\*\//);
if(!m){console.error('✗ 找不到 @@PURE 區塊');process.exit(1)}
const R=new Function(m[1]+'\nreturn ROOM;')();
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

console.log(`${fail?'✗':'✓'} 自我測試：通過 ${pass}、失敗 ${fail}`);process.exit(fail?1:0);
