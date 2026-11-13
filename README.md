# 丈量大師（原「門窗丈量」）

鋁門窗與室內丈量用的手機 App（PWA，單一 HTML 檔）。功能說明見 [docs/features.md](docs/features.md)。

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
| `tests/selftest.js` | 離線自我測試（`node tests/selftest.js`，驗證家具庫、範本、構想解析、用電計算、整層平面、繞一圈丈量、DAE 輸出、DXF 匯入） |
| `sw.js` | Service Worker（離線快取；改版時把 `VERSION` +1） |
| `manifest.webmanifest`、`icon-*.png` | PWA 安裝資訊與圖示 |
| `docs/features.md` | 功能說明 |

## 相容性注意

改名只改顯示名稱。IndexedDB 名稱 `mw-measure`、備份檔識別碼 `app: "mw-measure"` **刻意保留**，舊資料與舊備份檔可直接沿用。
