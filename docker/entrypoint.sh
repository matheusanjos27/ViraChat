#!/bin/sh
# Volume montado em /data/attachments nasce como root; o app roda como nextjs.
set -e
ATTACH_DIR="${ATTACHMENTS_DIR:-/data/attachments}"
mkdir -p "$ATTACH_DIR"
chown -R nextjs:nodejs "$ATTACH_DIR"
exec su-exec nextjs:nodejs "$@"
