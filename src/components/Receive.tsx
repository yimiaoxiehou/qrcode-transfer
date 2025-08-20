import React, { useRef, useState, useEffect } from "react";
import {
  createDecoder,
  readMetaFromBuffer,
  binaryToBlock,
} from "luby-transform";
import { toUint8Array } from "js-base64";
import QrScanner from "qr-scanner";

import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Alert,
  ProgressBar,
} from "react-bootstrap";
import { CameraOff, SwitchCamera } from "lucide-react";

const pako = require("pako");

interface FileMeta {
  filename: string;
  contentType: string;
}

interface ReceiveInfo {
  received: number;
  checksum: number;
  filesize: number;
  progress: number;
}

function Receive() {
  const [curDid, setCurDid] = useState(0);
  // eslint-disable-next-line 
  const [isScanning, setIsScanning] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [receiveInfo, setReceiveInfo] = useState<ReceiveInfo | undefined>(
    undefined
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const decoder = createDecoder();
  const qrScannerRef = useRef<QrScanner | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // 优化清理函数
  useEffect(() => {
    const cleanup = () => {
      // 清理 QrScanner
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
      // 清理视频流
      stopStream();
      // 清理动画帧
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      // 重置状态
      setIsScanning(false);
      setHasPermission(null);
      setReceiveInfo(undefined);
      setStartDate(undefined);
      setEndDate(undefined);
      // 清理解码器
      if (decoder) {
        // @ts-ignore
        decoder.destroy?.();
      }
    };
    return cleanup;
  // eslint-disable-next-line 
  }, []);

  // 优化文件下载函数，确保 URL 对象被正确释放
  const downloadFile = (data: Uint8Array, meta: FileMeta) => {
    try {
      const unzipData = meta.contentType.endsWith("|zip") ? pako.inflate(data) : data;
      const blob = new Blob([unzipData], { type: meta.contentType.endsWith("|zip") ? meta.contentType.split("|")[0] : meta.contentType });
      const url = URL.createObjectURL(blob);

      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = decodeURIComponent(meta.filename);
        a.click();
      } finally {
        // 确保 URL 对象被释放
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Download failed:", error);
      throw error;
    }
  };

  // 优化停止流函数
  const stopStream = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        track.stop();
        streamRef.current?.removeTrack(track);
      });
      streamRef.current = null;
    }

    // 清理视频元素
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };


  // 二维码处理逻辑
  const handleQrResult = (result: { data: string }) => {
    try {
      const block = binaryToBlock(toUint8Array(result.data));
      const isOkay = decoder.addBlock(block);
      // 只在第一次接收到数据时设置开始时间和打印日志
      if (!startDate) {
        setStartDate((p) => {
          if (p === undefined) {
            console.log(
              "receive file start, checksum: ",
              decoder.meta.checksum
            );
            return new Date();
          } else {
            return p;
          }
        });
      }
      console.log(decoder.decodedCount)
      console.log(JSON.stringify(decoder.meta))
      console.log(decoder.meta.data.length)
      setReceiveInfo({
        received: decoder.encodedCount,
        checksum: decoder.meta.checksum,
        filesize: decoder.meta.bytes,
        progress: Math.round(
          (decoder.decodedCount + 1) / (decoder.meta.k + 1) < 0.3 ? decoder.encodedCount / decoder.meta.k * 3 : (decoder.decodedCount + 1) / (decoder.meta.k + 1)
        ),
      });
      if (isOkay) {
        setEndDate((p) => {
          if (p === undefined) {
            return new Date();
          } else {
            return p;
          }
        });
        console.log("receive file success, checksum: ", decoder.meta.checksum);
        setIsScanning(false);
        const result = decoder.getDecoded();
        if (!result) {
          return;
        }
        const [data, meta] = readMetaFromBuffer(result) as [
          Uint8Array,
          FileMeta
        ];
        downloadFile(data, meta);
        if (qrScannerRef.current) {
          qrScannerRef.current.stop();
          qrScannerRef.current.destroy();
          qrScannerRef.current = null;
        }
        stopStream();
        // 清理解码器
        if (decoder) {
          // @ts-ignore
          decoder.destroy?.();
        }
      }
    } catch (error) {
      console.error("QR processing failed:", error);
    }
  };

  // 优化后的摄像头启动逻辑
  const startCamera = async () => {
    try {
      setIsScanning(true);
      stopStream();
      setHasPermission(true); // 初始化时设置为tru
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput").reverse();
      console.log(videoDevices)
      // 尝试获取后置摄像头
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('环境') ||
        device.label.toLowerCase().includes('后置')
      );
      // 优化设备ID选择逻辑
      const deviceId = curDid === 0 && backCamera 
        ? backCamera.deviceId 
        : videoDevices[curDid]?.deviceId;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId,
          facingMode: backCamera ? "environment" : undefined,
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        qrScannerRef.current = new QrScanner(videoRef.current, handleQrResult, {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 10,
          // 设置扫描区域
          calculateScanRegion: (video: HTMLVideoElement) => {
            const smallestDimension = Math.min(
              video.videoWidth,
              video.videoHeight
            );
            const scanRegionSize = Math.round(smallestDimension);

            return {
              x: Math.round((video.videoWidth - scanRegionSize) / 2),
              y: Math.round((video.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            };
          },
        });
        qrScannerRef.current.setInversionMode("both");
        qrScannerRef.current.start();
      }
    } catch (error) {
      console.error("Camera error:", error);
      setIsScanning(false);
    }
  };

  const toggleCamera = () => {
    setCurDid((curDid) => (curDid + 1) % 2);
    startCamera();
  };

  return (
    <Container
      fluid
      className="p-0 position-relative"
      style={{
        maxWidth: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Row className="g-0 flex">
        <Col xs={12}>
          <div
            className="video-container"
            style={{
              width: "100%",
              backgroundColor: "#000",
            }}
          >
            {!hasPermission && (
              <div className="d-flex flex-column align-items-center justify-content-center h-100 text-white p-3">
                <CameraOff size={48} className="mb-3" />
                <Button
                  variant="outline-light"
                  onClick={startCamera}
                  className="mt-2"
                >
                  开始接收
                </Button>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              width="100%"
              height="100%"
              style={{
                objectFit: "cover",
                display: hasPermission === false ? "none" : "block",
              }}
            />
            <div className="position-absolute top-0 end-0 p-1">
              <Button
                variant="link"
                className="text-white d-flex flex-column align-items-center"
                onClick={toggleCamera}
                disabled={!hasPermission}
              >
                <SwitchCamera size={24} style={{ color: "#9ec5fe" }} />
              </Button>
            </div>
          </div>
        </Col>
      </Row>
      <Row className="g-0 flex-grow-1">
        <Col xs={12} className="h-100">
          <Card className="border-0 rounded-0 h-100" style={{
            backgroundColor: "#282c34",
            color: "#fff",
          }}>
            {receiveInfo === undefined && (
              <Card.Body>
                <Card.Title>提示</Card.Title>
                <Card.Text>点击右上角的按钮可以切换摄像头。</Card.Text>
                <Alert
                  variant="info"
                  className="mb-0 mt-2"
                  style={{
                    textAlign: "left",
                  }}
                >
                  <small>
                    提示：首次使用时，请允许浏览器访问您的摄像头。如果您看不到摄像头画面。
                    <br></br>
                    请检查您的浏览器设置并确保已授予摄像头权限。
                    <br></br>
                    接收文件时，请确保摄像头包含完整的二维码并尽量靠近屏幕。
                  </small>
                </Alert>
              </Card.Body>
            )}
            {receiveInfo !== undefined && (
              <Card.Body>
                <Card.Title>接收文件中</Card.Title>
                <Alert
                  variant="info"
                  className="mb-0 mt-2"
                  style={{
                    textAlign: "left",
                  }}
                >
                  <Row className="mb-2">
                    <Col xs={4} className="text-end fw-medium">
                      已扫描:
                    </Col>
                    <Col xs={8}>{receiveInfo.received}</Col>
                  </Row>
                  <Row className="mb-2">
                    <Col xs={4} className="text-end fw-medium">
                      校验码:
                    </Col>
                    <Col xs={8}>{receiveInfo.checksum}</Col>
                  </Row>
                  <Row className="mb-2">
                    <Col xs={4} className="text-end fw-medium">
                      文件大小:
                    </Col>
                    <Col xs={8}>{receiveInfo.filesize} bytes</Col>
                  </Row>
                  <Row className="mb-2">
                    <Col xs={4} className="text-end fw-medium">
                      总进度:
                    </Col>
                    <Col xs={8} className="mt-1">
                      <ProgressBar
                        now={receiveInfo.progress}
                        variant="primary"
                      />
                    </Col>
                    <Row className="mb-2">
                      <Col xs={4} className="text-end fw-medium">
                        开始时间:
                      </Col>
                      <Col xs={8}>{startDate?.toLocaleString()}</Col>
                    </Row>
                    <Row className="mb-2">
                      <Col xs={4} className="text-end fw-medium">
                        结束时间:
                      </Col>
                      <Col xs={8}>{endDate?.toLocaleString()}</Col>
                    </Row>
                  </Row>
                </Alert>
              </Card.Body>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Receive;
