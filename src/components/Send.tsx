import React, { useState, useCallback, useEffect, useRef } from "react";
import { Container, Form } from "react-bootstrap";

import { fromUint8Array } from 'js-base64'
import { blockToBinary, createEncoder,appendFileHeaderMetaToBuffer } from 'luby-transform'
import { renderSVG } from 'uqr'
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
            filename: encodeURIComponent(file.name),
            contentType: file.type,
          }); // 为压缩数据添加文件头信息，便于后续反编
        }).then(bytes => {
          const encoder = createEncoder(bytes, 1000)
          timeoutRef.current = setInterval(() => {
            const data = encoder.fountain().next().value
            const binary = blockToBinary(data)
            const str = fromUint8Array(binary)
            const svg = renderSVG(str, { border: 2 })
            setCurrentSVG(svg);
          },
            1000 / 10)
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
