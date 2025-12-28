<script setup>
import { onMounted, ref } from "vue";
import { apiFetch } from "../api";

const groups = ref([]);
const name = ref("");
const error = ref("");
const loading = ref(false);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    const data = await apiFetch("/api/groups");
    groups.value = data.groups || [];
  } catch (e) {
    error.value = e.message || "No se pudieron cargar los grupos";
  } finally {
    loading.value = false;
  }
}

async function createGroup() {
  error.value = "";
  if (!name.value.trim()) return;
  try {
    await apiFetch("/api/groups", { method: "POST", body: { name: name.value.trim() } });
    name.value = "";
    await load();
  } catch (e) {
    error.value = e.message || "No se pudo crear el grupo";
  }
}

onMounted(load);
</script>

<template>
  <div class="row" style="align-items: flex-start">
    <div class="card" style="flex: 1; min-width: 280px">
      <h2 style="margin-top: 0">Tus grupos</h2>
      <div v-if="loading" class="muted">Cargando…</div>
      <div v-else-if="groups.length === 0" class="muted">Aún no tienes grupos.</div>
      <div v-else style="display: grid; gap: 10px">
        <RouterLink
          v-for="g in groups"
          :key="g.id"
          :to="`/groups/${g.id}`"
          class="card"
          style="display: flex; justify-content: space-between; align-items: center"
        >
          <div>
            <div style="font-weight: 600">{{ g.name }}</div>
            <div class="muted" style="font-size: 12px">
              {{ g.memberCount }} miembros · {{ g.myPendingCount }} pendientes tuyos
            </div>
          </div>
          <span class="pill">Abrir</span>
        </RouterLink>
      </div>
      <p v-if="error" style="color: var(--danger); margin-bottom: 0">{{ error }}</p>
    </div>
    <div class="card" style="width: 320px">
      <h3 style="margin-top: 0">Crear grupo</h3>
      <div class="field">
        <div class="label">Nombre del grupo</div>
        <input v-model="name" type="text" placeholder="Amigos del finde" />
      </div>
      <button class="btn primary" @click="createGroup">Crear</button>
      <p class="muted" style="font-size: 12px; margin-bottom: 0">Límite: 20 grupos por usuario.</p>
    </div>
  </div>
</template>
