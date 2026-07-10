import { Building2 } from 'lucide-react';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { useMediaObjectUrl } from '@/hooks/use-media-object-url';
import type { Project } from '@/routes/_private/cadastros/obras/@interface/project.interface';

interface ObraCardProps {
  obra: Project;
  onSelect: (id: number) => void;
}

/** Card de obra na galeria de seleção (home): capa no topo + nome, código e contexto. */
export function ObraCard({ obra, onSelect }: ObraCardProps) {
  const coverUrl = useMediaObjectUrl(obra.coverImage);

  return (
    <Item
      variant="outline"
      size="sm"
      className="h-full cursor-pointer flex-col items-stretch gap-0 overflow-hidden p-0 transition-colors hover:border-primary/50"
      onClick={() => onSelect(obra.id)}
    >
      <div className="flex aspect-[3/4] w-full shrink-0 items-center justify-center overflow-hidden bg-accent/40">
        {coverUrl ? <img src={coverUrl} alt={obra.name} className="block h-full w-full object-contain" /> : <Building2 className="size-10 text-muted-foreground/60" aria-hidden />}
      </div>
      <ItemContent className="gap-0 p-4">
        <ItemTitle className="text-base">{obra.name}</ItemTitle>
        <ItemDescription>
          {obra.code}
          {obra.context ? ` · ${obra.context}` : ''}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
