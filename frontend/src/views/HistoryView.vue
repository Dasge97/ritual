<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { apiFetch } from "../api";

const route = useRoute();
const groupId = computed(() => route.params.groupId);

const sessions = ref([]);
const error = ref("");
const loading = ref(false);

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
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

async function load() {
  error.value = "";
  loading.value = true;
  try {
    const data = await apiFetch(`/api/groups/${groupId.value}/history`);
    sessions.value = data.sessions || [];
  } catch (e) {
    error.value = e.message || "No se pudo cargar el historial";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="card">
    <div class="row" style="justify-content: space-between; align-items: center">
      <div>
        <h2 style="margin: 0">Historial</h2>
        <div class="muted" style="font-size: 12px">Solo dentro de este grupo.</div>
      </div>
      <RouterLink class="btn" :to="`/groups/${groupId}`">Volver</RouterLink>
    </div>
  </div>

  <div v-if="loading" class="muted" style="margin-top: 12px">Cargando…</div>
  <div v-else-if="sessions.length === 0" class="card" style="margin-top: 12px">
    <div class="muted">Aún no hay rituales.</div>
  </div>
  <div v-else style="display: grid; gap: 12px; margin-top: 12px">
    <div v-for="s in sessions" :key="s.ritualSessionId" class="card">
      <div class="row" style="justify-content: space-between; align-items: center">
        <div style="font-weight: 600">Ritual</div>
        <span class="pill">{{ fmtDate(s.ritualDate) }}</span>
      </div>

      <div style="display: grid; gap: 12px; margin-top: 12px">
        <div v-for="it in s.items" :key="it.position" class="card">
          <div class="row" style="justify-content: space-between; align-items: center">
            <div>
              <div style="font-weight: 600">{{ it.authorNickname }}</div>
              <div class="muted" style="font-size: 12px">
                esperó {{ it.waitedDays }} días · {{ typeLabel(it.type) }} ·
                {{ emotionalWeightLabel(it.emotionalWeight) }}
              </div>
            </div>
            <span class="pill">contado</span>
          </div>
          <div style="white-space: pre-wrap; margin-top: 12px">{{ it.text }}</div>
        </div>
      </div>
    </div>
  </div>

  <p v-if="error" style="color: var(--danger)">{{ error }}</p>
</template>
