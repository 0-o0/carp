'use client';

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent, useCallback } from 'react';
import ReactDOM from 'react-dom';

const PROVINCE_KEYBOARD = [
  ['京', '津', '渝', '沪', '冀', '晋', '辽', '吉', '黑', '苏'],
  ['浙', '皖', '闽', '赣', '鲁', '豫', '鄂', '湘', '粤', '琼'],
  ['川', '贵', '云', '陕', '甘', '青', '蒙', '桂', '宁', '新'],
  ['藏', '使', '领', '警', '学', '港', '澳'],
];

interface PlateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  keyboardAlign?: 'center' | 'right';
}

export function PlateInput({ value, onChange, required = false, disabled = false, keyboardAlign = 'right' }: PlateInputProps) {
  const [province, setProvince] = useState('');
  const [boxes, setBoxes] = useState<string[]>(Array(7).fill(''));
  const [showProvinceKeyboard, setShowProvinceKeyboard] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const keyboardRef = useRef<HTMLDivElement>(null);

  // 同步外部值到内部状态
  useEffect(() => {
    if (value && value.length > 0) {
      const firstChar = value[0];
      if (/[\u4e00-\u9fa5]/.test(firstChar)) {
        setProvince(firstChar);
        const rest = value.slice(1).split('');
        const newBoxes = Array(7).fill('');
        rest.forEach((char, i) => {
          if (i < 7) newBoxes[i] = char.toUpperCase();
        });
        setBoxes(newBoxes);
      } else {
        setProvince('');
        const chars = value.split('');
        const newBoxes = Array(7).fill('');
        chars.forEach((char, i) => {
          if (i < 7) newBoxes[i] = char.toUpperCase();
        });
        setBoxes(newBoxes);
      }
    } else {
      setProvince('');
      setBoxes(Array(7).fill(''));
    }
  }, [value]);

  // 点击外部关闭省份键盘
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (keyboardRef.current && !keyboardRef.current.contains(event.target as Node)) {
        setShowProvinceKeyboard(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const updateValue = useCallback((newProvince: string, newBoxes: string[]) => {
    onChange(newProvince + newBoxes.join(''));
  }, [onChange]);

  const selectProvince = (p: string) => {
    setProvince(p);
    updateValue(p, boxes);
    setShowProvinceKeyboard(false);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const handleBoxChange = (index: number, inputValue: string) => {
    if (disabled) return;

    const char = inputValue.slice(-1);
    if (!char) return;

    if (/[A-Za-z0-9]/.test(char)) {
      const newBoxes = [...boxes];
      newBoxes[index] = char.toUpperCase();
      setBoxes(newBoxes);
      updateValue(province, newBoxes);
      
      if (index < 6) {
        setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
      }
    }
  };

  // 处理键盘事件
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      const newBoxes = [...boxes];
      
      if (boxes[index]) {
        newBoxes[index] = '';
        setBoxes(newBoxes);
        updateValue(province, newBoxes);
      } else if (index > 0) {
        newBoxes[index - 1] = '';
        setBoxes(newBoxes);
        updateValue(province, newBoxes);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 6) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      const newBoxes = [...boxes];
      newBoxes[index] = '';
      setBoxes(newBoxes);
      updateValue(province, newBoxes);
    }
  };

  // 处理粘贴
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();

    const pastedText = e.clipboardData.getData('text').trim();
    const cleanText = pastedText.replace(/[\s\-·.·•_]/g, '');
    
    if (!cleanText) return;

    let newProvince = province;
    let startIndex = 0;
    
    const firstChar = cleanText[0];
    if (/[\u4e00-\u9fa5]/.test(firstChar)) {
      newProvince = firstChar;
      startIndex = 1;
    }
    const newBoxes = Array(7).fill('');
    let boxIndex = 0;
    for (let i = startIndex; i < cleanText.length && boxIndex < 7; i++) {
      const char = cleanText[i];
      if (/[A-Za-z0-9]/.test(char)) {
        newBoxes[boxIndex] = char.toUpperCase();
        boxIndex++;
      }
    }

    setProvince(newProvince);
    setBoxes(newBoxes);
    updateValue(newProvince, newBoxes);

    const nextEmpty = newBoxes.findIndex(b => !b);
    const focusIndex = nextEmpty === -1 ? 6 : nextEmpty;
    setTimeout(() => inputRefs.current[focusIndex]?.focus(), 10);
  };

  // 验证车牌格式
  const validatePlate = () => {
    const filledBoxes = boxes.filter(b => b).length;
    const totalFilled = (province ? 1 : 0) + filledBoxes;
    
    if (totalFilled === 0) return { valid: true, message: '' };
    if (!province) return { valid: false, message: '请选择省份' };
    if (filledBoxes < 6) return { valid: false, message: '车牌号至少需要7位' };
    
    return { valid: true, message: '格式正确' };
  };

  const filledCount = (province ? 1 : 0) + boxes.filter(b => b).length;
  const validation = validatePlate();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-[3px] sm:gap-1.5 md:gap-2 w-full">
        <div className="relative" ref={keyboardRef}>
          <button
            type="button"
            onClick={() => !disabled && setShowProvinceKeyboard(!showProvinceKeyboard)}
            disabled={disabled}
            className={`w-9 sm:w-11 md:w-[52px] aspect-[4/5] min-h-[36px] sm:min-h-[42px] max-h-[54px] border-2 rounded-lg sm:rounded-xl text-sm sm:text-base md:text-lg font-bold text-center transition-all duration-200 focus:outline-none focus:scale-105 focus:shadow-lg ${
              province 
                ? 'bg-gradient-to-b from-slate-700 to-slate-800 border-orange-500 shadow-md text-foreground' 
                : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-600 hover:border-slate-500 text-slate-400'
            } focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20`}
          >
            {province || '省'}
          </button>
        </div>

        <span className="text-slate-500 font-bold text-xs sm:text-base md:text-lg">·</span>

        {boxes.map((box, index) => (
          <input
            key={index}
            ref={el => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="text"
            value={box}
            onChange={e => handleBoxChange(index, e.target.value)}
            onKeyDown={e => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`flex-1 min-w-0 w-7 sm:w-10 md:w-11 max-w-[36px] sm:max-w-[42px] md:max-w-[48px] aspect-[4/5] min-h-[36px] sm:min-h-[42px] max-h-[54px] border-2 rounded-lg sm:rounded-xl text-xs sm:text-base md:text-lg font-bold text-center uppercase transition-all duration-200 text-foreground placeholder:text-slate-600 focus:outline-none focus:scale-105 focus:shadow-lg ${
              box 
                ? 'bg-gradient-to-b from-slate-700 to-slate-800 border-orange-500 shadow-md' 
                : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700 hover:border-slate-600'
            } focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20`}
            placeholder={index === 6 ? '' : '0'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        ))}
      </div>
      
      <div className="flex items-center justify-between text-xs sm:text-sm px-1">
        <span className="text-slate-500">
          {required ? '必填' : '可选'} · 已填 {filledCount}/8 位
          <span className="hidden sm:inline text-slate-600 ml-2">（支持粘贴车牌）</span>
        </span>
        {filledCount >= 7 && (
          <span className={`flex items-center gap-1 font-medium ${validation.valid ? 'text-blue-400' : 'text-orange-400'}`}>
            {validation.valid ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {validation.message}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {validation.message}
              </>
            )}
          </span>
        )}
      </div>

      {showProvinceKeyboard && typeof document !== 'undefined' && ReactDOM.createPortal(
        <>
          <div 
            className="fixed inset-0 bg-black/15 z-[9998]"
            onClick={() => setShowProvinceKeyboard(false)}
          />
          <div className={`fixed bottom-0 left-0 right-0 z-[9999] flex justify-center landscape:pb-3 ${keyboardAlign === 'right' ? 'landscape:justify-end landscape:pr-[3%]' : ''}`}>
            <div 
              ref={keyboardRef}
              className={`w-full max-w-md rounded-t-[22px] overflow-hidden landscape:w-[50vw] landscape:max-w-none landscape:rounded-[22px]`}
              style={{ 
                background: 'rgba(255, 255, 255, 0.38)',
                backdropFilter: 'blur(24px) saturate(155%) contrast(110%)',
                WebkitBackdropFilter: 'blur(24px) saturate(155%) contrast(110%)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.15), inset 0 2px 14px rgba(255,255,255,0.34), inset 0 -2px 12px rgba(0,0,0,0.08)'
              }}
            >
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 18% 16%, rgba(255,255,255,0.5), transparent 48%), radial-gradient(circle at 75% 85%, rgba(255,255,255,0.08), transparent 55%), linear-gradient(140deg, rgba(255,255,255,0.2), rgba(255,255,255,0.04) 45%, rgba(0,0,0,0.05))',
                  opacity: 0.9
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between px-4 h-10 border-b border-white/20">
                  <span className="text-sm text-gray-600 font-medium">选择省份</span>
                  <button
                    type="button"
                    onClick={() => setShowProvinceKeyboard(false)}
                    className="text-blue-500 font-semibold text-sm px-2 py-0.5 rounded active:bg-white/30"
                  >
                    完成
                  </button>
                </div>
                <div className="px-3 py-3 pb-[max(env(safe-area-inset-bottom),12px)] landscape:px-4 landscape:py-4">
                  {PROVINCE_KEYBOARD.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center gap-1.5 landscape:gap-2 mb-1.5 landscape:mb-2 last:mb-0">
                      {row.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => selectProvince(p)}
                          className={`h-[44px] landscape:h-[52px] min-w-[32px] landscape:min-w-[44px] flex-1 max-w-[40px] landscape:max-w-[60px] rounded-lg landscape:rounded-xl text-[15px] landscape:text-[17px] font-medium transition-colors ${
                            province === p
                              ? 'bg-blue-500 text-white shadow-sm'
                              : 'bg-slate-700 text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.3)] active:bg-slate-600 active:scale-95'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// 导出验证函数供外部使用
export function validatePlateNumber(plate: string): boolean {
  if (!plate || plate.length < 7 || plate.length > 8) return false;
  const firstChar = plate[0];
  if (!/[\u4e00-\u9fa5]/.test(firstChar)) return false;
  for (let i = 1; i < plate.length; i++) {
    if (!/^[A-Z0-9]$/i.test(plate[i])) return false;
  }
  return true;
}
