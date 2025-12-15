# Proposta Comercial – Assistente Dr. Sérgio & Plataforma Multi‑Planos (Versão Reduzida)

## 1. Resumo
Esta proposta consolida: (a) venda do estado atual do assistente (chat RAG), (b) continuidade evolutiva, e (c) desenvolvimento da nova plataforma com planos de acesso e IA personalizada (usando React/Next.js + NestJS em vez de Wix). Valores ajustados para perfil desenvolvedor júnior, mantendo sustentabilidade e acessibilidade.

## 2. Projeto Atual (Assistente RAG) – Escopo e Valor
Já implementado:
- Backend Node: chat, sessões, histórico, embeddings (Gemini), recuperação contextual (RAG) básica.
- Frontend React: múltiplas sessões, autenticação, UI de chat funcional.
- Persistência: integração Supabase (histórico e sessões).

Pendências principais (não inclusas no estado atual):
- Camada de estilo personalizado do doutor.
- Painel de métricas/monitoramento.
- Memória longa (entre dias/sessões).
- Testes automatizados e hardening de segurança (rate limiting, logs estruturados).
- Identidade visual final (paleta, tipografia, avatar aprovado).

Valor de venda do pacote atual (transferência + handover): **R$ 3.200 líquidos**.
- Já foram pagos R$ 600 (deduzidos).
- Desconto para pagamento à vista: **R$ 3.000**.
- Inclui: README técnico, mapa de endpoints, instruções de setup, lista priorizada de pendências.

## 3. Continuidade – Roadmap de Evolução do Assistente
Sprint 1 (2–3 semanas): Estilo do doutor, painel básico (usuários, sessões, requisições), ajustes de prompt. (30–40h)
Sprint 2 (2–3 semanas): Memória longa por usuário, sumarização/re‑ranking contexto, testes básicos. (30–45h)
Sprint 3 (2–3 semanas): Voz (opcional), hardening segurança (rate limit, masking), melhoria UX. (25–35h)

Modelos de contratação para evolução:
- Pacote “Refino MVP” (Sprints 1+2 resumidos): 50–55h → **R$ 1.250 – R$ 1.650** (R$25–30/h).
- Retainer Evolução (24–32h/mês): **R$ 600 – R$ 960/mês** (R$25–30/h).
- Horas avulsas (prioridades pequenas): **R$ 25 – R$ 30/h** (mínimo de 10h/mês).

Critérios de aceite (exemplos):
- Respostas padronizadas com voz do doutor ≥ 80% aprovadas.
- Painel exibindo contagem diária de sessões e chamadas IA.
- Latência média de geração ≤ limiar definido.

## 4. Novo Projeto – Plataforma Multi‑Planos com IA
Objetivo: Ambiente de aprendizagem com três níveis de acesso (Free, Círculo Implicado, Círculo Integral), recomendação de conteúdo guiada por IA, agendamento de consultorias, mensagens diretas e mecanismo de upgrade.

### Principais Módulos (NestJS)
1. Auth & Users: Registro, login, refresh tokens, roles (free | implicado | integral).
2. Plans & Billing: Stripe (produtos, preços, webhooks) → atualização de role automática.
3. Content: CRUD conteúdo (vídeo, texto, áudio, tags, trilha), indexação embeddings.
4. AI Orchestrator: Classificação de intenção + seleção de conteúdo + geração de resposta híbrida.
5. Consumption & Feedback: Registro de visualizações, exercícios, avaliações.
6. Consultations: Controle de quota, agendamento via Google Calendar API.
7. Messaging: Formulário assíncrono, fila de respostas, status.
8. Upgrade Engine: Regras para sugerir migração de plano quando conteúdo restrito detectado.
9. Metrics & Logs: Coleta estruturada (pino), exportação básica para análise.

### Frontend (Next.js)
- App Router, SSR/ISR para páginas públicas (/convite, /inicio, /planos).
- Área autenticada com React Query, layout adaptativo, componente de “IA Guardiã” no canto.
- Painel usuário: histórico de consumo, recomendações, contador de consultorias restantes.

## 5. Arquitetura Técnica Resumida
- Banco: Postgres (Supabase ou RDS) + pgvector para embeddings.
- Deploy: Vercel (frontend) + Render/Fly/Railway (Nest) + Supabase (DB).
- Integrações: Stripe (checkout, webhooks), Google Calendar (service account), provider IA (Gemini/OpenAI), serviço e‑mail (Resend/SendGrid).
- Segurança: JWT + rate limiting (por IP + usuário), validação Zod, auditoria upgrades.

## 6. Fases e Cronograma (Valores Reduzidos)
Fase A – Fundamentos (Auth, Roles, Stripe base, Content CRUD, estrutura AI mínima) – 2–3 semanas (50–60h).
Fase B – Recomendação IA + Consumo + Feedback + Mensagens – 3–4 semanas (55–70h).
Fase C – Consultorias (quota + agendamento) + Add‑On de sessões – 2–3 semanas (40–50h).
Fase D – Personalização avançada + métricas + otimizações + polimento UX – 2–3 semanas (35–45h).

## 7. Precificação Ajustada (Perfil Júnior – Reduzida)
Valores por fase (faixa acessível):
- Fase A (50–60h): **R$ 1.250 – R$ 1.800**
- Fase B (55–70h): **R$ 1.375 – R$ 2.100**
- Fase C (40–50h): **R$ 1.000 – R$ 1.500**
- Fase D (35–45h): **R$ 875 – R$ 1.350**

Total estimado (intervalo): **R$ 4.500 – R$ 6.750**.
- Pacote completo à vista (desconto ~5–7%): **R$ 4.200 – R$ 6.300**.
- Pagamento fase a fase: 40% início da fase + 60% na aprovação de critérios de aceite.

Modelo por hora (caso preferência): **R$ 25 – R$ 30/h** (estimativa total 190–225h → **R$ 4.750 – R$ 6.750**, teto controlado pelo cliente).

## 8. Retainer Pós‑Lançamento (Nova Plataforma)
- Manutenção leve (12–16h/mês): **R$ 300 – R$ 480/mês** (R$25–30/h).
- Evolução contínua (24–32h/mês + refinamentos IA): **R$ 600 – R$ 960/mês** (R$25–30/h).
- Pacote trimestral de otimização (priorizar conversão e recomendação): valor negociado com base em métricas iniciais.

## 9. Entregáveis e Critérios de Aceite
Por fase incluem:
- Código versionado (Git) + README instalação.
- Diagrama de arquitetura (mermaid ou PlantUML) atualizado.
- Migrações DB reprodutíveis.
- Testes mínimos (Auth, upgrade plano, recomendação IA, quota consultorias).
- Checklist segurança (tokens, rate limit, sanitização).
- Critérios de aceite específicos (ex.: Fase B: recomendação retorna ≥2 itens relevantes com feedback armazenado).

## 10. Exclusões e Responsabilidades
Cliente / Doutor:
- Fornecer conteúdo validado (vídeos, textos, tags) e aprovar diretrizes de voz.
- Validar persona e tom das respostas (não é diagnóstico médico).

Desenvolvedor:
- Implementar tecnologia, integrações e ajustes de UX acordados.
- Sugerir melhorias de fluxo e otimizações de custo IA.

Exclusões (fora do escopo base):
- Criação de conteúdo original médico.
- Suporte 24/7 ou garantia de disponibilidade clínica.
- Infra avançada multi‑região / autoscaling complexo.

## 11. Riscos e Mitigações
- Atraso na entrega de conteúdo: uso de placeholders + tags neutras.
- Escopo crescente: registro de change requests; >10% horas adicionais reorçam valor.
- Custos IA elevados: caching resultados, resumo de trechos, limite de tokens por requisição.
- Qualidade de recomendação inicial baixa: fase de ajuste com coleta de feedback (campo “ajudou” / “não ajudou”).

## 12. Próximos Passos
1. Confirmação da venda do estado atual (assistente RAG) e forma de pagamento.
2. Escolha entre: Evolução imediata do assistente ou início da Fase A da nova plataforma.
3. Assinatura de aceite / minicontrato (escopo + valores + prazos).
4. Kickoff técnico (definir prioridades iniciais e convenções de conteúdo).
5. Execução fase 1 e revisão conjunta.

## 13. Resumo Executivo de Valores
- Estado atual assistente: **R$ 3.200** (R$ 3.000 à vista).
- Refino MVP assistente (opção rápida, 50–55h): **R$ 1.250 – R$ 1.650**.
- Nova plataforma completa (reduzida): **R$ 4.500 – R$ 6.750** (ou pacote à vista **R$ 4.200 – R$ 6.300**).
- Valor hora júnior para extras: **R$ 25 – R$ 30/h**.
- Retainers: manutenção **R$ 300 – R$ 480/mês** / evolução **R$ 600 – R$ 960/mês**.

## 14. Observações Finais
Os valores refletem equilíbrio entre acessibilidade e o nível de complexidade das integrações (IA, Stripe, Calendar, vetores, quotas). Ajustes finos podem ocorrer após levantamento detalhado de conteúdo e regras de recomendação.

---
Preparado por: Desenvolvedor (Perfil Júnior)
Data: {{14/11/2025}}
Contato: (inserir email/whatsapp)

Esta proposta é válida por 30 dias a partir da data acima.
