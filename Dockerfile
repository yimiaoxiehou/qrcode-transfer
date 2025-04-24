FROM docker.utpf.cn/docker.io/library/ubuntu
COPY qrcode-transfer-linux-amd64 /qrcode-transfer
WORKDIR /
ENTRYPOINT ["/qrcode-transfer"]
