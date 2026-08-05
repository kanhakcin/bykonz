import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, FileText, Film, ImagePlus, Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api/client.api';

export const EVIDENCE_CATEGORIES = [
  'Painel Elétrico',
  'Sistema DP',
  'Supervisório',
  'Rack',
  'Encoder',
  'Switch',
  'IPC',
  'Câmera IA',
  'Rede',
  'NMEA',
  'Modbus',
  'CLP',
  'Antena',
  'Equipamentos',
  'Testes',
  'Pendências',
] as const;

export const ATTENDANCE_TYPES = [
  'SITE_SURVEY',
  'INSTALLATION',
  'MAINTENANCE',
  'DIAGNOSIS',
  'COMMISSIONING',
  'TECHNICAL_SUPPORT',
] as const;

interface Evidence {
  id: number;
  category: string;
  observation?: string | null;
  aiDescription?: string | null;
  aiTags?: string[];
  equipmentIdentified?: string[];
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  ocrText?: string | null;
  orderIndex?: number | null;
  attachmentMime?: string | null;
  attachmentData?: string | null;
  createdAt: string;
}

interface Mobilization {
  id: number;
  reportCode: string;
  clientName?: string | null;
  vesselName?: string | null;
  serviceType?: string | null;
  attendanceType?: string | null;
  siteLocation?: string | null;
  technicianName?: string | null;
  objective?: string | null;
  status?: string | null;
  evidences?: Evidence[];
  inventory?: { id: number; name: string; quantity?: number }[];
  reports?: { id: number; reportCode: string }[];
}

interface PendingIssue {
  id: number;
  system: string;
  description: string;
  responsible?: string | null;
  status?: string | null;
  suggestedByAi?: boolean | null;
}

export function EvidenceManager() {
  const [projectId, setProjectId] = useState<number | undefined>();
  const [projectInput, setProjectInput] = useState('');
  const [mobilizations, setMobilizations] = useState<Mobilization[]>([]);
  const [selectedMobilization, setSelectedMobilization] = useState<Mobilization | null>(null);
  const [pendingIssues, setPendingIssues] = useState<PendingIssue[]>([]);
  const [loading, setLoading] = useState(false);

  // Mobilization form
  const [mobForm, setMobForm] = useState({
    clientName: '',
    vesselName: '',
    serviceType: '',
    attendanceType: '',
    siteLocation: '',
    mobilizationDate: '',
    technicianName: '',
    objective: '',
  });

  // Evidence upload
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [evidenceCategory, setEvidenceCategory] = useState<string>('');
  const [evidenceObservation, setEvidenceObservation] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    category: string;
    confidence: number;
    aiTags: string[];
    aiSummary: string;
    suggestedEquipment: string[];
    suggestedPendingIssues: { system?: string; description: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) return;
    void loadMobilizations(projectId);
  }, [projectId]);

  async function loadMobilizations(id: number) {
    setLoading(true);
    try {
      const res = await api.get<Mobilization[]>(`/api/v1/projects/${id}/mobilizations`);
      setMobilizations(res.data as Mobilization[]);
    } finally {
      setLoading(false);
    }
  }

  async function createMobilization() {
    if (!projectId) return;
    setLoading(true);
    try {
      await api.post(`/api/v1/projects/${projectId}/mobilizations`, mobForm);
      setMobForm({
        clientName: '',
        vesselName: '',
        serviceType: '',
        attendanceType: '',
        siteLocation: '',
        mobilizationDate: '',
        technicianName: '',
        objective: '',
      });
      await loadMobilizations(projectId);
    } finally {
      setLoading(false);
    }
  }

  async function openMobilization(mob: Mobilization) {
    setSelectedMobilization(mob);
    setLoading(true);
    try {
      const res = await api.get<Mobilization>(`/api/v1/mobilizations/${mob.id}`);
      setSelectedMobilization(res.data as Mobilization);
      const issuesRes = await api.get<{ pendingIssues?: PendingIssue[] }>(`/api/v1/mobilizations/${mob.id}`);
      const data = issuesRes.data as Mobilization;
      setPendingIssues(data.pendingIssues ?? []);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setEvidenceFile(file);
      setAiDescription('');
      setAiResult(null);
    }
  }

  async function analyzeEvidence() {
    if (!evidenceFile) return;
    setAiAnalyzing(true);
    try {
      const base64 = await fileToBase64(evidenceFile);
      const res = await api.post(
        '/api/v1/ai/analyze-evidence',
        {
          filename: evidenceFile.name,
          contentType: evidenceFile.type,
          body: base64,
          observation: evidenceObservation || undefined,
        },
        { timeout: 60000 },
      );
      const result = res.data as {
        category: string;
        confidence: number;
        aiTags: string[];
        aiSummary: string;
        suggestedEquipment: string[];
        suggestedPendingIssues: { system?: string; description: string }[];
      };
      setAiResult(result);
      setAiDescription(result.aiSummary);
      if (!evidenceCategory) setEvidenceCategory(result.category);
    } catch (error) {
      toast.error('Falha na análise de IA da evidência');
    } finally {
      setAiAnalyzing(false);
    }
  }

  async function uploadEvidence() {
    if (!selectedMobilization || !evidenceFile) return;
    setLoading(true);
    try {
      const base64 = await fileToBase64(evidenceFile);
      await api.post(`/api/v1/mobilizations/${selectedMobilization.id}/evidences/upload`, {
        filename: evidenceFile.name,
        contentType: evidenceFile.type,
        body: base64,
        category: evidenceCategory || undefined,
        observation: evidenceObservation || undefined,
      });
      setEvidenceFile(null);
      setEvidenceCategory('');
      setEvidenceObservation('');
      setAiDescription('');
      setAiResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await openMobilization(selectedMobilization);
    } finally {
      setLoading(false);
    }
  }

  async function updateEvidenceDescription(evidence: Evidence, newDescription: string) {
    try {
      await api.patch(`/api/v1/evidences/${evidence.id}`, { aiDescription: newDescription });
      setSelectedMobilization((prev) =>
        prev
          ? {
              ...prev,
              evidences: prev.evidences?.map((e) => (e.id === evidence.id ? { ...e, aiDescription: newDescription } : e)),
            }
          : prev,
      );
    } catch {
      toast.error('Erro ao salvar descrição');
    }
  }

  async function generateReport() {
    if (!selectedMobilization) return;
    setLoading(true);
    try {
      await api.post(`/api/v1/mobilizations/${selectedMobilization.id}/generate-report`);
      toast.success('Relatório gerado com sucesso');
      await openMobilization(selectedMobilization);
    } finally {
      setLoading(false);
    }
  }

  async function downloadReport(format: 'pdf' | 'docx') {
    if (!selectedMobilization?.reports?.[0]) {
      toast.error('Gere o relatório primeiro');
      return;
    }
    const reportId = selectedMobilization.reports[0].id;
    try {
      const res = await api.get(`/api/v1/reports/${reportId}/${format}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${reportId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar relatório');
    }
  }

  const groupedEvidences = useMemo(() => {
    const groups = new Map<string, Evidence[]>();
    for (const ev of selectedMobilization?.evidences ?? []) {
      const list = groups.get(ev.category) ?? [];
      list.push(ev);
      groups.set(ev.category, list);
    }
    return [...groups.entries()];
  }, [selectedMobilization?.evidences]);

  return (
    <Card>
      <CardHeader title="Relatórios Inteligentes — Evidências">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4" />
          Foto → IA → descrição técnica → relatório
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project selector */}
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="ID do projeto"
            value={projectInput}
            onChange={(e) => setProjectInput(e.target.value)}
          />
          <Button onClick={() => setProjectId(Number(projectInput))} disabled={!projectInput}>
            Carregar
          </Button>
        </div>

        {projectId && (
          <>
            {/* Create mobilization */}
            <div className="rounded-lg border p-4">
              <h3 className="mb-3 font-semibold">Nova mobilização</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Cliente</Label>
                  <Input value={mobForm.clientName} onChange={(e) => setMobForm({ ...mobForm, clientName: e.target.value })} />
                </div>
                <div>
                  <Label>Embarcação</Label>
                  <Input value={mobForm.vesselName} onChange={(e) => setMobForm({ ...mobForm, vesselName: e.target.value })} />
                </div>
                <div>
                  <Label>Tipo de atendimento</Label>
                  <Select
                    value={mobForm.attendanceType}
                    onValueChange={(v) => setMobForm({ ...mobForm, attendanceType: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={mobForm.siteLocation} onChange={(e) => setMobForm({ ...mobForm, siteLocation: e.target.value })} />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={mobForm.mobilizationDate} onChange={(e) => setMobForm({ ...mobForm, mobilizationDate: e.target.value })} />
                </div>
                <div>
                  <Label>Técnico responsável</Label>
                  <Input value={mobForm.technicianName} onChange={(e) => setMobForm({ ...mobForm, technicianName: e.target.value })} />
                </div>
              </div>
              <div className="mt-3">
                <Label>Objetivo</Label>
                <Textarea value={mobForm.objective} onChange={(e) => setMobForm({ ...mobForm, objective: e.target.value })} />
              </div>
              <Button className="mt-3" onClick={() => void createMobilization()} disabled={loading}>
                Criar mobilização
              </Button>
            </div>

            {/* Mobilization list */}
            <div className="space-y-2">
              <h3 className="font-semibold">Mobilizações</h3>
              {mobilizations.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mobilização.</p>}
              {mobilizations.map((mob) => (
                <div key={mob.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <div className="font-semibold">{mob.reportCode}</div>
                    <div className="text-sm text-muted-foreground">
                      {mob.vesselName || mob.clientName || 'Sem dados'} · {mob.attendanceType || mob.serviceType || '—'}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void openMobilization(mob)}>
                    Abrir
                  </Button>
                </div>
              ))}
            </div>

            {/* Selected mobilization detail */}
            {selectedMobilization && (
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{selectedMobilization.reportCode}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedMobilization.vesselName} · {selectedMobilization.siteLocation} · {selectedMobilization.technicianName}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void generateReport()} disabled={loading}>
                      <Wand2 className="size-4" /> Gerar relatório
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void downloadReport('pdf')}>
                      <FileText className="size-4" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void downloadReport('docx')}>
                      <FileText className="size-4" /> DOCX
                    </Button>
                  </div>
                </div>

                {/* Evidence upload */}
                <Button variant="green" onClick={() => setEvidenceDialogOpen(true)}>
                  <Camera className="size-4" /> Adicionar evidência
                </Button>

                {/* Grouped evidence */}
                <div className="mt-4 space-y-4">
                  {groupedEvidences.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma evidência registrada.</p>}
                  {groupedEvidences.map(([category, evidences]) => (
                    <div key={category}>
                      <h4 className="mb-2 font-semibold text-sm">{category}</h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        {evidences.map((ev) => (
                          <div key={ev.id} className="rounded border p-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="info">{ev.category}</Badge>
                              {ev.aiTags && ev.aiTags.length > 0 && (
                                <div className="flex gap-1">
                                  {ev.aiTags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="secondary">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            {ev.manufacturer && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {ev.manufacturer} {ev.model ? `· ${ev.model}` : ''} {ev.serialNumber ? `· SN ${ev.serialNumber}` : ''}
                              </p>
                            )}
                            <Label className="mt-2 block text-xs">Descrição (IA)</Label>
                            <Textarea
                              className="mt-1 min-h-20 text-sm"
                              defaultValue={ev.aiDescription ?? ev.observation ?? ''}
                              onBlur={(e) => void updateEvidenceDescription(ev, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pending issues */}
                <div className="mt-4">
                  <h4 className="mb-2 font-semibold text-sm">Pendências ({pendingIssues.length})</h4>
                  {pendingIssues.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência.</p>}
                  {pendingIssues.map((issue) => (
                    <div key={issue.id} className="mb-2 rounded border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={issue.status?.toLowerCase() === 'open' ? 'warning' : 'success'}>{issue.status ?? 'OPEN'}</Badge>
                        <span className="font-medium">{issue.system}</span>
                        {issue.suggestedByAi && <Badge variant="violet">IA</Badge>}
                      </div>
                      <div className="mt-1 text-muted-foreground">{issue.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Evidence upload dialog */}
      <Dialog open={evidenceDialogOpen} onOpenChange={setEvidenceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar evidência</DialogTitle>
            <DialogDescription>Envie a foto e a IA analisará automaticamente o equipamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-input px-6 py-10"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setEvidenceFile(file);
                  setAiDescription('');
                  setAiResult(null);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {evidenceFile ? (
                <div className="flex items-center gap-2">
                  {evidenceFile.type.startsWith('image/') ? <ImagePlus className="size-8" /> : <Film className="size-8" />}
                  <span className="text-sm">{evidenceFile.name}</span>
                </div>
              ) : (
                <>
                  <ImagePlus className="size-8 text-muted-foreground" />
                  <span className="mt-2 text-sm text-muted-foreground">Arraste a foto ou clique para selecionar</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
              />
            </div>

            <div>
              <Label>Categoria</Label>
              <Select value={evidenceCategory} onValueChange={setEvidenceCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione ou deixe a IA classificar" />
                </SelectTrigger>
                <SelectContent>
                  {EVIDENCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observação (opcional)</Label>
              <Textarea value={evidenceObservation} onChange={(e) => setEvidenceObservation(e.target.value)} />
            </div>

            <Button variant="blue" className="w-full" onClick={() => void analyzeEvidence()} disabled={!evidenceFile || aiAnalyzing}>
              {aiAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              {aiAnalyzing ? 'Analisando pela IA...' : 'Analisar pela IA'}
            </Button>

            {aiResult && (
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="violet">IA</Badge>
                  <Badge variant={aiResult.confidence > 0.7 ? 'success' : 'warning'}>
                    Confiança {Math.round(aiResult.confidence * 100)}%
                  </Badge>
                </div>
                {aiResult.aiTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {aiResult.aiTags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <Label className="mt-2 block text-xs">Descrição técnica gerada (editável)</Label>
                <Textarea className="mt-1" value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} />
                {aiResult.suggestedEquipment.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Equipamentos: {aiResult.suggestedEquipment.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialogOpen(false)}>
              <Trash2 className="size-4" /> Cancelar
            </Button>
            <Button onClick={() => void uploadEvidence()} disabled={!evidenceFile || loading}>
              Salvar evidência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
