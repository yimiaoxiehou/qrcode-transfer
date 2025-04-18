import React, { useRef, useState, useEffect } from "react";
import * as ww from "@wecom/jssdk";
import fountain_wasm_init, {
  decode_for_file,
} from "@yimiaoxiehou/fountain-wasm";
import rxing_wasm_init, {
  convert_canvas_to_luma,
  decode_barcode,
} from "@yimiaoxiehou/rxing-wasm";
import Axios from "axios";
import { Button } from "react-bootstrap";
import FormData from "form-data";
const pako = require("pako");

function Receive() {
  const [curDid, setCurDid] = useState(0);
  const [count, setCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const initWasm = async () => {
      try {
        await Promise.all([
          fountain_wasm_init(),
          rxing_wasm_init()
        ]);
        console.log("WASM modules initialized");
        await getAppJsapiTicket();
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    };

    initWasm();

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopStream();
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const getAppJsapiTicket = async () => {
    try {
      const res = await Axios.get("/api/getJsTicket");
      if (res.data?.errcode !== 0) {
        throw new Error(res.data?.errmsg || "Failed to get ticket");
      }
      
      ww.register({
        corpId: "ww0f642810a65d6cb8",
        agentId: 1000006,
        jsApiList: ["previewFile"],
        getConfigSignature: ww.getSignature,
        onConfigSuccess: () => console.log("Config success"),
        onConfigComplete: () => console.log("Config complete")
      });
    } catch (error) {
      console.error("Ticket error:", error);
    }
  };

  const processFile = async (file: any) => {
    try {
      const fileData = pako.inflate(file.data);
      const blob = new Blob([fileData], { type: file.mime_type });
      
      // Upload and preview
      const formData = new FormData();
      formData.append("file", blob, file.name);
      
      await Axios.post("/api/upload", formData);
      ww.previewFile({
        url: `/api/upload?filename=${file.name}`,
        name: file.name,
        size: fileData.length,
        success: () => console.log("Preview success"),
        fail: console.error
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log("File processed successfully");
      return true;
    } catch (error) {
      console.error("File processing error:", error);
      return false;
    }
  };

  const drawFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d")!;
    
    context.drawImage(video, 0, 0);
    const luma8Data = convert_canvas_to_luma(canvas);
    
    try {
      const parsedBarcode = decode_barcode(luma8Data, canvas.width, canvas.height);
      if (parsedBarcode?.raw_bytes().length > 0) {
        setCount(prev => prev + 1);
        const file = await decode_for_file(512, parsedBarcode.raw_bytes());
        if (file && await processFile(file)) {
          setIsScanning(false);
          return;
        }
      }
    } catch (error) {
      if (error !== "not found") {
        console.warn("Scanning error:", error);
      }
    }
    
    requestAnimationFrame(drawFrame);
  };

  const startCamera = async (facingMode: "user" | "environment" = "user") => {
    try {
      setIsScanning(true);
      stopStream();

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      const deviceId = videoDevices[curDid]?.deviceId;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId,
          facingMode: { exact: "environment" }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          drawFrame();
        };
      }
      
      setCurDid((curDid + 1) % videoDevices.length);
    } catch (error) {
      console.error("Camera error:", error);
      setIsScanning(false);
    }
  };

  const toggleCamera = () => {
    if (!streamRef.current) return;
    // 获取当前摄像头模式
    const videoTrack = streamRef.current.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const currentFacingMode =
      settings.facingMode === "user" ? "environment" : "user";

    // 重新启动摄像头
    startCamera(currentFacingMode);
  };

  return (
    <div className="App">
      <header className="App-header">
        <Button onClick={() => startCamera()} style={{ margin: "20px" }}>
          扫描二维码
        </Button>
        <Button
          onClick={toggleCamera}
          style={{ margin: "20px" }}
          variant="info"
        >
          切换摄像头
        </Button>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            display: "none",
          }}
        />
        <canvas id="canvas" ref={canvasRef}></canvas>
      </header>
    </div>
  );
}

export default Receive;
