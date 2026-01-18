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
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setStats(result.stats);
        }
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  // 加载日志设置
  const loadLogSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings', {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.settings) {
          setLogSettings({
            log_enabled: result.settings.log_enabled || 'false',
            log_retention_days: result.settings.log_retention_days || '7',
          });
        }
      }
    } catch (error) {
      console.error('加载日志设置失败:', error);
    }
  }, []);

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

      const result: LogQueryResult = await response.json();

      if (result.success) {
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
    <div className="flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-gray-100">
      <div className="text-sm text-gray-500">
        共 {total} 条记录，第 {page}/{totalPages} 页
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
                    ? 'bg-orange-500 text-white' 
                    : 'border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          下一页
        </button>
      </div>
    </div>
  );

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 日志未开启提示 */}
      {logSettings && logSettings.log_enabled !== 'true' && (
        <div className="card bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-800">日志记录已关闭</h3>
              <p className="text-sm text-amber-700 mt-1">
                当前未启用日志记录功能，新的优惠使用不会被记录。下方显示的是历史数据。
              </p>
              <a 
                href="/dash-panel/settings" 
                className="inline-block mt-2 text-sm text-amber-600 hover:text-amber-800 font-medium"
              >
                前往设置开启 →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="card border border-blue-100/80 bg-gradient-to-br from-blue-50/90 to-white/90 shadow-lg">
          <p className="text-xs text-blue-600">今日请求</p>
          <p className="text-2xl sm:text-3xl font-semibold text-blue-700 mt-1">
            {stats?.todayRequests ?? '-'}
          </p>
          <p className="text-xs text-blue-500 mt-1">实时统计</p>
        </div>
        <div className="card border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 to-white/90 shadow-lg">
          <p className="text-xs text-emerald-600">7日成功</p>
          <p className="text-2xl sm:text-3xl font-semibold text-emerald-700 mt-1">
            {stats?.successRequests ?? '-'}
          </p>
          <p className="text-xs text-emerald-500 mt-1">成功率 {successRate}%</p>
        </div>
        <div className="card border border-red-100/80 bg-gradient-to-br from-red-50/90 to-white/90 shadow-lg">
          <p className="text-xs text-red-600">7日失败</p>
          <p className="text-2xl sm:text-3xl font-semibold text-red-700 mt-1">
            {stats?.failedRequests ?? '-'}
          </p>
          <p className="text-xs text-red-500 mt-1">需要关注</p>
        </div>
        <div className="card border border-purple-100/80 bg-gradient-to-br from-purple-50/90 to-white/90 shadow-lg">
          <p className="text-xs text-purple-600">7日总计</p>
          <p className="text-2xl sm:text-3xl font-semibold text-purple-700 mt-1">
            {stats?.totalRequests ?? '-'}
          </p>
          <p className="text-xs text-purple-500 mt-1">优惠使用次数</p>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="card shadow-xl border border-gray-100/80">
        <div className="flex flex-col gap-4">
          {/* 标题区域 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">使用记录</h1>
              <p className="text-xs sm:text-sm text-gray-500">查看停车优惠使用历史和请求状态</p>
            </div>
            <Button variant="outline" onClick={() => loadLogs()}>
              🔄 刷新
            </Button>
          </div>

          {/* 筛选区域 */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* 搜索框 */}
            <div className="search-box flex-1">
              <svg className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <span className="hidden sm:flex items-center text-gray-400">至</span>
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
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                重置
              </button>
            )}
          </div>

          {/* 桌面端表格视图 */}
          <div className="hidden lg:block rounded-2xl border border-gray-100 overflow-hidden">
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
                      <td colSpan={6} className="text-center text-gray-500 py-8">
                        暂无记录
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id}>
                        <td className="text-sm text-gray-600 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td>
                          <div>
                            <div className="font-medium text-gray-900">{log.guestName || '未知'}</div>
                            <div className="text-xs text-gray-500">{log.guestPhone || '-'}</div>
                          </div>
                        </td>
                        <td>{log.guestRoom || '-'}</td>
                        <td>
                          <span className="font-mono text-gray-900">{log.plateNumber}</span>
                        </td>
                        <td>
                          <StatusBadge status={log.requestSuccess ? 'active' : 'disabled'} />
                        </td>
                        <td>
                          {log.responseData ? (
                            <button
                              onClick={() => alert(log.responseData)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              查看响应
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
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
              <div className="text-center text-gray-500 py-8">暂无记录</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                        log.requestSuccess 
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' 
                          : 'bg-gradient-to-br from-red-400 to-red-500'
                      }`}>
                        {log.requestSuccess ? '✓' : '✗'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{log.guestName || '未知住客'}</div>
                        <div className="text-sm text-gray-500">{log.guestRoom || '-'}</div>
                      </div>
                    </div>
                    <StatusBadge status={log.requestSuccess ? 'active' : 'disabled'} />
                  </div>

                  {/* 卡片详情 */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">车牌: </span>
                      <span className="font-mono font-medium text-gray-900">{log.plateNumber}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">手机: </span>
                      <span className="text-gray-900">{log.guestPhone || '-'}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    {formatDateTime(log.createdAt)}
                  </div>

                  {/* 响应详情 */}
                  {log.responseData && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => alert(log.responseData)}
                        className="text-xs text-blue-600 hover:text-blue-800"
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
