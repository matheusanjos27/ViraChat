#!/usr/bin/env bash
# Primeiro boot na VPS (Ubuntu 22.04/24.04) — rodar como root
set -euo pipefail

echo "==> Swap 2G (ajuda em VPS 4GB)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

echo "==> Git"
apt-get update -y
apt-get install -y git curl ca-certificates

echo "==> Pronto. Clone o repo e siga docker/DEPLOY-VPS.md"
docker --version
