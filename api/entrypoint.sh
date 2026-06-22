#!/bin/sh
set -e

echo "A correr migrations..."
npx prisma migrate deploy

echo "A arrancar servidor..."
exec node src/index.js
