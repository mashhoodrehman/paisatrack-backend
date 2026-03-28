#!/bin/sh

set -e

pm2 start ecosystem.config.js
pm2 save
pm2 status
