import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadResumePdf, type ResumeData } from "@/lib/resume-pdf";
import { applyEditsToPdf, downloadEditedLetter, type Edit } from "@/lib/cover-letter-overlay";
import { MatchScoreRing } from "@/components/MatchScoreRing";
import { FileText, Upload, Sparkles, Download, CheckCircle2, ArrowRight, Mail } from "lucide-react";

type ResumeResult = ResumeData & {
  match_score_before: number;
  match_score_after: number;
  page_target?: number;
  length_decision_reason?: string;
  keywords_added?: string[];
  keywords_missing_in_original?: string[];
};

type LetterResult = {
  company_name?: string;
  edits: Edit[];
  keywords_added?: string[];
  original_text?: string;
};

const Index = () => {
  // Resume tab state
  const [jd, setJd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [forceOnePage, setForceOnePage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<ResumeResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cover letter tab state — now PDF upload
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const [letterJd, setLetterJd] = useState("");
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterResult, setLetterResult] = useState<LetterResult | null>(null);
  const [editedLetterBytes, setEditedLetterBytes] = useState<Uint8Array | null>(null);
  const letterFileRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Please upload a .pdf resume.", variant: "destructive" });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB.", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const onLetterFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Please upload a .pdf cover letter.", variant: "destructive" });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB.", variant: "destructive" });
      return;
    }
    setLetterFile(f);
  };

  const runProgress = (label: string) => {
    setProgressLabel(label);
    setProgress(8);
    let p = 8;
    const id = setInterval(() => {
      p = Math.min(92, p + Math.random() * 12);
      setProgress(p);
    }, 450);
    return () => {
      clearInterval(id);
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setProgressLabel("");
      }, 400);
    };
  };

  const handleSubmit = async () => {
    if (!jd.trim() || jd.trim().length < 50) {
      toast({ title: "Job description too short", description: "Paste the full JD (min 50 chars).", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Resume required", description: "Upload your current resume PDF.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    const stop = runProgress(
      forceOnePage ? "Re-engineering PDF Layout…" : "Mirroring keywords · scoring ATS match…",
    );
    try {
      const fd = new FormData();
      fd.append("jd", jd);
      fd.append("resume", file);
      fd.append("force_one_page", String(forceOnePage));
      const { data, error } = await supabase.functions.invoke("optimize-resume", { body: fd });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult((data as any).resume);
      toast({ title: "Resume re-engineered", description: "ATS-optimized version is ready." });
    } catch (e: any) {
      toast({
        title: "Could not refine resume",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      stop();
      setLoading(false);
    }
  };

  const useResumeJd = () => {
    if (!jd.trim()) {
      toast({ title: "No JD on Resume tab", description: "Paste a job description there first.", variant: "destructive" });
      return;
    }
    setLetterJd(jd);
    toast({ title: "JD copied", description: "Reused from Resume tab." });
  };

  const handleLetterSubmit = async () => {
    if (!letterFile) {
      toast({ title: "Cover letter required", description: "Upload your current cover letter PDF.", variant: "destructive" });
      return;
    }
    if (!letterJd.trim() || letterJd.trim().length < 50) {
      toast({ title: "Target JD too short", description: "Paste the JD (min 50 chars).", variant: "destructive" });
      return;
    }
    setLetterLoading(true);
    setLetterResult(null);
    setEditedLetterBytes(null);
    const stop = runProgress("Locating swap points · preserving original layout…");
    try {
      const fd = new FormData();
      fd.append("jd", letterJd);
      fd.append("letter", letterFile);
      const { data, error } = await supabase.functions.invoke("optimize-cover-letter", { body: fd });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const lr = data as LetterResult;
      setLetterResult(lr);

      // Apply edits in-place to the original PDF
      const originalBytes = new Uint8Array(await letterFile.arrayBuffer());
      const edited = await applyEditsToPdf(originalBytes, lr.edits || []);
      setEditedLetterBytes(edited);

      toast({
        title: "Cover letter tailored",
        description: `${(lr.edits || []).length} in-place edits applied. Original layout preserved.`,
      });
    } catch (e: any) {
      toast({
        title: "Could not tailor letter",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      stop();
      setLetterLoading(false);
    }
  };

  const handleDownloadLetter = () => {
    if (!editedLetterBytes || !letterFile) return;
    const safe = (s: string) => (s || "").replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "");
    const company = safe(letterResult?.company_name || "Tailored");
    const base = safe(letterFile.name.replace(/\.pdf$/i, "")) || "CoverLetter";
    downloadEditedLetter(editedLetterBytes, `${base}_${company}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="bg-gradient-hero text-primary-foreground">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <div className="flex items-center gap-2 text-sm font-medium opacity-80">
            <Sparkles className="h-4 w-4" />
            <span>ResumeRefine</span>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
            Beat the bots.<br />
            <span className="bg-gradient-accent bg-clip-text text-transparent">Land the interview.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg opacity-80 md:text-xl">
            ATS-optimized resumes and in-place edited cover letters — your layout, your voice, JD-mirrored keywords.
          </p>
        </div>
      </header>

      {/* App */}
      <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 shadow-elegant">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold">Job Description</h2>
                </div>
                <Textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the full job description here…"
                  className="min-h-[280px] resize-none text-sm"
                  disabled={loading}
                />
                <p className="mt-2 text-xs text-muted-foreground">{jd.length.toLocaleString()} characters</p>
              </Card>

              <Card className="p-6 shadow-elegant">
                <div className="mb-3 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold">Current Resume (PDF)</h2>
                </div>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/40 p-6 text-center transition-colors hover:border-accent hover:bg-secondary"
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                    disabled={loading}
                  />
                  {file ? (
                    <>
                      <CheckCircle2 className="h-10 w-10 text-accent" />
                      <p className="mt-3 text-sm font-medium">{file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(0)} KB · click to replace
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">Drop your PDF here</p>
                      <p className="mt-1 text-xs text-muted-foreground">or click to browse · max 10 MB</p>
                    </>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                  <div>
                    <Label htmlFor="force-one-page" className="text-sm font-medium">
                      Force 1-Page Resume
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Auto-shrinks font, tightens line-height, trims oldest bullets.
                    </p>
                  </div>
                  <Switch
                    id="force-one-page"
                    checked={forceOnePage}
                    onCheckedChange={setForceOnePage}
                    disabled={loading}
                  />
                </div>
              </Card>
            </div>

            <div className="mt-8 flex justify-center">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={loading}
                className="bg-gradient-accent text-accent-foreground shadow-glow hover:opacity-90"
              >
                {loading ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Analyzing &amp; Re-engineering…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Refine my resume
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {progress > 0 && (
              <Card className="mt-6 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{progressLabel}</span>
                  <span className="text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="mt-3" />
              </Card>
            )}

            {result && !loading && (
              <Card className="mt-10 p-6 md:p-8 shadow-elegant">
                <h3 className="text-2xl font-bold">Comparison</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  ATS match against this job description, before and after rewrite.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-10 md:gap-16">
                  <MatchScoreRing label="Before" score={result.match_score_before} tone="muted" />
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  <MatchScoreRing label="After" score={result.match_score_after} />
                </div>

                {(result.page_target || result.length_decision_reason) && (
                  <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-4 text-sm">
                    <span className="font-semibold">Length: </span>
                    {forceOnePage ? 1 : result.page_target || 1} page
                    {(forceOnePage ? 1 : result.page_target || 1) > 1 ? "s" : ""}
                    {result.length_decision_reason && (
                      <span className="text-muted-foreground"> — {result.length_decision_reason}</span>
                    )}
                  </div>
                )}

                {result.keywords_added && result.keywords_added.length > 0 && (
                  <div className="mt-6">
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Keywords mirrored from JD
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords_added.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-8 rounded-lg border border-border bg-secondary/40 p-5">
                  <h4 className="mb-2 text-sm font-semibold">Preview</h4>
                  <p className="text-sm font-bold">{result.name}</p>
                  <p className="mt-3 text-sm leading-relaxed">{result.summary}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {result.experience?.length || 0} experience entries · {result.skills?.length || 0} skills
                  </p>
                </div>

                <div className="mt-8 flex justify-center">
                  <Button
                    size="lg"
                    onClick={() => downloadResumePdf(result, forceOnePage)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" />
                    Download ATS PDF
                  </Button>
                </div>
              </Card>
            )}

            )}

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Single-column · Helvetica/Arial · Text-searchable · Zero tables, columns, or icons
        </footer>
      </main>
    </div>
  );
};

export default Index;
