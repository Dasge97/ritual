<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { clearAuth, getCurrentUser } from "./stores/auth";

const route = useRoute();
const router = useRouter();

const user = computed(() => getCurrentUser());
const isRitual = computed(() => route.path.includes("/ritual"));

function logout() {
  clearAuth();
  router.push("/login");
}
</script>

<template>
  <div :class="{ ritualMode: isRitual }">
    <header class="topbar">
      <div class="row" style="align-items: center">
        <div class="brand">
          <RouterLink to="/groups">Ritual</RouterLink>
        </div>
        <div class="muted" v-if="user">{{ user.nickname }}</div>
      </div>
      <div class="row" style="align-items: center">
        <RouterLink class="btn" to="/groups" v-if="user">Grupos</RouterLink>
        <button class="btn" @click="logout" v-if="user">Salir</button>
        <RouterLink class="btn" to="/login" v-else>Entrar</RouterLink>
      </div>
    </header>
    <main class="container">
      <RouterView />
    </main>
  </div>
</template>
