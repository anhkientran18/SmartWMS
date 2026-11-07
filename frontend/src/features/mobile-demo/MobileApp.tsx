/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import {
  Scan, Camera, Mic, Volume2, Sparkles, CheckCircle,
  AlertOctagon, RefreshCcw, FileText, Image, ShieldAlert, Cpu, LogOut, User
} from "lucide-react";
import { Bin, Product, WavePicking } from "../../types/index";
import ProfileScreen from "../auth/ProfileScreen";

interface MobileAppProps {
  products: Product[];
  bins: Bin[];
  waves: WavePicking[];
  onUpdateBinQty: (binCode: string, sku: string, qty: number, action: "ADD" | "SUBTRACT") => void;
  onUpdateWaveStep: (waveId: string, step: number) => void;
  lang: string;
  onLogout?: () => void;
}

export default function MobileApp({
  products,
  bins,
  waves,
  onUpdateBinQty,
  onUpdateWaveStep,
  lang,
  onLogout
}: MobileAppProps) {
  const isEn = lang === "en-US";

  // Tab navigation in Mobile app
  const [activeTab, setActiveTab] = useState<"scan" | "wave" | "voice" | "vision" | "profile">("scan");

  // Barcode State
  const [scanning, setScanning] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<Product | null>(null);
  const [actualQty, setActualQty] = useState<number>(10);
  const [assignedBin, setAssignedBin] = useState<string>("D2-A02-N01");
  const [scanMessage, setScanMessage] = useState("");
  const [bulkScanning, setBulkScanning] = useState(false);
  const [bulkScanResult, setBulkScanResult] = useState<Array<{ sku: string; qty: number; binCode: string; name: string }> | null>(null);

  // Voice State
  const [recording, setRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [resolvedIntent, setResolvedIntent] = useState<any>(null);
  const [speaking, setSpeaking] = useState(false);

  // Vision State
  const [invoiceOcrData, setInvoiceOcrData] = useState<any>(null);
  const [damageData, setDamageData] = useState<any>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const fileInputRefVisible = useRef<HTMLInputElement>(null);

  // Sound Synth Generator for scanner beep (prevents loading dead URLs)
  const triggerBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1KHz beep
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.12);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);

      // Attempt device haptic vibrate trigger
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(80);
      }
    } catch (e) {
      console.warn("Audio Context beep was blocked by user interact constraints");
    }
  };

  // Speaks response via Text-To-Speech (TTS)
  const speakOutLoud = (txt: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(txt);
    utterance.lang = lang === "en-US" ? "en-US" : "vi-VN";
    utterance.rate = 1.0;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Trigger Scanner Match
  const handleBarcodeSelect = (prod: Product) => {
    triggerBeepSound();
    setBarcodeResult(prod);
    setBulkScanResult(null);
    // Auto-Assign suggested optimal Bin based on category
    if (prod.category === "Beverage" || prod.category === "Food") {
      setAssignedBin(prod.sku === "MILK-VNM" ? "C1-A01-N02" : "D2-A02-N01");
    } else {
      setAssignedBin("D2-A02-N02");
    }
    setScanMessage("");
  };

  // Execute Bulk QR Scanning Simulation
  const executeBulkScan = async () => {
    if (!products || products.length === 0) return;
    setBulkScanning(true);
    setBarcodeResult(null);
    setScanMessage("");
    setBulkScanResult(null);

    // Simulate camera beep & slight delay for computer vision scan
    triggerBeepSound();

    await new Promise(resolve => setTimeout(resolve, 800));

    const scannedItems: Array<{ sku: string; qty: number; binCode: string; name: string }> = [];

    // Take first 3 products to scan
    const itemsToScan = products.slice(0, 3);

    // Hardcoded realistic amounts
    const qtys = [50, 30, 20];

    for (let i = 0; i < itemsToScan.length; i++) {
      const prod = itemsToScan[i];
      const qty = qtys[i % qtys.length];

      // Get assigned bin using robust index lookup or category backup
      let targetBin = "D2-A02-N01";
      if (bins && bins.length > i) {
        targetBin = bins[i].code;
      } else if (bins && bins.length > 0) {
        targetBin = bins[0].code;
      }

      try {
        await onUpdateBinQty(targetBin, prod.sku, qty, "ADD");
        scannedItems.push({
          sku: prod.sku,
          name: prod.name,
          qty,
          binCode: targetBin
        });
      } catch (err) {
        console.error("Bulk scan item fail:", prod.sku, err);
      }
    }

    setBulkScanResult(scannedItems);
    triggerBeepSound();
    setBulkScanning(false);
  };

  // Submit scan to DB
  const executeScanSubmission = async () => {
    if (!barcodeResult) return;
    setScanning(true);
    try {
      await onUpdateBinQty(assignedBin, barcodeResult.sku, actualQty, "ADD");
      setScanMessage(isEn ? `✓ Deposited ${actualQty} items to Bin ${assignedBin}` : `✓ Đã xếp thành công ${actualQty} ${barcodeResult.sku} vào kệ ${assignedBin}`);
      triggerBeepSound();
      setBarcodeResult(null);
    } catch (err: any) {
      setScanMessage(`✕ Error: ${err.message || "Failed"}`);
    } finally {
      setScanning(false);
    }
  };

  // Trigger simulated voice command intents
  const handleTriggerVoiceCmd = async (inputTranscript: string) => {
    setRecording(true);
    setVoiceTranscript(inputTranscript);
    setResolvedIntent(null);

    try {
      const res = await fetch("/api/gemini/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: inputTranscript, locale: lang })
      });
      const data = await res.json();
      setResolvedIntent(data);
      triggerBeepSound();
      speakOutLoud(data.confirmationText || "Command parsed.");

      // Auto perform addition or subtraction if requested concepts matched
      if (data.action === "ADD" || data.action === "SUBTRACT") {
        await onUpdateBinQty(data.binCode || "D2-A02-N01", data.sku, data.qty || 5, data.action);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecording(false);
    }
  };

  // Image Upload simulated handle (Ocr / Damage)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, mode: "ocr" | "damage") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzingImage(true);
    setInvoiceOcrData(null);
    setDamageData(null);

    // Convert file to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setUploadedImage(base64String);

      try {
        if (mode === "ocr") {
          const res = await fetch("/api/gemini/ocr-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64String })
          });
          const data = await res.json();
          setInvoiceOcrData(data);

          // Auto deposit into Bin if SKU matched
          if (data.items && data.items.length > 0) {
            const firstItem = data.items[0];
            await onUpdateBinQty("D2-A03-N01", firstItem.sku || "MILK-VNM", firstItem.quantity || 150, "ADD");
          }
        } else {
          const res = await fetch("/api/gemini/damage-detection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64String, locale: lang })
          });
          const data = await res.json();
          setDamageData(data);
        }
        triggerBeepSound();
      } catch (err) {
        console.error(err);
      } finally {
        setAnalyzingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Custom static templates for OCR & QC if camera isn't allowed
  const triggerSimulateVisionDoc = async (mode: "ocr" | "damage") => {
    setAnalyzingImage(true);
    setInvoiceOcrData(null);
    setDamageData(null);
    setUploadedImage("STUB_LABEL");

    try {
      if (mode === "ocr") {
        const res = await fetch("/api/gemini/ocr-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: "" })
        });
        const data = await res.json();
        setInvoiceOcrData(data);

        // Auto deposit Milk in simulation
        await onUpdateBinQty("C1-A01-N01", "MILK-VNM", 150, "ADD");
      } else {
        const res = await fetch("/api/gemini/damage-detection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: "", locale: lang })
        });
        const data = await res.json();
        setDamageData(data);
      }
      triggerBeepSound();
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzingImage(false);
    }
  };

  return (
    <div className="flex-1 flex justify-center items-center p-6 bg-slate-100/40">

      {/* High-Fidelity PDA Barcode Rugged Smartphone Wrapper */}
      <div className="w-80 h-[645px] bg-slate-950 rounded-[40px] shadow-2xl shadow-indigo-950/20 border-[8px] border-slate-800 relative flex flex-col overflow-hidden text-slate-100">

        {/* Notch Camera visual element */}
        <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-xl flex items-center justify-between px-6 z-40">
          <div className="text-[10px] font-mono tracking-tighter text-slate-400">08:18</div>
          <div className="h-2 w-16 bg-slate-950 rounded-full shrink-0"></div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span className="text-[10px] font-mono text-slate-400">98%</span>
          </div>
        </div>

        {/* Top PDA status handle bar */}
        <div className="pt-8 pb-3 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Cpu className="h-4 w-4 text-orange-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-mono font-bold text-orange-400 tracking-wider truncate">SmartWMS-PDA-09</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("profile")}
              className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase shrink-0 transition cursor-pointer flex items-center gap-1 ${
                activeTab === "profile"
                  ? "bg-indigo-600 text-white border-indigo-400"
                  : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20"
              }`}
            >
              <User className="h-3 w-3" />
              <span>{isEn ? "STAFF" : "NHÂN VIÊN"}</span>
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                title={isEn ? "Log Out Profile" : "Đăng xuất"}
                className="p-1 px-1.5 bg-rose-500/15 hover:bg-rose-500/35 border border-rose-500/35 hover:border-rose-500/50 text-rose-400 rounded-lg active:scale-95 transition"
              >
                <LogOut className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Screen View Space (height restricted) */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-3 pb-20 scrollbar-none">

          {/* TAB: Core Scanner matches UC-01 */}
          {activeTab === "scan" && (
            <div className="space-y-3.5">
              <div className="space-y-1">
                <h3 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
                  {isEn ? "📦 Smart Inbound Scan" : "📦 Quét Nhận Hàng Inbound"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isEn ? "Point camera at cargo QR/Barcode sheet labels." : "Nhận diện kiện hàng bằng Barcode dán sẵn."}
                </p>
              </div>

              {/* Camera Scanner Simulation overlay */}
              <div className="w-full h-40 bg-slate-900 rounded-xl border border-indigo-500/30 overflow-hidden relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,#090d16_90%)] z-10"></div>

                {/* Horizontal scanner red guide line */}
                <span className="absolute inset-x-4 h-0.5 bg-red-500 z-20 animate-bounce shadow-[0_0_10px_#ef4444]" style={{ animationDuration: "2s" }}></span>

                {/* Visual grid guides */}
                <div className="absolute top-8 bottom-8 left-12 right-12 border-2 border-dashed border-indigo-500/40 rounded-lg flex items-center justify-center z-10">
                  <Scan className="h-7 w-7 text-indigo-400/50 animate-pulse" />
                </div>

                <div className="absolute bottom-2 inset-x-2 text-center text-[9px] text-slate-500 font-mono z-25">
                  {isEn ? "[EMULATED CAMERA INTERFACE]" : "[MÔ PHỎNG CAMERA CHUYÊN DỤNG]"}
                </div>
              </div>

              {/* Barcode options lists to simulate scanning a real hardware item */}
              <div className="space-y-1.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono font-bold text-slate-400 block px-1">
                  {isEn ? "TAP ITEM IN LIST TO SIMULATE HARDWARE SCAN" : "CHỌN MÃ HÀNG GIẢ LẬP ĐỂ QUÉT BARCODE"}
                </span>

                <div className="grid grid-cols-2 gap-1.5">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleBarcodeSelect(p)}
                      className="py-1.5 px-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-[10px] rounded-lg text-slate-200 font-mono truncate text-left transition"
                    >
                      📟 {p.sku}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk scan option panel */}
              <div className="bg-slate-900 border border-emerald-500/20 p-2.5 rounded-xl space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] font-mono font-extrabold text-emerald-400 uppercase tracking-tight flex items-center gap-1">
                    ⚡ {isEn ? "CV MULTI-TAG DISPATCH" : "LÔ HÀNG HÓA MULTI-TAG"}
                  </span>
                  <span className="text-[8px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-bold">
                    {isEn ? "BULK QR" : "QUÉT LÔ QR"}
                  </span>
                </div>
                <button
                  onClick={executeBulkScan}
                  disabled={bulkScanning}
                  className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono rounded-lg text-[9px] font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Scan className="h-3 w-3 animate-pulse" />
                  {bulkScanning
                    ? (isEn ? "PROCESSING BULK AGGREGATE..." : "ĐANG CHUYỂN HOÁ DỮ LIỆU LÔ HÀNG...")
                    : (isEn ? "SIMULATE BULK QR CODE SCAN" : "GIẢ LẬP QUÉT LÔ NHIỀU MÃ QR MỘT LÚC")}
                </button>
              </div>

              {/* Scan Results Interactive Dialog */}
              {barcodeResult ? (
                <div className="bg-slate-900 border border-indigo-500/40 p-3 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex gap-2 items-start opacity-90">
                    <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 flex-1 w-0">
                      <h4 className="text-xs font-bold text-slate-200 truncate">{barcodeResult.name}</h4>
                      <p className="text-[9px] text-slate-400 font-mono">SKU: {barcodeResult.sku} | Barcode: {barcodeResult.barcode}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <label className="text-[9px] text-slate-500 font-mono block mb-0.5">
                        {isEn ? "Target Bin (Optimal Location)" : "Kệ Chứa Gợi Ý (Tối ưu AI)"}
                      </label>
                      <select
                        value={assignedBin}
                        onChange={(e) => setAssignedBin(e.target.value)}
                        className="w-full bg-slate-850 border border-slate-700 rounded p-1 text-[10px] text-slate-200 outline-none font-mono"
                      >
                        {bins.map(b => (
                          <option key={b.id} value={b.code}>Bin: {b.code.split('-').slice(1).join('-')}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-slate-500 font-mono block mb-0.5">
                        {isEn ? "Qty actually put-away" : "Số Lượng Thực Nhận"}
                      </label>
                      <input
                        type="number"
                        value={actualQty}
                        onChange={(e) => setActualQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-850 border border-slate-700 rounded p-1 text-[10px] text-slate-200 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <button
                    onClick={executeScanSubmission}
                    disabled={scanning}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition"
                  >
                    {isEn ? "SUBMIT SECURE WRITER" : "XÁC NHẬN NHẬP KHO VẬT LÝ"}
                  </button>
                </div>
              ) : bulkScanResult ? (
                <div className="bg-slate-900 border border-emerald-500/40 p-3 rounded-xl space-y-2 animate-fadeIn text-[10px]">
                  <div className="flex justify-between items-center text-emerald-400 font-mono font-bold uppercase border-b border-slate-805 pb-1.5">
                    <span className="flex items-center gap-1">✅ {isEn ? "BULK SCAN SUCCESS" : "HOÀN TẤT QUÉT LÔ"}</span>
                    <span className="bg-emerald-500 text-slate-950 px-1 py-0.5 rounded text-[8px] font-extrabold tracking-wider">
                      {isEn ? "SUCCESS" : "KẾT QUẢ"}
                    </span>
                  </div>

                  <div className="space-y-1.5 bg-slate-950 p-2 rounded-lg border border-slate-850 max-h-36 overflow-y-auto">
                    {bulkScanResult.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-900 last:border-0 font-mono">
                        <div>
                          <div className="text-slate-200 font-bold block">{item.sku}</div>
                          <div className="text-slate-500 text-[8px] truncate max-w-[120px]">{item.name}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-emerald-400 font-extrabold">+{item.qty} pcs</div>
                          <span className="bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-slate-400 text-[8px] font-bold block mt-0.5">Bin: {item.binCode}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[8px] text-slate-400 text-center italic mt-1 leading-snug">
                    {isEn
                      ? "3 cargo items systematically parsed, deduplicated, and logged matching physical inventory."
                      : "Dữ liệu từ 3 kiện QR code đã được trích xuất hoàn thiện & cập nhật cân bằng tồn tại kệ."}
                  </div>
                </div>
              ) : (
                scanMessage && (
                  <div className="p-3 bg-indigo-900/40 border border-indigo-500/20 rounded-xl text-center text-xs text-indigo-300 font-semibold animate-pulse">
                    {scanMessage}
                  </div>
                )
              )}
            </div>
          )}

          {/* TAB: Wave picking matches UC-02 */}
          {activeTab === "wave" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
                  {isEn ? "⚡ WAVE PICKING ROUTES" : "⚡ GOM ĐƠN WAVE PICKING"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isEn ? "Pick-path algorithm ordered layout to save travel steps." : "Lộ trình di chuyển ngắn nhất do thuật toán S-Shape chỉ định."}
                </p>
              </div>

              {waves.map((w) => (
                <div key={w.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-200">{w.name.slice(0, 25)}...</h4>
                      <span className="text-[9px] font-mono text-slate-500">ID: {w.id} | Staff: {w.assignedStaff}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      w.status === "Completed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse"
                    }`}>
                      {w.status}
                    </span>
                  </div>

                  {/* Move Steps List */}
                  <div className="space-y-2">
                    {w.optimizedPath.map((itm) => (
                      <div
                        key={itm.step}
                        className={`p-2 rounded-lg border flex items-center justify-between text-xs transition duration-150 ${
                          itm.scanned
                            ? "bg-slate-950 border-emerald-500/20 text-slate-500 line-through"
                            : "bg-slate-850 border-slate-800 text-slate-200"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-4 w-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
                              itm.scanned ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-600 text-white"
                            }`}>
                              {itm.step}
                            </span>
                            <span className="font-mono font-bold text-slate-200 bg-slate-900 px-1 py-0.5 rounded text-[10px]">
                              {itm.binCode.split('-').slice(1).join('-')}
                            </span>
                          </div>
                          <span className="text-[10px] block py-0.5">{itm.name.slice(0, 18)}...</span>
                          <span className="text-[9px] block text-slate-400 font-mono">{isEn ? "PICK QTY" : "SỐ LƯỢNG LẤY"}: {itm.qty} units ({itm.sku})</span>
                        </div>

                        {!itm.scanned && (
                          <button
                            onClick={() => {
                              triggerBeepSound();
                              onUpdateWaveStep(w.id, itm.step);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono px-2 py-1 rounded text-[9px] font-bold"
                          >
                            [SCAN BIN]
                          </button>
                        )}
                        {itm.scanned && (
                          <div className="text-[10px] font-mono text-emerald-500 font-bold uppercase">
                            ✓ {isEn ? "PICKED" : "HÀN TẤT"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: Voice command rảnh tay matches UC-03 */}
          {activeTab === "voice" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
                  {isEn ? "🗣️ Voice Command Control" : "🗣️ Nhận Lệnh Bằng Giọng Nói"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isEn
                    ? "Logistics actions parsed completely hands-free by our NLP Agent."
                    : "Nhân viên rảnh tay bốc vác chỉ cần phát khẩu lệnh, AI tự động xếp hàng và ghi nhận."}
                </p>
              </div>

              {/* Large record trigger */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-3">
                <button
                  onClick={() => handleTriggerVoiceCmd(
                    isEn
                      ? "Pick ten boxes of instant noodles from shelf D2-A02-N01"
                      : "Nhập 45 sữa tươi vào kệ C1-A01-N02"
                  )}
                  className={`h-16 w-16 rounded-full flex items-center justify-center transition border ${
                    recording
                      ? "bg-rose-600 animate-ping border-rose-500"
                      : "bg-indigo-600 hover:bg-indigo-500 border-indigo-400"
                  }`}
                >
                  <Mic className={`h-8 w-8 text-white ${recording ? "animate-pulse" : ""}`} />
                </button>
                <span className="text-[10px] font-mono font-semibold text-indigo-400 uppercase">
                  {recording ? (isEn ? "AI ANALYZING TRANSCRIPT..." : "AI ĐANG PHÂN TÍCH KHẨU LỆNH...") : (isEn ? "TAP MIC TO MOCK VOICE INSTRUCTION" : "NHẤN MIC ĐỂ GIẢ LẬP KHẨU LỆNH CHUYÊN SÂU")}
                </span>
              </div>

              {/* Preset commands options to test parsing dynamics */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-slate-500 block">
                  {isEn ? "TEST VOICE COGNITION UTTERANCES:" : "CÁC KHẨU LỆNH MẪU ĐỂ TEST AI AGENT:"}
                </span>

                <div className="space-y-1.5 col-span-2">
                  <button
                    onClick={() => handleTriggerVoiceCmd("SmartWMS, tôi vừa lấy 10 thùng sữa Vinamilk ở kệ C1-A01-N01")}
                    className="w-full text-left p-2.5 bg-slate-900 hover:bg-slate-850 rounded-lg text-[10px] border border-slate-800 text-slate-300 font-sans block leading-snug"
                  >
                    🔊 &quot;Tôi vừa lấy 10 thùng sữa Vinamilk ở kệ C1-A01-N01&quot;
                  </button>
                  <button
                    onClick={() => handleTriggerVoiceCmd("Đặt 40 khay Coca Cola Lon vào kệ D2-A02-N02")}
                    className="w-full text-left p-2.5 bg-slate-900 hover:bg-slate-850 rounded-lg text-[10px] border border-slate-800 text-slate-300 font-sans block leading-snug"
                  >
                    🔊 &quot;Đặt 40 khay Coca Cola Lon vào kệ D2-A02-N02&quot;
                  </button>
                  <button
                    onClick={() => handleTriggerVoiceCmd("Pick 20 units of IPHONE15 from shelf D2-A02-N02")}
                    className="w-full text-left p-2.5 bg-slate-900 hover:bg-slate-850 rounded-lg text-[10px] border border-slate-800 text-slate-300 font-sans block leading-snug"
                  >
                    🔊 &quot;Pick 20 units of IPHONE15 from shelf D2-A02-N02&quot;
                  </button>
                </div>
              </div>

              {/* Voice Result Render */}
              {voiceTranscript && (
                <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-2">
                  <div className="text-[10px] font-mono text-slate-400">
                    <span className="font-bold text-indigo-400">{isEn ? "Spoken transcript" : "Lời nói nhận diện"}:</span>
                    <p className="italic text-slate-300 pt-0.5">&quot;{voiceTranscript}&quot;</p>
                  </div>

                  {resolvedIntent && (
                    <div className="p-2.5 bg-slate-950 border border-indigo-500/20 rounded-lg space-y-1 text-[10px] font-mono">
                      <div className="flex justify-between text-[9px] text-indigo-400 font-bold border-b border-slate-850 pb-1 uppercase">
                        <span>🤖 EXTRACTED EXTRACTION</span>
                        <Volume2 className={`h-3 w-3 ${speaking ? "text-emerald-400 animate-bounce" : ""}`} />
                      </div>
                      <div className="pt-1.5 grid grid-cols-2 gap-y-1">
                        <div>ACTION: <strong className="text-blue-400">{resolvedIntent.action}</strong></div>
                        <div>SKU: <strong className="text-amber-500">{resolvedIntent.sku}</strong></div>
                        <div>QTY: <strong className="text-emerald-400">{resolvedIntent.qty}</strong></div>
                        <div>BIN: <strong className="text-slate-300">{resolvedIntent.binCode}</strong></div>
                      </div>
                      <div className="text-[11px] text-emerald-400 italic pt-1 font-sans font-medium">
                        {resolvedIntent.confirmationText}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: Computer Vision OCR and Damage grades matches UC-05 */}
          {activeTab === "vision" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
                  {isEn ? "👁️ Multi-modal AI Vision" : "👁️ Xử Lý Hình Ảnh AI Vision"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isEn
                    ? "Upload cargo files or trigger OCR delivery slips."
                    : "Chụp ảnh kiểm tra hóa đơn (OCR) hoặc giám định móp méo hư hại hàng lỗi."}
                </p>
              </div>

              {/* Hardware Input File Selector (Hiden) */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRefVisible}
                style={{ display: "none" }}
                onChange={(e) => handleImageFileChange(e, "ocr")}
              />

              {/* Capture controls */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerSimulateVisionDoc("ocr")}
                  disabled={analyzingImage}
                  className="p-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 transition text-center"
                >
                  <FileText className="h-5 w-5 text-indigo-400" />
                  <span className="text-[10px] font-sans font-bold leading-none">{isEn ? "OCR Invoice" : "OCR Hóa Đơn Trống"}</span>
                </button>
                <button
                  onClick={() => triggerSimulateVisionDoc("damage")}
                  disabled={analyzingImage}
                  className="p-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 transition text-center"
                >
                  <ShieldAlert className="h-5 w-5 text-rose-400" />
                  <span className="text-[10px] font-sans font-bold leading-none">{isEn ? "Damage QC Camera" : "Giám Định Hàng Lỗi"}</span>
                </button>
              </div>

              {uploadedImage && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 text-xs animate-fadeIn">

                  {/* Image render simulator */}
                  <div className="w-full h-24 bg-slate-950 rounded-lg flex items-center justify-center border border-indigo-500/10 text-[10px] font-mono text-slate-400 overflow-hidden">
                    {uploadedImage === "STUB_LABEL" ? (
                      <div className="text-center p-2">
                        <Camera className="h-5 w-5 text-indigo-400 mx-auto mb-1 animate-pulse" />
                        <span>{isEn ? "IMAGE DATA INJECTED SECURELY" : "ẢNH ĐỀ XUẤT ĐÃ ĐƯỢC CHỤP & GỬI"}</span>
                      </div>
                    ) : (
                      <img src={uploadedImage} alt="Uploaded cargo slip" className="w-full h-full object-cover" />
                    )}
                  </div>

                  {analyzingImage ? (
                    <div className="text-center py-2 text-indigo-400 flex items-center justify-center gap-1.5 uppercase font-mono text-[10px]">
                      <RefreshCcw className="h-3 w-3 animate-spin" />
                      <span>{isEn ? "AI Vision digesting image..." : "AI Vision đang mổ xẻ ảnh chụp..."}</span>
                    </div>
                  ) : (
                    <>
                      {invoiceOcrData && (
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-indigo-500/20 space-y-1.5 text-[9px] font-mono text-slate-300">
                          <div className="text-indigo-400 font-semibold border-b border-slate-850 pb-0.5">
                            🧾 OCR INBOUND BILL DETECTED
                          </div>
                          <div>VENDOR: {invoiceOcrData.vendorName}</div>
                          <div>DOC NO: {invoiceOcrData.invoiceNo}</div>
                          <div className="text-[10px] font-sans pt-1 font-semibold text-emerald-400">
                            ITEMS RECOGNIZED:
                          </div>
                          {invoiceOcrData.items?.map((it: any, k: number) => (
                            <div key={k} className="pl-1 bg-slate-900 rounded p-1">
                              • {it.sku} - {it.name} | QTY: {it.quantity} x {it.price?.toLocaleString()}đ
                            </div>
                          ))}
                          <div className="text-[8px] text-indigo-500 font-bold block pt-1 uppercase">
                            Auto deposited MILK-VNM 150 count directly into Cool Box.
                          </div>
                        </div>
                      )}

                      {damageData && (
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-rose-500/20 space-y-1.5 text-[9px] font-mono text-slate-300">
                          <div className="text-rose-400 font-semibold border-b border-slate-850 pb-0.5 flex justify-between">
                            <span>🔍 INCIDENT GRADE ADVISORY</span>
                            <span>SCORE: {damageData.severityScore}/10</span>
                          </div>
                          <div>DAMAGE TYPE: <b className="text-slate-200">{isEn ? damageData.damageTypeEn : damageData.damageTypeVi}</b></div>
                          <div className="border border-rose-900/40 p-1.5 rounded bg-rose-950/20 text-sans text-rose-300 leading-snug">
                            <b>ACTION ADVISED:</b> {isEn ? damageData.actionEn : damageData.actionVi}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: Profile Screen with i18next & Offline-First architecture */}
          {activeTab === "profile" && (
            <ProfileScreen
              onLogout={onLogout}
              onClose={() => setActiveTab("scan")}
              currentRole="Staff"
              lang={lang}
            />
          )}

        </div>

        {/* BOTTOM NAV BAR */}
        <nav className="absolute bottom-0 inset-x-0 h-16 bg-slate-900 border-t border-slate-800 grid grid-cols-5 px-1 select-none z-30">
          <button
            onClick={() => setActiveTab("scan")}
            className={`flex flex-col items-center justify-center p-1 transition ${
              activeTab === "scan" ? "text-indigo-400 font-bold" : "text-slate-500"
            }`}
          >
            <Scan className="h-4 w-4" />
            <span className="text-[8px] font-sans uppercase font-semibold mt-1">{isEn ? "Scan Bar" : "Quét Mã"}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("wave");
              setScanMessage("");
            }}
            className={`flex flex-col items-center justify-center p-1 transition ${
              activeTab === "wave" ? "text-indigo-400 font-bold" : "text-slate-500"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span className="text-[8px] font-sans uppercase font-semibold mt-1">{isEn ? "Route PO" : "Wave Đơn"}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("voice");
              setScanMessage("");
            }}
            className={`flex flex-col items-center justify-center p-1 transition ${
              activeTab === "voice" ? "text-indigo-400 font-bold" : "text-slate-500"
            }`}
          >
            <Mic className="h-4 w-4" />
            <span className="text-[8px] font-sans uppercase font-semibold mt-1">{isEn ? "Voice" : "Khẩu Lệnh"}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("vision");
              setScanMessage("");
            }}
            className={`flex flex-col items-center justify-center p-1 transition ${
              activeTab === "vision" ? "text-indigo-400 font-bold" : "text-slate-500"
            }`}
          >
            <Camera className="h-4 w-4" />
            <span className="text-[8px] font-sans uppercase font-semibold mt-1">{isEn ? "Vision AI" : "Ảnh chụp"}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("profile");
              setScanMessage("");
            }}
            className={`flex flex-col items-center justify-center p-1 transition ${
              activeTab === "profile" ? "text-indigo-400 font-bold" : "text-slate-500"
            }`}
          >
            <User className="h-4 w-4" />
            <span className="text-[8px] font-sans uppercase font-semibold mt-1">{isEn ? "Profile" : "Hồ sơ"}</span>
          </button>
        </nav>

      </div>

    </div>
  );
}
