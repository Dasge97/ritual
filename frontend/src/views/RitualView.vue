<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useRoute } from "vue-router";
import { apiFetch } from "../api";
import { subscribeRitualEvents } from "../sse";

const route = useRoute();
const groupId = computed(() => route.params.groupId);

const state = ref(null);
const current = ref(null);
const loading = ref(false);
const error = ref("");
const myVote = ref(null);

const revealedText = ref("");
const closure = ref(null);

let subscription = null;
let pollId = null;

function statusLabel(status) {
  if (status === "voting") return "votación";
  if (status === "active") return "activo";
  if (status === "paused") return "en pausa";
  if (status === "completed") return "completado";
  return status;
}

function typeLabel(type) {
  if (type === "anecdote") return "anécdota";
  if (type === "important") return "importante";
  if (type === "difficult") return "difícil";
  return type;
}

function emotionalWeightLabel(weight) {
  if (weight === "normal") return "normal";
  if (weight === "important") return "importante";
  if (weight === "difficult") return "difícil";
  return weight;
}

async function refreshOnce() {
  const data = await apiFetch(`/api/groups/${groupId.value}/rituals/state`);
  state.value = data;
  myVote.value = data?.voting?.myVote ?? null;
  if (data?.session?.status === "active" || data?.session?.status === "paused") {
    const cur = await apiFetch(`/api/groups/${groupId.value}/rituals/current`);
    current.value = cur.current;
  } else {
    current.value = null;
  }
}

async function refresh() {
  error.value = "";
  try {
    await refreshOnce();
  } catch (e) {
    error.value = e.message || "No se pudo actualizar";
  }
}

async function startVote() {
  error.value = "";
  try {
    await apiFetch(`/api/groups/${groupId.value}/rituals/start-vote`, { method: "POST" });
    await refresh();
  } catch (e) {
    error.value = e.message || "No se pudo iniciar";
  }
}

async function vote(vote) {
  error.value = "";
  try {
    await apiFetch(`/api/groups/${groupId.value}/rituals/vote`, { method: "POST", body: { vote } });
    await refresh();
  } catch (e) {
    error.value = e.message || "No se pudo votar";
  }
}

async function tellCurrent() {
  error.value = "";
  revealedText.value = "";
  closure.value = null;
  try {
    const data = await apiFetch(`/api/groups/${groupId.value}/rituals/tell-current`, {
      method: "POST"
    });
    revealedText.value = data.revealedText || "";
    if (data.completed) closure.value = data.closure;
    await refresh();
  } catch (e) {
    error.value = e.message || "Error";
  }
}

async function pause() {
  await apiFetch(`/api/groups/${groupId.value}/rituals/pause`, { method: "POST" });
  await refresh();
}
async function resume() {
  await apiFetch(`/api/groups/${groupId.value}/rituals/resume`, { method: "POST" });
  await refresh();
}

onMounted(async () => {
  loading.value = true;
  try {
    await refresh();
    subscription = subscribeRitualEvents(groupId.value, (snapshot) => {
      state.value = { ...snapshot, voting: { ...(snapshot.voting || {}), myVote: myVote.value } };
      current.value = snapshot.current || null;
      if (snapshot?.session?.status === "completed" && snapshot.closure) {
        closure.value = snapshot.closure;
      }
    });
    pollId = setInterval(refresh, 10000);
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  if (subscription) subscription.close();
  if (pollId) clearInterval(pollId);
});
</script>

<template>
  <div class="card">
    <div class="row" style="justify-content: space-between; align-items: center">
      <div>
        <h2 style="margin: 0">Modo ritual</h2>
        <div class="muted" style="font-size: 12px">
          Vota para entrar. Luego se revela uno a uno. El texto aparece solo al marcar como contado.
        </div>
      </div>
      <RouterLink class="btn" :to="`/groups/${groupId}`">Volver</RouterLink>
    </div>
  </div>

  <div v-if="loading" class="muted" style="margin-top: 12px">Cargando…</div>

  <div v-else-if="!state?.session" class="card" style="margin-top: 12px">
    <div class="row" style="justify-content: space-between; align-items: center">
      <div>
        <div style="font-weight: 600">Aún no hay sesión</div>
        <div class="muted" style="font-size: 12px">Inicia una votación cuando estéis juntos.</div>
      </div>
      <button class="btn primary" @click="startVote">Iniciar votación</button>
    </div>
  </div>

  <div v-else style="display: grid; gap: 12px; margin-top: 12px">
    <div class="card" v-if="state.session.status === 'voting'">
      <div class="row" style="justify-content: space-between; align-items: center">
        <div>
          <div style="font-weight: 600">Votación</div>
          <div class="muted" style="font-size: 12px">
            Sí {{ state.voting?.yesVotes }} / {{ state.voting?.totalMembers }} · Hace falta mayoría
          </div>
        </div>
        <div class="row">
          <button class="btn" @click="vote('no')">No</button>
          <button class="btn primary" @click="vote('yes')">Sí</button>
        </div>
      </div>
      <div class="muted" style="margin-top: 10px; font-size: 12px">Tu voto: {{ state.voting?.myVote || '—' }}</div>
    </div>

    <div class="card" v-else-if="state.session.status === 'completed'">
      <div style="font-weight: 600">Sesión completada</div>
      <div class="muted" style="font-size: 12px">Inicia una nueva votación cuando os volváis a ver.</div>
    </div>

    <div class="card" v-else>
      <div class="row" style="justify-content: space-between; align-items: center">
        <div>
          <div style="font-weight: 600">El ritual está {{ statusLabel(state.session.status) }}</div>
          <div class="muted" style="font-size: 12px">Se puede pausar y reanudar.</div>
          <div class="muted" style="font-size: 12px; margin-top: 6px" v-if="state.progress?.totalPositions">
            Progreso: {{ state.progress.currentPosition }}/{{ state.progress.totalPositions }}
          </div>
        </div>
        <div class="row">
          <button class="btn" v-if="state.session.status === 'active'" @click="pause">Pausar</button>
          <button class="btn" v-if="state.session.status === 'paused'" @click="resume">Reanudar</button>
        </div>
      </div>

      <div v-if="closure" class="card" style="margin-top: 12px">
        <div style="font-weight: 600">Cierre</div>
        <div class="muted" style="font-size: 12px">
          Cosas contadas: {{ closure.itemsTold }} · Días desde el último ritual: {{ closure.daysSinceLastRitual ?? '—' }}
        </div>
      </div>

      <div v-else-if="!current" class="muted" style="margin-top: 12px">No hay cosas en esta sesión.</div>

      <div v-else class="card" style="margin-top: 12px">
        <div class="row" style="justify-content: space-between; align-items: center">
          <div>
            <div style="font-weight: 600">{{ current.authorNickname }}</div>
            <div class="muted" style="font-size: 12px">
              Esperó {{ current.waitedDays }} días · {{ typeLabel(current.type) }} ·
              {{ emotionalWeightLabel(current.emotionalWeight) }}
            </div>
          </div>
          <button class="btn primary" @click="tellCurrent" :disabled="state.session.status !== 'active'">
            Marcar como contado
          </button>
        </div>

        <div v-if="revealedText" style="margin-top: 12px; white-space: pre-wrap">
          {{ revealedText }}
        </div>
        <div v-else class="muted" style="margin-top: 12px; font-size: 12px">
          El texto aparece al marcar como contado.
        </div>
      </div>
    </div>

    <p v-if="error" style="color: var(--danger); margin: 0">{{ error }}</p>
  </div>
</template>
