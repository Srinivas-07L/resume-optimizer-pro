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

      setStatus('AI is engineering your resume...');
      const response = await fetch('/api/optimize', {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 100)}`);
      }

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
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    let y = margin;

    // --- CENTERED HEADER ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(result.name || 'Full Name', pageWidth / 2, y, { align: 'center' });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const contactInfo = [
      result.email,
      result.phone,
      result.location
    ].filter(Boolean).join(' | ');
    
    doc.text(contactInfo, pageWidth / 2, y, { align: 'center' });
    y += 5;

    const links = [
      result.linkedin,
      result.github
    ].filter(Boolean).join(' | ');

    if (links) {
      doc.text(links, pageWidth / 2, y, { align: 'center' });
      y += 10;
    } else {
      y += 5;
    }

    const addSectionHeader = (title: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, margin, y);
      y += 2;
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    // 1. Executive Summary
    addSectionHeader('Executive Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const summaryLines = doc.splitTextToSize(result.summary, contentWidth);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * 6) + 6;

    // 2. Technical Skills
    if (result.skills && result.skills.length > 0) {
      addSectionHeader('Technical Skills');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      
      const skillsText = result.skills.join(', ');
      const skillsLines = doc.splitTextToSize(skillsText, contentWidth);
      doc.text(skillsLines, margin, y);
      y += (skillsLines.length * 6) + 6;
    }

    // 3. Professional Experience
    addSectionHeader('Professional Experience');
    result.experience.forEach((exp: any) => {
      if (y > 260) { doc.addPage(); y = margin; }

      // Company and Date on the same line
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(exp.company, margin, y);
      if (exp.dates) {
        doc.text(exp.dates, pageWidth - margin, y, { align: 'right' });
      }
      y += 5;

      // Role
      doc.setFont('helvetica', 'bolditalic');
      doc.text(exp.role, margin, y);
      y += 6;

      // Bullets
      doc.setFont('helvetica', 'normal');
      exp.description.forEach((bullet: string) => {
        const bulletText = `• ${bullet}`;
        const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 5);
        if (y + (bulletLines.length * 6) > 280) { doc.addPage(); y = margin; }
        doc.text(bulletLines, margin + 5, y);
        y += (bulletLines.length * 6);
      });
      y += 4;
    });

    // 4. Education
    if (result.education && result.education.length > 0) {
      if (y > 250) { doc.addPage(); y = margin; }
      addSectionHeader('Education');
      
      result.education.forEach((edu: any) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const school = edu.school || edu;
        doc.text(school, margin, y);
        if (edu.date || edu.year) {
          doc.text(edu.date || edu.year, pageWidth - margin, y, { align: 'right' });
        }
        y += 5;
        
        if (edu.degree) {
          doc.setFont('helvetica', 'normal');
          doc.text(edu.degree, margin, y);
          y += 6;
        } else {
          y += 2;
        }
      });
    }

    // 5. Awards & Accomplishments
    // (Assuming they are parsed or can be added if present in result)

    doc.save(`${result.name.replace(/\s+/g, '_')}_Final_Optimized.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20">
      <nav className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold tracking-tight">Resume Optimizer</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Secure</span>
            <span className="flex items-center gap-1"><Target className="h-4 w-4" /> ATS Ready</span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 pt-12">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Land your dream interview.
          </h1>
          <p className="mt-4 text-xl text-slate-500">
            Professional AI resume optimization to mirror job descriptions perfectly.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Input Card 1 */}
          <div className="bg-white p-6 rounded-2xl border shadow-elegant">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold">Job Description</h2>
            </div>
            <textarea 
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the target job description here..."
              className="w-full h-80 bg-slate-50 border rounded-xl p-4 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
            <p className="mt-2 text-xs text-slate-400">{jd.length.toLocaleString()} characters</p>
          </div>

          {/* Input Card 2 */}
          <div className="bg-white p-6 rounded-2xl border shadow-elegant">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold">Current Resume</h2>
            </div>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "h-80 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer",
                file ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-slate-100/50"
              )}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
              {file ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
                  <p className="font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(0)} KB · click to change</p>
                </>
              ) : (
                <>
                  <FileText className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="font-medium text-slate-600">Drop your resume PDF here</p>
                  <p className="text-xs text-slate-400 mt-1">or click to browse from your computer</p>
                </>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
              <div>
                <p className="text-sm font-bold">Force 1-Page Layout</p>
                <p className="text-xs text-slate-500">Auto-condense for impact</p>
              </div>
              <button 
                onClick={() => setForceOnePage(!forceOnePage)}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-colors duration-300",
                  forceOnePage ? "bg-blue-600" : "bg-slate-200"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm",
                  forceOnePage ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <button 
            onClick={handleOptimize}
            disabled={loading || !file || !jd}
            className={cn(
              "h-14 px-10 rounded-xl font-bold text-lg transition-all flex items-center gap-3",
              loading || !file || !jd
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800 shadow-xl active:scale-95"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 fill-current" />
                Refine My Resume
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-16 space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="bg-white p-8 rounded-2xl border shadow-elegant">
              <h3 className="text-2xl font-bold mb-2">Analysis Complete</h3>
              <p className="text-slate-500 text-sm mb-8">ATS match improvement against this job description.</p>
              
              <div className="flex flex-wrap items-center justify-center gap-12 py-8">
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Original</div>
                  <div className="text-5xl font-black text-slate-300">{result.match_score_before}%</div>
                </div>
                <ArrowRight className="h-8 w-8 text-slate-200" />
                <div className="text-center">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Optimized</div>
                  <div className="text-5xl font-black text-blue-600">{result.match_score_after}%</div>
                </div>
              </div>

              {result.keywords_added.length > 0 && (
                <div className="mt-10 pt-10 border-t">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Keywords Synced</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.keywords_added.map((kw, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-2xl border shadow-elegant">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold">{result.name}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Generated Profile</p>
                </div>
                <button 
                  onClick={downloadPdf}
                  className="flex items-center gap-2 px-6 h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
              </div>
              
              <div className="prose prose-slate max-w-none">
                <div className="bg-slate-50 p-6 rounded-xl border">
                  <p className="text-sm leading-relaxed text-slate-600 italic">"{result.summary}"</p>
                </div>
                
                <div className="mt-8 space-y-6">
                  {result.experience.map((exp, i) => (
                    <div key={i} className="border-l-2 border-slate-100 pl-6 py-1">
                      <div className="flex justify-between items-baseline mb-2">
                        <h4 className="font-bold text-slate-900">{exp.role}</h4>
                        <span className="text-xs font-bold text-slate-400 uppercase">{exp.company}</span>
                      </div>
                      <ul className="space-y-2">
                        {exp.description.map((bullet: string, j: number) => (
                          <li key={j} className="text-sm text-slate-500 flex gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 text-center py-10 border-t bg-white">
        <p className="text-xs text-slate-400">
          Professional ATS Optimization · Standard Output · Verified Results
        </p>
      </footer>
    </div>
  );
}
