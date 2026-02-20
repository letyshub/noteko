#!/bin/bash
# Validation script for Group 3: Editor Settings, Git Hooks, and NPM Scripts
# This script checks all requirements from task group 3.

PASS=0
FAIL=0
PROJECT_DIR="D:/Projects/noteko"

check() {
  local desc="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Group 3 Validation: Editor Settings, Git Hooks, and NPM Scripts ==="
echo ""

# --- .vscode/settings.json checks ---
echo "--- .vscode/settings.json ---"

SETTINGS_FILE="$PROJECT_DIR/.vscode/settings.json"

# Check file exists
[ -f "$SETTINGS_FILE" ]
check "settings.json exists" $?

# Check editor.formatOnSave is true
grep -q '"editor.formatOnSave": true' "$SETTINGS_FILE" 2>/dev/null
check "editor.formatOnSave: true" $?

# Check preserved color customizations
grep -q '"activityBar.background": "#382732"' "$SETTINGS_FILE" 2>/dev/null
check "Preserved activityBar.background color" $?

grep -q '"titleBar.activeBackground": "#4E3746"' "$SETTINGS_FILE" 2>/dev/null
check "Preserved titleBar.activeBackground color" $?

grep -q '"titleBar.activeForeground": "#FBF9FA"' "$SETTINGS_FILE" 2>/dev/null
check "Preserved titleBar.activeForeground color" $?

# --- .vscode/extensions.json checks ---
echo ""
echo "--- .vscode/extensions.json ---"

EXT_FILE="$PROJECT_DIR/.vscode/extensions.json"

[ -f "$EXT_FILE" ]
check "extensions.json exists" $?

grep -q '"dbaeumer.vscode-eslint"' "$EXT_FILE" 2>/dev/null
check "ESLint extension recommended" $?

grep -q '"esbenp.prettier-vscode"' "$EXT_FILE" 2>/dev/null
check "Prettier extension recommended" $?

grep -q '"editorconfig.editorconfig"' "$EXT_FILE" 2>/dev/null
check "EditorConfig extension recommended" $?

grep -q '"bradlc.vscode-tailwindcss"' "$EXT_FILE" 2>/dev/null
check "Tailwind CSS IntelliSense extension recommended" $?

# --- npm scripts checks ---
echo ""
echo "--- npm scripts ---"

PKG_FILE="$PROJECT_DIR/package.json"

# Check npm run lint exits with code 0
cd "$PROJECT_DIR" && npm run lint > /dev/null 2>&1
check "npm run lint exits with code 0" $?

# Check format:check script exists and executes (may fail due to unformatted files, that's OK)
cd "$PROJECT_DIR" && npm run format:check > /dev/null 2>&1; FORMAT_EXIT=$?
# The script should exist (not "missing script" error which is exit code 1 with specific message)
grep -q '"format:check"' "$PKG_FILE" 2>/dev/null
check "format:check script exists in package.json" $?

# --- Husky / lint-staged checks ---
echo ""
echo "--- Husky and lint-staged ---"

PRECOMMIT_FILE="$PROJECT_DIR/.husky/pre-commit"

[ -f "$PRECOMMIT_FILE" ]
check ".husky/pre-commit file exists" $?

grep -q 'npx lint-staged' "$PRECOMMIT_FILE" 2>/dev/null
check ".husky/pre-commit contains 'npx lint-staged'" $?

grep -q '"lint-staged"' "$PKG_FILE" 2>/dev/null
check "package.json contains lint-staged configuration" $?

# --- Summary ---
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
