<script setup>
import AppLayout from "@/components/layout/AppLayout.vue";

const sections = [
  {
    title: "Core Modules",
    links: [
      {
        label: "Symmetry",
        description: "Symmetry elements and symmetry operations.",
        to: "/symmetry-elements"
      },
      {
        label: "Point Groups",
        description: "Point-group decision flow.",
        to: "/flowchart"
      },
      {
        label: "Quiz",
        description: "Random point-group challenge.",
        to: "/quiz"
      }
    ]
  }
];
</script>

<template>
  <AppLayout>
    <template #sidebar>
      <div class="app-sidebar">
        <RouterLink to="/" class="brand-card">
          <span class="brand-kicker">Visualizing</span>
          <strong class="brand-title">Molecular Point Groups</strong>
          <span class="brand-subtitle">
            Explore (1) Symmetry elements and symmetry operations (2) Classification of point groups and their decision flow.
          </span>
        </RouterLink>

        <nav class="sidebar-nav" aria-label="Project navigation">
          <section
            v-for="section in sections"
            :key="section.title"
            class="sidebar-group"
          >
            <p class="sidebar-group-title">{{ section.title }}</p>

            <RouterLink
              v-for="link in section.links"
              :key="`${section.title}-${link.label}`"
              :to="link.to"
              class="sidebar-link"
            >
              <span class="sidebar-link-copy">
                <span class="sidebar-link-label">{{ link.label }}</span>
                <span class="sidebar-link-description">{{ link.description }}</span>
              </span>
              <span class="sidebar-link-arrow">></span>
            </RouterLink>
          </section>
        </nav>
      </div>
    </template>

    <template #content>
      <RouterView />
    </template>
  </AppLayout>
</template>

<style scoped>
.app-sidebar {
  display: grid;
  gap: 1rem;
  padding-top: 3.5rem;
}

.brand-card {
  display: grid;
  gap: 0.45rem;
  padding: 1.25rem;
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at top left, rgba(84, 110, 255, 0.18), transparent 38%),
    radial-gradient(circle at bottom right, rgba(214, 40, 57, 0.16), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 247, 250, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
}

.brand-kicker {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #d62839;
}

.brand-title {
  font-size: 1.58rem;
  line-height: 1.1;
  color: #111827;
}

.brand-subtitle {
  font-size: 0.95rem;
  line-height: 1.62;
  color: #4b5563;
}

.sidebar-nav {
  display: grid;
  gap: 1rem;
}

.sidebar-group {
  display: grid;
  gap: 0.65rem;
  padding: 0.95rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.sidebar-group-title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #6b7280;
}

.sidebar-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border-radius: 0.95rem;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.92);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.sidebar-link:hover {
  transform: translateY(-1px);
  border-color: rgba(191, 219, 254, 0.95);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}

.sidebar-link.router-link-exact-active {
  border-color: rgba(147, 197, 253, 0.9);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(219, 234, 254, 0.9));
  box-shadow: 0 14px 28px rgba(59, 130, 246, 0.14);
}

.sidebar-link-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.sidebar-link-label {
  font-size: 0.98rem;
  font-weight: 700;
  color: #111827;
}

.sidebar-link-description {
  font-size: 0.85rem;
  line-height: 1.45;
  color: #6b7280;
}

.sidebar-link-arrow {
  font-size: 1rem;
  color: #9ca3af;
  transition: transform 0.2s ease, color 0.2s ease;
}

.sidebar-link:hover .sidebar-link-arrow,
.sidebar-link.router-link-exact-active .sidebar-link-arrow {
  color: #2563eb;
  transform: translateX(2px);
}
</style>
