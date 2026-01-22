'use client';

import { ReactNode, useEffect, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // 使用 requestAnimationFrame 确保动画正确触发
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 200);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      {/* 背景遮罩 - 玻璃模糊效果 */}
      <div 
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${isAnimating ? 'opacity-100' : 'opacity-0'}`} 
        style={{ WebkitBackdropFilter: 'blur(4px)' }}
      />
      
      {/* 模态框内容 - 深色玻璃卡片效果 */}
      <div 
        className={`
          relative ${sizeClass} w-full
          bg-slate-900/95 backdrop-blur-2xl
          border border-slate-700/50
          rounded-3xl
          shadow-[0_25px_80px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.25)]
          max-h-[90vh] overflow-hidden
          transition-all duration-200 ease-out
          ${isAnimating ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}
        `}
        style={{ WebkitBackdropFilter: 'blur(32px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部装饰条 - 橙蓝渐变 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-blue-500" />
        
        {/* 标题栏 */}
        {title && (
          <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl" style={{ WebkitBackdropFilter: 'blur(16px)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground tracking-tight">{title}</h2>
              <button 
                onClick={onClose} 
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-all duration-150 hover:scale-105 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

