# Serviço de Armazenamento (Storage Service) — Bykonz Marine Platform

## 1. Objetivo

Criar um **serviço exclusivo para armazenamento** de arquivos. **Nenhum outro módulo
deve acessar diretamente o armazenamento.** Todo acesso ocorre através deste serviço.

## 2. Estrutura

```
Storage Service (interface)
   ↓
[Provider] MinIO (self-hosted)
[Provider] Amazon S3
[Provider] Azure Blob (futuro)
```

## 3. Interface

```ts
interface StorageService {
  upload(input: UploadInput): Promise<FileRef>;
  download(ref: FileRef): Promise<Buffer>;
  delete(ref: FileRef): Promise<void>;
  getSignedUrl(ref: FileRef, expiresIn: number): Promise<string>;
  createThumbnail(ref: FileRef): Promise<FileRef>; // geração de miniaturas
}
```

## 4. Responsabilidades do Storage Service

- Upload de arquivos (assíncrono)
- Download de arquivos
- Exclusão
- URLs assinadas (acesso temporário)
- Compressão de imagens
- Geração de miniaturas
- Organização de pastas por domínio (ex.: `mobilizations/{id}/evidences/...`)

## 5. Regras

- **Nenhum módulo instancia S3/MinIO/Azure diretamente.**
- Todos os módulos dependem da interface `StorageService`.
- O provider é configurado via injeção de dependência (container).
- Tarefas pesadas (compressão, miniaturas) rodam de forma assíncrona via Queue Service.

## 6. Provedores

| Provedor | Uso |
|----------|-----|
| MinIO | Desenvolvimento/staging (self-hosted via docker-compose) |
| Amazon S3 | Produção |
| Azure Blob | Futuro |

O provider atual (`S3ObjectStorage` em `src/lib/s3Storage.ts`) será adaptado para
implementar a interface `StorageService`.
