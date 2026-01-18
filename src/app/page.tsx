'use client';

import { useState, FormEvent } from 'react';
import { GradientBackground, PlateInput, Confetti, validatePlateNumber } from '@/components/ui';

type SubmitState = 'form' | 'loading' | 'success' | 'error';

interface SubmitResponse {
  success: boolean;
  requirePlate?: boolean;
  redirectUrl?: string;
  message?: string;
}

export default function Home() {
  const [state, setState] = useState<SubmitState>('form');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    roomNumber: '',
    plateNumber: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [plateRequired, setPlateRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = '请输入姓名';
    if (!formData.phone.trim()) newErrors.phone = '请输入手机号';
    else if (!/^1[3-9]\d{9}$/.test(formData.phone)) newErrors.phone = '请输入正确的手机号';
    if (!formData.roomNumber.trim()) newErrors.roomNumber = '请输入房间号';

    if (plateRequired || formData.plateNumber) {
      if (!formData.plateNumber) newErrors.plateNumber = '请输入车牌号';
      else if (!validatePlateNumber(formData.plateNumber)) newErrors.plateNumber = '车牌号格式不正确（如：粤B12345）';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setState('loading');

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result: SubmitResponse = await response.json();

      if (response.ok && result.success) {
        setState('success');
      } else if (result.requirePlate) {
        setPlateRequired(true);
        setErrors({ plateNumber: '管理员未登记车牌号，请填写您的车牌号' });
        setState('form');
      } else if (result.redirectUrl) {
        setTimeout(() => {
          window.location.href = result.redirectUrl!;
        }, 100);
      } else {
        setErrorMessage(result.message || '提交失败，请稍后重试');
        setState('error');
      }
    } catch {
      setErrorMessage('网络错误，请稍后重试');
      setState('error');
    }
  };

  const resetToForm = () => {
    setState('form');
    setFormData({ name: '', phone: '', roomNumber: '', plateNumber: '' });
    setPlateRequired(false);
    setErrors({});
    setErrorMessage('');
  };

  if (state === 'success') {
    return (
      <GradientBackground className="min-h-screen">
        <Confetti />
        {/* 移动端：垂直居中卡片 */}
        <div className="lg:hidden min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 text-center border border-white/60">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">申请成功</h1>
            <p className="text-lg text-gray-600 mb-6">欢迎下次光临</p>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/60 mb-8">
              <p className="text-amber-700 flex items-center justify-center gap-2">
                <span className="text-xl">⏰</span>
                <span>请在 <strong>30分钟内</strong> 离开停车场</span>
              </p>
              <p className="text-sm text-amber-600 mt-1">超时将恢复正常计费</p>
            </div>
            <button onClick={resetToForm} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-colors">
              返回首页
            </button>
          </div>
        </div>

        {/* 桌面端：左右分栏全屏 */}
        <div className="hidden lg:flex min-h-screen">
          {/* 左侧 - 品牌/装饰区 */}
          <div className="w-1/2 xl:w-3/5 relative flex items-center justify-center p-12">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -left-32 top-20 w-[600px] h-[600px] rounded-full blur-3xl bg-gradient-to-br from-green-300/50 to-emerald-200/40" />
              <div className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full blur-3xl bg-gradient-to-tl from-teal-200/50 to-cyan-100/40" />
            </div>
            <div className="relative text-center max-w-lg">
              <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-2xl shadow-green-500/30">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-5xl xl:text-6xl font-bold text-gray-900 mb-4">申请成功！</h1>
              <p className="text-xl text-gray-600">感谢您的使用，欢迎下次光临</p>
            </div>
          </div>

          {/* 右侧 - 信息区 */}
          <div className="w-1/2 xl:w-2/5 bg-white/80 backdrop-blur-xl flex items-center justify-center p-12">
            <div className="w-full max-w-md">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border border-amber-200/60 mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center">
                    <span className="text-3xl">⏰</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-800">30 分钟</p>
                    <p className="text-amber-600">离场时间限制</p>
                  </div>
                </div>
                <p className="text-amber-700">请在规定时间内离开停车场，超时将恢复正常计费标准。</p>
              </div>

              <div className="bg-gray-50 rounded-3xl p-8 mb-8">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">温馨提示</h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                    <span>优惠已成功应用到您的车辆</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                    <span>请保持车牌清晰可识别</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                    <span>如有问题请联系前台</span>
                  </li>
                </ul>
              </div>

              <button onClick={resetToForm} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-colors">
                返回首页
              </button>
            </div>
          </div>
        </div>
      </GradientBackground>
    );
  }

  if (state === 'error') {
    return (
      <GradientBackground className="min-h-screen">
        {/* 移动端 */}
        <div className="lg:hidden min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 text-center border border-white/60">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">申请未成功</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <div className="bg-gray-50 rounded-2xl p-4 mb-8">
              <p className="text-gray-500 text-sm">如有疑问，请联系前台工作人员</p>
            </div>
            <button onClick={resetToForm} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-colors">
              重新填写
            </button>
          </div>
        </div>

        {/* 桌面端 */}
        <div className="hidden lg:flex min-h-screen">
          <div className="w-1/2 xl:w-3/5 relative flex items-center justify-center p-12">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -right-32 top-20 w-[500px] h-[500px] rounded-full blur-3xl bg-red-200/50" />
              <div className="absolute left-0 bottom-0 w-[400px] h-[400px] rounded-full blur-3xl bg-orange-100/60" />
            </div>
            <div className="relative text-center max-w-lg">
              <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-2xl shadow-red-500/30">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-5xl xl:text-6xl font-bold text-gray-900 mb-4">抱歉</h1>
              <p className="text-xl text-gray-600">申请未能成功处理</p>
            </div>
          </div>

          <div className="w-1/2 xl:w-2/5 bg-white/80 backdrop-blur-xl flex items-center justify-center p-12">
            <div className="w-full max-w-md">
              <div className="bg-red-50 rounded-3xl p-8 border border-red-100 mb-8">
                <h3 className="font-bold text-red-800 mb-3 text-lg">错误信息</h3>
                <p className="text-red-700">{errorMessage}</p>
              </div>

              <div className="bg-gray-50 rounded-3xl p-8 mb-8">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">可能的原因</h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">1</span>
                    <span>登记信息不匹配</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">2</span>
                    <span>优惠次数已用完</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">3</span>
                    <span>住宿时间已过期</span>
                  </li>
                </ul>
              </div>

              <button onClick={resetToForm} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-colors">
                重新填写
              </button>
            </div>
          </div>
        </div>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground className="min-h-screen">
      {/* ========== 移动端布局（< lg） ========== */}
      <div className="lg:hidden min-h-screen flex flex-col">
        {/* 顶部装饰区 */}
        <div className="relative pt-12 pb-8 px-6 text-center">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -left-20 -top-20 w-64 h-64 rounded-full blur-3xl bg-purple-300/40" />
            <div className="absolute right-0 top-0 w-48 h-48 rounded-full blur-3xl bg-orange-200/50" />
          </div>
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">住客停车优惠</h1>
            <p className="text-gray-500 mt-1">请填写信息申请优惠</p>
          </div>
        </div>

        {/* 表单区域 */}
        <div className="flex-1 px-4 pb-8">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/60">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">姓名</label>
                <input
                  type="text"
                  placeholder="请输入姓名"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-3.5 bg-white border-2 ${errors.name ? 'border-red-300 bg-red-50/30' : 'border-gray-200'} rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all`}
                />
                {errors.name && <p className="text-red-500 text-sm mt-1.5">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">手机号</label>
                <input
                  type="tel"
                  placeholder="请输入手机号"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  maxLength={11}
                  className={`w-full px-4 py-3.5 bg-white border-2 ${errors.phone ? 'border-red-300 bg-red-50/30' : 'border-gray-200'} rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all`}
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1.5">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">房间号</label>
                <input
                  type="text"
                  placeholder="请输入房间号"
                  value={formData.roomNumber}
                  onChange={e => setFormData({ ...formData, roomNumber: e.target.value })}
                  className={`w-full px-4 py-3.5 bg-white border-2 ${errors.roomNumber ? 'border-red-300 bg-red-50/30' : 'border-gray-200'} rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all`}
                />
                {errors.roomNumber && <p className="text-red-500 text-sm mt-1.5">{errors.roomNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  车牌号 {plateRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(可选)</span>}
                </label>
                <PlateInput
                  value={formData.plateNumber}
                  onChange={value => setFormData({ ...formData, plateNumber: value })}
                  required={plateRequired}
                />
                {errors.plateNumber && <p className="text-red-500 text-sm mt-1.5">{errors.plateNumber}</p>}
              </div>

              <button
                type="submit"
                disabled={state === 'loading'}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold text-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-gray-900/20"
              >
                {state === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    提交中...
                  </span>
                ) : '提交申请'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-5">
              如有疑问请联系前台工作人员
            </p>
          </div>
        </div>
      </div>

      {/* ========== 桌面端布局（>= lg）：左右分栏 ========== */}
      <div className="hidden lg:flex min-h-screen">
        {/* 左侧 - 品牌展示区 */}
        <div className="w-1/2 xl:w-3/5 relative flex items-center justify-center p-12 xl:p-20">
          {/* 背景装饰 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -left-40 top-20 w-[700px] h-[700px] rounded-full blur-3xl bg-gradient-to-br from-purple-300/50 to-violet-200/40" />
            <div className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full blur-3xl bg-gradient-to-tl from-orange-200/60 to-amber-100/50" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-3xl bg-gradient-to-r from-pink-200/40 to-rose-100/30" />
          </div>

          {/* 品牌内容 */}
          <div className="relative z-10 max-w-xl">
            {/* Logo */}
            <div className="w-20 h-20 mb-8 rounded-3xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>

            <h1 className="text-5xl xl:text-6xl font-bold text-gray-900 leading-tight mb-6">
              住客停车<br />优惠服务
            </h1>

            <p className="text-xl text-gray-600 mb-12 leading-relaxed">
              专为酒店住客提供的便捷停车优惠申请服务。<br />
              只需填写基本信息，即可享受专属停车优惠。
            </p>

            {/* 特性卡片 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-white/80">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">快速申请</h3>
                <p className="text-sm text-gray-500">30秒完成申请</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-white/80">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">安全可靠</h3>
                <p className="text-sm text-gray-500">信息加密传输</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-white/80">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">即时生效</h3>
                <p className="text-sm text-gray-500">申请后立即可用</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-white/80">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">专属服务</h3>
                <p className="text-sm text-gray-500">住客专享优惠</p>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧 - 表单区 */}
        <div className="w-1/2 xl:w-2/5 bg-white/80 backdrop-blur-xl flex items-center justify-center p-8 xl:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">填写信息</h2>
              <p className="text-gray-500">请确保信息与入住登记一致</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">姓名</label>
                <input
                  type="text"
                  placeholder="请输入您的姓名"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-5 py-4 bg-white border-2 ${errors.name ? 'border-red-300 bg-red-50/30' : 'border-gray-200'} rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 hover:border-gray-300 transition-all`}
                />
                {errors.name && <p className="text-red-500 text-sm mt-2">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">手机号</label>
                <input
                  type="tel"
                  placeholder="请输入11位手机号"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  maxLength={11}
                  className={`w-full px-5 py-4 bg-white border-2 ${errors.phone ? 'border-red-300 bg-red-50/30' : 'border-gray-200'} rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 hover:border-gray-300 transition-all`}
                />
                {errors.phone && <p className="text-red-500 text-sm mt-2">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">房间号</label>
                <input
                  type="text"
                  placeholder="例如：8808"
                  value={formData.roomNumber}
                  onChange={e => setFormData({ ...formData, roomNumber: e.target.value })}
                  className={`w-full px-5 py-4 bg-white border-2 ${errors.roomNumber ? 'border-red-300 bg-red-50/30' : 'border-gray-200'} rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 hover:border-gray-300 transition-all`}
                />
                {errors.roomNumber && <p className="text-red-500 text-sm mt-2">{errors.roomNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  车牌号 {plateRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(可选)</span>}
                </label>
                <PlateInput
                  value={formData.plateNumber}
                  onChange={value => setFormData({ ...formData, plateNumber: value })}
                  required={plateRequired}
                />
                {errors.plateNumber && <p className="text-red-500 text-sm mt-2">{errors.plateNumber}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={state === 'loading'}
                  className="w-full py-5 bg-gray-900 text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-xl shadow-gray-900/20"
                >
                  {state === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      提交中...
                    </span>
                  ) : '提交申请'}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>提交即表示同意酒店停车优惠条款</span>
              </div>
              <p className="text-center text-sm text-gray-400 mt-3">
                如有疑问请联系前台 · 服务时间 24 小时
              </p>
            </div>
          </div>
        </div>
      </div>
    </GradientBackground>
  );
}
