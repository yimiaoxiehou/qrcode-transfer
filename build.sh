#!/bin/bash

yarn build
GOOS=linux GOARCH=amd64 go build -o qrcode-transfer-linux-amd64
GOOS=darwin GOARCH=amd64 go build -o qrcode-transfer-darwin-amd64
GOOS=windows GOARCH=amd64 go build -o qrcode-transfer-windows-amd64.exe

docker build -t yimiaoxiehou/qrcode-transfer:latest .