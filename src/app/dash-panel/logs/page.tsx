'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button, StatusBadge } from '@/components/ui';
import { parseShanghaiDateTime } from '@/lib/datetime';

interface UsageLogWithGuest {
  id: number;
  guestId: number;
  plateNumber: string;
  requestSuccess: boolean;
  responseData: string | null;
  createdAt: string;
  guestName: string | null;
  guestPhone: string | null;
  guestRoom: string | null;
}

interface LogStats {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  todayRequests: number;
}

interface LogSettings {
  log_enabled: string;
  log_retention_days: string;
}

interface LogQueryResult {
  success: boolean;
  type: string;
  data: UsageLogWithGuest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function LogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<UsageLogWithGuest[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [logSettings, setLogSettings] = useState<LogSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // 筛选条件
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [successFilter, setSuccessFilter] = useState<string>('all');

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/logs?stats=true&days=7', {
        credentials: 'include',
      });
      if (response.status === 401) {
        router.push('/dash-panel');
        return;
      }
      const text = await response.text();
      let result: any = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        console.error('加载统计数据失败: 非 JSON 响应', text);
        return;
      }
      if (response.ok && result?.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, [router]);

  // 加载日志设置
  const loadLogSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings', {
        credentials: 'include',
      });
      if (response.status === 401) {
        router.push('/dash-panel');
        return;
      }
      const text = await response.text();
      let result: any = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        console.error('加载日志设置失败: 非 JSON 响应', text);
        return;
      }
      if (response.ok && result?.success && result.settings) {
        setLogSettings({
          log_enabled: result.settings.log_enabled || 'false',
          log_retention_days: result.settings.log_retention_days || '7',
        });
      }
    } catch (error) {
      console.error('加载日志设置失败:', error);
    }
  }, [router]);

  // 加载日志列表
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: 'usage',
        page: page.toString(),
        pageSize: '20',
      });
      
      if (searchQuery) params.set('search', searchQuery);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (successFilter !== 'all') params.set('success', successFilter);

      const response = await fetch(`/api/logs?${params}`, {
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/dash-panel');
        return;
      }

      const text = await response.text();
      let result: LogQueryResult | null = null;
      try {
        result = text ? JSON.parse(text) as LogQueryResult : null;
      } catch {
        console.error('加载日志失败: 非 JSON 响应', text);
        return;
      }

      if (response.ok && result?.success) {
        setLogs(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  }, [router, page, searchQuery, startDate, endDate, successFilter]);

  // 初始加载
  useEffect(() => {
    loadStats();
    loadLogSettings();
  }, [loadStats, loadLogSettings]);

  // 筛选变化时重新加载
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadLogs]);

  // 重置筛选
  const resetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSuccessFilter('all');
    setPage(1);
  };

  // 格式化日期时间
  const formatDateTime = (dateStr: string) => {
    const date = parseShanghaiDateTime(dateStr);
    if (!date) return dateStr;
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 成功率计算
  const successRate = useMemo(() => {
    if (!stats || stats.totalRequests === 0) return 0;
    return Math.round((stats.successRequests / stats.totalRequests) * 100);
  }, [stats]);

  // 分页组件
  const Pagination = () => (
    <div className="flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-slate-100">
      <div className="text-sm text-slate-500">
        共 {total} 条记录，第 {page}/{totalPages} 页
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/50 transition-colors"
        >
          上一页
        </button>
        
        {/* 页码快捷跳转 */}
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 text-sm rounded-lg ${
                  page === pageNum 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20' 
                    : 'border border-slate-700 hover:bg-slate-700/50 text-slate-300'
                } transition-all`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/50 transition-colors"
        >
          下一页
        </button>
      </div>
    </div>
  );

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-600/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <span className="text-slate-400 text-sm">加载使用记录...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 日志未开启提示 */}
      {logSettings && logSettings.log_enabled !== 'true' && (
        <div className="glass-card p-4 bg-gradient-to-r from-amber-50/90 to-orange-50/80 border border-amber-200/50">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-800">日志记录已关闭</h3>
              <p className="text-sm text-amber-700 mt-1">
                当前未启用日志记录功能，新的优惠使用不会被记录。下方显示的是历史数据。
              </p>
              <a 
                href="/dash-panel/settings" 
                className="inline-block mt-2 text-sm text-amber-600 hover:text-amber-800 font-semibold"
              >
                前往设置开启 →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 统计卡片 - 参考 Lexron Dashboard */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="glass-stat p-4 border border-blue-500/30 bg-gradient-to-br from-blue-500/20 via-slate-800/80 to-blue-600/10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow shadow-blue-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">今日请求</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {stats?.todayRequests ?? '-'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">实时统计</p>
        </div>
        <div className="glass-stat p-4 border border-blue-500/30 bg-gradient-to-br from-blue-500/20 via-slate-800/80 to-blue-600/10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow shadow-blue-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">7日成功</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {stats?.successRequests ?? '-'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">成功率 {successRate}%</p>
        </div>
        <div className="glass-stat p-4 border border-red-500/30 bg-gradient-to-br from-red-500/20 via-slate-800/80 to-rose-500/10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-white shadow shadow-red-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">7日失败</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {stats?.failedRequests ?? '-'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">需要关注</p>
        </div>
        <div className="glass-stat p-4 border border-orange-500/30 bg-gradient-to-br from-orange-500/20 via-slate-800/80 to-amber-500/10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow shadow-orange-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">7日总计</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {stats?.totalRequests ?? '-'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">优惠使用次数</p>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="glass-card p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          {/* 标题区域 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">使用记录</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">查看停车优惠使用历史和请求状态</p>
            </div>
            <Button variant="outline" onClick={() => loadLogs()}>
              🔄 刷新
            </Button>
          </div>

          {/* 筛选区域 */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* 搜索框 */}
            <div className="search-box flex-1">
              <svg className="w-4.5 h-4.5 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="搜索车牌号..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="flex-1 min-w-0"
              />
            </div>

            {/* 日期筛选 */}
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                className="filter-dropdown text-sm"
                placeholder="开始日期"
              />
              <span className="hidden sm:flex items-center text-slate-400">至</span>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                className="filter-dropdown text-sm"
                placeholder="结束日期"
              />
            </div>

            {/* 状态筛选 */}
            <select
              className="filter-dropdown"
              value={successFilter}
              onChange={e => { setSuccessFilter(e.target.value); setPage(1); }}
            >
              <option value="all">全部状态</option>
              <option value="true">成功</option>
              <option value="false">失败</option>
            </select>

            {/* 重置按钮 */}
            {(searchQuery || startDate || endDate || successFilter !== 'all') && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                重置
              </button>
            )}
          </div>

          {/* 桌面端表格视图 */}
          <div className="hidden lg:block rounded-2xl border border-slate-700/50 overflow-hidden bg-slate-800/60">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>住客</th>
                    <th>房间</th>
                    <th>车牌号</th>
                    <th>状态</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-400 py-8">
                        暂无记录
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id}>
                        <td className="text-sm text-slate-400 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td>
                          <div>
                            <div className="font-medium text-foreground">{log.guestName || '未知'}</div>
                            <div className="text-xs text-slate-500">{log.guestPhone || '-'}</div>
                          </div>
                        </td>
                        <td>{log.guestRoom || '-'}</td>
                        <td>
                          <span className="font-mono text-foreground">{log.plateNumber}</span>
                        </td>
                        <td>
                          <StatusBadge status={log.requestSuccess ? 'active' : 'disabled'} />
                        </td>
                        <td>
                          {log.responseData ? (
                            <button
                              onClick={() => alert(log.responseData)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              查看响应
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
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
          <div className="lg:hidden space-y-3">
            {logs.length === 0 ? (
              <div className="text-center text-slate-500 py-8">暂无记录</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="p-4 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-sm">
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow ${
                        log.requestSuccess 
                          ? 'bg-gradient-to-br from-blue-400 to-blue-500' 
                          : 'bg-gradient-to-br from-red-400 to-rose-500'
                      }`}>
                        {log.requestSuccess ? '✓' : '✗'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{log.guestName || '未知住客'}</div>
                        <div className="text-sm text-slate-500">{log.guestRoom || '-'}</div>
                      </div>
                    </div>
                    <StatusBadge status={log.requestSuccess ? 'active' : 'disabled'} />
                  </div>

                  {/* 卡片详情 */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-slate-500">车牌: </span>
                      <span className="font-mono font-medium text-foreground">{log.plateNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">手机: </span>
                      <span className="text-slate-300">{log.guestPhone || '-'}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">
                    {formatDateTime(log.createdAt)}
                  </div>

                  {/* 响应详情 */}
                  {log.responseData && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <button
                        onClick={() => alert(log.responseData)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        查看响应详情 →
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 分页 */}
          {totalPages > 1 && <Pagination />}
        </div>
      </div>
    </div>
  );
}
