#!/bin/bash
# =============================================================================
# P82 — Migrate URL thumbnail trong KV: ke.maume.asia → ngan.maume.asia
# Duyệt mọi key preset:*, thay domain trong field thumbnail + thumbnails[], ghi lại.
# An toàn: ke-maume worker phục vụ CẢ 2 domain nên ảnh chạy cả trước lẫn sau migrate.
# Chạy SAU khi deploy ke-maume (đã bound ngan.maume.asia). CHỈ chạy 1 lần.
#
# Usage:  bash scripts/migrate-thumb-domain.sh          # thật
#         DRY=1 bash scripts/migrate-thumb-domain.sh    # chỉ in, không ghi
# =============================================================================
set -euo pipefail
NS="9122f2b7b431485389a95a9887cb5516"   # KV namespace KE_PRESETS (shared ke-maume + maume-admin)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Liệt kê key preset:* trong KV $NS ..."
keys=$(npx wrangler kv key list --namespace-id "$NS" --remote | jq -r '.[].name' | grep '^preset:' || true)
[ -z "$keys" ] && { echo "Không có preset nào."; exit 0; }

migrated=0; skipped=0
while IFS= read -r k; do
  [ -z "$k" ] && continue
  npx wrangler kv key get --namespace-id "$NS" --remote "$k" > "$TMP/cur.json" 2>/dev/null || { echo "  ⚠ bỏ qua (get lỗi): $k"; continue; }
  if grep -q "ke\.maume\.asia/thumb" "$TMP/cur.json"; then
    sed 's|ke\.maume\.asia/thumb|ngan.maume.asia/thumb|g' "$TMP/cur.json" > "$TMP/new.json"
    if [ "${DRY:-0}" = "1" ]; then
      echo "  [DRY] sẽ migrate: $k"
    else
      npx wrangler kv key put --namespace-id "$NS" --remote "$k" --path "$TMP/new.json"
      echo "  ✓ migrated: $k"
    fi
    migrated=$((migrated+1))
  else
    skipped=$((skipped+1))
  fi
done <<< "$keys"

echo "→ Xong. Migrate: $migrated · Bỏ qua (không có URL ke): $skipped"
