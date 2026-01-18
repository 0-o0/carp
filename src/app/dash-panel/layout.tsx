'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  isSuperAdmin: boolean;
}

export default function DashPanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authVerified, setAuthVerified] = useState(false); // 新增：是否已验证认证状态

  const isLoginPage = pathname === '/dash-panel';

  // 验证登录状态
  const verifyAuth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (response.ok) {
        const data = await response.json() as { success: boolean; user?: User };
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('dash_user', JSON.stringify(data.user));
          return true;
        }
      }
      
      // 验证失败，清除本地存储
      localStorage.removeItem('dash_user');
      setUser(null);
      return false;
    } catch {
      // 网络错误时不再信任 localStorage，因为可能是 cookie 失效
      localStorage.removeItem('dash_user');
      setUser(null);
      return false;
    }
  }, []);

  // 初始化验证
  useEffect(() => {
    // 始终进行服务端验证
    verifyAuth().then(isValid => {
      setLoading(false);
      setAuthVerified(true);
      
      if (isLoginPage) {
        // 如果在登录页且已登录，跳转到 guests
        if (isValid) {
          router.replace('/dash-panel/guests');
        }
      } else {
        // 如果在其他页面且未登录，跳转到登录页
        if (!isValid) {
          router.replace('/dash-panel');
        }
      }
    });
  }, [isLoginPage, verifyAuth, router]);

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      /* ignore */
    }
    localStorage.removeItem('dash_user');
    setUser(null);
    router.push('/dash-panel');
  };

  // 显示加载状态直到验证完成
  if (loading || !authVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-purple-50">
        <div className="text-gray-500 flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span>验证登录状态...</span>
        </div>
      </div>
    );
  }

  // 登录页直接渲染
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 未登录且不在登录页，不渲染任何内容（等待重定向）
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-purple-50">
        <div className="text-gray-500 flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span>正在跳转...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/dash-panel/guests', label: '住客管理', icon: '👥' },
    { href: '/dash-panel/settings', label: '系统设置', icon: '⚙️' },
  ];

  if (user?.isSuperAdmin) {
    navItems.splice(1, 0, { href: '/dash-panel/admins', label: '管理员', icon: '🔐' });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/60">
      {/* 移动端遮罩层 */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        {/* 侧边栏 - 桌面端固定显示，移动端滑出 */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 flex-col bg-white/95 backdrop-blur-lg border-r border-gray-100 shadow-xl lg:shadow-sm
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:flex
        `}>
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div>
              <p className="text-xs tracking-[0.2em] text-orange-500 font-semibold">CARP HOTEL</p>
              <p className="text-xl font-bold text-gray-900 mt-1">停车管理</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-purple-100 text-orange-600 text-lg">🚗</span>
          </div>
          <div className="px-6 pb-4 text-xs text-gray-400">控制台</div>
          <nav className="flex-1 space-y-2 px-4 pb-6 overflow-y-auto">
            {navItems.map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-150 ${active ? 'bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-lg shadow-orange-200' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-4 pb-6">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-700">
              <p className="font-semibold truncate">{user?.username}</p>
              <p className="text-xs text-gray-500 mt-1">{user?.isSuperAdmin ? '超级管理员' : '管理员'}</p>
              <button onClick={handleLogout} className="mt-3 inline-flex items-center gap-2 text-xs text-orange-600 font-semibold">
                退出登录 ↗
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {/* 顶部导航栏 */}
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100 px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              {/* 移动端菜单按钮 */}
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                aria-label="打开菜单"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold hidden sm:block">Dashboard</p>
                <h1 className="text-base sm:text-xl font-bold text-gray-900 sm:mt-1 truncate">酒店停车管理中心</h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* 移动端用户头像 */}
                <div className="lg:hidden flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                {/* 系统状态 */}
                <div className="hidden sm:flex items-center gap-2 sm:gap-3 rounded-full bg-gray-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="hidden sm:inline">系统在线</span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-5 lg:p-8 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
