'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, InputField, Modal, StatusBadge, ToggleSwitch, PlateInput, validatePlateNumber } from '@/components/ui';
import { calculateDefaultCheckOutTimeShanghai, formatShanghaiDateTimeLocalInput, parseShanghaiDateTime } from '@/lib/datetime';
import type { GuestsResponse, GuestItem, SubmitResponse } from '@/types/api';

// 优惠类型接口
interface DiscountType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

export default function GuestsPage() {
  const router = useRouter();
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadGuestsInFlightRef = useRef(false);
  const [defaultUseCount, setDefaultUseCount] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestItem | null>(null);
  
  // 动态优惠类型
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const selectableDiscountTypes = discountTypes.filter(t => t.code !== 'none');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    notes: '',
    plateNumber: '',
    useCount: 3,
    discountType: '',
    checkInTime: '',
    checkOutTime: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [assistSubmitting, setAssistSubmitting] = useState<number | null>(null);

  // 加载住客列表
  const loadGuests = useCallback(async () => {
    if (loadGuestsInFlightRef.current) return;
    loadGuestsInFlightRef.current = true;
    try {
      const url = searchQuery 
        ? `/api/guests?search=${encodeURIComponent(searchQuery)}`
        : '/api/guests';
      
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
      });
      const result: GuestsResponse = await response.json();

      if (response.status === 401) {
        router.push('/dash-panel');
        return;
      }

      if (result.success && result.guests) {
        setGuests(result.guests);
      }
    } catch (error) {
      console.error('加载住客列表失败:', error);
    } finally {
      loadGuestsInFlightRef.current = false;
      setLoading(false);
    }
  }, [router, searchQuery]);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  // 加载默认可用次数
  useEffect(() => {
    const loadDefaultUseCount = async () => {
      try {
        const response = await fetch('/api/settings', { credentials: 'include' });
        if (response.status === 401) {
          router.push('/dash-panel');
          return;
        }

        const data = (await response.json()) as { success: boolean; settings?: Record<string, string> };
        const next = Number.parseInt(data.settings?.default_use_count || '3', 10);
        if (Number.isFinite(next) && next > 0) {
          setDefaultUseCount(next);
        }
      } catch (error) {
        console.error('加载默认可用次数失败:', error);
      }
    };

    loadDefaultUseCount();
  }, [router]);

  // 加载优惠类型
  useEffect(() => {
    const loadDiscountTypes = async () => {
      try {
        const response = await fetch('/api/discount-types?activeOnly=true', { credentials: 'include' });
        if (response.status === 401) {
          router.push('/dash-panel');
          return;
        }

        const data = await response.json();
        if (data.success && data.discountTypes) {
          setDiscountTypes(data.discountTypes);
        }
      } catch (error) {
        console.error('加载优惠类型失败:', error);
      }
    };

    loadDiscountTypes();
  }, [router]);

  useEffect(() => {
    if (selectableDiscountTypes.length === 0) return;
    setFormData(prev => {
      const exists = selectableDiscountTypes.some(t => t.code === prev.discountType);
      if (exists) return prev;
      return { ...prev, discountType: selectableDiscountTypes[0].code };
    });
  }, [selectableDiscountTypes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadGuests();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loadGuests]);

  // 过滤住客
  const filteredGuests = guests.filter(guest => {
    if (statusFilter === 'all') return true;
    return guest.status === statusFilter;
  });

  // 重置表单 - 默认选择第一个优惠类型（因为录入的住客通常都有优惠）
  const resetForm = useCallback(() => {
    const now = new Date();
    const checkOut = calculateDefaultCheckOutTimeShanghai(now);
    
    // 获取第一个可用的优惠类型，如果没有则为空
    const defaultDiscountType = selectableDiscountTypes.length > 0 ? selectableDiscountTypes[0].code : '';

    setFormData({
      name: '',
      phone: '',
      notes: '',
      plateNumber: '',
      useCount: defaultUseCount,
      discountType: defaultDiscountType,
      checkInTime: formatShanghaiDateTimeLocalInput(now),
      checkOutTime: formatShanghaiDateTimeLocalInput(checkOut),
    });
    setFormErrors({});
  }, [defaultUseCount, selectableDiscountTypes]);

  // 打开新增弹窗
  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // 打开编辑弹窗
  const openEditModal = (guest: GuestItem) => {
    setEditingGuest(guest);
    const checkIn = parseShanghaiDateTime(guest.check_in_time);
    const checkOut = parseShanghaiDateTime(guest.check_out_time);
    setFormData({
      name: guest.name,
      phone: guest.phone,
      notes: guest.notes || '',
      plateNumber: guest.plate_number || '',
      useCount: guest.use_count,
      discountType: guest.discount_type,
      checkInTime: checkIn ? formatShanghaiDateTimeLocalInput(checkIn) : guest.check_in_time.replace(' ', 'T'),
      checkOutTime: checkOut ? formatShanghaiDateTimeLocalInput(checkOut) : guest.check_out_time.replace(' ', 'T'),
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  // 验证表单
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = '请输入姓名';
    if (!formData.phone.trim()) errors.phone = '请输入手机号';
    else if (!/^1[3-9]\d{9}$/.test(formData.phone)) errors.phone = '手机号格式不正确';
    if (!formData.discountType) errors.discountType = '请选择优惠类型';
    else if (
      selectableDiscountTypes.length > 0 &&
      !selectableDiscountTypes.some(t => t.code === formData.discountType)
    ) {
      errors.discountType = '优惠类型无效，请重新选择';
    }
    if (formData.plateNumber && !validatePlateNumber(formData.plateNumber)) {
      errors.plateNumber = '车牌号格式不正确';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 辅助提交优惠申请
  const handleAssistSubmit = async (guest: GuestItem) => {
    if (!guest.plate_number) {
      alert('该住客没有录入车牌号，无法辅助提交');
      return;
    }

    if (!guest.discount_type) {
      alert('该住客未设置优惠类型，无法提交优惠申请');
      return;
    }

    if (guest.use_count <= 0) {
      alert('该住客可用次数已用完');
      return;
    }

    const checkOut = parseShanghaiDateTime(guest.check_out_time);
    if (checkOut && checkOut.getTime() < Date.now()) {
      alert('该住客已超过离店时间');
      return;
    }

    if (!confirm(`确定要为 ${guest.name} 的车牌 ${guest.plate_number} 提交优惠申请吗？`)) {
      return;
    }

    setAssistSubmitting(guest.id);
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guestId: guest.id,
          plateNumber: guest.plate_number,
        }),
      });

      const result: SubmitResponse = await response.json();

      if (result.success) {
        const nextUseCount = typeof result.useCount === 'number' ? result.useCount : Math.max(0, guest.use_count - 1);
        const nextStatus =
          typeof result.status === 'string' ? result.status : (nextUseCount <= 0 ? 'exhausted' : guest.status);

        // 立即更新本地状态，避免需要刷新页面
        setGuests(prevGuests => prevGuests.map(g => (g.id === guest.id ? { ...g, use_count: nextUseCount, status: nextStatus } : g)));
        alert(`提交成功！\n${result.message || '可用次数已扣减'}`);
      } else {
        alert(`提交失败：${result.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('辅助提交失败:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setAssistSubmitting(null);
    }
  };

  // 提交新增
  const handleAdd = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result: GuestsResponse = await response.json();

      if (result.success) {
        setShowAddModal(false);
        loadGuests();
      } else {
        setFormErrors({ form: result.message || '创建失败' });
      }
    } catch {
      setFormErrors({ form: '操作失败，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  // 提交编辑
  const handleEdit = async () => {
    if (!validateForm() || !editingGuest) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editingGuest.id,
          ...formData,
        }),
      });

      const result: GuestsResponse = await response.json();

      if (result.success) {
        setShowEditModal(false);
        loadGuests();
      } else {
        setFormErrors({ form: result.message || '更新失败' });
      }
    } catch {
      setFormErrors({ form: '操作失败，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  // 切换状态
  const toggleStatus = async (guest: GuestItem) => {
    const newStatus = guest.status === 'disabled' ? 'active' : 'disabled';
    
    try {
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: guest.id,
          status: newStatus,
        }),
      });

      if (response.ok) {
        loadGuests();
      }
    } catch (error) {
      console.error('状态切换失败:', error);
    }
  };

  // 删除住客
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？')) return;

    try {
      const response = await fetch(`/api/guests?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        loadGuests();
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = parseShanghaiDateTime(dateStr);
    if (!date) return dateStr;
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 获取状态
  const getStatus = (guest: GuestItem): 'active' | 'exhausted' | 'expired' | 'disabled' => {
    if (guest.status === 'disabled') return 'disabled';
    if (guest.use_count <= 0) return 'exhausted';
    const checkOut = parseShanghaiDateTime(guest.check_out_time);
    if (checkOut && checkOut.getTime() < Date.now()) return 'expired';
    return guest.status;
  };

  // 获取优惠类型显示名称
  const getDiscountTypeName = (code: string) => {
    if (!code) return '-';
    const type = discountTypes.find(t => t.code === code);
    return type?.name || code;
  };

  // 获取优惠类型颜色 - 根据实际类型返回对应颜色
  const getDiscountTypeColor = (code: string) => {
    if (!code) return '#9CA3AF';
    const type = discountTypes.find(t => t.code === code);
    // 根据类型名称的关键字返回对应颜色主题
    if (type?.color) {
      const colorMap: Record<string, string> = {
        'orange': '#F97316',
        'purple': '#3B82F6', // 改为蓝色
        'blue': '#3B82F6',
        'green': '#3B82F6', // 改为蓝色
        'red': '#EF4444',
        'pink': '#F97316', // 改为橙色
        'yellow': '#F59E0B',
        'cyan': '#3B82F6', // 改为蓝色
        'indigo': '#3B82F6', // 改为蓝色
      };
      return colorMap[type.color] || type.color;
    }
    return '#3B82F6';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-blue-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <span className="text-slate-400 text-sm">加载住客列表...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 顶部统计卡片 - 响应式网格 */}
      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass-stat rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">可用住客</p>
              <p className="text-3xl sm:text-4xl font-bold text-orange-300 mt-2">{guests.filter(g => g.status === 'active' && g.use_count > 0).length}</p>
              <p className="text-xs text-slate-400 mt-2">待处理申请快速放行</p>
            </div>
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xl shadow-lg shadow-orange-500/30">
              🎫
            </span>
          </div>
        </div>
        <div className="glass-stat rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">总住客</p>
              <p className="text-3xl sm:text-4xl font-bold text-blue-300 mt-2">{guests.length}</p>
              <p className="text-xs text-slate-400 mt-2">含禁用、超时、次数用尽</p>
            </div>
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-500/30">
              👥
            </span>
          </div>
        </div>
        <div className="glass-stat sm:col-span-2 lg:col-span-1 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">快捷操作</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={openAddModal} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-lg shadow-orange-500/30 hover:shadow-xl hover:from-orange-600 hover:to-orange-700 transition-all">
                  + 新增住客
                </button>
                <button onClick={() => loadGuests()} className="px-4 py-2.5 rounded-xl bg-slate-800/60 text-blue-300 text-sm font-semibold border border-slate-600/50 hover:bg-slate-700/60 transition-all backdrop-blur-sm">
                  🔄 刷新列表
                </button>
              </div>
            </div>
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-500/30">
              ⚡
            </span>
          </div>
        </div>
      </div>

      <div className="glass-card shadow-xl border border-slate-700/50 rounded-2xl">
        <div className="flex flex-col gap-4">
          {/* 标题区域 - 响应式 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">住客管理</h1>
              <p className="text-xs sm:text-sm text-slate-400">快速搜索、筛选并管理住客优惠资格</p>
            </div>
            <div className="hidden sm:block">
              <Button variant="blue" onClick={openAddModal}>
                + 新增住客
              </Button>
            </div>
          </div>

          {/* 搜索和筛选 - 响应式 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-5 pb-5">
            <div className="search-box flex-1">
              <svg className="w-5 h-5 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="搜索姓名、手机号、房间号、车牌..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-slate-500"
              />
            </div>
            <select
              className="filter-dropdown w-full sm:w-auto"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="exhausted">次数已用完</option>
              <option value="expired">已超时</option>
              <option value="disabled">已禁用</option>
            </select>
          </div>

          {/* 桌面端表格视图 */}
          <div className="hidden lg:block rounded-2xl overflow-hidden mx-5 mb-5">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>住客信息</th>
                    <th>备注</th>
                    <th>车牌号</th>
                    <th>剩余次数</th>
                    <th>优惠类型</th>
                    <th>离店时间</th>
                    <th>状态</th>
                    <th>启用</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-slate-400 py-8">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map(guest => {
                      const status = getStatus(guest);
                      return (
                        <tr key={guest.id}>
                          <td>
                            <div>
                              <div className="font-medium text-foreground">{guest.name}</div>
                              <div className="text-sm text-slate-400">{guest.phone}</div>
                            </div>
                          </td>
                          <td>
                            {guest.notes ? (
                              <span className="text-slate-300 text-sm">{guest.notes}</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td>
                            {guest.plate_number ? (
                              <span className="font-mono text-slate-200">{guest.plate_number}</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td>
                            <span className={`font-medium ${guest.use_count <= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                              {guest.use_count}
                            </span>
                          </td>
                          <td>
                            <span 
                              className="px-2 py-1 rounded-lg text-xs text-white"
                              style={{ backgroundColor: getDiscountTypeColor(guest.discount_type) }}
                            >
                              {getDiscountTypeName(guest.discount_type)}
                            </span>
                          </td>
                          <td className="text-sm text-slate-400">
                            {formatDate(guest.check_out_time)}
                          </td>
                          <td>
                            <StatusBadge status={status} />
                          </td>
                          <td>
                            <ToggleSwitch
                              checked={guest.status !== 'disabled'}
                              onChange={() => toggleStatus(guest)}
                            />
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {guest.plate_number && guest.discount_type && status === 'active' && (
                                <button
                                  onClick={() => handleAssistSubmit(guest)}
                                  disabled={assistSubmitting === guest.id}
                                  className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all"
                                  title="辅助提交优惠申请"
                                >
                                  {assistSubmitting === guest.id ? '提交中...' : '🚀 辅助提交'}
                                </button>
                              )}
                              <button
                                onClick={() => openEditModal(guest)}
                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                title="编辑"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(guest.id)}
                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                title="删除"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 移动端/平板端卡片视图 */}
          <div className="lg:hidden space-y-4 px-5 pb-5">
            {filteredGuests.length === 0 ? (
              <div className="text-center text-slate-400 py-12 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <span className="text-4xl mb-3 block">📋</span>
                暂无数据
              </div>
            ) : (
              filteredGuests.map(guest => {
                const status = getStatus(guest);
                return (
                  <div key={guest.id} className="p-5 glass-card rounded-2xl">
                    {/* 卡片头部 */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-lg shadow-orange-500/20">
                          {guest.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">{guest.name}</div>
                          <div className="text-sm text-slate-400">{guest.phone}</div>
                        </div>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    {/* 卡片详情 */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                        <span className="text-slate-500 text-xs uppercase tracking-wider">备注</span>
                        <div className="font-medium text-foreground mt-0.5 truncate">{guest.notes || '-'}</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                        <span className="text-slate-500 text-xs uppercase tracking-wider">剩余</span>
                        <div className={`font-bold mt-0.5 ${guest.use_count <= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                          {guest.use_count} 次
                        </div>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                        <span className="text-slate-500 text-xs uppercase tracking-wider">车牌</span>
                        <div className="font-mono text-foreground mt-0.5">{guest.plate_number || '-'}</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                        <span className="text-slate-500 text-xs uppercase tracking-wider">优惠</span>
                        <div className="mt-0.5">
                          <span 
                            className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: getDiscountTypeColor(guest.discount_type) }}
                          >
                            {getDiscountTypeName(guest.discount_type)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      离店: {formatDate(guest.check_out_time)}
                    </div>

                    {/* 卡片操作 */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">启用</span>
                        <ToggleSwitch
                          checked={guest.status !== 'disabled'}
                          onChange={() => toggleStatus(guest)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        {guest.plate_number && guest.discount_type && status === 'active' && (
                          <button
                            onClick={() => handleAssistSubmit(guest)}
                            disabled={assistSubmitting === guest.id}
                            className="px-3 py-2 text-xs font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed shadow-sm transition-all"
                            title="辅助提交"
                          >
                            {assistSubmitting === guest.id ? '...' : '🚀 提交'}
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(guest)}
                          className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                          title="编辑"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(guest.id)}
                          className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                          title="删除"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 新增弹窗 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="新增住客"
      >
        <div className="space-y-4">
          <InputField
            label="姓名 *"
            placeholder="请输入姓名"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />
          <InputField
            label="手机号 *"
            placeholder="请输入手机号"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            error={formErrors.phone}
            maxLength={11}
          />
          <InputField
            label="备注"
            placeholder="可选，如房间号、特殊说明等"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
          />
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              车牌号 <span className="text-slate-400">(可选)</span>
            </label>
            <PlateInput
              value={formData.plateNumber}
              onChange={value => setFormData({ ...formData, plateNumber: value })}
              keyboardAlign="center"
            />
            {formErrors.plateNumber && (
              <p className="text-sm text-red-400 mt-1">{formErrors.plateNumber}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              优惠类型 <span className="text-red-400">*</span>
            </label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              value={formData.discountType}
              onChange={e => setFormData({ ...formData, discountType: e.target.value })}
              required
            >
              <option value="" disabled>
                {selectableDiscountTypes.length === 0 ? '加载中...' : '请选择优惠类型'}
              </option>
              {selectableDiscountTypes.map(type => (
                <option key={type.code} value={type.code}>
                  {type.name}
                </option>
              ))}
            </select>
            {formErrors.discountType && (
              <p className="text-sm text-red-400 mt-1">{formErrors.discountType}</p>
            )}
          </div>
          <InputField
            label="可用次数"
            type="number"
            value={formData.useCount.toString()}
            onChange={e => setFormData({ ...formData, useCount: parseInt(e.target.value) || 0 })}
            min={0}
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="到店时间"
              type="datetime-local"
              value={formData.checkInTime}
              onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
              step={1}
            />
            <InputField
              label="离店时间"
              type="datetime-local"
              value={formData.checkOutTime}
              onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
              step={1}
            />
          </div>

          {formErrors.form && (
            <p className="text-sm text-red-400">{formErrors.form}</p>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
              取消
            </Button>
            <Button variant="blue" onClick={handleAdd} loading={submitting} className="flex-1">
              确认新增
            </Button>
          </div>
        </div>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑住客"
      >
        <div className="space-y-4">
          <InputField
            label="姓名 *"
            placeholder="请输入姓名"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />
          <InputField
            label="手机号 *"
            placeholder="请输入手机号"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            error={formErrors.phone}
            maxLength={11}
          />
          <InputField
            label="备注"
            placeholder="可选，如房间号、特殊说明等"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
          />
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              车牌号 <span className="text-slate-400">(可选)</span>
            </label>
            <PlateInput
              value={formData.plateNumber}
              onChange={value => setFormData({ ...formData, plateNumber: value })}
              keyboardAlign="center"
            />
            {formErrors.plateNumber && (
              <p className="text-sm text-red-400 mt-1">{formErrors.plateNumber}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              优惠类型 <span className="text-red-400">*</span>
            </label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              value={formData.discountType}
              onChange={e => setFormData({ ...formData, discountType: e.target.value })}
              required
            >
              <option value="" disabled>
                {selectableDiscountTypes.length === 0 ? '加载中...' : '请选择优惠类型'}
              </option>
              {selectableDiscountTypes.map(type => (
                <option key={type.code} value={type.code}>
                  {type.name}
                </option>
              ))}
            </select>
            {formErrors.discountType && (
              <p className="text-sm text-red-400 mt-1">{formErrors.discountType}</p>
            )}
          </div>
          <InputField
            label="可用次数"
            type="number"
            value={formData.useCount.toString()}
            onChange={e => setFormData({ ...formData, useCount: parseInt(e.target.value) || 0 })}
            min={0}
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="到店时间"
              type="datetime-local"
              value={formData.checkInTime}
              onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
              step={1}
            />
            <InputField
              label="离店时间"
              type="datetime-local"
              value={formData.checkOutTime}
              onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
              step={1}
            />
          </div>

          {formErrors.form && (
            <p className="text-sm text-red-400">{formErrors.form}</p>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">
              取消
            </Button>
            <Button variant="blue" onClick={handleEdit} loading={submitting} className="flex-1">
              保存修改
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
