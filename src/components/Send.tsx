import React, { useRef, useEffect, useCallback } from 'react';
import fountain_wasm_init, { init_encode_from_file, next_val } from "@yimiaoxiehou/fountain-wasm";
import rxing_wasm_init from "@yimiaoxiehou/rxing-wasm";
import QRCode, { QRCodeByteSegment } from 'qrcode';
import { Form } from 'react-bootstrap';
const pako = require('pako');

function Send() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  // 初始化WASM模块
  useEffect(() => {
    const initWASM = async () => {
      try {
        await Promise.all([fountain_wasm_init(), rxing_wasm_init()]);
        console.log("WASM模块初始化成功");
      } catch (error) {
        console.error("WASM初始化失败:", error);
      }
    };

    initWASM();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const generateQRCode = useCallback((canvas: HTMLCanvasElement, data: Uint8Array) => {
    const byteSegment: QRCodeByteSegment = {
      data: data,
      mode: 'byte'
    };
    QRCode.toCanvas(canvas, [byteSegment], { 
      errorCorrectionLevel: 'L',
      margin: 1,
      scale: 8
    }).catch(console.error);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canvasRef.current || !e.target.files?.[0]) return;

    const canvas = canvasRef.current;
    const file = e.target.files[0];

    file.arrayBuffer().then(async (buffer) => {
      const bytes = new Uint8Array(buffer);
      const compressedData = pako.deflate(bytes);
      
      console.log(`原始数据大小: ${bytes.length} bytes`);
      console.log(`压缩后大小: ${compressedData.length} bytes`);

      const enc = init_encode_from_file(512, file.name, file.type, compressedData);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        const data = next_val(enc);
        if (data.length > 0) {
          generateQRCode(canvas, data);
        }
      }, 200);
    }).catch(console.error);
  }, [generateQRCode]);

  return (
    <div className="App">
      <header className="App-header">
        <Form.Group className="mb-3">
          <Form.Control 
            type="file" 
            onChange={handleFileChange}
            accept="*" 
          />
        </Form.Group>
        <canvas 
          ref={canvasRef}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </header>
    </div>
  );
}

export default Send;
