# 丈量大師（原「門窗丈量」）

鋁門窗與採光罩的**現場丈量 App**：手機開啟即可記錄尺寸、畫施工圖、看 3D、算才數／坪數與報價，並匯出 PDF 施工圖、DXF（CAD）、CSV。資料只存在手機瀏覽器（IndexedDB），不需帳號、不需伺服器。

## 功能

- 類型：橫拉窗、固定窗、推射窗、百葉窗、門、採光罩（矩形／缺角／斜邊／自訂外形、障礙物、封邊、排水）
- 三點量測取最小值、尺寸異常警告、採光罩結構／排水／熱水器安全提醒
- 匯出：A4 PDF（圖框＋標題欄＋報價單＋照片）、DXF R12 壓縮包、CSV
- AI 快速輸入與 AI 檢查（僅在 Claude Artifact 環境中可用）
- **黑科技（v2 新增）**
  - 離線 PWA：加入主畫面後，工地沒訊號也能開啟、丈量、存檔（Service Worker 快取 App 與 jsPDF／three.js）
  - 丈量時螢幕保持常亮（Screen Wake Lock，可在設定關閉）
  - 自動申請「永久儲存」，並在設定頁顯示空間用量與是否已鎖定
  - 超過 7 天沒完整備份會在首頁提醒
  - 儲存失敗（空間不足）指數退避重試並提示；離線／上線狀態提示

## 部署

純靜態網站，沒有建置步驟。推到 `main` 後由 `.github/workflows/pages.yml` 把網站檔案推到 `gh-pages` 分支：

1. 若網址打不開：GitHub repo → **Settings → Pages → Source** 選 **Deploy from a branch**、分支 **gh-pages** / `(root)`（只需設定一次）
2. 網址：`https://xin7355-collab.github.io/shoe/`
3. iPhone 用 Safari 開啟 → 分享 → **加入主畫面**

本機測試：`python3 -m http.server 8000` 後開 `http://localhost:8000/`。

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 整個 App（HTML＋CSS＋JS 單檔） |
| `sw.js` | Service Worker（離線快取；改版時把 `VERSION` +1） |
| `manifest.webmanifest`、`icon-*.png` | PWA 安裝資訊與圖示 |

## 相容性注意

改名只改顯示名稱。IndexedDB 名稱 `mw-measure`、備份檔識別碼 `app: "mw-measure"` **刻意保留**，舊資料與舊備份檔可直接沿用。
