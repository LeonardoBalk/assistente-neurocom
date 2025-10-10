# RAG e Embeddings

## Embeddings
- Modelo: `text-embedding-004`
- Dimensão: 768 (validada no serviço; mismatch lança erro)
- Uso:
  - embedText(pergunta)
  - embedText(pergunta + resposta) para salvar no histórico

## RPCs principais

### match_documents (fallback de documentos)
```sql
with candidates as (
  select
    d.id::bigint as id,
    d.content,
    1 - (d.embedding <=> (p_query_embedding::vector(768))) as similarity
  from public.documents d
  where d.embedding is not null
    and (1 - (d.embedding <=> (p_query_embedding::vector(768)))) >= p_min_sim
  order by d.embedding <=> (p_query_embedding::vector(768))
  limit p_candidate_pool
)
select id, content, similarity
from candidates
order by similarity desc
limit p_match_count;
```

Parâmetros:
- p_query_embedding: vetor[768] da pergunta
- p_min_sim: similaridade mínima (ex.: 0.30)
- p_candidate_pool: tamanho do pool inicial (ex.: 50–100)
- p_match_count: top K final (ex.: 8)

### search_docs_and_history (unificada)
```plpgsql
declare
  v_total_limit int := coalesce(p_total_limit, p_match_count + p_history_count);
begin
  -- Para IVFFlat: mais probes = mais recall (e mais lento)
  -- perform set_config('ivfflat.probes','10', true);

  return query
  with docs as (
    select 
      d.id::bigint as id,
      d.content,
      1 - (d.embedding <=> (p_query_embedding::vector(768))) as similarity,
      'documento'::text as tipo,
      (1 - (d.embedding <=> (p_query_embedding::vector(768)))) as score
    from public.documents d
    where d.embedding is not null
      and (1 - (d.embedding <=> (p_query_embedding::vector(768)))) >= p_min_sim_docs
    order by d.embedding <=> (p_query_embedding::vector(768))
    limit p_match_count
  ),
  hist as (
    select
      h.id::bigint as id,
      (h.pergunta || E'\n' || h.resposta)::text as content,
      1 - (h.embedding <=> (p_query_embedding::vector(768))) as similarity,
      'historico'::text as tipo,
      (
        0.7 * (1 - (h.embedding <=> (p_query_embedding::vector(768))))
        + 0.3 * exp( - extract(epoch from (now() - h.criado_em)) / p_recency_half_life_seconds )
      ) as score
    from public.historico h
    where h.embedding is not null
      and h.usuario_id = p_usuario_id
      and h.sessao_id  = p_sessao_id
      and (1 - (h.embedding <=> (p_query_embedding::vector(768)))) >= p_min_sim_hist
    order by score desc
    limit p_history_count
  )
  select * from (
    select * from docs
    union all
    select * from hist
  ) u
  order by u.score desc
  limit v_total_limit;
end;
```

Parâmetros:
- p_query_embedding: vetor[768] da pergunta
- p_usuario_id: para filtrar histórico por usuário
- p_sessao_id: para filtrar histórico por sessão
- p_match_count: K de documentos (ex.: 8)
- p_history_count: K de histórico (ex.: 6)
- p_min_sim_docs: min sim docs (ex.: 0.30)
- p_min_sim_hist: min sim histórico (ex.: 0.25)
- p_recency_half_life_seconds: meia-vida de recência (ex.: 86400)
- p_total_limit: limite global (opcional)

## Fallback e decisão
- Primeiro tenta `search_docs_and_history` (documentos + histórico com score por sim + recência).
- Se falhar (erro RPC) ou retornar vazio, usa:
  - `match_documents` para documentos
  - histórico recente por recência (limit 10) como contorno
- O join final do contexto concatena histórico + docs, mantendo ordem cronológica onde aplicável.

## Notas de performance
- Garanta indexação vetorial adequada (pgvector) para columns embedding em documents/historico
- Ajuste IVFFlat probes conforme necessidade (comentários no SQL)
- Observe tempos de resposta e métricas de recall vs. latência
- Evite embeddings com dimensões diferentes (validadas no serviço)
