import { Building2, ImageUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useMediaObjectUrl } from '@/hooks/use-media-object-url';

interface ProjectCoverFieldProps {
  /** URL relativa da capa já salva (`/projects/:id/cover`), quando editando. */
  currentCover?: string | null;
  onFileChange: (file: File | null) => void;
}

/** Seção "Capa": preview da imagem atual/escolhida + seletor de arquivo. */
export function ProjectCoverField({ currentCover, onFileChange }: ProjectCoverFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const savedUrl = useMediaObjectUrl(currentCover);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Preview otimista do arquivo escolhido; revoga ao trocar/desmontar.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    onFileChange(file);
  };

  const shownUrl = previewUrl ?? savedUrl;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border bg-accent/40 sm:w-64">
        {shownUrl ? <img src={shownUrl} alt={t('project.cover')} className="size-full object-cover" /> : <Building2 className="size-10 text-muted-foreground/60" aria-hidden />}
      </div>
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <ImageUp className="size-4" />
          {t('project.cover')}
        </Button>
        <p className="text-muted-foreground text-sm">{t('project.cover.help')}</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleSelect} />
      </div>
    </div>
  );
}
