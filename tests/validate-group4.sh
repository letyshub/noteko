#!/bin/bash
# Validation script for Group 4: Reformat Codebase and Final Validation
# This script verifies the one-time Prettier reformat was applied correctly
# and all lint/format tooling passes.

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

echo "=== Group 4 Validation: Reformat Codebase and Final Validation ==="
echo ""

# --- Prettier format check ---
echo "--- Prettier format check ---"

cd "$PROJECT_DIR" && npm run format:check > /dev/null 2>&1
check "npm run format:check exits with code 0 (all files formatted)" $?

# --- ESLint check ---
echo ""
echo "--- ESLint check ---"

cd "$PROJECT_DIR" && npm run lint > /dev/null 2>&1
check "npm run lint exits with code 0 (no lint errors)" $?

# --- Verify Prettier style applied to source files ---
echo ""
echo "--- Prettier style verification (semicolons removed, single quotes) ---"

# Check that source files do NOT contain semicolons at end of statements
# (excluding .d.ts type reference directives which use /// and are not statement-ending semicolons)
# We check a representative file: src/main/index.ts
MAIN_FILE="$PROJECT_DIR/src/main/index.ts"
# Count lines ending with semicolon (excluding triple-slash directives)
SEMI_COUNT=$(grep -cE ';$' "$MAIN_FILE" 2>/dev/null | head -1)
[ "$SEMI_COUNT" = "0" ]
check "src/main/index.ts has no trailing semicolons" $?

# Check utils.ts uses single quotes (was using double quotes before)
UTILS_FILE="$PROJECT_DIR/src/renderer/lib/utils.ts"
grep -q "from 'clsx'" "$UTILS_FILE" 2>/dev/null
check "utils.ts uses single quotes (reformatted)" $?

# Check App.tsx has no trailing semicolons
APP_FILE="$PROJECT_DIR/src/renderer/App.tsx"
# Only check non-JSX lines ending with semicolons
SEMI_COUNT_APP=$(grep -cE ';\s*$' "$APP_FILE" 2>/dev/null | head -1)
[ "$SEMI_COUNT_APP" = "0" ]
check "src/renderer/App.tsx has no trailing semicolons" $?

# Check preload/index.ts has no trailing semicolons
PRELOAD_FILE="$PROJECT_DIR/src/preload/index.ts"
SEMI_COUNT_PRELOAD=$(grep -cE ';$' "$PRELOAD_FILE" 2>/dev/null | head -1)
[ "$SEMI_COUNT_PRELOAD" = "0" ]
check "src/preload/index.ts has no trailing semicolons" $?

# --- ESLint config verification ---
echo ""
echo "--- ESLint config verification ---"

# Verify .eslintrc.json does NOT exist (flat config only)
[ ! -f "$PROJECT_DIR/.eslintrc.json" ]
check ".eslintrc.json does NOT exist (using flat config)" $?

# Verify eslint.config.mjs exists
[ -f "$PROJECT_DIR/eslint.config.mjs" ]
check "eslint.config.mjs exists" $?

# --- ESLint environment-specific config checks ---
echo ""
echo "--- ESLint environment-specific config ---"

# Check that main process config includes Node.js globals
cd "$PROJECT_DIR" && MAIN_CONFIG=$(npx eslint --print-config src/main/index.ts 2>/dev/null)
echo "$MAIN_CONFIG" | grep -q '"__dirname"' 2>/dev/null
check "Main process config includes Node.js globals (__dirname)" $?

echo "$MAIN_CONFIG" | grep -q '"process"' 2>/dev/null
check "Main process config includes Node.js globals (process)" $?

# Check that renderer config includes browser globals and React rules
cd "$PROJECT_DIR" && RENDERER_CONFIG=$(npx eslint --print-config src/renderer/App.tsx 2>/dev/null)
echo "$RENDERER_CONFIG" | grep -q '"document"' 2>/dev/null
check "Renderer config includes browser globals (document)" $?

echo "$RENDERER_CONFIG" | grep -q '"window"' 2>/dev/null
check "Renderer config includes browser globals (window)" $?

# --- Path alias verification ---
echo ""
echo "--- Path alias resolution ---"

# Verify @shared/* import resolves in main process file
cd "$PROJECT_DIR" && npx eslint src/main/index.ts > /dev/null 2>&1
check "Path aliases resolve: npx eslint src/main/index.ts passes" $?

# --- Summary ---
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
