#!/bin/sh
# Copies app/ to dist/ and stamps the committed sha into <meta name="build"> and the footer (R6).
set -eu
cd "$(dirname "$0")"
if [ -n "$(git status --porcelain -- app)" ]; then echo "app/ has uncommitted changes; commit first" >&2; exit 1; fi
SHA=$(git rev-parse HEAD)
rm -rf dist && cp -R app dist
sed "s/__BUILD_SHA__/$SHA/g" app/index.html > dist/index.html
echo "$SHA"
