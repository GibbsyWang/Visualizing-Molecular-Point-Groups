<script setup>
import { computed } from "vue";
import katex from "katex";
import "katex/dist/katex.min.css";

const props = defineProps({
  expr: {
    type: String,
    default: ""
  },
  displayMode: {
    type: Boolean,
    default: false
  }
});

const rendered = computed(() => {
  if (!props.expr) {
    return "";
  }

  try {
    return katex.renderToString(props.expr, {
      throwOnError: false,
      displayMode: props.displayMode,
      strict: "ignore"
    });
  } catch (error) {
    return props.expr;
  }
});
</script>

<template>
  <span class="latex-inline" v-html="rendered"></span>
</template>

<style scoped>
.latex-inline {
  display: inline-flex;
  align-items: center;
  line-height: 1.2;
}
</style>
