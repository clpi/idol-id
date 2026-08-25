#!/usr/bin/env bash
# deploy-units.sh <app> <port> <unit-name> [extra-env-file]
# Writes a systemd unit for one idol.id app face, reloads, restarts.
set -e
APP="$1"; PORT="$2"; UNIT="$3"; EXTRA="${4:-}"
DIR=/home/clp/idol-id
{
  echo "[Unit]"
  echo "Description=idol.id $APP face ($UNIT)"
  echo "After=network.target"
  echo ""
  echo "[Service]"
  echo "Type=simple"
  echo "User=clp"
  echo "WorkingDirectory=$DIR"
  echo "ExecStart=/usr/bin/python3 $DIR/server.py --app $APP --port $PORT"
  echo "Restart=always"
  echo "RestartSec=3"
  echo "Environment=IDOL_BIN=$DIR/idol-bin"
  echo "Environment=IDOL_LIBS_DIR=$DIR/lib-src"
  echo "EnvironmentFile=$DIR/r2.env"
  [ -n "$EXTRA" ] && cat "$EXTRA"
  echo ""
  echo "[Install]"
  echo "WantedBy=multi-user.target"
} > /etc/systemd/system/$UNIT.service
systemctl daemon-reload
systemctl restart "$UNIT"
sleep 1
echo "$UNIT: $(curl -s localhost:$PORT/health)"
