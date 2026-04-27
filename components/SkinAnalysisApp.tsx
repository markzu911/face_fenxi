'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Loader2, Sparkles, ChevronRight, RefreshCw, Download, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface AnalysisResult {
  skinAge: number;
  overallScore: number;
  skinType: string;
  dimensions: {
    pores: DimensionResult;
    blackheads: DimensionResult;
    wrinkles: DimensionResult;
    spots: DimensionResult;
    acne: DimensionResult;
    sensitivity: DimensionResult;
    eyeArea: DimensionResult;
    hydration: DimensionResult;
  };
  recommendations: Array<{
    product: string;
    reason: string;
  }>;
}

interface DimensionResult {
  score: number;
  severity: string;
  details: string;
  salesPitch: string;
}

interface SkinAnalysisAppProps {
  // Configured in environment variables now. We can largely ignore passing keys via props
  geminiApiKey?: string;
}

export function SkinAnalysisApp({ geminiApiKey }: SkinAnalysisAppProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // SaaS Integration State
  const [saasParams, setSaasParams] = useState<{userId: string, toolId: string, context: string, prompt: string[]} | null>(null);
  const [saasInfo, setSaasInfo] = useState<any>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        const { userId, toolId, context, prompt } = event.data;
        if (userId && userId !== 'null' && userId !== 'undefined' &&
            toolId && toolId !== 'null' && toolId !== 'undefined') {
            
            setSaasParams({ userId, toolId, context: context || '', prompt: prompt || [] });
            
            fetch('/api/tool/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, toolId })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success || data.valid) {
                    setSaasInfo(data?.data);
                }
            })
            .catch(console.error);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const downloadReport = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      // Lazy load to prevent Next.js SSR Webpack chunk errors ("Cannot read properties of undefined (reading 'call')")
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(reportRef.current, {
        pixelRatio: 2,
        backgroundColor: '#fbfaf8'
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Aura_Skin_Report_${new Date().getTime()}.png`;
      link.click();
    } catch (err) {
      console.error("Failed to generate report image", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('请上传有效的图片文件。');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    setError(null);

    // STEP 2: Verify Integral
    if (saasParams) {
        try {
          const vRes = await fetch('/api/tool/verify', {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ userId: saasParams.userId, toolId: saasParams.toolId })
          });
          const vData = await vRes.json();
          if (!vData.success && !vData.valid) {
              setError(vData.message || '当前积分不足，无法执行面部数据推演。');
              setIsAnalyzing(false);
              return;
          }
        } catch(e) {
          console.warn("校验接口异常，放行执行 (宽松校验)", e);
        }
    }

    try {
      // Extract base64 data without prefix
      const base64Data = image.split(',')[1];
      const mimeType = image.split(',')[0].split(':')[1].split(';')[0];

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-3-flash-preview',
          imageBase64: base64Data,
          mimeType,
          saasContext: saasParams?.context,
          saasPrompt: saasParams?.prompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      
      if (responseData.result) {
        setResult(responseData.result as AnalysisResult);
      } else {
        throw new Error('解析响应失败。');
      }

      // STEP 3: Consume
      if (saasParams) {
          fetch('/api/tool/consume', {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ userId: saasParams.userId, toolId: saasParams.toolId })
          }).catch(console.error);
      }
      
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || '分析过程中发生网络异常。';
      
      // Parse JSON formatted error messages returned by some API wrapper layers
      if (errorMessage.startsWith('{') && errorMessage.endsWith('}')) {
        try {
           const parsedObj = JSON.parse(errorMessage);
           if (parsedObj.error && parsedObj.error.message) {
               errorMessage = parsedObj.error.message;
           }
        } catch (e) {}
      }

      // Friendly translations for common Gemini API errors
      if (errorMessage.includes('503') || errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE')) {
          errorMessage = '当前AI模型请求过载（请稍后再试）。这通常发生在高峰期，您的请求稍后便能通过。';
      } else if (errorMessage.includes('API key not valid')) {
          errorMessage = 'API 密钥身份验证失败，请确保密钥配置正确无误。';
      }

      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-[#2c2c2a] pb-24">
      {/* Header */}
      <header className="pt-16 pb-12 px-6 text-center max-w-3xl mx-auto relative">
        {saasInfo && (
           <div className="absolute top-4 right-6 bg-white shadow-sm border border-[#e8e4db] px-4 py-2 rounded-full text-xs font-medium text-[#6b665c] flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-[#4CAF50]"></span>
             {saasInfo.user?.name} · 积分: {saasInfo.user?.integral}
           </div>
        )}
        <h1 className="font-serif text-5xl md:text-6xl text-[#1a1a1a] mb-4 tracking-tight">Aura AI</h1>
        <p className="text-lg md:text-xl text-[#6b665c] font-light max-w-xl mx-auto leading-relaxed">
          上传素颜自拍，让临床级计算机视觉技术为您分析肌肤健康状况。
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!image && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto relative group"
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                ref={fileInputRef}
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[3/4] md:aspect-square rounded-[32px] border-2 border-dashed border-[#e8e4db] bg-white hover:border-[#c2a386] transition-colors flex flex-col items-center justify-center p-8 cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="w-20 h-20 rounded-full bg-[#fbfaf8] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Camera className="w-8 h-8 text-[#c2a386]" />
                </div>
                <h3 className="font-serif text-2xl text-[#1a1a1a] mb-2">上传自拍</h3>
                <p className="text-[#8c887e] text-center text-sm px-4">
                  为获得最佳效果，请在光线充足的环境下拍摄，保持素颜，并确保面部角度无遮挡。
                </p>
              </div>
            </motion.div>
          )}

          {image && !result && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto text-center"
            >
              <div className="relative aspect-[3/4] md:aspect-square rounded-[32px] overflow-hidden shadow-2xl mb-8 border border-[#e8e4db] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Selfie preview" className="w-full h-full object-cover" />
                
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-md flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                    <p className="text-white font-medium tracking-wide shadow-black text-lg drop-shadow-md">
                      正在分析面部特征向量...
                    </p>
                  </div>
                )}
              </div>
              
              {!isAnalyzing && (
                <div className="flex gap-4 justify-center">
                  <button 
                    onClick={reset}
                    className="px-8 py-4 rounded-full border border-[#e8e4db] font-medium text-[#6b665c] hover:bg-white transition-colors"
                  >
                    重新选择
                  </button>
                  <button 
                    onClick={analyzeImage}
                    className="px-8 py-4 rounded-full bg-[#2c2c2a] text-white font-medium hover:bg-black transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    开始分析
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {result && image && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-center bg-white p-4 rounded-full shadow-sm border border-[#e8e4db] max-w-xl mx-auto px-6">
                <span className="font-medium text-[#6b665c]">分析完成</span>
                <div className="flex items-center gap-4">
                  <button onClick={downloadReport} disabled={isDownloading} className="text-[#1a1a1a] hover:text-[#c2a386] flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50">
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    下载报告
                  </button>
                  <div className="w-px h-4 bg-[#e8e4db]"></div>
                  <button onClick={reset} className="text-[#c2a386] hover:text-[#a08468] flex items-center gap-2 text-sm font-medium transition-colors">
                    <RefreshCw className="w-4 h-4" /> 重新开始
                  </button>
                </div>
              </div>

              {/* Downloadable Wrapper */}
              <div ref={reportRef} className="space-y-12 pb-8 bg-[#fbfaf8]">
                {/* Top Level Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard title="总体分数" value={result.overallScore} suffix="/100" />
                  <StatCard title="肌肤年龄" value={result.skinAge} suffix=" 岁" />
                  <StatCard title="检测肤质" value={result.skinType} isString />
                </div>

                {/* Detailed Breakdown */}
                <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-[#e8e4db]">
                  <h2 className="font-serif text-3xl mb-10 text-center">多维分析报告</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <DimensionBlock title="水油平衡及光泽度" dimension={result.dimensions.hydration} />
                    <DimensionBlock title="毛孔及细腻度" dimension={result.dimensions.pores} />
                    <DimensionBlock title="黑头分布" dimension={result.dimensions.blackheads} />
                    <DimensionBlock title="色斑及色素沉着" dimension={result.dimensions.spots} />
                    <DimensionBlock title="痤疮及痘痘" dimension={result.dimensions.acne} />
                    <DimensionBlock title="敏感及红血丝" dimension={result.dimensions.sensitivity} />
                    <DimensionBlock title="皱纹及细纹" dimension={result.dimensions.wrinkles} />
                    <DimensionBlock title="眼部黑眼圈及眼袋" dimension={result.dimensions.eyeArea} />
                  </div>
                </div>

                {/* Actionable Recommendations */}
                <div className="bg-[#2c2c2a] text-white rounded-[32px] p-8 md:p-12 shadow-xl">
                  <h2 className="font-serif text-3xl mb-8 flex items-center gap-3">
                    <Sparkles className="text-[#c2a386]" /> 专属护肤方案
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.recommendations.map((rec, i) => (
                      <div key={i} className="bg-white/10 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                        <h3 className="font-medium text-[#c2a386] mb-2">{rec.product}</h3>
                        <p className="text-white/80 text-sm leading-relaxed">{rec.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}

function StatCard({ title, value, suffix = "", isString = false }: { title: string, value: string | number, suffix?: string, isString?: boolean }) {
  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e8e4db] flex flex-col items-center justify-center text-center">
      <h3 className="text-[#8c887e] text-sm uppercase tracking-widest font-semibold mb-4">{title}</h3>
      <div className="font-serif text-5xl text-[#1a1a1a]">
        {value}
        {!isString && <span className="text-2xl text-[#8c887e] ml-1 font-sans font-light tracking-normal">{suffix}</span>}
      </div>
    </div>
  );
}

function DimensionBlock({ title, dimension }: { title: string, dimension: DimensionResult }) {
  // Determine color based on score
  let strokeColor = "#4CAF50"; // Green for good
  if (dimension.score < 60) strokeColor = "#F44336"; // Red for poor
  else if (dimension.score < 80) strokeColor = "#FFC107"; // Yellow for moderate

  const data = [
    { name: 'Score', value: dimension.score },
    { name: 'Remaining', value: 100 - dimension.score }
  ];

  return (
    <div className="flex gap-6 items-start">
      <div className="w-24 h-24 shrink-0 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={32}
              outerRadius={45}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              cornerRadius={4}
            >
               <Cell key="cell-0" fill={strokeColor} />
               <Cell key="cell-1" fill="#f5f5f5" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="absolute inset-0 flex items-center justify-center font-bold text-lg text-[#1a1a1a]">
          {dimension.score}
        </span>
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="font-bold text-lg text-[#1a1a1a]">{title}</h3>
          <span className="text-xs px-2 py-1 bg-[#f5f5f0] text-[#6b665c] rounded-md font-medium uppercase tracking-wider">
            {dimension.severity}
          </span>
        </div>
        <p className="text-[#6b665c] text-sm leading-relaxed mb-4">
          {dimension.details}
        </p>
        <div className="bg-[#fcfbf9] border border-[#e8e4db] rounded-xl p-4 relative overflow-hidden">
           <div className="w-1 h-full bg-[#c2a386] absolute left-0 top-0"></div>
           <p className="text-sm font-medium text-[#2c2c2a] leading-relaxed">
             <span className="text-[#c2a386] font-bold mr-1">Aura 护肤建议：</span>
             {dimension.salesPitch}
           </p>
        </div>
      </div>
    </div>
  );
}
