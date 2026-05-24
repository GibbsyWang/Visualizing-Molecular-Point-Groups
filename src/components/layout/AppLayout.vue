<template>
  <div class="layout" :class="{ 'layout--compact': isCompact, 'layout--resizing': isResizing }">
    <div class="layout-sidebar" v-show="state.showSidebar" :style="sidebarStyle">
      <div class="layout-sidebar-retract">
        <button
          type="button"
          class="layout-toggle-button"
          aria-label="Collapse sidebar"
          @click="handleRetractSidebar"
        >
          <span class="layout-toggle-icon"><</span>
        </button>
      </div>

      <div class="layout-sidebar-content">
        <slot name="sidebar"></slot>
      </div>

      <div
        v-if="!isCompact"
        class="layout-sidebar-resizer"
        @mousedown="handleResizeStart"
      ></div>
    </div>

    <div
      class="layout-content"
      :class="{ 'layout-content--collapsed': !state.showSidebar }"
      :style="contentStyle"
    >
      <div class="layout-content-retract" v-if="!state.showSidebar">
        <button
          type="button"
          class="layout-toggle-button"
          aria-label="Expand sidebar"
          @click="handleRetractSidebar"
        >
          <span class="layout-toggle-icon">></span>
        </button>
      </div>

      <slot name="content"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_CONTENT_WIDTH = 760;
const COMPACT_BREAKPOINT = 1080;

const sidebarWidth = ref(320);
const isCompact = ref(false);
const isResizing = ref(false);

const state = reactive({
  showSidebar: true
});

const sidebarStyle = computed(() =>
  isCompact.value
    ? null
    : state.showSidebar
      ? { width: `${sidebarWidth.value}px` }
      : { width: "0px" }
);

const contentStyle = computed(() =>
  isCompact.value
    ? { minWidth: "0" }
    : {
        minWidth: `${MIN_CONTENT_WIDTH}px`,
        marginLeft: state.showSidebar ? `${sidebarWidth.value}px` : "0"
      }
);

const resetLayoutPosition = () => {
  const layoutEl = document.querySelector(".layout");
  if (layoutEl) {
    layoutEl.scrollLeft = 0;
  }
};

const handleRetractSidebar = () => {
  state.showSidebar = !state.showSidebar;
  nextTick(() => {
    resetLayoutPosition();
  });
};

let resizeStartX = 0;
let resizeStartWidth = 0;

const getLayoutWidth = () => {
  const layoutEl = document.querySelector(".layout");
  return layoutEl ? layoutEl.clientWidth : window.innerWidth;
};

const getSidebarBounds = () => {
  const layoutWidth = getLayoutWidth();
  const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, Math.max(0, layoutWidth - MIN_CONTENT_WIDTH));
  const minAllowed = Math.min(MIN_SIDEBAR_WIDTH, maxAllowed || MIN_SIDEBAR_WIDTH);

  return {
    minAllowed: maxAllowed > 0 ? minAllowed : MIN_SIDEBAR_WIDTH,
    maxAllowed: maxAllowed > 0 ? maxAllowed : MIN_SIDEBAR_WIDTH
  };
};

const clampSidebarWidth = () => {
  if (isCompact.value) {
    return;
  }

  const { minAllowed, maxAllowed } = getSidebarBounds();
  sidebarWidth.value = Math.min(maxAllowed, Math.max(minAllowed, sidebarWidth.value));
};

const handleResizeMove = (event) => {
  if (!isResizing.value) {
    return;
  }

  const nextWidth = resizeStartWidth + (event.clientX - resizeStartX);
  const { minAllowed, maxAllowed } = getSidebarBounds();
  sidebarWidth.value = Math.min(maxAllowed, Math.max(minAllowed, nextWidth));
};

const handleResizeEnd = () => {
  if (!isResizing.value) {
    return;
  }

  isResizing.value = false;
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
  window.removeEventListener("mousemove", handleResizeMove);
  window.removeEventListener("mouseup", handleResizeEnd);
};

const handleResizeStart = (event) => {
  if (isCompact.value || event.button !== 0) {
    return;
  }

  isResizing.value = true;
  resizeStartX = event.clientX;
  resizeStartWidth = sidebarWidth.value;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
  window.addEventListener("mousemove", handleResizeMove);
  window.addEventListener("mouseup", handleResizeEnd);
};

const syncLayoutMode = () => {
  isCompact.value = window.innerWidth < COMPACT_BREAKPOINT;
  if (isCompact.value) {
    state.showSidebar = false;
  }

  nextTick(() => {
    resetLayoutPosition();
    clampSidebarWidth();
  });
};

onMounted(() => {
  window.addEventListener("resize", syncLayoutMode);
  syncLayoutMode();
});

onUnmounted(() => {
  window.removeEventListener("resize", syncLayoutMode);
  handleResizeEnd();
});
</script>

<style scoped>
.layout {
  display: block;
  min-height: 100vh;
  overflow-x: hidden;
}

.layout-sidebar {
  position: fixed;
  box-sizing: border-box;
  top: 0;
  left: 0;
  height: 100vh;
  overflow-y: auto;
  scrollbar-gutter: stable;
  background-color: rgb(240, 242, 246);
  z-index: 999991;
  width: 320px;
  min-width: 0;
  max-width: 520px;
  transition: transform 300ms, min-width 300ms, max-width 300ms, width 300ms;
}

.layout-sidebar-content {
  padding: 1rem;
}

.layout-sidebar-retract {
  position: absolute;
  top: 1rem;
  display: flex;
  right: 1rem;
  z-index: 2;
}

.layout-toggle-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.55);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #1f2937;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.layout-toggle-button:hover {
  background: #ffffff;
  border-color: rgba(100, 116, 139, 0.72);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.16);
}

.layout-toggle-icon {
  font-size: 1.3rem;
  line-height: 1;
}

.layout-sidebar-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
}

.layout-sidebar-resizer:hover {
  background: rgba(0, 0, 0, 0.08);
}

.layout-content {
  position: relative;
  min-height: 100vh;
  min-width: 0;
  transition: transform 300ms, min-width 300ms, max-width 300ms;
}

.layout-content--collapsed {
  margin-left: 0 !important;
  padding-left: 2.5rem;
}

.layout-content-retract {
  position: fixed;
  top: 1.1rem;
  left: 1rem;
  z-index: 10;
}

.layout--resizing .layout-sidebar,
.layout--resizing .layout-content,
.layout--resizing .layout-toggle-button {
  transition: none !important;
}

.layout--compact .layout-sidebar {
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  width: min(22rem, calc(100vw - 1.5rem));
  height: auto;
  min-width: 0;
  max-width: calc(100vw - 1.5rem);
  max-height: calc(100vh - 1.5rem);
  overflow-y: auto;
  background: rgba(240, 242, 246, 0.82);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.18);
}

.layout--compact .layout-sidebar-retract {
  position: sticky;
  top: 1rem;
  display: flex;
  justify-content: flex-end;
  padding-right: 1rem;
  z-index: 2;
}

.layout--compact .layout-content {
  width: 100%;
  min-height: 100vh;
}

.layout--compact .layout-content--collapsed {
  padding-left: 0;
}

.layout--compact .layout-content-retract {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 10;
}
</style>
