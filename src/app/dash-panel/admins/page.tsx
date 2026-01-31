'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, InputField, Modal, StatusBadge, ToggleSwitch } from '@/components/ui';
import type { AdminsResponse, AuthResponse } from '@/types/api';

interface Admin {
  id: number;
  username: string;
  is_super_admin: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export default function AdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 加载管理员列表
  const loadAdmins = useCallback(async () => {
    try {
      const response = await fetch('/api/admins', {
        credentials: 'include',
      });
      const result: AdminsResponse = await response.json();

      if (response.status === 401) {
        router.push('/dash-panel');
        return;
      }

      if (response.status === 403) {
        router.push('/dash-panel/guests');
        return;
      }

      if (result.success && result.admins) {
        setAdmins(result.admins);
      }
    } catch (error) {
      console.error('加载管理员列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  // 新增管理员
  const handleAdd = async () => {
    if (!newUsername.trim()) {
      setFormError('请输入用户名');
      return;
    }

    if (newUsername.length < 3) {
      setFormError('用户名至少3个字符');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: newUsername.trim() }),
      });

      const result: AuthResponse = await response.json();

      if (result.success) {
        setShowAddModal(false);
        setNewUsername('');
        loadAdmins();
      } else {
        setFormError(result.message || '创建失败');
      }
    } catch {
      setFormError('操作失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 切换状态
  const toggleStatus = async (admin: Admin) => {
    try {
      const response = await fetch('/api/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: admin.id,
          action: 'toggle',
        }),
      });

      if (response.ok) {
        loadAdmins();
      }
    } catch (error) {
      console.error('状态切换失败:', error);
    }
  };

  // 删除管理员
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个管理员吗？')) return;

    try {
      const response = await fetch('/api/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id,
          action: 'delete',
        }),
      });

      if (response.ok) {
        loadAdmins();
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <span className="text-slate-400 text-sm">加载管理员列表...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 顶部统计卡片 - 参考 Lexron Dashboard */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <div className="glass-stat p-5 border border-orange-500/30 bg-gradient-to-br from-orange-500/20 via-slate-800/80 to-amber-500/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">管理员总数</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{admins.length}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">含超级管理员与普通管理员</p>
        </div>
        <div className="glass-stat p-5 border border-blue-500/30 bg-gradient-to-br from-blue-500/20 via-slate-800/80 to-blue-600/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">快捷操作</p>
                <p className="text-sm text-slate-400">新管理员使用默认密码</p>
              </div>
            </div>
            <Button variant="green" onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
              + 新增管理员
            </Button>
          </div>
        </div>
      </div>

      {/* 管理员列表卡片 */}
      <div className="glass-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">管理员管理</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">管理后台账号及权限状态</p>
          </div>
        </div>

        {/* 桌面端表格视图 */}
        <div className="hidden md:block rounded-2xl border border-slate-700/50 overflow-hidden bg-slate-800/60">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>启用</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 py-8">
                      暂无管理员
                    </td>
                  </tr>
                ) : (
                  admins.map(admin => (
                    <tr key={admin.id} className="hover:bg-blue-500/10 transition-colors">
                      <td>
                        <div className="font-medium text-foreground flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold shadow">
                            {admin.username.charAt(0).toUpperCase()}
                          </span>
                          <span>{admin.username}</span>
                          {admin.is_super_admin === 1 && (
                            <span className="text-amber-500">👑</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                          admin.is_super_admin === 1
                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          {admin.is_super_admin === 1 ? '超级管理员' : '管理员'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge 
                          status={admin.is_active === 1 ? 'active' : 'disabled'}
                          text={admin.is_active === 1 ? '正常' : '已禁用'}
                        />
                      </td>
                      <td className="text-sm text-slate-400">
                        {formatDate(admin.created_at)}
                      </td>
                      <td>
                        {admin.is_super_admin === 1 ? (
                          <span className="text-slate-400 text-sm">-</span>
                        ) : (
                          <ToggleSwitch
                            checked={admin.is_active === 1}
                            onChange={() => toggleStatus(admin)}
                          />
                        )}
                      </td>
                      <td>
                        {admin.is_super_admin === 1 ? (
                          <span className="text-slate-400 text-sm">-</span>
                        ) : (
                          <button
                            onClick={() => handleDelete(admin.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="删除"
                          >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 移动端卡片视图 */}
        <div className="md:hidden space-y-3">
          {admins.length === 0 ? (
            <div className="text-center text-slate-500 py-8">暂无管理员</div>
          ) : (
            admins.map(admin => (
              <div key={admin.id} className="p-4 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-sm">
                {/* 卡片头部 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow">
                      {admin.username.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate flex items-center gap-1">
                        {admin.username}
                        {admin.is_super_admin === 1 && <span className="text-amber-500">👑</span>}
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                        admin.is_super_admin === 1
                          ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {admin.is_super_admin === 1 ? '超级管理员' : '管理员'}
                      </span>
                    </div>
                  </div>
                  <StatusBadge 
                    status={admin.is_active === 1 ? 'active' : 'disabled'}
                    text={admin.is_active === 1 ? '正常' : '已禁用'}
                  />
                </div>

                {/* 卡片详情 */}
                <div className="text-sm text-slate-500 mb-3">
                  创建于 {formatDate(admin.created_at)}
                </div>

                {/* 卡片操作 */}
                {admin.is_super_admin !== 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">启用</span>
                      <ToggleSwitch
                        checked={admin.is_active === 1}
                        onChange={() => toggleStatus(admin)}
                      />
                    </div>
                    <button
                      onClick={() => handleDelete(admin.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="删除"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="mt-5 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 backdrop-blur-sm rounded-xl border border-amber-500/30">
          <p className="text-xs sm:text-sm text-amber-400 flex items-start sm:items-center gap-2">
            <span className="flex-shrink-0">💡</span>
            <span><strong>提示：</strong>新增管理员将使用默认密码，首次登录后需修改密码。超级管理员拥有所有权限。</span>
          </p>
        </div>
      </div>

      {/* 新增管理员弹窗 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewUsername('');
          setFormError('');
        }}
        title="新增管理员"
      >
        <div className="space-y-4">
          <InputField
            label="用户名"
            placeholder="请输入用户名（至少3个字符）"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            error={formError}
          />

          <p className="text-sm text-slate-400">
            新管理员将使用系统默认密码，首次登录后需要修改。
          </p>

          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddModal(false);
                setNewUsername('');
                setFormError('');
              }} 
              className="flex-1"
            >
              取消
            </Button>
            <Button variant="orange" onClick={handleAdd} loading={submitting} className="flex-1">
              确认创建
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
