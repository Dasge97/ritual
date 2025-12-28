import { createRouter, createWebHistory } from "vue-router";
import { getAuthToken } from "./stores/auth";

import LoginView from "./views/LoginView.vue";
import RegisterView from "./views/RegisterView.vue";
import GroupsView from "./views/GroupsView.vue";
import GroupView from "./views/GroupView.vue";
import RitualView from "./views/RitualView.vue";
import HistoryView from "./views/HistoryView.vue";
import InviteAcceptView from "./views/InviteAcceptView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/groups" },
    { path: "/login", component: LoginView },
    { path: "/register", component: RegisterView },
    { path: "/invites/:token", component: InviteAcceptView, meta: { requiresAuth: true } },
    { path: "/groups", component: GroupsView, meta: { requiresAuth: true } },
    { path: "/groups/:groupId", component: GroupView, meta: { requiresAuth: true } },
    { path: "/groups/:groupId/ritual", component: RitualView, meta: { requiresAuth: true } },
    { path: "/groups/:groupId/history", component: HistoryView, meta: { requiresAuth: true } }
  ]
});

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true;
  const token = getAuthToken();
  if (!token) return { path: "/login", query: { next: to.fullPath } };
  return true;
});

export default router;
