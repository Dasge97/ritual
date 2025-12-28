<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { apiFetch } from "../api";

const route = useRoute();
const groupId = computed(() => route.params.groupId);

const group = ref(null);
const members = ref([]);
const myThings = ref([]);
const ritual = ref(null);

const inviteEmail = ref("");
const lastInviteLink = ref("");
const inviteNote = ref("");

const thingText = ref("");
const thingType = ref("anecdote");
const emotionalWeight = ref("normal");

const editId = ref(null);
const editText = ref("");
const editType = ref("anecdote");
const editWeight = ref("normal");

const error = ref("");
const loading = ref(false);

function weightClass(w) {
  if (w === "important") return "w-important";
  if (w === "difficult") return "w-difficult";
  return "w-normal";
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

function ritualStatusLabel(status) {
  if (status === "voting") return "votación";
  if (status === "active") return "activo";
  if (status === "paused") return "en pausa";
  if (status === "completed") return "completado";
  return status;
}

async function loadAll() {
  error.value = "";
  loading.value = true;
  try {
    const data = await apiFetch(`/api/groups/${groupId.value}`);
    group.value = data.group;
    members.value = data.members;
    ritual.value = data.ritual || null;

    const mine = await apiFetch(`/api/groups/${groupId.value}/my-things`);
    myThings.value = mine.things || [];
  } catch (e) {
    error.value = e.message || "No se pudo cargar el grupo";
  } finally {
    loading.value = false;
  }
}

async function invite() {
  error.value = "";
  lastInviteLink.value = "";
  inviteNote.value = "";
  try {
    const data = await apiFetch(`/api/groups/${groupId.value}/invite`, {
      method: "POST",
      body: { email: inviteEmail.value.trim() }
    });

    if (data?.inviteLink) lastInviteLink.value = data.inviteLink;
    if (data?.pendingInvite && !data?.inviteLink)
      inviteNote.value = data.message || "Invitación pendiente";
    if (data?.alreadyMember) inviteNote.value = "El usuario ya es miembro";

    inviteEmail.value = "";
    await loadAll();
  } catch (e) {
    error.value = e.message || "No se pudo invitar";
  }
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(lastInviteLink.value);
    inviteNote.value = "Copiado";
  } catch {
    inviteNote.value = "No se pudo copiar";
  }
}

async function addThing() {
  error.value = "";
  try {
    await apiFetch(`/api/groups/${groupId.value}/things`, {
      method: "POST",
      body: { text: thingText.value, type: thingType.value, emotionalWeight: emotionalWeight.value }
    });
    thingText.value = "";
    await loadAll();
  } catch (e) {
    error.value = e.message || "No se pudo añadir";
  }
}

function startEdit(t) {
  editId.value = t.id;
  editText.value = t.text;
  editType.value = t.type;
  editWeight.value = t.emotionalWeight;
}

function cancelEdit() {
  editId.value = null;
  editText.value = "";
}

async function saveEdit() {
  error.value = "";
  try {
    await apiFetch(`/api/things/${editId.value}`, {
      method: "PUT",
      body: { text: editText.value, type: editType.value, emotionalWeight: editWeight.value }
    });
    cancelEdit();
    await loadAll();
  } catch (e) {
    error.value = e.message || "No se pudo guardar";
  }
}

async function removeThing(id) {
  error.value = "";
  try {
    await apiFetch(`/api/things/${id}`, { method: "DELETE" });
    await loadAll();
  } catch (e) {
    error.value = e.message || "No se pudo eliminar";
  }
}

onMounted(loadAll);
</script>

<template>
  <div v-if="loading" class="muted">Cargando…</div>
  <div v-else-if="!group" class="muted">Grupo no encontrado.</div>
  <div v-else class="row" style="align-items: flex-start">
    <div style="flex: 1; min-width: 320px; display: grid; gap: 12px">
      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center">
          <div>
            <h2 style="margin: 0">{{ group.name }}</h2>
            <div class="muted" style="font-size: 12px">Sin vistas previas. Solo recuentos.</div>
            <div v-if="ritual" class="muted" style="font-size: 12px; margin-top: 6px">
              Ritual: {{ ritualStatusLabel(ritual.session.status) }} ·
              <span v-if="ritual.session.totalPositions">
                {{ ritual.session.currentPosition }}/{{ ritual.session.totalPositions }}
              </span>
              <span v-else>—</span>
              · Sí {{ ritual.voting.yesVotes }}/{{ ritual.voting.totalMembers }}
            </div>
          </div>
          <div class="row">
            <RouterLink class="btn" :to="`/groups/${groupId}/history`">Historial</RouterLink>
            <RouterLink class="btn primary" :to="`/groups/${groupId}/ritual`">Modo ritual</RouterLink>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">Miembros</h3>
        <div style="display: grid; gap: 10px">
          <div
            v-for="m in members"
            :key="m.id"
            class="row"
            style="justify-content: space-between; align-items: center"
          >
            <div class="row" style="align-items: center">
              <span class="weightDot" :class="weightClass(m.pendingWeight || 'normal')" />
              <div>
                <div style="font-weight: 600">{{ m.nickname }}</div>
                <div class="muted" style="font-size: 12px">{{ m.pendingCount }} pendientes</div>
              </div>
            </div>
            <span class="pill">{{ m.pendingCount }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">Añadir algo para contar</h3>
        <div class="field">
          <div class="label">Texto (oculto hasta el ritual)</div>
          <textarea v-model="thingText" placeholder="Escríbelo ahora. Cuéntalo después." />
        </div>
        <div class="row">
          <div style="flex: 1; min-width: 180px">
            <div class="field">
              <div class="label">Tipo</div>
              <select v-model="thingType">
                <option value="anecdote">anécdota</option>
                <option value="important">importante</option>
                <option value="difficult">difícil</option>
              </select>
            </div>
          </div>
          <div style="flex: 1; min-width: 180px">
            <div class="field">
              <div class="label">Peso emocional</div>
              <select v-model="emotionalWeight">
                <option value="normal">normal</option>
                <option value="important">importante</option>
                <option value="difficult">difícil</option>
              </select>
            </div>
          </div>
        </div>
        <button class="btn primary" @click="addThing" :disabled="!thingText.trim()">Añadir</button>
        <p class="muted" style="font-size: 12px; margin-bottom: 0">
          Los demás solo ven tu recuento y el peso — no el contenido.
        </p>
      </div>
    </div>

    <div style="width: 360px; display: grid; gap: 12px">
      <div class="card">
        <h3 style="margin-top: 0">Invitar</h3>
        <div class="field">
          <div class="label">Email del usuario</div>
          <input v-model="inviteEmail" type="email" placeholder="amigo@mail.com" />
        </div>
        <button class="btn" @click="invite" :disabled="!inviteEmail.trim()">Invitar</button>
        <p class="muted" style="font-size: 12px; margin-bottom: 0">
          Cualquier miembro puede invitar. Límite: 20 miembros.
        </p>
        <div v-if="lastInviteLink" class="card" style="margin-top: 12px">
          <div class="muted" style="font-size: 12px">Enlace de invitación (compártelo):</div>
          <div style="word-break: break-all; margin-top: 6px">{{ lastInviteLink }}</div>
          <div class="row" style="justify-content: flex-end; margin-top: 10px">
            <button class="btn" @click="copyInvite">Copiar</button>
          </div>
        </div>
        <div v-if="inviteNote" class="muted" style="font-size: 12px; margin-top: 10px">
          {{ inviteNote }}
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">Mis pendientes (editables)</h3>

        <div v-if="editId" class="card" style="margin-bottom: 10px">
          <div class="field">
            <div class="label">Editar texto</div>
            <textarea v-model="editText" />
          </div>
          <div class="row">
            <select v-model="editType">
              <option value="anecdote">anécdota</option>
              <option value="important">importante</option>
              <option value="difficult">difícil</option>
            </select>
            <select v-model="editWeight">
              <option value="normal">normal</option>
              <option value="important">importante</option>
              <option value="difficult">difícil</option>
            </select>
          </div>
          <div class="row" style="justify-content: flex-end; margin-top: 10px">
            <button class="btn" @click="cancelEdit">Cancelar</button>
            <button class="btn primary" @click="saveEdit" :disabled="!editText.trim()">Guardar</button>
          </div>
        </div>

        <div v-if="myThings.length === 0" class="muted">No tienes pendientes.</div>
        <div v-else style="display: grid; gap: 10px">
          <div v-for="t in myThings" :key="t.id" class="card">
            <div class="row" style="justify-content: space-between; align-items: center">
              <span class="pill">{{ typeLabel(t.type) }} · {{ emotionalWeightLabel(t.emotionalWeight) }}</span>
              <div class="row">
                <button class="btn" @click="startEdit(t)">Editar</button>
                <button class="btn danger" @click="removeThing(t.id)">Eliminar</button>
              </div>
            </div>
            <div style="white-space: pre-wrap; margin-top: 10px">{{ t.text }}</div>
          </div>
        </div>
      </div>

      <div class="card" style="opacity: 0.7">
        <h3 style="margin-top: 0">Logros (desactivado)</h3>
        <div class="muted" style="font-size: 12px">
          Preparado para más adelante, no forma parte de este MVP.
        </div>
      </div>

      <p v-if="error" style="color: var(--danger); margin: 0">{{ error }}</p>
    </div>
  </div>
</template>
