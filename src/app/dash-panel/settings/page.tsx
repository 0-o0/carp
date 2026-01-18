'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, QRScanner } from '@/components/ui';
import type { SettingsResponse } from '@/types/api';

interface Settings {
  url_24hour: string;
  url_5day: string;
  jsessionid_24hour: string;
  jsessionid_5day: string;
  default_use_count: string;
  error_redirect_url: string;
  // 日志设置
  log_enabled: string;
  log_retention_days: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    url_24hour: '',
    url_5day: '',
    jsessionid_24hour: '',
    jsessionid_5day: '',
    default_use_count: '3',
    error_redirect_url: '',
    // 日志设置
    log_enabled: 'false',
    log_retention_days: '7',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});
  const [showQRScanner, setShowQRScanner] = useState<'24hour' | '5day' | null>(null);
  const [cleaningLogs, setCleaningLogs] = useState(false);

  // 加载设置
  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings', {
        credentials: 'include',
      });
      const result: SettingsResponse = await response.json();

      if (response.status === 401) {
        router.push('/dash-panel');
        return;
      }

      if (result.success && result.settings) {
        setSettings(prev => ({ ...prev, ...result.settings }));
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 保存设置
  const saveSetting = async (key: string, value: string) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    setMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[key];
      return newMessages;
    });

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      });

      const result: SettingsResponse = await response.json();

      if (result.success) {
        if (key === 'url_24hour' && result.jsessionid) {
          setSettings(prev => ({ ...prev, jsessionid_24hour: result.jsessionid! }));
        } else if (key === 'url_5day' && result.jsessionid) {
          setSettings(prev => ({ ...prev, jsessionid_5day: result.jsessionid! }));
        }

        setMessages(prev => ({
          ...prev,
          [key]: { type: 'success', text: result.message || '保存成功' },
        }));
      } else {
        setMessages(prev => ({
          ...prev,
          [key]: { type: 'error', text: result.message || '保存失败' },
        }));
      }
    } catch {
      setMessages(prev => ({
        ...prev,
        [key]: { type: 'error', text: '保存失败，请稍后重试' },
      }));
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // 处理二维码扫描结果
  const handleQRScan = (url: string) => {
    if (showQRScanner === '24hour') {
      setSettings(prev => ({ ...prev, url_24hour: url }));
    } else if (showQRScanner === '5day') {
      setSettings(prev => ({ ...prev, url_5day: url }));
    }
    setShowQRScanner(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      {/* 页面标题 */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">配置停车优惠系统参数</p>
      </div>

      {/* 24小时优惠配置 */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-orange-100/60 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">24小时优惠配置</h2>
              <p className="text-xs text-white/80">短期停车优惠，适用于1天内离店</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* 二维码扫描区域 */}
          {showQRScanner === '24hour' && (
            <div className="animate-fadeIn">
              <QRScanner
                onScan={handleQRScan}
                label="扫描24小时优惠二维码"
                placeholder="支持拖入图片、粘贴或直接选择"
              />
              <button
                onClick={() => setShowQRScanner(null)}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700"
              >
                ← 取消扫描
              </button>
            </div>
          )}

          {showQRScanner !== '24hour' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-900">优惠链接 URL</label>
                  <button
                    onClick={() => setShowQRScanner('24hour')}
                    className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    扫描二维码
                  </button>
                </div>
                <textarea
                  placeholder="输入24小时优惠的扫码链接"
                  value={settings.url_24hour}
                  onChange={e => setSettings(prev => ({ ...prev, url_24hour: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:bg-white transition-all resize-none"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  例如: http://www.szdaqin.cn/shopDiscount/scanQr.do?sk=...
                </p>
              </div>
          
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-semibold text-gray-900 mb-2">当前 Session ID</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono text-gray-600 pr-16"
                  value={settings.jsessionid_24hour || '未获取'}
                  readOnly
                />
                {settings.jsessionid_24hour && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">有效</span>
                )}
              </div>
            </div>
            <Button
              variant="orange"
              onClick={() => saveSetting('url_24hour', settings.url_24hour)}
              loading={saving.url_24hour}
              className="w-full sm:w-auto whitespace-nowrap"
            >
              更新并获取Session
            </Button>
          </div>

          {messages.url_24hour && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${messages.url_24hour.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span>{messages.url_24hour.type === 'success' ? '✓' : '✗'}</span>
              <span>{messages.url_24hour.text}</span>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* 5天优惠配置 */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-purple-100/60 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-violet-500 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">5天优惠配置</h2>
              <p className="text-xs text-white/80">长期停车优惠，适用于多日住宿</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* 二维码扫描区域 */}
          {showQRScanner === '5day' && (
            <div className="animate-fadeIn">
              <QRScanner
                onScan={handleQRScan}
                label="扫描5天优惠二维码"
                placeholder="支持拖入图片、粘贴或直接选择"
              />
              <button
                onClick={() => setShowQRScanner(null)}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700"
              >
                ← 取消扫描
              </button>
            </div>
          )}

          {showQRScanner !== '5day' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-900">优惠链接 URL</label>
                  <button
                    onClick={() => setShowQRScanner('5day')}
                    className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    扫描二维码
                  </button>
                </div>
                <textarea
                  placeholder="输入5天优惠的扫码链接"
                  value={settings.url_5day}
                  onChange={e => setSettings(prev => ({ ...prev, url_5day: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:bg-white transition-all resize-none"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  例如: http://www.szdaqin.cn/shopDiscount/scanQr.do?sk=...
                </p>
              </div>
          
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-semibold text-gray-900 mb-2">当前 Session ID</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono text-gray-600 pr-16"
                  value={settings.jsessionid_5day || '未获取'}
                  readOnly
                />
                {settings.jsessionid_5day && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">有效</span>
                )}
              </div>
            </div>
            <Button
              variant="orange"
              onClick={() => saveSetting('url_5day', settings.url_5day)}
              loading={saving.url_5day}
              className="w-full sm:w-auto whitespace-nowrap"
            >
              更新并获取Session
            </Button>
          </div>

          {messages.url_5day && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${messages.url_5day.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span>{messages.url_5day.type === 'success' ? '✓' : '✗'}</span>
              <span>{messages.url_5day.text}</span>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* 其他设置 */}
      <div className="card shadow-lg border border-gray-100">
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">其他设置</h2>
            <p className="text-xs text-gray-500">系统默认参数配置</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 bg-gray-50 rounded-xl">
              <label className="block text-sm font-semibold text-gray-900 mb-2">默认可用次数</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="次数"
                  value={settings.default_use_count}
                  onChange={e => setSettings(prev => ({ ...prev, default_use_count: e.target.value }))}
                  min={1}
                  className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 transition-all"
                />
                <Button
                  variant="outline"
                  onClick={() => saveSetting('default_use_count', settings.default_use_count)}
                  loading={saving.default_use_count}
                >
                  保存
                </Button>
              </div>
              {messages.default_use_count && (
                <p className={`text-xs mt-2 ${messages.default_use_count.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {messages.default_use_count.text}
                </p>
              )}
            </div>

            <div className="p-3 sm:p-4 bg-gray-50 rounded-xl">
              <label className="block text-sm font-semibold text-gray-900 mb-2">错误重定向 URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="备用跳转链接（可选）"
                  value={settings.error_redirect_url}
                  onChange={e => setSettings(prev => ({ ...prev, error_redirect_url: e.target.value }))}
                  className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 transition-all"
                />
                <Button
                  variant="outline"
                  onClick={() => saveSetting('error_redirect_url', settings.error_redirect_url)}
                  loading={saving.error_redirect_url}
                >
                  保存
                </Button>
              </div>
              {messages.error_redirect_url && (
                <p className={`text-xs mt-2 ${messages.error_redirect_url.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {messages.error_redirect_url.text}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50">
        <div className="flex items-center gap-3 mb-3 sm:mb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-blue-900">使用说明</h2>
        </div>
        <ul className="text-xs sm:text-sm text-blue-800 space-y-2 sm:space-y-3">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 flex-shrink-0">•</span>
            <span><strong>优惠链接：</strong>从停车场优惠二维码获取的链接，系统会自动获取 Session ID</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 flex-shrink-0">•</span>
            <span><strong>Session ID：</strong>用于向停车系统发送优惠请求的凭证，每次更新链接会自动刷新</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 flex-shrink-0">•</span>
            <span><strong>优惠类型：</strong>系统根据住客的离店时间自动判断使用24小时还是5天优惠</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 flex-shrink-0">⚠️</span>
            <span><strong>重要提示：</strong>如果优惠失效，请重新获取二维码链接并更新</span>
          </li>
        </ul>
      </div>

      {/* 日志配置 */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100/60 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">日志配置</h2>
              <p className="text-xs text-white/80">管理使用记录和审计日志（D1 Free Plan 建议关闭）</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* 日志开关 */}
          <div className="p-3 sm:p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-gray-900">启用日志记录</label>
                <p className="text-xs text-gray-500 mt-0.5">开启后会记录每次优惠使用和管理操作</p>
              </div>
              <button
                onClick={() => {
                  const newValue = settings.log_enabled === 'true' ? 'false' : 'true';
                  setSettings(prev => ({ ...prev, log_enabled: newValue }));
                  saveSetting('log_enabled', newValue);
                }}
                disabled={saving.log_enabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.log_enabled === 'true' ? 'bg-orange-500' : 'bg-gray-300'
                } ${saving.log_enabled ? 'opacity-50' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.log_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {messages.log_enabled && (
              <p className={`text-xs mt-2 ${messages.log_enabled.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {messages.log_enabled.text}
              </p>
            )}
          </div>

          {/* 日志保留天数 */}
          <div className="p-3 sm:p-4 bg-gray-50 rounded-xl">
            <label className="block text-sm font-semibold text-gray-900 mb-2">日志保留天数</label>
            <div className="flex gap-2">
              <select
                value={settings.log_retention_days}
                onChange={e => setSettings(prev => ({ ...prev, log_retention_days: e.target.value }))}
                className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 transition-all"
              >
                <option value="3">3 天</option>
                <option value="7">7 天</option>
                <option value="14">14 天</option>
                <option value="30">30 天</option>
              </select>
              <Button
                variant="outline"
                onClick={() => saveSetting('log_retention_days', settings.log_retention_days)}
                loading={saving.log_retention_days}
              >
                保存
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              超过保留期限的日志将被自动清理，建议设置较短时间以节省 D1 存储空间
            </p>
            {messages.log_retention_days && (
              <p className={`text-xs mt-2 ${messages.log_retention_days.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {messages.log_retention_days.text}
              </p>
            )}
          </div>

          {/* 手动清理日志 */}
          <div className="p-3 sm:p-4 bg-red-50 rounded-xl border border-red-100">
            <label className="block text-sm font-semibold text-gray-900 mb-2">手动清理日志</label>
            <p className="text-xs text-gray-500 mb-3">
              立即删除超过保留天数的所有日志数据。此操作不可撤销。
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm(`确定要清理 ${settings.log_retention_days} 天前的所有日志吗？此操作不可撤销。`)) return;
                setCleaningLogs(true);
                try {
                  const response = await fetch('/api/logs', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ retentionDays: parseInt(settings.log_retention_days, 10) }),
                  });
                  const result = await response.json();
                  if (result.success) {
                    setMessages(prev => ({
                      ...prev,
                      log_clean: { type: 'success', text: `已清理 ${result.deleted || 0} 条日志` },
                    }));
                  } else {
                    setMessages(prev => ({
                      ...prev,
                      log_clean: { type: 'error', text: result.message || '清理失败' },
                    }));
                  }
                } catch {
                  setMessages(prev => ({
                    ...prev,
                    log_clean: { type: 'error', text: '清理失败，请稍后重试' },
                  }));
                } finally {
                  setCleaningLogs(false);
                }
              }}
              loading={cleaningLogs}
              className="border-red-200 text-red-600 hover:bg-red-100"
            >
              🗑️ 清理过期日志
            </Button>
            {messages.log_clean && (
              <p className={`text-xs mt-2 ${messages.log_clean.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {messages.log_clean.text}
              </p>
            )}
          </div>

          {/* D1 存储警告 */}
{/*           <div className="p-3 sm:p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 flex-shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Cloudflare D1 Free Plan 限制</p>
                <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                  <li>• 存储空间: 5GB</li>
                  <li>• 每日读取: 500 万行</li>
                  <li>• 每日写入: 10 万行</li>
                </ul>
                <p className="text-xs text-amber-600 mt-2">
                  建议：如果请求量不大，可以关闭日志节省配额；如需开启，请定期清理。
                </p>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}
