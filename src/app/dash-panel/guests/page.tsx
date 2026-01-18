'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, InputField, Modal, StatusBadge, ToggleSwitch, PlateInput, validatePlateNumber } from '@/components/ui';
import { calculateDefaultCheckOutTimeShanghai, formatShanghaiDateTimeLocalInput, parseShanghaiDateTime } from '@/lib/datetime';
import type { GuestsResponse } from '@/types/api';

interface Guest {
  id: number;
  name: string;
  phone: string;
  room_number: string;
  plate_number: string | null;
  use_count: number;
  check_in_time: string;
  check_out_time: string;
  discount_type: '24hour' | '5day';
  status: 'active' | 'exhausted' | 'expired' | 'disabled';
  created_at: string;
  updated_at: string;
}

export default function GuestsPage() {
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultUseCount, setDefaultUseCount] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    roomNumber: '',
    plateNumber: '',
    useCount: 3,
    checkInTime: '',
    checkOutTime: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // 加载住客列表
  const loadGuests = useCallback(async () => {
    try {
      const url = searchQuery 
        ? `/api/guests?search=${encodeURIComponent(searchQuery)}`
        : '/api/guests';
      
      const response = await fetch(url, {
        credentials: 'include',
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

  // 重置表单
  const resetForm = () => {
    const now = new Date();
    const checkOut = calculateDefaultCheckOutTimeShanghai(now);

    setFormData({
      name: '',
      phone: '',
      roomNumber: '',
      plateNumber: '',
      useCount: defaultUseCount,
      checkInTime: formatShanghaiDateTimeLocalInput(now),
      checkOutTime: formatShanghaiDateTimeLocalInput(checkOut),
    });
    setFormErrors({});
  };

  // 打开新增弹窗
  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // 打开编辑弹窗
  const openEditModal = (guest: Guest) => {
    setEditingGuest(guest);
    const checkIn = parseShanghaiDateTime(guest.check_in_time);
    const checkOut = parseShanghaiDateTime(guest.check_out_time);
    setFormData({
      name: guest.name,
      phone: guest.phone,
      roomNumber: guest.room_number,
      plateNumber: guest.plate_number || '',
      useCount: guest.use_count,
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
    if (!formData.roomNumber.trim()) errors.roomNumber = '请输入房间号';
    if (formData.plateNumber && !validatePlateNumber(formData.plateNumber)) {
      errors.plateNumber = '车牌号格式不正确';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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
  const toggleStatus = async (guest: Guest) => {
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
  const getStatus = (guest: Guest): 'active' | 'exhausted' | 'expired' | 'disabled' => {
    if (guest.status === 'disabled') return 'disabled';
    if (guest.use_count <= 0) return 'exhausted';
    const checkOut = parseShanghaiDateTime(guest.check_out_time);
    if (checkOut && checkOut.getTime() < Date.now()) return 'expired';
    return guest.status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 顶部统计卡片 - 响应式网格 */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card border border-orange-100/80 bg-gradient-to-br from-orange-50/90 to-white/90 shadow-lg">
          <p className="text-xs text-orange-600">可用住客</p>
          <p className="text-2xl sm:text-3xl font-semibold text-orange-700 mt-1">{guests.filter(g => g.status === 'active' && g.use_count > 0).length}</p>
          <p className="text-xs text-orange-500 mt-1">待处理申请快速放行</p>
        </div>
        <div className="card border border-purple-100/80 bg-gradient-to-br from-purple-50/90 to-white/90 shadow-lg">
          <p className="text-xs text-purple-700">总住客</p>
          <p className="text-2xl sm:text-3xl font-semibold text-purple-700 mt-1">{guests.length}</p>
          <p className="text-xs text-purple-500 mt-1">含禁用、超时、次数用尽</p>
        </div>
        <div className="card border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 to-white/90 shadow-lg sm:col-span-2 lg:col-span-1">
          <p className="text-xs text-emerald-700">快捷操作</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={openAddModal} className="px-3 py-2 rounded-full bg-emerald-600 text-white text-sm shadow">
              + 新增住客
            </button>
            <button onClick={() => loadGuests()} className="px-3 py-2 rounded-full bg-white text-emerald-700 text-sm border border-emerald-100">
              刷新列表
            </button>
          </div>
        </div>
      </div>

      <div className="card shadow-xl border border-gray-100/80">
        <div className="flex flex-col gap-4">
          {/* 标题区域 - 响应式 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">住客管理</h1>
              <p className="text-xs sm:text-sm text-gray-500">快速搜索、筛选并管理住客优惠资格</p>
            </div>
            <div className="hidden sm:block">
              <Button variant="orange" onClick={openAddModal}>
                + 新增住客
              </Button>
            </div>
          </div>

          {/* 搜索和筛选 - 响应式 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="search-box flex-1">
              <svg className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="搜索姓名、手机号、房间号、车牌..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 min-w-0"
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
          <div className="hidden lg:block rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>住客信息</th>
                    <th>房间号</th>
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
                      <td colSpan={9} className="text-center text-gray-500 py-8">
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
                              <div className="font-medium text-gray-900">{guest.name}</div>
                              <div className="text-sm text-gray-500">{guest.phone}</div>
                            </div>
                          </td>
                          <td>{guest.room_number}</td>
                          <td>
                            {guest.plate_number ? (
                              <span className="font-mono">{guest.plate_number}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td>
                            <span className={`font-medium ${guest.use_count <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {guest.use_count}
                            </span>
                          </td>
                          <td>
                            <span className={`px-2 py-1 rounded text-xs ${
                              guest.discount_type === '5day' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {guest.discount_type === '5day' ? '5天' : '24小时'}
                            </span>
                          </td>
                          <td className="text-sm text-gray-600">
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
                              <button
                                onClick={() => openEditModal(guest)}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="编辑"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(guest.id)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                title="删除"
                              >
                                🗑️
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
          <div className="lg:hidden space-y-3">
            {filteredGuests.length === 0 ? (
              <div className="text-center text-gray-500 py-8">暂无数据</div>
            ) : (
              filteredGuests.map(guest => {
                const status = getStatus(guest);
                return (
                  <div key={guest.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                    {/* 卡片头部 */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {guest.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{guest.name}</div>
                          <div className="text-sm text-gray-500">{guest.phone}</div>
                        </div>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    {/* 卡片详情 */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">房间: </span>
                        <span className="font-medium text-gray-900">{guest.room_number}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">剩余: </span>
                        <span className={`font-medium ${guest.use_count <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {guest.use_count} 次
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">车牌: </span>
                        <span className="font-mono text-gray-900">{guest.plate_number || '-'}</span>
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          guest.discount_type === '5day' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {guest.discount_type === '5day' ? '5天优惠' : '24小时'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mb-3">
                      离店: {formatDate(guest.check_out_time)}
                    </div>

                    {/* 卡片操作 */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">启用</span>
                        <ToggleSwitch
                          checked={guest.status !== 'disabled'}
                          onChange={() => toggleStatus(guest)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(guest)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(guest.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="删除"
                        >
                          🗑️
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
            label="房间号 *"
            placeholder="请输入房间号"
            value={formData.roomNumber}
            onChange={e => setFormData({ ...formData, roomNumber: e.target.value })}
            error={formErrors.roomNumber}
          />
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              车牌号 <span className="text-gray-400">(可选)</span>
            </label>
            <PlateInput
              value={formData.plateNumber}
              onChange={value => setFormData({ ...formData, plateNumber: value })}
            />
            {formErrors.plateNumber && (
              <p className="text-sm text-red-500 mt-1">{formErrors.plateNumber}</p>
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
            <p className="text-sm text-red-500">{formErrors.form}</p>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
              取消
            </Button>
            <Button variant="orange" onClick={handleAdd} loading={submitting} className="flex-1">
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
            label="房间号 *"
            placeholder="请输入房间号"
            value={formData.roomNumber}
            onChange={e => setFormData({ ...formData, roomNumber: e.target.value })}
            error={formErrors.roomNumber}
          />
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              车牌号 <span className="text-gray-400">(可选)</span>
            </label>
            <PlateInput
              value={formData.plateNumber}
              onChange={value => setFormData({ ...formData, plateNumber: value })}
            />
            {formErrors.plateNumber && (
              <p className="text-sm text-red-500 mt-1">{formErrors.plateNumber}</p>
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
            <p className="text-sm text-red-500">{formErrors.form}</p>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">
              取消
            </Button>
            <Button variant="orange" onClick={handleEdit} loading={submitting} className="flex-1">
              保存修改
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
