import React, { useState, useCallback, useEffect, useRef } from "react";
import { Container, Form } from "react-bootstrap";

import { fromUint8Array } from 'js-base64'
import { blockToBinary, createEncoder, appendFileHeaderMetaToBuffer } from 'luby-transform'
import { renderSVG } from 'uqr'
import brotliPromise from 'brotli-wasm';

const archiveType = require('archive-type');
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatSeconds(seconds: number) {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  return `${minutes}分${remainingSeconds}秒`;
}

function Send() {
  const [timeSpeedInfo, setTimeSpeedInfo] = useState<string>("");
  const [currentSVG, setCurrentSVG] = useState<string>("");
  const generatorRef = useRef<Generator | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [brotli, setBrotli] = useState<any>(null);
  useEffect(() => {
    const initBrotli = async () => {
      const brotliInstance = await brotliPromise;
      setBrotli(brotliInstance);
    };
    initBrotli();
    return () => {
      // 清理定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setCurrentSVG("");
      setTimeSpeedInfo("");
      // 清理生成器
      generatorRef.current = null;
    };
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0] || !brotli) return;
      const file = e.target.files[0];

      // 清理之前的资源
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setCurrentSVG("");

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const fileType = archiveType(bytes);

        let data;
        let zip = false;
        if (fileType) {
          data = bytes;
          zip = false;
        } else {
          try {
            const compressed = brotli.compress(bytes, {
              quality: 5,
            });
            if (compressed.length < bytes.length) {
              data = compressed;
              zip = true;
            } else {
              data = bytes;
              zip = false;
            }
          } catch (e) {
            console.error('Compression failed, use raw file.', e);
            data = bytes;
            zip = false;
          }
        }
        setTimeSpeedInfo(
          `数据压缩后大小: ${formatBytes(
            data.length
          )}, 传输时间最少需要 ${formatSeconds(data.length / 800 / 10)}`
        );
        const bytesWithHeader = await appendFileHeaderMetaToBuffer(data, {
          filename: encodeURIComponent(file.name),
          contentType: zip ? file.type + "|zip" : file.type,
        }); // 为压缩数据添加文件头信息，便于后续反编

        const encoder = createEncoder(bytesWithHeader, 1000)
        timeoutRef.current = setInterval(() => {
          const data = encoder.fountain().next().value
          const binary = blockToBinary(data)
          const str = fromUint8Array(binary)
          const svg = renderSVG(str, { border: 2 })
          setCurrentSVG(svg);
        },
          1000 / 15)
      } catch (error) {
        console.error("File processing error:", error);
      }


      // 清理 input 的 value，允许选择相同文件
      e.target.value = "";
    },
    [brotli]
  );

  return (
    <Container
      fluid
      className="p-0 position-relative"
      style={{
        maxWidth: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Form.Group className="mb-3" style={{
        width: "300px"
      }}>
        <Form.Control type="file" onChange={handleFileChange} accept="*" />
      </Form.Group>
      {timeSpeedInfo && <p>{timeSpeedInfo}</p>}
      {/* 使用时间戳作为key确保每次都会重新渲染 */}
      {currentSVG && (
        <div
          style={{
            maxWidth: "97vw",
            width: "600px",
            maxHeight: "97vw",
            height: "600px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          dangerouslySetInnerHTML={{
            __html: currentSVG,
          }}
        />
      )}
    </Container>
  );
}

export default Send;
