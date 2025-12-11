import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import Draggable from "react-draggable";
import SignatureCanvas from "react-signature-canvas";
import axios from "axios";
import "./styles/PdfContainer.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// import { pdfjs } from "react-pdf";
// import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js";
// pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

// MUST be after all imports
// pdfjs.GlobalWorkerOptions.workerSrc =
//   `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;


export default function PdfComp() {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [viewerWidth] = useState(680);
  const [boxPos, setBoxPos] = useState({ x: 60, y: 60 });
  const [canvasW, setCanvasW] = useState(0);
  const [canvasH, setCanvasH] = useState(0);

  const containerRef = useRef(null);
  const boxRef = useRef(null);
  const sigRef = useRef(null);

  useEffect(() => {
    // measure canvas on resize
    const onResize = () => measureCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (f) {
      setPdfFile(f);
      // reset saved position when new pdf selected (optional)
      // localStorage.removeItem("sigBoxPos");
    }
  }

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setTimeout(() => measureCanvas(), 250);
  }

  function measureCanvas() {
    if (!containerRef.current) return;
    const canvas = containerRef.current.querySelector("canvas");
    if (!canvas) return;
    setCanvasW(canvas.offsetWidth);
    setCanvasH(canvas.offsetHeight);
  }

  // restore saved pos (based on signature canvas top-left)
  useEffect(() => {
    const raw = localStorage.getItem("sigBoxPos");
    if (!raw) return;
    const saved = JSON.parse(raw);
    setTimeout(() => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (!canvas) return;
      const x = (saved.xPercent / 100) * canvas.offsetWidth;
      const y = (saved.yPercent / 100) * canvas.offsetHeight;
      // adjust so outer box places correctly (handle + border)
      const ADJUST_X = 2;
      const ADJUST_Y = 14;
      setBoxPos({ x: Math.max(0, x - ADJUST_X), y: Math.max(0, y - ADJUST_Y) });
    }, 300);
  }, [pdfFile]);
  

  const handleDrag = (e, data) => setBoxPos({ x: data.x, y: data.y });

  const handleStop = () => {
    const pdfCanvas = containerRef.current?.querySelector("canvas");
    const signCanvas = sigRef.current?.getCanvas();
    if (!pdfCanvas || !signCanvas) return;

    const pdfRect = pdfCanvas.getBoundingClientRect();
    const sigRect = signCanvas.getBoundingClientRect();

    const realX = sigRect.left - pdfRect.left;
    const realY = sigRect.top - pdfRect.top;

    const xPercent = (realX / pdfCanvas.offsetWidth) * 100;
    const yPercent = (realY / pdfCanvas.offsetHeight) * 100;

    localStorage.setItem("sigBoxPos", JSON.stringify({ xPercent, yPercent }));
    toast.info("Position saved");
  };

  const clearSig = () => sigRef.current && sigRef.current.clear();

  const handleSave = async () => {
    try {
      if (!pdfFile) { toast.error("Please select a PDF"); return; }
      if (!sigRef.current || sigRef.current.isEmpty()) { toast.error("Please sign"); return; }

      const saved = JSON.parse(localStorage.getItem("sigBoxPos") || "{}");
      const sigCanvasEl = sigRef.current.getCanvas();

      const fd = new FormData();
      fd.append("pdf", pdfFile);
      fd.append("signature", sigRef.current.toDataURL());
      fd.append("x", saved.xPercent ?? 0);
      fd.append("y", saved.yPercent ?? 0);
      fd.append("page", pageNumber);
      fd.append("pdfWidth", canvasW);
      fd.append("pdfHeight", canvasH);
      fd.append("sigWidth", sigCanvasEl.width);
      fd.append("sigHeight", sigCanvasEl.height);

      const res = await axios.post("https://pdfsigningbackend.onrender.com/sign-pdf", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob"
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "signed.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Signed PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Signing failed");
    }
  };

  return (
    <div className="pdf-app">
      <header className="pdf-header">
        <div><h2>PDF Signature Tool</h2><p className="muted">Upload · Drag · Sign · Download</p></div>
        <div className="header-actions">
          <label className="file-btn">
            Choose PDF
            <input type="file" accept="application/pdf" onChange={onFileChange} />
          </label>
        </div>
      </header>

      <main className="pdf-body">
        <div className="viewer-and-controls">
          <div className="pdf-wrapper" ref={containerRef}>
            {pdfFile ? (
              <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess}>
                <Page pageNumber={pageNumber} width={viewerWidth} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
            ) : (
              <div className="empty-state">Select a PDF to start signing</div>
            )}

            {pdfFile && (
              <Draggable
                nodeRef={boxRef}
                bounds="parent"
                handle=".drag-handle"
                position={boxPos}
                onDrag={handleDrag}
                onStop={handleStop}
                defaultPosition={{ x: 60, y: 60 }}
              >
                <div ref={boxRef} className="sig-box">
                  <div className="drag-handle">Drag</div>
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="black"
                    canvasProps={{ className: "sigCanvas", width: 140, height: 40 }}
                  />
                </div>
              </Draggable>
            )}
          </div>

          <div className="controls">
            <div className="control-row">
              <button className="btn btn-clear" onClick={clearSig}>Clear</button>
              <button className="btn btn-save" onClick={handleSave}>Save & Download</button>
            </div>

            <div className="control-row meta">
              <div>Page:
                <input type="number" min="1" max={numPages || 1} value={pageNumber}
                  onChange={(e) => setPageNumber(Number(e.target.value))} />
                <span className="muted"> of {numPages || "-"}</span>
              </div>

              <div className="muted small">Canvas: {canvasW}×{canvasH}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
