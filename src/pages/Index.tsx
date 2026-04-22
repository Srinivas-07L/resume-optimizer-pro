import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadResumePdf, type ResumeData } from "@/lib/resume-pdf";
import { downloadCoverLetterPdf, type CoverLetterData } from "@/lib/cover-letter-pdf";
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

const Index = () => {
  // Resume tab state
  const [jd, setJd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [forceOnePage, setForceOnePage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cover letter tab state
  const [baseLetter, setBaseLetter] = useState("");
  const [letterJd, setLetterJd] = useState("");
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterResult, setLetterResult] = useState<(CoverLetterData & { keywords_added?: string[] }) | null>(null);

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
    try {
      const fd = new FormData();
      fd.append("jd", jd);
      fd.append("resume", file);
      fd.append("force_one_page", String(forceOnePage));
      const { data, error } = await supabase.functions.invoke("refine-resume", { body: fd });
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
    if (!baseLetter.trim() || baseLetter.trim().length < 50) {
      toast({ title: "Base letter too short", description: "Paste your full base cover letter (min 50 chars).", variant: "destructive" });
      return;
    }
    if (!letterJd.trim() || letterJd.trim().length < 50) {
      toast({ title: "Target JD too short", description: "Paste the JD (min 50 chars).", variant: "destructive" });
      return;
    }
    setLetterLoading(true);
    setLetterResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("refine-cover-letter", {
        body: { base_letter: baseLetter, jd: letterJd },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setLetterResult((data as any).letter);
      toast({ title: "Cover letter tailored", description: "Format & voice preserved." });
    } catch (e: any) {
      toast({
        title: "Could not tailor letter",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLetterLoading(false);
    }
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
            ATS-optimized resumes and tailored cover letters — keyword-mirrored, single-column, text-searchable.
          </p>
        </div>
      </header>

      {/* App */}
      <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <Tabs defaultValue="resume" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="resume">
              <FileText className="mr-2 h-4 w-4" /> Resume
            </TabsTrigger>
            <TabsTrigger value="cover">
              <Mail className="mr-2 h-4 w-4" /> Cover Letter
            </TabsTrigger>
          </TabsList>

          {/* RESUME TAB */}
          <TabsContent value="resume" className="mt-6">
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
                      Overrides smart length; ruthlessly trims older roles.
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

            {loading && (
              <Card className="mt-10 animate-pulse p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-3 w-48 rounded bg-muted" />
                  <div className="h-3 w-64 rounded bg-muted" />
                  <div className="h-3 w-40 rounded bg-muted" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Mirroring keywords · rewriting in STAR/XYZ · scoring ATS match…
                  </p>
                </div>
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
                    {result.page_target || 1} page{(result.page_target || 1) > 1 ? "s" : ""}
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
                    onClick={() => downloadResumePdf(result)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" />
                    Download ATS PDF
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* COVER LETTER TAB */}
          <TabsContent value="cover" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 shadow-elegant">
                <div className="mb-3 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold">Base Cover Letter</h2>
                </div>
                <Textarea
                  value={baseLetter}
                  onChange={(e) => setBaseLetter(e.target.value)}
                  placeholder="Paste your base cover letter — your voice, format, and structure will be locked…"
                  className="min-h-[320px] resize-none text-sm"
                  disabled={letterLoading}
                />
                <p className="mt-2 text-xs text-muted-foreground">{baseLetter.length.toLocaleString()} characters</p>
              </Card>

              <Card className="p-6 shadow-elegant">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-accent" />
                    <h2 className="text-lg font-semibold">Target Job Description</h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={useResumeJd} disabled={letterLoading}>
                    Use Resume JD
                  </Button>
                </div>
                <Textarea
                  value={letterJd}
                  onChange={(e) => setLetterJd(e.target.value)}
                  placeholder="Paste the target job description…"
                  className="min-h-[320px] resize-none text-sm"
                  disabled={letterLoading}
                />
                <p className="mt-2 text-xs text-muted-foreground">{letterJd.length.toLocaleString()} characters</p>
              </Card>
            </div>

            <div className="mt-8 flex justify-center">
              <Button
                size="lg"
                onClick={handleLetterSubmit}
                disabled={letterLoading}
                className="bg-gradient-accent text-accent-foreground shadow-glow hover:opacity-90"
              >
                {letterLoading ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Tailoring letter…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Tailor my cover letter
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {letterLoading && (
              <Card className="mt-10 animate-pulse p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-3 w-48 rounded bg-muted" />
                  <div className="h-3 w-64 rounded bg-muted" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Locking format · preserving voice · swapping keywords…
                  </p>
                </div>
              </Card>
            )}

            {letterResult && !letterLoading && (
              <Card className="mt-10 p-6 md:p-8 shadow-elegant">
                <h3 className="text-2xl font-bold">Tailored Cover Letter</h3>
                {letterResult.company_name && (
                  <p className="mt-1 text-sm text-muted-foreground">For: {letterResult.company_name}</p>
                )}

                {letterResult.keywords_added && letterResult.keywords_added.length > 0 && (
                  <div className="mt-6">
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Keywords mirrored from JD
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {letterResult.keywords_added.map((k) => (
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

                <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-5">
                  <h4 className="mb-3 text-sm font-semibold">Preview</h4>
                  <div className="space-y-3 text-sm leading-relaxed">
                    <p>{letterResult.salutation}</p>
                    {letterResult.paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    <p>{letterResult.sign_off}</p>
                    {letterResult.signature_name && <p className="font-semibold">{letterResult.signature_name}</p>}
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                  <Button
                    size="lg"
                    onClick={() => downloadCoverLetterPdf(letterResult)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" />
                    Download Cover Letter PDF
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Single-column · Helvetica/Arial · Text-searchable · Zero tables, columns, or icons
        </footer>
      </main>
    </div>
  );
};

export default Index;
