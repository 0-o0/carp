'use client';

import { useState, useRef, useCallback, ChangeEvent } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan: (url: string) => void;
  label?: string;
  placeholder?: string;
}

export function QRScanner({ onScan, label = '扫描二维码', placeholder = '或直接粘贴URL链接' }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 处理图片识别
  const processImage = useCallback(async (file: File) => {
    setScanning(true);
    setError('');

    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // 设置画布尺寸
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // 获取图像数据
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // 使用 jsQR 识别
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            const url = code.data;
            // 验证是否为有效URL
            if (url.startsWith('http://') || url.startsWith('https://')) {
              onScan(url);
              setError('');
            } else {
              setError('识别到的内容不是有效的URL链接');
            }
          } else {
            setError('未能识别二维码，请确保图片清晰完整');
          }
          setScanning(false);
        };

        img.onerror = () => {
          setError('图片加载失败');
          setScanning(false);
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        setError('文件读取失败');
        setScanning(false);
      };

      reader.readAsDataURL(file);
    } catch {
      setError('识别过程出错');
      setScanning(false);
    }
  }, [onScan]);

  // 处理文件选择
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('请选择图片文件');
        return;
      }
      processImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 处理拖放
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('请选择图片文件');
        return;
      }
      processImage(file);
    }
  };

  // 处理粘贴
  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        // 检查是否有图片
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'pasted-image.png', { type: imageType });
          processImage(file);
          return;
        }
        // 检查是否有文本（URL）
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();
          if (text.startsWith('http://') || text.startsWith('https://')) {
            onScan(text.trim());
            return;
          }
        }
      }
      setError('剪贴板中没有可识别的图片或URL');
    } catch {
      setError('无法读取剪贴板，请直接拖入图片');
    }
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-semibold text-gray-900">{label}</label>
      )}
      
      {/* 隐藏的 canvas 用于图片处理 */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 上传区域 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-orange-400 bg-orange-50'
            : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {scanning ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">正在识别二维码...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">点击或拖入二维码图片</p>
              <p className="text-xs text-gray-400 mt-1">{placeholder}</p>
            </div>
          </div>
        )}
      </div>

      {/* 快捷操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePaste}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          从剪贴板粘贴
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm font-medium rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          选择图片
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-xl">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
