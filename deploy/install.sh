#!/bin/sh
# install.sh — install one idol.id platform instance as a systemd service.
#   sudo sh deploy/install.sh <app> <port> [instance]
# app: graph | lib | docs | api | site
set -eu
APP="${1:?usage: install.sh <app> <port> [instance]}"
PORT="${2:?usage: install.sh <app> <port> [instance]}"
INSTANCE="${3:-$(hostname -s)}"
case "$APP" in graph|lib|docs|api|site) ;; *) echo "bad app: $APP" >&2; exit 2 ;; esac

USER="${SUDO_USER:-$(id -un)}"
HOME_DIR="$(getent passwd "$USER" | cut -d: -f6)"
UNIT="idol-$APP.service"
DEST="/etc/systemd/system/$UNIT"

mkdir -p "/etc/systemd/system/$UNIT.d"
cat > "/etc/systemd/system/$UNIT.d/env.conf" <<EOF
[Service]
Environment=IDOL_INSTANCE=$INSTANCE
EnvironmentFile=-/etc/idol/idol.env
EOF

cat > "$DEST" <<EOF
[Unit]
Description=idol.id platform — $APP ($INSTANCE)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME_DIR/idol-id
ExecStart=/usr/bin/python3 $HOME_DIR/idol-id/server.py --app $APP --port $PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$UNIT"
systemctl restart "$UNIT"
sleep 1
systemctl --no-pager -l status "$UNIT" | head -6
echo "→ http://localhost:$PORT ($APP, instance $INSTANCE)"
