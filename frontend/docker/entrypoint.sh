#!/bin/sh
set -e

# Write the runtime-configurable backend URL into a plain JS file that
# index.html loads before the app bundle. This lets you change API_URL
# by just restarting the container with a different env var - no rebuild
# needed, which matters on platforms that inject env vars at *runtime*
# rather than at Docker build time (e.g. Back4App Containers).
echo "window.__API_URL__ = \"${API_URL:-http://localhost:4000/api}\";" > /app/dist/config.js

exec serve -s dist -l "${PORT:-3000}"
