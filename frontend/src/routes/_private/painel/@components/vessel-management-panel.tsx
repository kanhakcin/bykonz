import { useEffect, useState } from 'react';
import { ShipWheel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api/client.api';

interface Vessel {
  id: number;
  name: string;
  code?: string | null;
  imo?: string | null;
  mmsi?: string | null;
  vesselType?: string | null;
  flag?: string | null;
  port?: string | null;
  location?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  observations?: string | null;
}

export function VesselManagementPanel() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [form, setForm] = useState({
    name: '',
    code: '',
    imo: '',
    mmsi: '',
    vesselType: '',
    flag: '',
    port: '',
    location: '',
    model: '',
    manufacturer: '',
    observations: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadVessels();
  }, []);

  async function loadVessels() {
    const response = await api.get<Vessel[]>('/api/v1/vessels');
    setVessels(response.data as Vessel[]);
  }

  async function saveVessel() {
    setLoading(true);
    try {
      await api.post('/api/v1/vessels', form);
      setForm({
        name: '',
        code: '',
        imo: '',
        mmsi: '',
        vesselType: '',
        flag: '',
        port: '',
        location: '',
        model: '',
        manufacturer: '',
        observations: '',
      });
      await loadVessels();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Embarcações e mobilizações">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShipWheel className="size-4" />
          Cadastro centralizado para o fluxo marítimo
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Nome da embarcação</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Código</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <Label>IMO</Label>
            <Input value={form.imo} onChange={(e) => setForm({ ...form, imo: e.target.value })} />
          </div>
          <div>
            <Label>MMSI</Label>
            <Input value={form.mmsi} onChange={(e) => setForm({ ...form, mmsi: e.target.value })} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Input value={form.vesselType} onChange={(e) => setForm({ ...form, vesselType: e.target.value })} />
          </div>
          <div>
            <Label>Bandeira</Label>
            <Input value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} />
          </div>
          <div>
            <Label>Porto</Label>
            <Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
          </div>
          <div>
            <Label>Localização</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div>
            <Label>Fabricante</Label>
            <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
        </div>
        <Button onClick={() => void saveVessel()} disabled={loading || !form.name.trim()}>
          Cadastrar embarcação
        </Button>
        <div className="space-y-2">
          {vessels.map((vessel) => (
            <div key={vessel.id} className="rounded border p-3">
              <div className="font-semibold">{vessel.name}</div>
              <div className="text-sm text-muted-foreground">
                {vessel.imo ? `IMO ${vessel.imo}` : 'IMO não informado'} · {vessel.port || vessel.location || 'Local não informado'}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
