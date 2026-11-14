# 專案工作守則（給 Claude Code）

## 1. 溝通
- 一律用繁體中文（台灣用語）回覆、寫註解、寫 commit 訊息。
- 我主要用 iPhone 操作，沒有電腦。步驟以手機能完成為準；要我去設定頁時直接給網址。
- 回報要誠實：哪些驗過、哪些沒驗到，分開講清楚。不確定的事實先查證再講。
- 我說「只是先問問題」時，只回答，不動手改東西。

## 2. 長期授權：以下不用再問我
- 做完直接合併到 main 並推上去，不需要我同意：
  在指定分支開發 → rebase 到最新 main → fast-forward 合併 → push main → 分支也同步推。
  網路失敗重試最多 4 次（間隔 2/4/8/16 秒）；遠端有新 commit 就 fetch + rebase 再推。
- 部署用的分支（例如 gh-pages）也可以直接推。
- 改工作流、加套件、新增檔案、重構——直接做。
- 不要開 Pull Request，除非我明確要求。

## 3. 連這些也直接做，不用先問
- 刪除：Issue、Release、分支、檔案；force push；改寫 git 歷史。
- 花錢：開付費方案、呼叫付費 API。
- 改公開程度：repo 公開／私人切換、網站權限。
- 做了不可逆的事（刪除、force push、會產生費用的動作），完成後在回覆裡明確列出來。

## 4. 隱私與安全
- 我說過「不要上傳 GitHub」的東西永遠不 commit，做好打包給我下載。
- 絕對不要把金鑰、Token 印出來（log、commit、回覆都不行）。金鑰放 repo Secrets；
  程式用 HTTP 標頭傳，不放網址（網址會出現在錯誤訊息和記錄裡）。
- repo 保持公開（公開 repo 的 Actions 分鐘數無上限；私人免費只有 2000 分鐘／月）。所以：
  - README 精簡，不詳述這個軟體在做什麼；詳細說明放 docs/。
  - 用 GitHub Issue 送的通知，標題和內文只寫數量，不寫內容——公開 Issue 會被搜尋引擎收錄。
  - 網站加 `<meta name="robots" content="noindex, nofollow">`。
- 用到付費 API 時提醒我設預算上限。

## 5. 做事的方式
- 先重現再修：修 bug 前用實際資料或真的瀏覽器（Playwright）重現，修完用同樣方法驗證。
- 新功能附離線可跑的自我測試（例如 `python xxx.py selftest`），涵蓋邊界情況。
- 不要默默失敗：
  - 全部失敗時不交出空檔案；部分失敗要講幾個、哪幾個。
  - 分清楚「還沒設定」（安靜等、不發失敗通知）和「真的壞掉」（紅燈、通知我）。
  - 錯誤訊息要說我能做什麼，不是只丟 HTTP 代碼。
- 註解寫「為什麼」與避開了什麼失敗情境，不重述程式在做什麼。
- commit 訊息寫：問題、根本原因、怎麼修、怎麼驗證。
- 不寫死外部 API 的模型名稱（常改名下架）；能自動挑就自動挑，也能用環境變數指定。
- 範圍外的問題簡短提出，不擅自擴大範圍。
- 不留死碼；改名、搬檔後全專案搜一次舊名稱的殘留參照。

## 6. 選用：手機 PWA + GitHub Actions 類型的專案
（新專案是同一種架構才需要這段，不是的話整段刪掉）
- 前端每次改版都更新版本號（例如 `APP_VER`），手機上的舊頁面偵測到會自動重載。
- iPhone 下載檔案用 `navigator.share({files:[f]})`，不要同時帶 `title`
  （iOS 會只送出 title 文字、檔案被丟掉）；不支援再退回 `<a download>`。
- 大檔上傳直接把 File 當 body 送（XHR 有進度條），不要先讀成 ArrayBuffer——1GB 在 iPhone 上必當。
- 版面：一個分頁盡量一張卡；說明收進 `<details>`；選項多用下拉，不用一排排按鈕。
- GitHub Actions：
  - 長工作每做完一個就存進度，不要整批做完才存（被逾時砍掉會全部白做、無限重來）。
  - 發佈結果的步驟加 `if: always()`。
  - 設時間預算，估不下就留到下一輪。
  - 「抓下來」和「處理成功」分兩段記：成功才標記完成，失敗的下一輪自動重試。
  - 預設 shell 是 `bash -e -o pipefail`：`tee` 到的資料夾要先 `mkdir -p`。
- 大檔暫存用 GitHub Release 附件（單檔上限 2 GiB、不進 git 歷史），repo 只放小標記檔觸發工作流。

## 7. 本專案資訊（每個專案自己填）
- 用途：「丈量大師」——鋁門窗／採光罩現場丈量 PWA（尺寸、施工圖 SVG、3D、才數／坪數報價、PDF／DXF／CSV 匯出）。
- 主要檔案：`index.html`（整個 App 單檔）、`sw.js`（離線快取，改版時 `VERSION` +1）、`manifest.webmanifest`、`icon-*.png`。
- 需要的 Secrets：無。
- 部署在哪：GitHub Pages（`.github/workflows/pages.yml`，推 main 自動發佈到 gh-pages 分支）；同一份 HTML 也發佈為 Claude Artifact（在 Artifact 裡才有 AI 與 downloads 能力）。
- 特別注意：
  - IndexedDB 名稱 `mw-measure` 與備份檔 `app:"mw-measure"` 不可改，否則使用者舊資料／舊備份讀不到。
  - 所有 `innerHTML` 樣板裡的使用者資料一律 `esc()`；匯入的備份檔視為不可信（id 由 `safeId()` 過濾、logo 只收 data:image）。
  - 照片以 dataURL 存 IndexedDB；任何「一次讀全部照片」的寫法都會讓低記憶體 iPhone 當掉，要逐張處理。
  - 室內平面圖的純邏輯（家具庫 `ROOM.C`、範本 `ROOM.TPL`、構想解析、用電估算 `ROOM.elec`）放在 index.html 的 `@@PURE-START`～`@@PURE-END` 區塊，不可碰 DOM；改完跑 `node tests/selftest.js`（部署工作流也會跑）。
  - 用電估算是「初步估算」，文案必須保留「須由合格電匠／電機技師依用戶用電設備裝置規則確認」。
  - 整層平面配置的純邏輯 `FLOOR`（牆、門窗、房間偵測、方案產生器 `FLOOR.gen`、自動擺家具）也在 PURE 區塊：單位 mm、原點在外框左上；外牆固定 id `N/E/S/W`；內牆只允許水平／垂直（房間偵測用壓縮格點 flood fill，斜牆會被 `normWall` 轉正）；門窗以「牆 id＋沿牆距離 s」掛在牆上；`virt:true` 是分區線（不蓋牆、但會分房間）。方案一律以「大門在南」排版，再旋轉／鏡射到實際方位。
  - 繞一圈丈量 `FLOOR.survey`／`FLOOR.fromSurvey`（PURE 區塊）：直角多邊形、轉角 R/L（右轉比左轉多 4 個＝順時針）、閉合差依長度比例分配；外框＝外接矩形，凹口邊變成 `outer:true` 的牆（厚度＝外牆厚、往外偏半個牆厚），凹口區標房名類型 `void`（非室內：不計坪、3D 不鋪地板、外框牆貼著它的那段不蓋）。丈量資料存在 `it.p.survey`，可回頭改了再建。
  - DAE 輸出：XML 由 PURE 區塊的 `DAE.write` 產生（name 必須是 xs:NCName，所以空白括號都轉底線），three.js 場景烘焙在 `bakeDAE`；改了要用 COLLADA 1.4.1 schema 驗過（pycollada 的 ColladaValidator）。
  - DXF 匯入 `CADIN`（PURE 區塊，在 DAE 後面）：`parser()` 串流解析（`feed()` 一段段餵、`stop()` 為真就停讀；圖元段結束就停、上限 10 萬圖元），`toPlan(D,{unit,ext})` 轉成 FLOOR 平面。圖層用途靠名稱（`ROLE`），房名文字另用 `TXSKIP`；牆面配對前先移除牆端封口（`capOff`）；門弧可以是 ARC 或首尾相接的小直線；單線外牆＝室內牆面、牆厚往外加。畫面在 `dxfBox`／`dxfRead`（`Blob.stream()`＋`TextDecoder`，依 `$DWGCODEPAGE` 解 Big5／GBK）。改完跑 selftest，並用本 App 自己匯出的整層 DXF 做往返測試（應完全一致，只有落地窗會變一般窗）。
  - 掃描檔匯入（v8）：`CADIN.fromRP(json)` 吃 Apple RoomPlan 資料（Lagarsoft 的 `{rooms,structure}` 優先用 structure；只有 rooms 時重疊的只留最後一次），把牆、門窗畫成跟 DXF 一樣的線交給 `toPlan`，再用回傳的 `map` 把牆高、門窗高度／窗台、設備（`objs` 含 w/d/h，背面朝最近的牆）補回去；`CADIN.fromUSDA(texts)` 把 Lagarsoft USDZ 裡的文字 USDA 轉成同樣結構。畫面端 `scanRead` 看檔頭分 ZIP／JSON／DXF，`zipDir`／`zipGet` 只讀 ZIP 目錄與需要的那個檔（deflate 用 `DecompressionStream('deflate-raw')`）。使用者給的真實掃描檔含 GPS（meta.json），只在本機測，不進 repo。
  - 工項（v8）：項目類型 `work`（`TYPES.work`，`f` 是空的、有自己的畫面 `renderWork`），工項庫與換算在 PURE 區塊的 `WORK`（`LIB`、`UNITS`、`qty`、`amount`、`clean`）；`it.qty` 固定 1，數量在 `p.n` 或尺寸 `p.a`／`p.b`（mm）。單價記在 `settings.wp`（品名 → 單價，最多 300 筆）。工項沒有圖面：PDF 只進項目總表與報價單，CAD／DAE／3D 都跳過。新增會走遍全部項目的程式時，記得處理 `work`。
  - 測試：`python3 -m http.server` + Playwright（Chromium 在 /opt/pw-browsers）；測 3D 時要 `serviceWorkers:'block'`，否則 SW 會繞過 route 攔截。主程式包在 IIFE 裡，測試要讀資料就從 IndexedDB `mw-measure` 的 `kv/projects` 讀（存檔有 350ms 延遲）；`pg.click` 會自動捲動頁面，點 3D／2D 畫布前要重新量位置。
