<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api";
import { setAuth } from "../stores/auth";

const router = useRouter();

const name = ref("");
const nickname = ref("");
const email = ref("");
const password = ref("");
const avatarUrl = ref("");
const avatarFile = ref(null);

const error = ref("");
const loading = ref(false);

function onFile(e) {
  avatarFile.value = e.target.files?.[0] || null;
}

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    const form = new FormData();
    form.append("name", name.value);
    form.append("nickname", nickname.value);
    form.append("email", email.value);
    form.append("password", password.value);
    if (avatarUrl.value) form.append("avatarUrl", avatarUrl.value);
    if (avatarFile.value) form.append("avatar", avatarFile.value);

    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: form,
      isForm: true
    });
    setAuth(data);
    const next = router.currentRoute.value.query?.next;
    router.push(typeof next === "string" ? next : "/groups");
  } catch (e) {
    error.value = e.message || "No se pudo crear la cuenta";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="card" style="max-width: 620px; margin: 0 auto">
    <h2 style="margin-top: 0">Crear cuenta</h2>
    <div class="row">
      <div style="flex: 1; min-width: 240px">
        <div class="field">
          <div class="label">Nombre</div>
          <input v-model="name" type="text" autocomplete="name" />
        </div>
        <div class="field">
          <div class="label">Apodo (se muestra en toda la app)</div>
          <input v-model="nickname" type="text" autocomplete="nickname" />
        </div>
        <div class="field">
          <div class="label">Correo electrónico</div>
          <input v-model="email" type="email" autocomplete="email" />
        </div>
        <div class="field">
          <div class="label">Contraseña</div>
          <input v-model="password" type="password" autocomplete="new-password" />
        </div>
      </div>
      <div style="flex: 1; min-width: 240px">
        <div class="field">
          <div class="label">URL del avatar (opcional)</div>
          <input v-model="avatarUrl" type="url" placeholder="https://..." />
        </div>
        <div class="field">
          <div class="label">O sube un avatar (opcional)</div>
          <input type="file" accept="image/*" @change="onFile" />
          <div class="muted" style="font-size: 12px">Máx. 2MB</div>
        </div>
      </div>
    </div>
    <div class="row" style="justify-content: space-between; align-items: center">
      <RouterLink to="/login" class="muted">Ya tengo una cuenta</RouterLink>
      <button class="btn primary" :disabled="loading" @click="onSubmit">Crear</button>
    </div>
    <p v-if="error" style="color: var(--danger); margin-bottom: 0">{{ error }}</p>
  </div>
</template>
