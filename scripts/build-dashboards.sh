#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
osd_root="$(cd "${1:?Usage: build-dashboards.sh /path/to/OpenSearch-Dashboards}" && pwd)"
version="$(node -p "require(process.argv[1]).version" "$osd_root/package.json")"
if [[ "$version" != "3.9.0" ]]; then
  echo "Expected OpenSearch Dashboards source 3.9.0, found $version" >&2
  exit 1
fi

build_source="$(mktemp -d "$osd_root/plugins/self_monitoring_build_XXXXXX")"
trap 'rm -rf -- "$build_source"' EXIT
cp -R "$repo_root/dashboards-plugin/." "$build_source/"
cd "$build_source"
yarn build
mkdir -p "$repo_root/artifacts"
cp build/stackMonitoring-3.9.0.zip "$repo_root/artifacts/"
echo "Built $repo_root/artifacts/stackMonitoring-3.9.0.zip"
