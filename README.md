# Ritual (MVP) — Despliegue

App social minimalista para grupos pequeños: escribís “cosas para contar” que se mantienen ocultas hasta que os veis en persona y activáis el modo ritual.

## Despliegue (Traefik)

Este repositorio está ajustado para despliegue detrás de Traefik (red externa `web` + red interna `internal`).

1) Crea un `.env` en el servidor basándote en `.env.deploy.example`.
2) Asegúrate de que existe la red externa de Traefik:

```bash
docker network create web
```

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
