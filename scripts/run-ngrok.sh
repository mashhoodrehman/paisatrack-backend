#!/bin/sh

PORT="${PORT:-5050}"
exec ngrok http "$PORT" --log=stdout
