#!/bin/sh
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"

if [ "$(id -u)" = "0" ]; then
  echo "A preparar directoria de uploads..."
  mkdir -p "$UPLOAD_DIR"
  chown -R node:node "$UPLOAD_DIR"
  RUN_AS_NODE="su-exec node"
else
  RUN_AS_NODE=""
fi

echo "A correr migrations..."
$RUN_AS_NODE npx prisma migrate deploy

echo "A arrancar servidor..."
exec $RUN_AS_NODE node src/index.js
