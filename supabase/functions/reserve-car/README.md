# `reserve-car`

Cria uma reserva e o bloqueio do veículo em uma única transação Postgres.

## Concorrência e idempotência

A RPC `reserve_car_atomic` usa um advisory lock transacional por veículo e
também bloqueia a linha de `veiculos` com `FOR UPDATE`. Depois do lock, ela
repete a consulta de sobreposição usando intervalos semiabertos `[start, end)`.
A constraint GiST em `car_blocks` funciona como última barreira contra corridas.

Cada usuário precisa enviar `Idempotency-Key`. A combinação usuário/chave é
única, protegida por outro advisory lock. Repetir a mesma chave e o mesmo
payload retorna exatamente a reserva anterior; reutilizar a chave com outro
payload retorna validação inválida.

## Exemplo

```http
POST /functions/v1/reserve-car HTTP/1.1
Authorization: Bearer <JWT_DO_USUARIO>
apikey: <CHAVE_PUBLICAVEL>
Idempotency-Key: checkout-20260812-001
Content-Type: application/json

{
  "car_id": "8ebcac21-d8c3-4f25-a87c-14a2a7280ef8",
  "start_at": "2026-08-20T12:00:00-03:00",
  "end_at": "2026-08-22T12:00:00-03:00",
  "pickup_location_id": "f5e0ae54-54ea-4f4d-a908-d8ed15c97c35",
  "dropoff_location_id": "f5e0ae54-54ea-4f4d-a908-d8ed15c97c35",
  "notes": "Retirada após o almoço."
}
```

Resposta `201 Created`:

```json
{
  "reservation_id": "b8aa8164-78f2-4bb4-ac3d-f4020817958d",
  "car_id": "8ebcac21-d8c3-4f25-a87c-14a2a7280ef8",
  "start_at": "2026-08-20T15:00:00+00:00",
  "end_at": "2026-08-22T15:00:00+00:00",
  "status": "pending"
}
```

Resposta `409 Conflict`:

```json
{
  "error": "CAR_UNAVAILABLE",
  "details": {
    "requested_window": {
      "start_at": "2026-08-20T15:00:00.000Z",
      "end_at": "2026-08-22T15:00:00.000Z"
    }
  }
}
```

O endpoint não registra JWTs, chaves ou dados sensíveis nos logs.
