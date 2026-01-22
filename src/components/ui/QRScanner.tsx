'use client';

import { useState, useRef, useCallback, ChangeEvent, useEffect } from 'react';
import jsQR from 'jsqr';

export interface ScanTarget {
  id: string;
  name: string;
  description?: string;
  color?: string;
  type: 'discount' | 'payment' | 'other';
}

interface QRScannerProps {
  targets: ScanTarget[];
  onScan: (targetId: string, url: string) => void | Promise<void>;
  title?: string;
}

export function QRScanner({ targets, onScan, title }: QRScannerProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 自动选择第一个
  useEffect(() => {
    if (targets.length > 0 && !targets.some(t => t.id === selectedTarget)) {
      setSelectedTarget(targets[0].id);
    }
  }, [targets, selectedTarget]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 清除消息
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  const busy = scanning || saving;
  const selectedInfo = targets.find(t => t.id === selectedTarget);

  // 处理URL
  const handleUrl = useCallback(async (url: string) => {
    if (!selectedTarget) { setError('请先选择目标'); return; }
    setSaving(true);
    setError('');
    try {
      await onScan(selectedTarget, url);
      setSuccess(`已填入「${selectedInfo?.name || ''}」`);
      setManualUrl('');
    } catch { setError('保存失败'); }
    finally { setSaving(false); }
  }, [selectedTarget, selectedInfo, onScan]);

  // 处理图片
  const processImage = useCallback(async (file: File) => {
    if (!selectedTarget) { setError('请先选择目标'); return; }
    setScanning(true);
    setError('');
    setSuccess('');
    try {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data && (code.data.startsWith('http://') || code.data.startsWith('https://'))) {
            handleUrl(code.data);
          } else {
            setError(code ? '内容非有效URL' : '未识别到二维码');
          }
          setScanning(false);
        };
        img.onerror = () => { setError('图片加载失败'); setScanning(false); };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => { setError('文件读取失败'); setScanning(false); };
      reader.readAsDataURL(file);
    } catch { setError('识别失败'); setScanning(false); }
  }, [selectedTarget, handleUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.startsWith('image/')) processImage(file);
    else if (file) setError('请选择图片');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) processImage(file);
    else if (file) setError('请选择图片');
  };

  const handlePaste = async () => {
    if (!selectedTarget) { setError('请先选择目标'); return; }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) {
          processImage(new File([await item.getType(imgType)], 'paste.png', { type: imgType }));
          return;
        }
        if (item.types.includes('text/plain')) {
          const text = await (await item.getType('text/plain')).text();
          if (text.startsWith('http://') || text.startsWith('https://')) {
            handleUrl(text.trim());
            return;
          }
        }
      }
      setError('剪贴板无可用内容');
    } catch { setError('无法读取剪贴板'); }
  };

  const handleManualSubmit = () => {
    const url = manualUrl.trim();
    if (url.startsWith('http://') || url.startsWith('https://')) handleUrl(url);
    else setError('请输入有效URL');
  };

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {title && <p className="text-sm font-medium text-slate-300">{title}</p>}

      {/* 下拉选择目标 */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !busy && setDropdownOpen(!dropdownOpen)}
          disabled={busy}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-left hover:bg-slate-700 transition-colors disabled:opacity-60"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedInfo?.color || '#6b7280' }} />
            <div className="min-w-0">
              <div className="font-medium text-foreground text-sm truncate">{selectedInfo?.name || '选择目标'}</div>
              {selectedInfo?.description && (
                <div className="text-xs text-slate-400 truncate">{selectedInfo.description}</div>
              )}
            </div>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 下拉菜单 */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
            {targets.map(target => (
              <button
                key={target.id}
                type="button"
                onClick={() => { setSelectedTarget(target.id); setDropdownOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/50 transition-colors ${selectedTarget === target.id ? 'bg-blue-500/10' : ''}`}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: target.color || '#6b7280' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">{target.name}</div>
                  {target.description && (
                    <div className="text-xs text-slate-400 truncate">{target.description}</div>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  target.type === 'discount' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {target.type === 'discount' ? 'Session' : 'URL'}
                </span>
                {selectedTarget === target.id && (
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 上传区 */}
      <div
        onClick={() => !busy && selectedTarget && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl p-8 text-center transition-all ${
          !selectedTarget ? 'bg-slate-800 border border-slate-700 cursor-not-allowed opacity-60' :
          busy ? 'bg-slate-800 border border-slate-700 cursor-wait' :
          dragOver ? 'bg-orange-500/10 border-2 border-orange-500 border-dashed' :
          'bg-slate-800 border-2 border-dashed border-slate-700 hover:border-orange-500/50 hover:bg-orange-500/5 cursor-pointer'
        }`}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">{scanning ? '识别中...' : '保存中...'}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedTarget ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-500'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-medium ${selectedTarget ? 'text-foreground' : 'text-slate-500'}`}>
                {selectedTarget ? '点击或拖入二维码图片' : '请先选择目标'}
              </p>
              <p className="text-xs text-slate-500 mt-1">支持拖入、粘贴或选择图片</p>
            </div>
          </div>
        )}
      </div>

      {/* 快捷操作 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePaste}
          disabled={!selectedTarget || busy}
          className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm font-medium rounded-xl transition-colors"
        >
          📋 粘贴
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedTarget || busy}
          className="flex-1 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-orange-400 text-sm font-medium rounded-xl transition-colors"
        >
          🖼 选择图片
        </button>
      </div>

      {/* URL手动输入 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          placeholder="或直接粘贴URL..."
          disabled={busy}
          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-sm text-foreground focus:outline-none focus:border-blue-500 focus:bg-slate-700 disabled:opacity-50 transition-all"
        />
        <button
          type="button"
          onClick={handleManualSubmit}
          disabled={!selectedTarget || !manualUrl.trim() || busy}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
        >
          确认
        </button>
      </div>

      {/* 消息提示 */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-blue-500/15 text-blue-300 text-sm rounded-xl border border-blue-500/30">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/15 text-red-300 text-sm rounded-xl border border-red-500/30">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
