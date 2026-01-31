'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { GradientBackground } from '@/components/ui';
import type { AuthResponse } from '@/types/api';

export default function DashPanelLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      setErrors({ form: '请输入用户名和密码' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'login',
          username: formData.username,
          password: formData.password,
        }),
      });

      const result: AuthResponse = await response.json();

      if (result.success) {
        if (result.user) {
          localStorage.setItem('dash_user', JSON.stringify(result.user));
        }
        if (result.needChangePassword) {
          setShowChangePassword(true);
        } else {
          router.push('/dash-panel/guests');
        }
      } else {
        setErrors({ form: result.message || '登录失败' });
      }
    } catch {
      setErrors({ form: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      setErrors({ password: '请输入新密码' });
      return;
    }

    if (newPassword.length < 6) {
      setErrors({ password: '密码至少需要6位' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ password: '两次输入的密码不一致' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'changePassword',
          username: formData.username,
          password: formData.password,
          newPassword,
        }),
      });

      const result: AuthResponse = await response.json();

      if (result.success) {
        const loginResponse = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'login',
            username: formData.username,
            password: newPassword,
          }),
        });
        const loginResult: AuthResponse = await loginResponse.json();
        if (!loginResult.success) {
          setErrors({ password: loginResult.message || '登录失败' });
          return;
        }
        if (loginResult.user) {
          localStorage.setItem('dash_user', JSON.stringify(loginResult.user));
        }
        router.push('/dash-panel/guests');
      } else {
        setErrors({ password: result.message || '修改失败' });
      }
    } catch {
      setErrors({ password: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  // 密码输入框图标
  const EyeIcon = ({ show }: { show: boolean }) => (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {show ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      )}
    </svg>
  );

  // 修改密码页面
  if (showChangePassword) {
    return (
      <GradientBackground className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -left-32 -top-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-500/25 to-blue-400/15" />
          <div className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-orange-500/30 to-amber-400/20" />
          <div className="absolute -left-20 bottom-0 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-blue-400/30 to-blue-300/20" />
        </div>

        <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-[400px]">
            <div 
              className="glass-modal p-8 sm:p-9"
              style={{ WebkitBackdropFilter: 'blur(32px) saturate(180%)' }}
            >
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-800 leading-tight">修改密码</h1>
                <p className="text-slate-500 mt-1.5 text-sm">首次登录请设置新密码</p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">新密码</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="请输入新密码（至少6位）"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="input-field pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <EyeIcon show={showNewPassword} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">确认密码</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="请再次输入新密码"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="input-field pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <EyeIcon show={showConfirmPassword} />
                    </button>
                  </div>
                </div>

                {errors.password && (
                  <p className="text-red-500 text-sm">{errors.password}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary mt-2"
                >
                  {loading ? '提交中...' : '确认修改'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </GradientBackground>
    );
  }

  // 登录页面 - 参考 Sign Up 设计图
  return (
    <GradientBackground className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-32 -top-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-500/25 to-blue-400/15" />
        <div className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-orange-500/30 to-amber-400/20" />
        <div className="absolute -left-20 bottom-0 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-blue-400/30 to-blue-300/20" />
        <div className="absolute right-20 bottom-20 w-[300px] h-[300px] rounded-full bg-gradient-to-tl from-blue-400/25 to-blue-300/15" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div 
            className="glass-modal p-8 sm:p-9"
            style={{ WebkitBackdropFilter: 'blur(32px) saturate(180%)' }}
          >
            {/* Logo */}
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-2xl shadow-xl shadow-orange-500/20">
                🚗
              </div>
            </div>

            <div className="text-center mb-7">
              <h1 className="text-2xl font-bold text-slate-800 leading-tight">管理后台</h1>
              <p className="text-slate-500 mt-1.5 text-sm">酒店停车优惠管理系统</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">用户名</label>
                <input
                  type="text"
                  placeholder="请输入用户名"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">密码</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="input-field pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <EyeIcon show={showPassword} />
                  </button>
                </div>
              </div>

              {errors.form && (
                <div className="flex items-center gap-2 p-3.5 bg-red-50/80 rounded-xl border border-red-100/60">
                  <svg className="w-4.5 h-4.5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-700 text-sm">{errors.form}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    登录中...
                  </span>
                ) : '登录'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-5">
              如忘记密码请联系超级管理员
            </p>
          </div>

          {/* 底部标签 */}
          <div className="mt-5 text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/65 backdrop-blur-sm rounded-full text-xs text-slate-300 shadow-sm border border-slate-700/40">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              系统运行正常
            </span>
          </div>
        </div>
      </div>
    </GradientBackground>
  );
}
