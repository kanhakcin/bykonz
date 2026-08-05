# Processamento Assíncrono (Queues) — Bykonz Marine Platform

## 1. Objetivo

Tarefas pesadas devem ser executadas em **background**, sem bloquear a interface do usuário.

## 2. Tarefas Assíncronas

- Upload de arquivos
- OCR
- Análise por IA (Vision)
- Compressão de imagens
- Geração de miniaturas
- Geração de PDF
- Envio de notificações

## 3. Infraestrutura

Usar uma biblioteca de filas (ex.: **BullMQ** com Redis) como backbone:

```
[API] → [Queue Service] → [Worker/Consumidor] → [Processamento]
```

- **Queue Service** — enfileira tarefas e retorna rapidamente ao cliente.
- **Workers** — processam tarefas em background.
- **Status/progresso** — o frontend consulta o status do processamento (polling ou WebSocket).

## 4. Interface

```ts
interface QueueService {
  enqueue<T>(queue: QueueName, job: T): Promise<JobRef>;
  getStatus(jobId: string): Promise<JobStatus>;
  on(jobId: string, event: 'completed' | 'failed', cb: (result: unknown) => void): void;
}
```

## 5. Filas por Domínio

| Fila | Tarefas |
|------|---------|
| `uploads` | Upload de arquivos, compressão, miniaturas |
| `ocr` | Extração de texto |
| `ai-analysis` | Análise de evidências pela IA |
| `reports` | Geração de PDF/DOCX |
| `notifications` | Envio de notificações |

## 6. Fluxo Exemplo (Upload + IA)

```
1. Cliente envia evidência → API responde 202 (aceito)
2. Queue Service enfileira job de upload
3. Worker de upload processa (armazena + comprime + miniatura)
4. Queue Service enfileira job de análise de IA
5. Worker de IA analisa a evidência (Vision + OCR)
6. Resultado persistido no banco
7. Frontend consulta status e mostra resultado quando pronto
```

## 7. Fallback

Em desenvolvimento (sem Redis/queues), o processamento pode rodar **síncrono** como
fallback, mantendo o fluxo funcional.
