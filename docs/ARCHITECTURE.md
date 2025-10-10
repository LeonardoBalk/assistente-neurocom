# Arquitetura

## Camadas
- routes: registram endpoints HTTP
- controllers: validam e orquestram req/res
- services: regras de negócio (auth, chat, rag, embedding)
- repositories: persistência (Supabase) e RPCs
- clients: SDKs externos (Supabase, Gemini)
- middlewares: auth JWT, tratamento de erros
- utils: helpers (asyncHandler, position, styler)
- ws: inicialização de WebSocket

## Diagrama de componentes
```mermaid
graph TD
  F[Frontend] -->|HTTP/WS| API[Express App]
  API --> ROUTES[Routes]
  ROUTES --> CTRL[Controllers]
  CTRL --> SRV[Services]
  SRV --> REP[Repositories]
  SRV --> LLM[Gemini]
  SRV --> EMB[Embedding Service]
  REP --> DB[(Supabase)]
  DB --> RPCs[RPCs]
```

## Fluxo /chat-rag
```mermaid
sequenceDiagram
  participant U as Frontend
  participant C as Controller (/chat-rag)
  participant S as Chat Service
  participant R as RAG Service
  participant E as Embedding
  participant D as Supabase
  participant G as Gemini

  U->>C: POST /chat-rag
  C->>S: validar e processar
  S->>R: buscarContexto(pergunta, sessão, user)
  R->>E: embedText(pergunta)
  E-->>R: vector[768]
  R->>D: search_docs_and_history(...)
  alt ok
    D-->>R: rows (docs + histórico)
  else fallback
    R->>D: match_documents(...)
    D-->>R: docs
    R->>D: histórico recente (limit 10)
    D-->>R: hist
  end
  S->>G: generateByPosition(contexto + hist, TU/ELE/NÓS)
  G-->>S: resposta
  S->>E: embedText(pergunta + resposta)
  E-->>S: vector[768]
  S->>D: insert_historico(...)
  D-->>S: id/ok
  S-->>C: resposta + followups + sessionId
  C-->>U: 200 OK
```
