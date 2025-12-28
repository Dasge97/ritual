# Ritual (MVP)

App social minimalista para grupos pequeños: escribís “cosas para contar” que se mantienen ocultas hasta que os veis en persona y activáis el modo ritual.

## Ejecutar en local (Docker)

Requisitos: Docker Desktop con `docker compose`.

```bash
docker compose -f docker-compose.local.yml up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/api/health`
- MySQL: `localhost:3306` (db `ritual`, user `app`, pass `apppass`)

## Despliegue (Traefik)

El `docker-compose.yml` está preparado para funcionar como el ejemplo que me pasaste (Traefik + red `web` externa + `internal` privada).

1) Crea un `.env` en el servidor basándote en `.env.deploy.example`.
2) Asegúrate de que existe la red externa de Traefik (`web`).
3) Levanta servicios:

```bash
docker compose up -d --build
```

## Notas del MVP

- Auth: JWT (guardado en localStorage en el navegador).
- “Cosas para contar”: ocultas para otros mientras `pending` (en el grupo solo se ven recuentos + indicador de peso).
- Modo ritual:
  - Empieza con una votación y se activa con mayoría simple.
  - El orden de revelado se fija al activarse.
  - El texto solo se revela al marcarlo como “contado”.
  - Se puede pausar y reanudar.
  - Actualización en vivo: SSE + polling de respaldo.
- Historial: solo dentro de cada grupo.
- Invitaciones:
  - Si el email ya existe, se añade al grupo.
  - Si no existe, se genera enlace `/invites/:token` para que lo acepte al registrarse/iniciar sesión.

## Troubleshooting

- Si cambias el esquema SQL y ya tienes volumen MySQL de antes:
  - `docker compose -f docker-compose.local.yml down -v`
  - `docker compose -f docker-compose.local.yml up --build`
