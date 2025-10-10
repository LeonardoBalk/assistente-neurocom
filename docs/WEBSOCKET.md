# WebSocket

A infraestrutura de WS é criada em `src/server.js` com `createRealtimeWSS(server)`.

## Conexão
- URL: `wss://<seu-serviço>` (mesma origem do HTTP)
- Autenticação: envie JWT como query (?token=...) ou mensagem inicial
- Exemplo (browser):
```js
const ws = new WebSocket(`wss://api.example.com?token=${token}`);
ws.onopen = () => ws.send(JSON.stringify({ type: "join", sessionId: "uuid" }));
ws.onmessage = (e) => console.log("msg:", e.data);
ws.onclose = () => console.log("closed");
```

## Eventos sugeridos
- join
  ```json
  { "type": "join", "sessionId": "uuid" }
  ```
- message
  ```json
  { "type": "message", "sessionId": "uuid", "text": "olá" }
  ```
- leave
  ```json
  { "type": "leave", "sessionId": "uuid" }
  ```
- server-broadcast (enviado pelo servidor)
  ```json
  { "type": "server-broadcast", "event": "joined", "sessionId": "uuid", "userId": 1 }
  ```

Ajuste os tipos conforme sua implementação em `src/ws/realtime.js`. Recomendado:
- Validar JWT antes de aceitar eventos
- Limitar tamanho de mensagens
- Fechar conexão em inatividade prolongada