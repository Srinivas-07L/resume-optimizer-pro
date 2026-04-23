'use client';

import { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  Loader2,
  Briefcase,
  Trophy,
  Target,
  Zap,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ResumeResult {
  name: string;
  summary: string;
  experience: any[];
  education: any[];
  skills: string[];
  match_score_before: number;
  match_score_after: number;
  keywords_added: string[];
}

export default function Home() {
  const [jd, setJd] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [forceOnePage, setForceOnePage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    }
  };

  const handleOptimize = async () => {
    if (!file || !jd) return;
    
    setLoading(true);
    setResult(null);
    setStatus('Analyzing Job Requirements...');

    try {
      const formData = new FormData();
      formData.append('jd', jd);
      formData.append('resume', file);
      formData.append('forceOnePage', String(forceOnePage));

      setStatus('AI is engineering your breakthrough...');
      const response = await fetch('/api/optimize', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Optimization failed');

      setResult(data);
      setStatus('');
    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message}`);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!result) return;
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(result.name, 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(result.summary, 20, 30, { maxWidth: 170 });
    
    let y = 60;
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('Professional Experience', 20, y);
    y += 10;
    
    result.experience.forEach((exp: any) => {
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text(`${exp.role} | ${exp.company}`, 20, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      exp.description.forEach((bullet: string) => {
        doc.text(`• ${bullet}`, 25, y, { maxWidth: 160 });
        y += 5;
      });
      y += 5;
    });

    doc.save(`${result.name.replace(/\s+/g, '_')}_Premium_Optimized.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 selection:bg-emerald-500/30">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      </div>

      <main className="relative z-10 max-w-[1600px] mx-auto min-h-screen flex flex-col md:flex-row">
        {/* Left Side: Input Controls */}
        <div className="w-full md:w-[450px] lg:w-[550px] p-6 lg:p-12 border-r border-white/5 bg-black/20 backdrop-blur-3xl shrink-0">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
              <Sparkles className="w-3 h-3" />
              Next-Gen Resume Engineering
            </div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white mb-4">
              Resume <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Optimizer</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Bypass ATS algorithms and catch the recruiter's eye with AI-powered keyword mirroring.
            </p>
          </div>

          <div className="space-y-8">
            {/* Step 1: Upload */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest">
                <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400">1</div>
                Source Document
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "group relative overflow-hidden h-40 rounded-2xl border transition-all duration-500 cursor-pointer",
                  file 
                    ? "border-emerald-500/30 bg-emerald-500/5" 
                    : "border-white/10 bg-white/[0.02] hover:border-emerald-500/50 hover:bg-emerald-500/[0.02]"
                )}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  {file ? (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-emerald-400 truncate max-w-full px-4">{file.name}</p>
                      <p className="text-xs text-emerald-500/60 mt-1">Ready for re-engineering</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-slate-300 font-medium group-hover:text-white transition-colors">Drag & drop your PDF</p>
                      <p className="text-xs text-slate-500 mt-1">Only PDF format supported</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: Target */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest">
                <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">2</div>
                Target Opportunity
              </label>
              <div className="relative group">
                <textarea 
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the target job description here..."
                  className="w-full h-48 bg-white/[0.02] border border-white/10 rounded-2xl p-5 text-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 outline-none transition-all resize-none placeholder:text-slate-600"
                />
                <div className="absolute bottom-4 right-4 text-[10px] font-bold text-slate-700 tracking-tighter uppercase">ATS Input Terminal</div>
              </div>
            </div>

            {/* Controls */}
            <div className="pt-4 flex flex-col gap-4">
              <button 
                onClick={() => setForceOnePage(!forceOnePage)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all",
                  forceOnePage ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", forceOnePage ? "bg-emerald-400 animate-pulse" : "bg-slate-700")} />
                  <span className="text-sm font-bold uppercase tracking-tight">Force 1-Page Layout</span>
                </div>
                <div className={cn(
                  "w-10 h-5 rounded-full relative transition-colors",
                  forceOnePage ? "bg-emerald-500" : "bg-slate-800"
                )}>
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                    forceOnePage ? "left-6" : "left-1"
                  )} />
                </div>
              </button>

              <button 
                onClick={handleOptimize} 
                disabled={loading || !file || !jd} 
                className={cn(
                  "group h-16 rounded-2xl font-black text-lg uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                  loading || !file || !jd
                    ? "bg-slate-900 text-slate-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white shadow-2xl shadow-emerald-500/20 active:scale-[0.98]"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Optimize Now</span>
                    <Zap className="w-5 h-5 group-hover:fill-current" />
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-auto pt-12 text-[10px] font-bold text-slate-700 uppercase tracking-[0.2em] flex items-center gap-4">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> SSL Secured</span>
            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> ATS Guaranteed</span>
          </div>
        </div>

        {/* Right Side: Results Display */}
        <div className="flex-1 bg-[#020202] overflow-y-auto custom-scrollbar relative">
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-12 text-center bg-black/60 backdrop-blur-sm">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full border-2 border-emerald-500/20 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-full border-t-2 border-emerald-500 animate-spin" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{status}</h3>
              <p className="text-slate-400 max-w-sm">Our AI is analyzing thousands of industry data points to optimize your professional profile.</p>
            </div>
          )}

          {!result && !loading && (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center text-slate-700 mb-6 group-hover:text-emerald-500/50 transition-colors">
                <Target className="w-10 h-10 opacity-20" />
              </div>
              <h2 className="text-2xl font-bold text-slate-600 mb-2">Ready for Engineering</h2>
              <p className="text-slate-700 max-w-md">Upload your resume and the job description to start the optimization process.</p>
            </div>
          )}

          {result && (
            <div className="p-6 lg:p-12 max-w-4xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-1000">
              {/* Stats Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-3xl group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-400">
                      <ArrowRight className="w-4 h-4 -rotate-45" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Baseline</span>
                  </div>
                  <div className="text-4xl font-black text-slate-400">{result.match_score_before}%</div>
                  <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-tighter">Initial ATS Score</p>
                </div>

                <div className="glass-card p-6 rounded-3xl border-emerald-500/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Trophy className="w-12 h-12 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Optimized</span>
                  </div>
                  <div className="text-4xl font-black text-emerald-400">{result.match_score_after}%</div>
                  <p className="text-[10px] text-emerald-500/60 mt-2 font-bold uppercase tracking-tighter">Engineered Score</p>
                </div>

                <div className="glass-card p-6 rounded-3xl flex flex-col justify-center items-center gap-3 bg-gradient-to-br from-emerald-600/20 to-blue-600/20 border-emerald-500/30">
                  <button onClick={downloadPdf} className="w-full group h-full flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                      <Download className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-white">Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Keyword Section */}
              <div className="glass-card p-8 rounded-[2rem]">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Keywords Mirrored</h3>
                    <p className="text-xs text-slate-500 font-medium">Strategic industry terms injected for ATS resonance</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.keywords_added.map((kw, i) => (
                    <span key={i} className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold transition-all hover:bg-blue-500/20 hover:border-blue-500/40 cursor-default">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview Section */}
              <div className="glass-card p-8 lg:p-12 rounded-[2.5rem] bg-white/[0.01]">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">{result.name}</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Optimized Candidate Profile</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-12">
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Professional Summary</h4>
                    <p className="text-lg text-slate-300 leading-relaxed font-medium tracking-tight italic">
                      "{result.summary}"
                    </p>
                  </section>

                  <section className="space-y-8">
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Experience Engineering</h4>
                    <div className="space-y-10 border-l-2 border-white/5 pl-8 ml-2">
                      {result.experience.map((exp: any, i: number) => (
                        <div key={i} className="relative group">
                          <div className="absolute -left-[41px] top-1.5 w-4 h-4 rounded-full bg-[#050505] border-2 border-emerald-500/50 group-hover:border-emerald-400 transition-colors" />
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-4">
                            <h5 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{exp.role}</h5>
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{exp.company}</span>
                          </div>
                          <ul className="space-y-3">
                            {exp.description.map((bullet: string, j: number) => (
                              <li key={j} className="flex gap-4 text-slate-400 text-sm leading-relaxed group/item">
                                <span className="text-emerald-500/50 group-hover/item:text-emerald-500 transition-colors mt-1 shrink-0">▸</span>
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
