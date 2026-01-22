'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, QRScanner, type ScanTarget } from '@/components/ui';
import type { SettingsResponse } from '@/types/api';

interface DiscountType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  scanUrl: string | null;
  jsessionid: string | null;
  refererUrl: string | null;
  postParams: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  default_use_count: string;
  error_redirect_url: string;
  log_enabled: string;
  log_retention_days: string;
  pay_url: string;
  pay_url_noplate: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    default_use_count: '3',
    error_redirect_url: '',
    log_enabled: 'false',
    log_retention_days: '7',
    pay_url: '',
    pay_url_noplate: '',
  });
  
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [updatingType, setUpdatingType] = useState<string | null>(null);
  
  // QR扫描器状态
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedScanTarget, setSelectedScanTarget] = useState<string>('');
  
  // 类型管理状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTypeDetail, setShowTypeDetail] = useState<DiscountType | null>(null);
  const [newType, setNewType] = useState({ code: '', name: '', description: '', color: '#6366f1' });
  const [addingType, setAddingType] = useState(false);
  const [deletingType, setDeletingType] = useState<string | null>(null);
  const [typeMessages, setTypeMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});
  const [cleaningLogs, setCleaningLogs] = useState(false);

  // 数据加载
  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings', { credentials: 'include' });
      const result: SettingsResponse = await response.json();
      if (response.status === 401) { router.push('/dash-panel'); return; }
      if (result.success && result.settings) {
        setSettings(prev => ({ ...prev, ...result.settings }));
      }
    } catch (e) { console.error('加载设置失败:', e); }
    finally { setLoading(false); }
  }, [router]);

  const loadDiscountTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/discount-types', { credentials: 'include' });
      const result = await response.json();
      if (response.status === 401) { router.push('/dash-panel'); return; }
      if (result.success && result.discountTypes) {
        setDiscountTypes(result.discountTypes);
      }
    } catch (e) { console.error('加载优惠类型失败:', e); }
    finally { setLoadingTypes(false); }
  }, [router]);

  useEffect(() => { loadSettings(); loadDiscountTypes(); }, [loadSettings, loadDiscountTypes]);

  // 保存设置
  const saveSetting = async (key: string, value: string): Promise<boolean> => {
    setSaving(prev => ({ ...prev, [key]: true }));
    setMessages(prev => { const n = { ...prev }; delete n[key]; return n; });
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      });
      const result: SettingsResponse = await response.json();
      setMessages(prev => ({
        ...prev,
        [key]: { type: result.success ? 'success' : 'error', text: result.message || (result.success ? '已保存' : '保存失败') },
      }));
      return result.success || false;
    } catch {
      setMessages(prev => ({ ...prev, [key]: { type: 'error', text: '保存失败' } }));
      return false;
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // 二维码扫描处理
  const handleQRScan = async (scanUrl: string, typeCode: string): Promise<string> => {
    setUpdatingType(typeCode);
    setTypeMessages(prev => { const n = { ...prev }; delete n[typeCode]; return n; });
    try {
      const response = await fetch('/api/discount-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'updateUrl', code: typeCode, scanUrl }),
      });
      const result = await response.json();
      if (result.success) {
        setTypeMessages(prev => ({
          ...prev,
          [typeCode]: { type: 'success', text: `Session 已更新` },
        }));
        loadDiscountTypes();
        return String(result.jsessionid || '');
      } else {
        const msg = String(result.error || result.message || '更新失败');
        setTypeMessages(prev => ({ ...prev, [typeCode]: { type: 'error', text: msg } }));
        throw new Error(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '更新失败';
      setTypeMessages(prev => ({ ...prev, [typeCode]: { type: 'error', text: msg } }));
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setUpdatingType(null);
    }
  };

  // 添加优惠类型
  const handleAddType = async () => {
    if (!newType.code || !newType.name) {
      setTypeMessages(prev => ({ ...prev, new: { type: 'error', text: '请填写代码和名称' } }));
      return;
    }
    setAddingType(true);
    try {
      const response = await fetch('/api/discount-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'create', ...newType, description: newType.description || null }),
      });
      const result = await response.json();
      if (result.success) {
        setShowAddModal(false);
        setNewType({ code: '', name: '', description: '', color: '#6366f1' });
        setTypeMessages(prev => { const n = { ...prev }; delete n.new; return n; });
        loadDiscountTypes();
      } else {
        setTypeMessages(prev => ({ ...prev, new: { type: 'error', text: result.error || '添加失败' } }));
      }
    } catch {
      setTypeMessages(prev => ({ ...prev, new: { type: 'error', text: '添加失败' } }));
    } finally {
      setAddingType(false);
    }
  };

  // 删除优惠类型
  const handleDeleteType = async (code: string) => {
    if (!confirm('确定删除此优惠类型？')) return;
    setDeletingType(code);
    try {
      const response = await fetch('/api/discount-types', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      const result = await response.json();
      if (result.success) {
        setShowTypeDetail(null);
        loadDiscountTypes();
      } else {
        setTypeMessages(prev => ({ ...prev, [code]: { type: 'error', text: result.error || '删除失败' } }));
      }
    } catch {
      setTypeMessages(prev => ({ ...prev, [code]: { type: 'error', text: '删除失败' } }));
    } finally {
      setDeletingType(null);
    }
  };

  // QR扫描目标处理
  const handleTargetScan = useCallback(async (targetId: string, url: string) => {
    const type = discountTypes.find(t => t.code === targetId);
    if (type) {
      await handleQRScan(url, type.code);
      return;
    }
    if (['pay_url', 'pay_url_noplate', 'error_redirect_url'].includes(targetId)) {
      setSettings(prev => ({ ...prev, [targetId]: url }));
      const ok = await saveSetting(targetId, url);
      if (!ok) throw new Error('保存失败');
      return;
    }
    throw new Error('未知目标');
  }, [discountTypes]);

  // 构建扫描目标列表（不包含已删除的 none 类型）
  const scanTargets: ScanTarget[] = [
    ...discountTypes.filter(t => t.code !== 'none').map(t => ({
      id: t.code,
      name: t.name,
      description: t.description || undefined,
      color: t.color,
      type: 'discount' as const,
    })),
    { id: 'pay_url', name: '正常缴费链接', color: '#3b82f6', type: 'payment' as const },
    { id: 'pay_url_noplate', name: '无牌车缴费链接', color: '#3b82f6', type: 'payment' as const },
    { id: 'error_redirect_url', name: '错误重定向', color: '#6b7280', type: 'other' as const },
  ];

  // 清理日志
  const cleanLogs = async () => {
    if (!confirm(`确定清理 ${settings.log_retention_days} 天前的日志？`)) return;
    setCleaningLogs(true);
    try {
      const response = await fetch('/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ retentionDays: parseInt(settings.log_retention_days, 10) }),
      });
      const result = await response.json();
      setMessages(prev => ({
        ...prev,
        log_clean: { type: result.success ? 'success' : 'error', text: result.success ? `已清理 ${result.deleted || 0} 条` : '清理失败' },
      }));
    } catch {
      setMessages(prev => ({ ...prev, log_clean: { type: 'error', text: '清理失败' } }));
    } finally {
      setCleaningLogs(false);
    }
  };

  if (loading || loadingTypes) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <span className="text-slate-500 text-sm">加载系统设置...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">系统设置</h1>
          <p className="text-sm text-slate-500 mt-1">配置停车优惠系统参数</p>
        </div>
        <button
          onClick={() => setShowQRModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-orange-500/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          扫码配置
        </button>
      </div>

      {/* 优惠类型管理 - 紧凑卡片网格 */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/40">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">优惠类型</h2>
              <p className="text-xs text-slate-400">{discountTypes.filter(t => t.code !== 'none').length} 个类型</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增
          </button>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {discountTypes.filter(type => type.code !== 'none').map(type => (
              <button
                key={type.id}
                onClick={() => setShowTypeDetail(type)}
                className="group relative p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/40 hover:shadow-lg transition-all text-left bg-slate-800/50 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0 shadow-sm" style={{ backgroundColor: type.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">{type.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{type.code}</div>
                  </div>
                </div>
                {/* 状态指示 */}
                <div className="mt-3 flex items-center gap-1.5">
                  {type.jsessionid ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      已配置
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50/80 text-amber-600 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      待配置
                    </span>
                  )}
                  {type.isSystem && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100/80 text-slate-500">系统</span>
                  )}
                </div>
                {/* 消息提示 */}
                {typeMessages[type.code] && (
                  <div className={`mt-2 text-xs truncate ${typeMessages[type.code].type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
                    {typeMessages[type.code].text}
                  </div>
                )}
                {/* 更新中 */}
                {updatingType === type.code && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 缴费链接配置 */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">缴费链接</h2>
              <p className="text-xs text-slate-400">非住客正常缴费跳转地址</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* 正常缴费 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">正常缴费 URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.pay_url}
                onChange={e => setSettings(prev => ({ ...prev, pay_url: e.target.value }))}
                placeholder="http://..."
                className="input-field flex-1"
              />
              <Button variant="outline" onClick={() => saveSetting('pay_url', settings.pay_url)} loading={saving.pay_url}>
                保存
              </Button>
            </div>
            {messages.pay_url && (
              <p className={`text-xs mt-1.5 ${messages.pay_url.type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
                {messages.pay_url.text}
              </p>
            )}
          </div>
          {/* 无牌车缴费 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">无牌车缴费 URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.pay_url_noplate}
                onChange={e => setSettings(prev => ({ ...prev, pay_url_noplate: e.target.value }))}
                placeholder="http://..."
                className="input-field flex-1"
              />
              <Button variant="outline" onClick={() => saveSetting('pay_url_noplate', settings.pay_url_noplate)} loading={saving.pay_url_noplate}>
                保存
              </Button>
            </div>
            {messages.pay_url_noplate && (
              <p className={`text-xs mt-1.5 ${messages.pay_url_noplate.type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
                {messages.pay_url_noplate.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 其他设置 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 默认可用次数 */}
        <div className="glass-card p-5">
          <label className="block text-sm font-medium text-slate-300 mb-2">默认可用次数</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={settings.default_use_count}
              onChange={e => setSettings(prev => ({ ...prev, default_use_count: e.target.value }))}
              className="input-field flex-1"
            />
            <Button variant="outline" onClick={() => saveSetting('default_use_count', settings.default_use_count)} loading={saving.default_use_count}>
              保存
            </Button>
          </div>
          {messages.default_use_count && (
            <p className={`text-xs mt-1.5 ${messages.default_use_count.type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
              {messages.default_use_count.text}
            </p>
          )}
        </div>
        {/* 错误重定向 */}
        <div className="glass-card p-5">
          <label className="block text-sm font-medium text-slate-300 mb-2">错误重定向 URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.error_redirect_url}
              onChange={e => setSettings(prev => ({ ...prev, error_redirect_url: e.target.value }))}
              placeholder="可选"
              className="input-field flex-1"
            />
            <Button variant="outline" onClick={() => saveSetting('error_redirect_url', settings.error_redirect_url)} loading={saving.error_redirect_url}>
              保存
            </Button>
          </div>
          {messages.error_redirect_url && (
            <p className={`text-xs mt-1.5 ${messages.error_redirect_url.type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
              {messages.error_redirect_url.text}
            </p>
          )}
        </div>
      </div>

      {/* 日志配置 */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg shadow-slate-200/40">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">日志配置</h2>
              <p className="text-xs text-slate-400">D1 Free Plan 建议关闭以节省配额</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* 日志开关 */}
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl backdrop-blur-sm border border-slate-700/50">
            <div>
              <div className="font-medium text-foreground text-sm">启用日志记录</div>
              <div className="text-xs text-slate-500 mt-0.5">记录每次优惠使用和管理操作</div>
            </div>
            <button
              onClick={() => {
                const newVal = settings.log_enabled === 'true' ? 'false' : 'true';
                setSettings(prev => ({ ...prev, log_enabled: newVal }));
                saveSetting('log_enabled', newVal);
              }}
              disabled={saving.log_enabled}
              className={`relative w-11 h-6 rounded-full transition-colors ${settings.log_enabled === 'true' ? 'bg-orange-500' : 'bg-slate-600'} ${saving.log_enabled ? 'opacity-50' : ''}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.log_enabled === 'true' ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          {/* 保留天数 + 清理 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">保留天数</label>
              <div className="flex gap-2">
                <select
                  value={settings.log_retention_days}
                  onChange={e => setSettings(prev => ({ ...prev, log_retention_days: e.target.value }))}
                  className="filter-dropdown flex-1"
                >
                  <option value="3">3 天</option>
                  <option value="7">7 天</option>
                  <option value="14">14 天</option>
                  <option value="30">30 天</option>
                </select>
                <Button variant="outline" onClick={() => saveSetting('log_retention_days', settings.log_retention_days)} loading={saving.log_retention_days}>
                  保存
                </Button>
              </div>
            </div>
            <div className="sm:self-end">
              <Button variant="outline" onClick={cleanLogs} loading={cleaningLogs} className="text-red-600 border-red-200 hover:bg-red-50">
                🗑 清理过期日志
              </Button>
            </div>
          </div>
          {messages.log_retention_days && (
            <p className={`text-xs ${messages.log_retention_days.type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
              {messages.log_retention_days.text}
            </p>
          )}
          {messages.log_clean && (
            <p className={`text-xs ${messages.log_clean.type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
              {messages.log_clean.text}
            </p>
          )}
        </div>
      </div>

      {/* ===== 模态框 ===== */}

      {/* QR扫描模态框 */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">扫码配置</h3>
              <button onClick={() => setShowQRModal(false)} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <QRScanner targets={scanTargets} onScan={handleTargetScan} title="选择目标并上传二维码" />
            </div>
          </div>
        </div>
      )}

      {/* 新增类型模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="font-semibold text-foreground">新增优惠类型</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">类型代码</label>
                <input
                  type="text"
                  placeholder="例如: 4hour"
                  value={newType.code}
                  onChange={e => setNewType(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-foreground focus:outline-none focus:border-blue-500 focus:bg-slate-800"
                />
                <p className="text-xs text-slate-500 mt-1">英文和数字，用于系统识别</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">显示名称</label>
                <input
                  type="text"
                  placeholder="例如: 4小时优惠"
                  value={newType.name}
                  onChange={e => setNewType(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-foreground focus:outline-none focus:border-blue-500 focus:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">描述（可选）</label>
                <input
                  type="text"
                  placeholder="例如: 适用于短时停车"
                  value={newType.description}
                  onChange={e => setNewType(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-foreground focus:outline-none focus:border-blue-500 focus:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">标识颜色</label>
                <div className="flex gap-2">
                  {['#6366f1', '#f97316', '#10b981', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6'].map(c => (
                    <button
                      key={c}
                      onClick={() => setNewType(prev => ({ ...prev, color: c }))}
                      className={`w-8 h-8 rounded-lg transition-transform ${newType.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {typeMessages.new && (
                <div className={`text-sm ${typeMessages.new.type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
                  {typeMessages.new.text}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => { setShowAddModal(false); setNewType({ code: '', name: '', description: '', color: '#6366f1' }); setTypeMessages(p => { const n = {...p}; delete n.new; return n; }); }} className="flex-1">
                  取消
                </Button>
                <Button variant="primary" onClick={handleAddType} loading={addingType} className="flex-1">
                  添加
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 类型详情模态框 - 支持直接填写 URL */}
      {showTypeDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTypeDetail(null)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: showTypeDetail.color }} />
                <h3 className="font-semibold text-foreground">{showTypeDetail.name}</h3>
                <span className="text-xs text-slate-400 font-mono">{showTypeDetail.code}</span>
              </div>
              <button onClick={() => setShowTypeDetail(null)} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {showTypeDetail.description && (
                <p className="text-sm text-slate-400">{showTypeDetail.description}</p>
              )}
              
              {/* 状态和 Session 显示 */}
              <div className="flex items-center gap-2 flex-wrap">
                {showTypeDetail.jsessionid ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    已配置
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    待配置
                  </span>
                )}
                {showTypeDetail.isSystem && (
                  <span className="px-2 py-1 rounded-full text-xs bg-slate-700 text-slate-400">系统内置</span>
                )}
              </div>

              {/* Session ID 显示 */}
              {showTypeDetail.jsessionid && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">当前 Session</label>
                  <div className="px-3 py-2 bg-slate-900 rounded-lg text-xs font-mono text-slate-400 break-all">
                    {showTypeDetail.jsessionid.slice(0, 48)}...
                  </div>
                </div>
              )}

              {/* 直接扫描配置区域 */}
              <div className="border-t border-slate-700/50 pt-4 mt-4">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  {showTypeDetail.jsessionid ? '更新配置' : '配置此优惠类型'}
                </label>
                <QRScanner
                  targets={[{
                    id: showTypeDetail.code,
                    name: showTypeDetail.name,
                    description: showTypeDetail.description || undefined,
                    color: showTypeDetail.color,
                    type: 'discount' as const,
                  }]}
                  onScan={handleTargetScan}
                />
              </div>

              {/* 消息 */}
              {typeMessages[showTypeDetail.code] && (
                <div className={`text-sm ${typeMessages[showTypeDetail.code].type === 'success' ? 'text-blue-400' : 'text-red-500'}`}>
                  {typeMessages[showTypeDetail.code].text}
                </div>
              )}
              
              {/* 操作 */}
              {!showTypeDetail.isSystem && (
                <div className="flex gap-3 pt-2 border-t border-slate-700/50">
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteType(showTypeDetail.code)}
                    loading={deletingType === showTypeDetail.code}
                    className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                  >
                    删除此类型
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
