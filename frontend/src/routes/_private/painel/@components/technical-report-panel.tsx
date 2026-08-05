import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api/client.api';
import { useProjectFilter } from '@/hooks/use-project-filter';

interface Mobilization {
  id: number;
  reportCode: string;
  clientName?: string | null;
  vesselName?: string | null;
  serviceType?: string | null;
  siteLocation?: string | null;
  technicianName?: string | null;
  objective?: string | null;
  status?: string | null;
}

export function TechnicalReportPanel() {
  const projectId = useProjectFilter((state) => state.projectId);
  const [mobilizations, setMobilizations] = useState<Mobilization[]>([]);
  const [form, setForm] = useState({
    clientName: '',
    vesselName: '',
    serviceType: '',
    siteLocation: '',
    technicianName: '',
    objective: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    void loadMobilizations(projectId);
  }, [projectId]);

  async function loadMobilizations(id: number) {
    const data = await api.get<Mobilization[]>(`/api/v1/projects/${id}/mobilizations`);
    setMobilizations(data.data as Mobilization[]);
  }

  async function createMobilization() {
    if (!projectId) return;
    setLoading(true);
    try {
      await api.post(`/api/v1/projects/${projectId}/mobilizations`, form);
      setForm({
        clientName: '',
        vesselName: '',
        serviceType: '',
        siteLocation: '',
        technicianName: '',
        objective: '',
      });
      await loadMobilizations(projectId);
    } finally {
      setLoading(false);
    }
  }

  async function generateReport(mobilizationId: number) {
    setLoading(true);
    try {
      await api.post(`/api/v1/mobilizations/${mobilizationId}/generate-report`);
      await loadMobilizations(projectId!);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Relatórios inteligentes">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4" />
          Evidências → IA → relatório técnico
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Cliente</Label>
            <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div>
            <Label>Embarcação</Label>
            <Input value={form.vesselName} onChange={(e) => setForm({ ...form, vesselName: e.target.value })} />
          </div>
          <div>
            <Label>Tipo de atendimento</Label>
            <Input value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} />
          </div>
          <div>
            <Label>Local</Label>
            <Input value={form.siteLocation} onChange={(e) => setForm({ ...form, siteLocation: e.target.value })} />
          </div>
          <div>
            <Label>Técnico responsável</Label>
            <Input value={form.technicianName} onChange={(e) => setForm({ ...form, technicianName: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Objetivo</Label>
          <Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
        </div>
        <Button onClick={() => void createMobilization()} disabled={loading}>
          Criar mobilização
        </Button>

        <div className="space-y-2">
          {mobilizations.map((mobilization) => (
            <div key={mobilization.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{mobilization.reportCode}</div>
                  <div className="text-sm text-muted-foreground">{mobilization.vesselName || mobilization.clientName || 'Mobilização sem dados'}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void generateReport(mobilization.id)} disabled={loading}>
                  Gerar relatório
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
