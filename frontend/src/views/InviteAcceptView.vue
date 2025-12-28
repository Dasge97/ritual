<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiFetch } from "../api";

const route = useRoute();
const router = useRouter();

const token = computed(() => String(route.params.token || ""));
const loading = ref(false);
const error = ref("");

async function accept() {
  loading.value = true;
  error.value = "";
  try {
    const data = await apiFetch("/api/groups/invites/accept", {
      method: "POST",
      body: { token: token.value }
    });
    router.replace(`/groups/${data.groupId}`);
  } catch (e) {
    error.value = e.message || "No se pudo aceptar la invitación";
  } finally {
    loading.value = false;
  }
}

onMounted(accept);
</script>

<template>
  <div class="card" style="max-width: 620px; margin: 0 auto">
    <h2 style="margin-top: 0">Aceptar invitación</h2>
    <p class="muted">Uniéndote al grupo…</p>
    <div v-if="loading" class="muted">Procesando…</div>
    <div v-if="error" style="color: var(--danger)">{{ error }}</div>
    <div class="row" style="justify-content: flex-end; margin-top: 12px">
      <RouterLink class="btn" to="/groups">Ir a grupos</RouterLink>
    </div>
  </div>
</template>
