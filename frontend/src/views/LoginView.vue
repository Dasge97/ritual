<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api";
import { setAuth } from "../stores/auth";

const router = useRouter();
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: { email: email.value, password: password.value }
    });
    setAuth(data);
    const next = router.currentRoute.value.query?.next;
    router.push(typeof next === "string" ? next : "/groups");
  } catch (e) {
    error.value = e.message || "No se pudo iniciar sesión";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="card" style="max-width: 520px; margin: 0 auto">
    <h2 style="margin-top: 0">Entrar</h2>
    <p class="muted">Sin feed. Sin chat. Solo lo que contarás cuando os veáis.</p>
    <div class="field">
      <div class="label">Correo electrónico</div>
      <input v-model="email" type="email" autocomplete="email" />
    </div>
    <div class="field">
      <div class="label">Contraseña</div>
      <input v-model="password" type="password" autocomplete="current-password" />
    </div>
    <div class="row" style="justify-content: space-between; align-items: center">
      <RouterLink to="/register" class="muted">Crear cuenta</RouterLink>
      <button class="btn primary" :disabled="loading" @click="onSubmit">Entrar</button>
    </div>
    <p v-if="error" style="color: var(--danger); margin-bottom: 0">{{ error }}</p>
  </div>
</template>
