import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  {
    path: "/",
    name: "home",
    component: () => import("@/pages/HomePage.vue"),
    meta: { title: "Visualizing Point Groups" }
  },
  {
    path: "/symmetry-elements",
    name: "symmetry-elements",
    component: () => import("@/pages/SymmetryElementsPage.vue"),
    alias: ["/symmetry"],
    meta: { title: "Symmetry | Visualizing Point Groups" }
  },
  {
    path: "/flowchart",
    name: "point-group-flowchart",
    component: () => import("@/pages/PointGroupFlowchartPage.vue"),
    meta: { title: "Point Groups | Visualizing Point Groups" }
  },
  {
    path: "/quiz",
    name: "point-group-quiz",
    component: () => import("@/pages/PointGroupQuizPage.vue"),
    meta: { title: "Quiz | Visualizing Point Groups" }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = to.meta.title;
  }
});

export default router;
