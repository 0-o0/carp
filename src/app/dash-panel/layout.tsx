'use client';

import { useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  isSuperAdmin: boolean;
}

type ThemeMode = 'light' | 'dark' | 'system';
const THEME_STORAGE_KEY = 'theme-mode';

// 太阳图标
const SunIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

// 月亮图标
const MoonIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

// 系统图标
const SystemIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export default function DashPanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authVerified, setAuthVerified] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  const isLoginPage = pathname === '/dash-panel';

  const getSystemTheme = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const applyTheme = useCallback((mode: ThemeMode) => {
    const resolved = mode === 'system' ? getSystemTheme() : mode;
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = resolved;
  }, []);

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

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) ?? 'light';
    setThemeMode(stored);
    applyTheme(stored);

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media || !media.addEventListener) return;
    const handleChange = () => {
      const current = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) ?? 'light';
      if (current === 'system') applyTheme('system');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [applyTheme]);

  // 点击外部关闭主题下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setThemeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    applyTheme(mode);
    setThemeDropdownOpen(false);
  };

  // 获取当前主题的图标
  const getThemeIcon = () => {
    if (themeMode === 'light') return <SunIcon />;
    if (themeMode === 'dark') return <MoonIcon />;
    return <SystemIcon />;
  };

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
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <span className="text-gray-500 text-sm">验证登录状态...</span>
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
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <span className="text-gray-500 text-sm">正在跳转...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/dash-panel/guests', label: '住客管理', icon: '👥' },
    { href: '/dash-panel/logs', label: '使用记录', icon: '📊' },
    { href: '/dash-panel/settings', label: '系统设置', icon: '⚙️' },
  ];

  if (user?.isSuperAdmin) {
    navItems.splice(2, 0, { href: '/dash-panel/admins', label: '管理员', icon: '🔐' });
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* 移动端遮罩层 */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          style={{ WebkitBackdropFilter: 'blur(4px)' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        {/* 侧边栏 - 固定定位，防止滚动消失 */}
        <aside className={`
          fixed inset-y-0 left-0 z-50
          w-[260px] flex flex-col
          bg-slate-900/95 backdrop-blur-xl
          border-r border-slate-700/50
          shadow-[4px_0_32px_rgba(0,0,0,0.3)]
          transform transition-transform duration-200 ease-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ WebkitBackdropFilter: 'blur(20px)' }}
        >
          {/* Logo区域 */}
          <div className="px-5 pt-6 pb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] tracking-[0.25em] text-orange-400 font-bold uppercase">Carp Hotel</p>
              <p className="text-lg font-bold text-foreground mt-0.5">停车管理</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-blue-500/20 text-lg shadow-sm border border-slate-600/50">🚗</span>
          </div>
          
          {/* 分隔线 */}
          <div className="mx-5 mb-3 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
          
          <div className="px-5 pb-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">控制台</div>
          
          {/* 导航菜单 */}
          <nav className="flex-1 space-y-1 px-3 pb-5 overflow-y-auto">
            {navItems.map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    active 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30' 
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          
          {/* 用户信息卡片 */}
          <div className="px-3 pb-5">
            <div 
              className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-lg p-4 text-sm"
              style={{ WebkitBackdropFilter: 'blur(16px)' }}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{user?.username}</p>
                  <p className="text-xs text-slate-400">{user?.isSuperAdmin ? '超级管理员' : '管理员'}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout} 
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 font-medium hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                退出登录
              </button>
            </div>
          </div>
        </aside>

        {/* 主内容区域 - 需要为固定侧边栏留出空间 */}
        <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px]">
          {/* 顶部导航栏 */}
          <header 
            className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 px-4 sm:px-5 py-3 sm:py-3.5"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
          >
            <div className="flex items-center justify-between gap-3">
              {/* 移动端菜单按钮 */}
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
                aria-label="打开菜单"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400 font-bold hidden sm:block">Dashboard</p>
                <h1 className="text-sm sm:text-lg font-bold text-foreground sm:mt-0.5 truncate">酒店停车管理中心</h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* 移动端用户头像 */}
                <div className="lg:hidden flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* 主题切换 - 下拉式 */}
                  <div className={`theme-dropdown ${themeDropdownOpen ? 'open' : ''}`} ref={themeDropdownRef}>
                    <button
                      type="button"
                      className="theme-dropdown-trigger"
                      onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                      aria-label="切换主题"
                    >
                      {getThemeIcon()}
                    </button>
                    <div className="theme-dropdown-menu">
                      <button
                        type="button"
                        className={`theme-dropdown-item ${themeMode === 'light' ? 'active' : ''}`}
                        onClick={() => handleThemeChange('light')}
                      >
                        <SunIcon />
                        <span>浅色</span>
                      </button>
                      <button
                        type="button"
                        className={`theme-dropdown-item ${themeMode === 'dark' ? 'active' : ''}`}
                        onClick={() => handleThemeChange('dark')}
                      >
                        <MoonIcon />
                        <span>深色</span>
                      </button>
                      <button
                        type="button"
                        className={`theme-dropdown-item ${themeMode === 'system' ? 'active' : ''}`}
                        onClick={() => handleThemeChange('system')}
                      >
                        <SystemIcon />
                        <span>跟随系统</span>
                      </button>
                    </div>
                  </div>
                  {/* 系统状态 */}
                  <div className="hidden sm:flex items-center gap-2 rounded-lg bg-blue-500/20 backdrop-blur-sm px-3 py-1.5 text-xs text-blue-300 font-medium border border-blue-500/30">
                    <span className="inline-flex h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    <span>系统在线</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-5 lg:p-6 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
