#!/bin/sh

set -e

pm2 stop ecosystem.config.js || true
pm2 delete ecosystem.config.js || true
