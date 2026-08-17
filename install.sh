#!/usr/bin/env bash
set -euo pipefail

LANG_CODE="fa"
VERSION="latest"
DEST_DIR="/var/lib/pasarguard/templates/subscription"
DEST_FILE="${DEST_DIR}/index.html"
ENV_FILE="/opt/pasarguard/.env"
TEMP_DIR=""
STAGED_FILE=""
ROLLBACK_FILE=""

# تنظیمات ریپازیتوری شخصی شما
REPO_OWNER="PEDIHS"
REPO_NAME="subscription-template"
PREBUILT_REF="dc1a274e5c9f88b8b20c4e6888bd82c26dc247dd"

cleanup() {
  [[ -n "${STAGED_FILE}" && -f "${STAGED_FILE}" ]] && rm -f "${STAGED_FILE}"
  [[ -n "${ROLLBACK_FILE}" && -f "${ROLLBACK_FILE}" ]] && rm -f "${ROLLBACK_FILE}"
  [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]] && rm -rf "${TEMP_DIR}"
}

trap cleanup EXIT

usage() {
  cat <<'EOF'
Usage: install.sh [--lang en|fa|zh|ru] [--version latest|<tag>]

Examples:
  install.sh
  install.sh --lang en
  install.sh --lang fa --version v2.0.0
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lang)
      if [[ $# -lt 2 ]]; then
        echo "Error: --lang needs a value (en|fa|zh|ru)." >&2
        exit 1
      fi
      LANG_CODE="$2"
      shift 2
      ;;
    --version)
      if [[ $# -lt 2 ]]; then
        echo "Error: --version needs a value (latest|<tag>)." >&2
        exit 1
      fi
      VERSION="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "${LANG_CODE}" in
  en|fa|zh|ru) ;;
  *)
    echo "Error: invalid language '${LANG_CODE}'. Use one of: en, fa, zh, ru." >&2
    exit 1
    ;;
esac

if [[ "${EUID}" -ne 0 ]]; then
  echo "Error: run this installer with sudo." >&2
  exit 1
fi

if [[ -z "${VERSION}" ]]; then
  echo "Error: version cannot be empty. Use 'latest' or a release tag like 'v2.0.0'." >&2
  exit 1
fi

RELEASE_PATH="latest/download"
if [[ "${VERSION}" != "latest" ]]; then
  RELEASE_PATH="download/${VERSION}"
fi

# تغییر آدرس به ریپازیتوری شخصی
URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/${RELEASE_PATH}/${LANG_CODE}.html"
if [[ "${LANG_CODE}" == "fa" ]]; then
  URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/${RELEASE_PATH}/index.html"
fi

RAW_PREBUILT_BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${PREBUILT_REF}/prebuilt"

mkdir -p "${DEST_DIR}"
TEMP_DIR="$(mktemp -d)"
STAGED_FILE="$(mktemp "${DEST_DIR}/.subscription-template.XXXXXX")"

download_file() {
  local source_url="$1"
  local target_file="$2"

  if command -v wget >/dev/null 2>&1; then
    wget -q --timeout=25 --tries=3 -O "${target_file}" "${source_url}"
  elif command -v curl >/dev/null 2>&1; then
    curl -fsSL --connect-timeout 25 --retry 3 --retry-delay 2 "${source_url}" -o "${target_file}"
  else
    return 127
  fi
}

download_prebuilt_fallback() {
  local archive="${TEMP_DIR}/index.html.gz"
  local manifest="${TEMP_DIR}/index.parts"
  local part_file=""
  local part=""
  local part_count=""
  local part_index=0

  if ! command -v gzip >/dev/null 2>&1; then
    echo "Error: gzip is required for the prebuilt fallback." >&2
    return 1
  fi

  if ! download_file "${RAW_PREBUILT_BASE}/index.parts" "${manifest}"; then
    echo "Error: failed to download the prebuilt manifest." >&2
    return 1
  fi

  read -r part_count < "${manifest}"
  if [[ ! "${part_count}" =~ ^[1-9][0-9]?$ ]]; then
    echo "Error: invalid prebuilt manifest." >&2
    return 1
  fi

  : > "${archive}"
  for ((part_index = 0; part_index < part_count; part_index++)); do
    printf -v part '%02d' "${part_index}"
    part_file="${TEMP_DIR}/index.html.gz.part-${part}"
    if ! download_file "${RAW_PREBUILT_BASE}/index.html.gz.part-${part}" "${part_file}"; then
      echo "Error: failed to download prebuilt part ${part}." >&2
      return 1
    fi
    cat "${part_file}" >> "${archive}"
  done

  gzip -t "${archive}"
  gzip -dc "${archive}" > "${STAGED_FILE}"
}

if ! command -v wget >/dev/null 2>&1 && ! command -v curl >/dev/null 2>&1; then
  echo "Error: neither wget nor curl is installed." >&2
  exit 1
fi

if [[ "${VERSION}" == "latest" && "${LANG_CODE}" == "fa" ]]; then
  echo "Downloading the current prebuilt Persian template..."
  download_prebuilt_fallback
elif ! download_file "${URL}" "${STAGED_FILE}"; then
  echo "Error: release asset could not be downloaded for ${LANG_CODE} (${VERSION})." >&2
  exit 1
fi

if [[ ! -s "${STAGED_FILE}" ]] || ! grep -qi '<!doctype html' "${STAGED_FILE}"; then
  echo "Error: downloaded release asset is not a valid HTML template." >&2
  exit 1
fi

if [[ "$(wc -c < "${STAGED_FILE}")" -lt 100000 ]]; then
  echo "Error: downloaded template is unexpectedly small; installation stopped." >&2
  exit 1
fi

chmod 0644 "${STAGED_FILE}"

if [[ -f "${DEST_FILE}" ]]; then
  ROLLBACK_FILE="$(mktemp "${DEST_DIR}/.index.rollback.XXXXXX")"
  cp -p "${DEST_FILE}" "${ROLLBACK_FILE}"
fi

if [[ -f "${ENV_FILE}" ]]; then
  cp -p "${ENV_FILE}" "${TEMP_DIR}/pasarguard.env"
fi

mv -f "${STAGED_FILE}" "${DEST_FILE}"
STAGED_FILE=""

mkdir -p "$(dirname "${ENV_FILE}")"
touch "${ENV_FILE}"

if grep -q '^CUSTOM_TEMPLATES_DIRECTORY=' "${ENV_FILE}"; then
  sed -i 's|^CUSTOM_TEMPLATES_DIRECTORY=.*|CUSTOM_TEMPLATES_DIRECTORY="/var/lib/pasarguard/templates/"|' "${ENV_FILE}"
else
  echo 'CUSTOM_TEMPLATES_DIRECTORY="/var/lib/pasarguard/templates/"' >> "${ENV_FILE}"
fi

if grep -q '^SUBSCRIPTION_PAGE_TEMPLATE=' "${ENV_FILE}"; then
  sed -i 's|^SUBSCRIPTION_PAGE_TEMPLATE=.*|SUBSCRIPTION_PAGE_TEMPLATE="subscription/index.html"|' "${ENV_FILE}"
else
  echo 'SUBSCRIPTION_PAGE_TEMPLATE="subscription/index.html"' >> "${ENV_FILE}"
fi

restart_pasarguard() {
  local restart_log="${TEMP_DIR}/pasarguard-restart.log"
  local restart_status=0

  if command -v timeout >/dev/null 2>&1; then
    timeout --signal=TERM --kill-after=5s 45s pasarguard restart > "${restart_log}" 2>&1 || restart_status=$?

    if [[ "${restart_status}" -eq 0 ]]; then
      return 0
    fi

    if [[ "${restart_status}" -eq 124 ]] && grep -Eqi 'Application startup complete|Uvicorn running on' "${restart_log}"; then
      return 0
    fi
  else
    pasarguard restart > "${restart_log}" 2>&1 &
    local restart_pid=$!

    for _ in $(seq 1 45); do
      if grep -Eqi 'Application startup complete|Uvicorn running on' "${restart_log}"; then
        kill -TERM "${restart_pid}" 2>/dev/null || true
        wait "${restart_pid}" 2>/dev/null || true
        return 0
      fi

      if ! kill -0 "${restart_pid}" 2>/dev/null; then
        wait "${restart_pid}"
        return $?
      fi

      sleep 1
    done

    kill -TERM "${restart_pid}" 2>/dev/null || true
    wait "${restart_pid}" 2>/dev/null || true
  fi

  echo "PasarGuard restart output:" >&2
  tail -n 30 "${restart_log}" >&2 || true
  return 1
}

if command -v pasarguard >/dev/null 2>&1; then
  echo "در حال ری‌استارت PasarGuard؛ این مرحله ممکن است تا ۴۵ ثانیه طول بکشد..."
  if ! restart_pasarguard; then
    echo "Error: PasarGuard restart failed; restoring the previous configuration." >&2
    if [[ -n "${ROLLBACK_FILE}" && -f "${ROLLBACK_FILE}" ]]; then
      mv -f "${ROLLBACK_FILE}" "${DEST_FILE}"
      ROLLBACK_FILE=""
    fi
    if [[ -f "${TEMP_DIR}/pasarguard.env" ]]; then
      cp -p "${TEMP_DIR}/pasarguard.env" "${ENV_FILE}"
    fi
    if command -v timeout >/dev/null 2>&1; then
      timeout --signal=TERM --kill-after=5s 45s pasarguard restart >/dev/null 2>&1 || true
    else
      pasarguard restart >/dev/null 2>&1 &
    fi
    exit 1
  fi
  echo "✅ نصب قالب سفارشی (${LANG_CODE}, ${VERSION}) انجام شد و PasarGuard ری‌استارت گردید."
else
  echo "✅ قالب سفارشی (${LANG_CODE}, ${VERSION}) در مسیر ${DEST_FILE} نصب شد."
  echo "⚠️ دستور pasarguard یافت نشد، سرویس را به‌صورت دستی ری‌استارت کنید."
fi
