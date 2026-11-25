# 🚀 GitHub Pages 部署說明 — 光復國小 3D 校園大冒險

本專案已內建完整的 **GitHub Actions 自動部署流程**，並透過 `vite-plugin-singlefile` 將所有程式碼、字型與靜態資源打包為單一 `dist/index.html`。因此無論部署於個人根網域或專案子路徑（例如 `https://<你的帳號>.github.io/guangfu-3d-campus/`），皆**無需額外修改 `base` 路徑**即可直接運行。

---

## 📦 專案內建部署檔案一覽

| 檔案路徑 | 說明 |
| --- | --- |
| `.github/workflows/deploy.yml` | GitHub Actions 自動化建置、型別檢查與 GitHub Pages 發佈腳本 |
| `scripts/publish.sh` | 搭配 GitHub CLI (`gh`) 的本機一鍵建立 Repo、推送與啟用 Pages 腳本 |
| `.nvmrc` | 指定 Node.js 20，確保本機與 GitHub Actions 建置環境一致 |
| `.gitignore` | 排除 `node_modules/`、`dist/` 與系統暫存檔，避免誤推大型目錄 |

---

## ✅ 事前準備

1. **GitHub 帳號**：免費帳號即可使用公開 Repository 的 GitHub Pages（含免費 HTTPS 憑證）。
2. **本機環境**：
   - [Git](https://git-scm.com/)
   - [Node.js 20+](https://nodejs.org/)（建議與 `.nvmrc` 一致）
   - *(選用，一鍵部署用)* [GitHub CLI (`gh`)](https://cli.github.com/)

---

## 🌟 方式一：一鍵自動部署（推薦）

使用 GitHub CLI 登入一次後，執行專案內附腳本即可自動完成驗證、建置、建立倉庫、推送程式碼與切換 Pages 來源：

```bash
# 1. 登入 GitHub CLI（僅需執行一次）
gh auth login

# 2. 執行一鍵發佈（可省略參數，預設倉庫名稱為 guangfu-3d-campus）
bash scripts/publish.sh guangfu-3d-campus
```

腳本會自動執行：
1. `npx tsc --noEmit` 型別檢查與 `npm run build` 驗證建置
2. 初始化 Git、建立 `main` 分支並提交程式碼
3. 建立公開 GitHub Repository 並推送
4. 將 Repository 的 **Pages 來源切換為 GitHub Actions** 並啟動部署

---

## 🛠️ 方式二：手動 Git 推送 + GitHub 網頁設定

若不想安裝 `gh`，可直接透過標準 Git 指令與 GitHub 網頁介面部署：

### 步驟 1：在 GitHub 建立新的 Repository
1. 前往 [https://github.com/new](https://github.com/new)
2. Repository name 填入 `guangfu-3d-campus`（可自訂）
3. 權限選擇 **Public**（免費方案之 GitHub Pages 需公開倉庫）
4. **不要勾選** README / `.gitignore` / License，點選 **Create repository**

### 步驟 2：在本機專案目錄初始化並推送
```bash
# 先在本機確認建置通過（可選，但強烈建議）
npm ci
npx tsc --noEmit
npm run build

# 推送至 GitHub main 分支
git init
git add .
git commit -m "feat: 光復國小 3D 校園大冒險"
git branch -M main
git remote add origin https://github.com/<你的帳號>/guangfu-3d-campus.git
git push -u origin main
```

### 步驟 3：啟用 GitHub Pages（選擇 GitHub Actions）
1. 進入你的 GitHub Repository 頁面
2. 點選上方分頁 **Settings** → 左側選單 **Pages**
3. 在 **Build and deployment** → **Source** 下拉選單選擇 **`GitHub Actions`**
   > ⚠️ **重要**：切勿選擇 `Deploy from a branch`，否則 GitHub 會直接提供未編譯的 `src/` 原始碼，導致網頁顯示空白畫面。

### 步驟 4：等待 Actions 綠燈並開啟網站
1. 點選 Repository 上方的 **Actions** 分頁
2. 若剛切換完 Source 尚未自動執行，點選左側 **Deploy to GitHub Pages** → 右側 **Run workflow** 手動觸發
3. 待 `build` 與 `deploy` 均顯示綠色勾勾（約 1 分鐘），即可透過以下網址造訪：
   ```text
   https://<你的帳號>.github.io/guangfu-3d-campus/
   ```

---

## ⚡ 方式三：免 Actions，直接發佈打包後的單一 HTML 檔

由於本專案使用 `vite-plugin-singlefile`，執行 `npm run build` 後會產生完全獨立的單一檔案 `dist/index.html`（約 2.8 MB）：
- 若只需快速測試靜態頁面，可將 `dist/index.html` 單獨放入一個專供展示的倉庫根目錄（檔名保持 `index.html`），並於該倉庫設定 `Deploy from a branch` 即可上線。
- 若未來仍會持續修改原始碼，建議仍採用 **方式一或方式二（GitHub Actions）**，每次 `git push` 即自動更新。

---

## 🔄 日後更新網站內容

修改程式碼後，只要推送到 `main` 分支，GitHub Actions 便會自動重新建置並覆蓋線上版本：

```bash
git add .
git commit -m "chore: 更新校園內容與背景音樂"
git push
```

---

## 🎵 背景音樂（YouTube 原曲 / 舒緩伴奏）部署注意事項

- **HTTPS 網域自動支援 YouTube 串流**：本專案已在 `index.html` 配置 `<meta name="referrer" content="strict-origin-when-cross-origin" />`，部署到 GitHub Pages（`https://*.github.io`）後，8 首精選 YouTube 原曲可直接透過 YouTube IFrame API 播放。
- **請勿以 `file://` 本機雙擊直接測試 YouTube 模式**：瀏覽器安全政策會限制本機檔案協定的 YouTube 嵌播，此時系統會自動平滑切換為內建 Web Audio **「舒緩伴奏」**；本機預覽請使用 `npm run preview` 或 `npm run dev`。
- **校園網路封鎖備援**：若學校或機關網路封鎖 YouTube，播放器會在逾時或錯誤時自動無縫切換至內建「舒緩伴奏」並顯示提示，玩家也可隨時於播放介面手動切換音源模式。

---

## 🌐 綁定自訂網域（選用）

1. 前往 GitHub Repository → **Settings** → **Pages** → **Custom domain**
2. 輸入你的網域（例如 `campus.example.edu.tw`）並儲存
3. 至你的 DNS 服務商新增一筆 `CNAME` 紀錄，指向 `<你的帳號>.github.io`
4. DNS 生效後勾選 **Enforce HTTPS** 即可完成加密連線。

---

## 🩺 常見排錯 FAQ

| 問題現象 | 可能原因 | 解決方式 |
| --- | --- | --- |
| 開啟網址出現**白畫面**或 404 | Pages Source 誤選成 `Deploy from a branch` | 至 `Settings → Pages → Source` 改選 **`GitHub Actions`**，再重新執行 Workflow |
| Actions 顯示權限不足 (`403`) | Repository Actions 權限受限 | 至 `Settings → Actions → General → Workflow permissions` 確認允許 Actions 執行，且 Pages 已切換為 `GitHub Actions` |
| `git push` 檔案過大失敗 | 未排除 `node_modules/` | 確認專案根目錄存在 `.gitignore`，執行 `git rm -r --cached node_modules` 後重新 commit |
| YouTube 原曲無法播放 | 瀏覽器阻擋第三方 iframe 或校園網路封鎖 YouTube | 系統會自動轉為內建「舒緩伴奏」，或點擊播放面板中的「舒緩伴奏」立即聆聽 |
