#!/usr/bin/env bash
set -euo pipefail

# 光復國小 3D 校園大冒險 — GitHub Pages 一鍵發佈腳本
# 用法：bash scripts/publish.sh [repo-name]

REPO_NAME="${1:-guangfu-3d-campus}"

echo "==> 1/5 檢查必要工具 (git / node / gh)..."
for cmd in git node npm gh; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ 找不到指令：$cmd，請先安裝後再執行。"
    exit 1
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ 尚未登入 GitHub CLI，請先執行：gh auth login"
  exit 1
fi

GH_USER="$(gh api user -q .login)"
FULL_REPO="${GH_USER}/${REPO_NAME}"

echo "==> 2/5 本機驗證 TypeScript 型別與生產建置..."
if [ ! -d node_modules ]; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi
npx tsc --noEmit -p tsconfig.json
npm run build

echo "==> 3/5 初始化 Git 並提交變更..."
if [ ! -d .git ]; then
  git init
fi
git branch -M main
git add .
if ! git diff --cached --quiet; then
  git commit -m "feat: 光復國小 3D 校園大冒險與 8 首療癒背景音樂播放器"
else
  echo "ℹ️ 沒有新的待提交變更，沿用目前 commit。"
fi

echo "==> 4/5 建立或連結 GitHub Repository (${FULL_REPO})..."
if ! gh repo view "$FULL_REPO" >/dev/null 2>&1; then
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
else
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "https://github.com/${FULL_REPO}.git"
  else
    git remote add origin "https://github.com/${FULL_REPO}.git"
  fi
  git push -u origin main
fi

echo "==> 5/5 設定 GitHub Pages 來源為 GitHub Actions..."
if gh api "repos/${FULL_REPO}/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/${FULL_REPO}/pages" -f build_type=workflow >/dev/null
else
  gh api -X POST "repos/${FULL_REPO}/pages" -f build_type=workflow >/dev/null
fi

# 若首次啟用尚未自動觸發，主動觸發一次 deploy workflow
gh workflow run deploy.yml --repo "$FULL_REPO" >/dev/null 2>&1 || true

echo ""
echo "🎉 推送完成！GitHub Actions 正在自動建置與發佈（約 1 分鐘）。"
echo "🔎 查看進度：https://github.com/${FULL_REPO}/actions"
echo "🌐 預計網址：https://${GH_USER}.github.io/${REPO_NAME}/"
