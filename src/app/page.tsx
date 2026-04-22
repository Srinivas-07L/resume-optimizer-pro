'use client';

import { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  ArrowRight, 
  Download, 
  CheckCircle2, 
  Loader2,
  Briefcase
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
    setStatus('Analyzing Job Description...');

    try {
      const formData = new FormData();
      formData.append('jd', jd);
      formData.append('resume', file);
      formData.append('forceOnePage', String(forceOnePage));

      setStatus('Gemini AI is re-engineering your resume...');
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
    
    doc.setFontSize(20);
    doc.text(result.name, 20, 20);
    
    doc.setFontSize(10);
    doc.text(result.summary, 20, 30, { maxWidth: 170 });
    
    let y = 60;
    doc.setFontSize(14);
    doc.text('Professional Experience', 20, y);
    y += 10;
    
    result.experience.forEach((exp: any) => {
      doc.setFontSize(11);
      doc.text(`${exp.role} | ${exp.company}`, 20, y);
      y += 5;
      doc.setFontSize(9);
      exp.description.forEach((bullet: string) => {
        doc.text(`• ${bullet}`, 25, y, { maxWidth: 160 });
        y += 5;
      });
      y += 5;
    });

    doc.save(`${result.name.replace(/\s+/g, '_')}_Optimized.pdf`);
  };

  // Modern Glassmorphism & Gradient classes
  const glassClass = "bg-white/5 backdrop-blur-xl border border-white/10";
  const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400";
  const btnPrimary = "px-8 py-4 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-white";

  return (
    <div className="min-h-screen p-8 md:p-24 bg-[#0a0a0c] text-[#f8fafc]">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          Powered by Gemini 1.5 Flash
        </div>
        <h1 className={cn("text-5xl md:text-7xl font-bold mb-6", gradientText)}>
          Resume AI Optimizer
        </h1>
        <p className="text-slate-400 text-xl max-w-2xl mx-auto">
          Mirror job descriptions, bypass ATS filters, and land your dream interview with AI-powered resume re-engineering.
        </p>
      </div>

      {/* Main App */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className={cn("p-8 rounded-3xl space-y-6", glassClass)}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Upload className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold">1. Upload Resume</h2>
            </div>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "group cursor-pointer h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all",
                file ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5"
              )}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
              {file ? (
                <>
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="font-medium text-emerald-400">{file.name}</p>
                </>
              ) : (
                <>
                  <FileText className="w-10 h-10 text-slate-600 mb-2 group-hover:text-indigo-400" />
                  <p className="text-slate-400">Drop your PDF or click to browse</p>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 mb-2 pt-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
                <Briefcase className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold">2. Target Job</h2>
            </div>
            
            <textarea 
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the job description here..."
              className="w-full h-48 bg-white/5 border border-slate-800 rounded-2xl p-4 text-slate-300 focus:ring-2 focus:ring-violet-500/50 transition-all resize-none"
            />

            <div className="flex items-center justify-between pt-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={forceOnePage} onChange={(e) => setForceOnePage(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:bg-indigo-600 transition-all"></div>
                <span className="text-sm font-medium text-slate-400 group-hover:text-slate-200">Force 1-Page Layout</span>
              </label>

              <button onClick={handleOptimize} disabled={loading || !file || !jd} className={btnPrimary}>
                {loading ? "Optimizing..." : "Optimize Now"}
              </button>
            </div>
          </div>
        </div>

        <div className="relative">
          {loading && (
            <div className={cn("absolute inset-0 z-10 rounded-3xl flex flex-col items-center justify-center text-center p-8", glassClass)}>
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <p className="text-xl font-semibold mb-2">{status}</p>
            </div>
          )}

          {!result && !loading && (
            <div className={cn("h-full rounded-3xl border-dashed flex flex-col items-center justify-center text-center p-12 text-slate-600", glassClass)}>
              <Sparkles className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-lg">Your optimized resume will appear here</p>
            </div>
          )}

          {result && (
            <div className={cn("rounded-3xl p-8 space-y-8 animate-in slide-in-from-bottom-8 duration-700", glassClass)}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Optimization Results</h3>
                <button onClick={downloadPdf} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-semibold">
                  <Download className="w-5 h-5" />
                  Download PDF
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-sm text-slate-500 mb-1">Original Match</p>
                  <div className="text-3xl font-bold text-slate-400">{result.match_score_before}%</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm text-emerald-500/70 mb-1">Optimized Match</p>
                  <div className="text-3xl font-bold text-emerald-500">{result.match_score_after}%</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Keywords Mirrored</h4>
                <div className="flex flex-wrap gap-2">
                  {result.keywords_added.map((kw, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                <h4 className="text-xl font-bold">{result.name}</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{result.summary}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
