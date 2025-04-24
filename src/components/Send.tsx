import React, { useState, useCallback, useEffect, useRef } from "react";
import { Container, Form } from "react-bootstrap";

import { createGeneraterSVG } from "@qifi/generate";
import { appendFileHeaderMetaToBuffer } from "luby-transform";
const pako = require("pako");

function Send() {
  const [currentSVG, setCurrentSVG] = useState<string>("");
  const generatorRef = useRef<Generator | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 清理资源
  useEffect(() => {
    return () => {
      // 清理定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 清理 SVG
      setCurrentSVG("");

      // 清理生成器
      generatorRef.current = null;
    };
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return;
      const file = e.target.files[0];

      // 清理之前的资源
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setCurrentSVG("");

      file
        .arrayBuffer()
        .then(buffer => {
          const bytes = new Uint8Array(buffer);
          let data = pako.deflate(bytes);
          console.log(`原始数据大小: ${bytes.length} bytes`);
          console.log(`压缩后大小: ${data.length} bytes`);
          return appendFileHeaderMetaToBuffer(data, {
            filename: file.name,
            contentType: file.type,
          }); // 为压缩数据添加文件头信息，便于后续反编
        }).then(data => createGeneraterSVG(data, {
            sliceSize: 1000,
            ecc: "L",
            border: 1,
          }))
        .then(async (generaterSVG) => {
          // 保存生成器引用
          const generator = generaterSVG.fountain();
          generatorRef.current = generator;
          async function processGenerator(generator: Generator) {
            for (const qrcode of generator) {
              if (!generatorRef.current) {
                // 如果组件已卸载，停止生成
                break;
              }
              // 使用 Promise 和 ref 管理定时器
              await new Promise((resolve) => {
                timeoutRef.current = setTimeout(resolve, 1000 / 10);
              });
              // @ts-ignore
              setCurrentSVG(qrcode);
            }
          }
          await processGenerator(generator);
          // 处理完成后清理
          URL.revokeObjectURL(file.name);
        })
        .catch((error) => {
          console.error("File processing error:", error);
        });

      // 清理 input 的 value，允许选择相同文件
      e.target.value = "";
    },
    []
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
      {/* 使用时间戳作为key确保每次都会重新渲染 */}
      { currentSVG && (
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
