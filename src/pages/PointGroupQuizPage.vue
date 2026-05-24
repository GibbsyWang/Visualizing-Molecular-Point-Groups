<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import PointGroupFlowchart from "@/components/flowchart/PointGroupFlowchart.vue";
import SymmetryMoleculeViewer from "@/components/molecule/SymmetryMoleculeViewer.vue";
import LatexInline from "@/components/common/LatexInline.vue";
import { FLOW_EDGES, FLOW_NODES, FLOW_SPECIAL_FAMILIES } from "@/data/flowchart";
import { getMoleculeDataset } from "@/data/moleculeDatasetStore";
import { canonicalizePointGroup, toPointGroupLatex } from "@/utils/pointGroupDetails";
import { toPointGroupFamily } from "@/utils/pointGroup";
import { toMolecularFormulaLatex } from "@/utils/chemLatex";

const dataset = getMoleculeDataset({ includeLog: true, includeGjf: true });
const records = dataset.records.filter((record) => record?.atoms?.length && record?.pointGroup);
const groupsByFamily = dataset.groupsByFamily;
const availableFamilies = computed(() => new Set([...groupsByFamily.keys()]));

const selectedFamily = ref("");
const quizRecord = ref(records[0] ?? null);
const guessInput = ref("");
const inputFlashState = ref("");
const hasInteractedWithInput = ref(false);
const revealedAnswer = ref("");
const totalAttempts = ref(0);
const solvedCount = ref(0);
const questionSolved = ref(false);
let inputFlashTimer = 0;

function normalizeGuess(inputText) {
  return canonicalizePointGroup(String(inputText ?? "").trim());
}

function pickRandomRecord() {
  if (!records.length) {
    quizRecord.value = null;
    return;
  }

  if (records.length === 1) {
    quizRecord.value = records[0];
  } else {
    const currentId = quizRecord.value?.id;
    let next = records[Math.floor(Math.random() * records.length)];
    let guard = 0;
    while (next?.id === currentId && guard < 20) {
      next = records[Math.floor(Math.random() * records.length)];
      guard += 1;
    }
    quizRecord.value = next;
  }

  questionSolved.value = false;
  guessInput.value = "";
  inputFlashState.value = "";
  revealedAnswer.value = "";
  selectedFamily.value = "";
}

function checkAnswer() {
  if (!quizRecord.value) {
    return;
  }

  const guess = normalizeGuess(guessInput.value);
  const expected = canonicalizePointGroup(quizRecord.value.pointGroup);
  if (!guess) {
    triggerInputError();
    return;
  }

  totalAttempts.value += 1;
  if (guess === expected) {
    lockInputSuccess();
    revealedAnswer.value = expected;
    selectedFamily.value = toPointGroupFamily(expected) ?? "";
    if (!questionSolved.value) {
      solvedCount.value += 1;
      questionSolved.value = true;
    }
    return;
  }

  triggerInputError();
}

function revealAnswer() {
  if (!quizRecord.value) {
    return;
  }

  const expected = canonicalizePointGroup(quizRecord.value.pointGroup);
  revealedAnswer.value = expected;
  selectedFamily.value = toPointGroupFamily(expected) ?? "";
  inputFlashState.value = "";
}

function onGuessInput() {
  if (inputFlashState.value === "success") {
    inputFlashState.value = "";
  }
}

function onGuessInputFocus() {
  hasInteractedWithInput.value = true;
}

function triggerInputError() {
  if (inputFlashTimer) {
    window.clearTimeout(inputFlashTimer);
    inputFlashTimer = 0;
  }

  inputFlashState.value = "";
  window.requestAnimationFrame(() => {
    inputFlashState.value = "error";
    inputFlashTimer = window.setTimeout(() => {
      inputFlashState.value = "";
      inputFlashTimer = 0;
    }, 500);
  });
}

function lockInputSuccess() {
  if (inputFlashTimer) {
    window.clearTimeout(inputFlashTimer);
    inputFlashTimer = 0;
  }
  inputFlashState.value = "success";
}

const accuracyText = computed(() => {
  if (!totalAttempts.value) {
    return "0%";
  }
  return `${Math.round((solvedCount.value / totalAttempts.value) * 100)}%`;
});

const guessLatex = computed(() => toPointGroupLatex(guessInput.value));
const revealedAnswerLatex = computed(() =>
  revealedAnswer.value ? toPointGroupLatex(revealedAnswer.value) : ""
);

onBeforeUnmount(() => {
  if (inputFlashTimer) {
    window.clearTimeout(inputFlashTimer);
    inputFlashTimer = 0;
  }
});

pickRandomRecord();
</script>

<template>
  <section class="page">
    <div class="page-shell">
      <header class="page-hero">
        <p class="page-eyebrow">Module 3</p>
        <h1 class="page-title">Point Group Quiz</h1>
        <p class="page-lead">
          Use the flowchart as guidance, then identify the point group of a random molecule.
        </p>
      </header>

      <div class="quiz-layout">
        <PointGroupFlowchart
          :nodes="FLOW_NODES"
          :edges="FLOW_EDGES"
          :special-families="FLOW_SPECIAL_FAMILIES"
          :selected-family="selectedFamily"
          :available-families="availableFamilies"
          :interactive="false"
        />

        <aside class="page-panel quiz-panel">
          <div class="stack" v-if="quizRecord">
            <p class="panel-title">Molecular Geometry</p>
            <SymmetryMoleculeViewer
              :atoms="quizRecord.atoms"
              :bonds="quizRecord.bonds"
            />
            <p class="panel-title panel-title--compact">Formula</p>
            <p class="molecule-formula">
              <LatexInline :expr="toMolecularFormulaLatex(quizRecord.formula)" />
            </p>
          </div>

          <div class="stack">
            <button type="button" class="btn random-btn" @click="pickRandomRecord">Random Molecule</button>
            <p class="panel-title">Your Input</p>
            <div class="quiz-quad-grid">
              <div class="input-with-preview">
                <input
                  v-model="guessInput"
                  class="group-input"
                  :class="{
                    'group-input--hint': !hasInteractedWithInput && !inputFlashState,
                    'group-input--success': inputFlashState === 'success',
                    'group-input--flash-error': inputFlashState === 'error'
                  }"
                  type="text"
                  placeholder="Input point group"
                  @focus="onGuessInputFocus"
                  @input="onGuessInput"
                  @keydown.enter.prevent="checkAnswer"
                />
                <div v-if="guessInput.trim()" class="inline-preview">
                  <LatexInline :expr="guessLatex" />
                </div>
              </div>
              <button type="button" class="btn btn--ghost quiz-action-btn" @click="checkAnswer">
                Check Answer
              </button>
              <div class="answer-slot">
                <span class="soft-label">Answer:</span>
                <LatexInline :expr="revealedAnswerLatex || '\\text{--}'" />
              </div>
              <button type="button" class="btn btn--ghost quiz-action-btn" @click="revealAnswer">
                Reveal
              </button>
            </div>
            <p class="quiz-stat">
              Solved: <strong>{{ solvedCount }}</strong>
              <span class="divider">|</span>
              Attempts: <strong>{{ totalAttempts }}</strong>
              <span class="divider">|</span>
              Accuracy: <strong>{{ accuracyText }}</strong>
            </p>
          </div>

        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quiz-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.quiz-panel {
  display: grid;
  gap: 1rem;
  align-content: start;
  position: sticky;
  top: 0.8rem;
}

.panel-title--compact {
  margin-top: 0.1rem;
}

.molecule-formula,
.quiz-stat {
  margin: 0;
  color: #334155;
}

.divider {
  margin: 0 0.45rem;
  color: #94a3b8;
}

.random-btn,
.quiz-action-btn {
  width: 100%;
  min-height: 2.8rem;
}

.quiz-quad-grid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 0;
  align-items: stretch;
  border: 1px solid rgba(148, 163, 184, 0.62);
  border-radius: 0.8rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.98);
}

.quiz-quad-grid::before,
.quiz-quad-grid::after {
  content: "";
  position: absolute;
  pointer-events: none;
  z-index: 2;
  background: rgba(148, 163, 184, 0.5);
}

.quiz-quad-grid::before {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-0.5px);
}

.quiz-quad-grid::after {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  transform: translateY(-0.5px);
}

.quiz-quad-grid > * {
  min-height: 2.8rem;
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.quiz-quad-grid > :nth-child(1) {
  border-top-left-radius: 0.8rem;
}

.quiz-quad-grid > :nth-child(2) {
  border-top-right-radius: 0.8rem;
}

.quiz-quad-grid > :nth-child(3) {
  border-bottom-left-radius: 0.8rem;
}

.quiz-quad-grid > :nth-child(4) {
  border-bottom-right-radius: 0.8rem;
}

.group-input {
  width: 100%;
  min-height: 2.8rem;
  border-radius: 0.8rem 0 0 0;
  border: 0;
  background: transparent;
  padding: 0.6rem 7rem 0.6rem 0.72rem;
  color: #0f172a;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.input-with-preview {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 0.8rem 0 0 0;
  overflow: hidden;
}

.input-with-preview:focus-within {
  background: rgba(239, 246, 255, 0.95);
}

.group-input--success {
  box-shadow: inset 0 0 0 2px rgba(22, 163, 74, 0.9);
  background: rgba(240, 253, 244, 0.98);
}

.group-input--hint {
  animation: input-hint-pulse 2.2s ease-in-out infinite;
}

.group-input--flash-error {
  animation: input-flash-error 0.5s ease;
}

@keyframes input-hint-pulse {
  0% {
    box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.22);
    background: rgba(255, 255, 255, 0.98);
  }
  50% {
    box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.58);
    background: rgba(239, 246, 255, 0.95);
  }
  100% {
    box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.22);
    background: rgba(255, 255, 255, 0.98);
  }
}

@keyframes input-flash-error {
  0% {
    box-shadow: inset 0 0 0 2px rgba(220, 38, 38, 0.96);
    background: rgba(254, 242, 242, 0.98);
  }
  70% {
    box-shadow: inset 0 0 0 2px rgba(248, 113, 113, 0.78);
    background: rgba(254, 242, 242, 0.98);
  }
}

.inline-preview {
  position: absolute;
  right: 0.72rem;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  max-width: 46%;
  pointer-events: none;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-preview :deep(.latex-inline) {
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-preview :deep(.katex) {
  font-size: 0.95em;
}

.answer-slot {
  min-height: 2.8rem;
  border-radius: 0;
  border: 0;
  background: rgba(248, 250, 252, 0.95);
  padding: 0.6rem 0.72rem;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  overflow: hidden;
}

.soft-label {
  color: #64748b;
  margin-right: 0.45rem;
}

.quiz-quad-grid .quiz-action-btn {
  border: 0;
  border-radius: 0;
  min-height: 2.8rem;
  box-shadow: none;
}

.answer-slot :deep(.latex-inline) {
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .quiz-layout {
    grid-template-columns: 1fr;
  }

  .quiz-panel {
    position: static;
  }
}

@media (max-width: 760px) {
  .quiz-quad-grid {
    grid-template-columns: 1fr;
  }

  .quiz-quad-grid::before,
  .quiz-quad-grid::after {
    display: none;
  }

  .quiz-quad-grid > * + * {
    border-top: 1px solid rgba(148, 163, 184, 0.5);
  }

  .quiz-quad-grid > :nth-child(1) {
    border-top-left-radius: 0.8rem;
    border-top-right-radius: 0.8rem;
    border-bottom-left-radius: 0;
  }

  .quiz-quad-grid > :nth-child(2),
  .quiz-quad-grid > :nth-child(3) {
    border-radius: 0;
  }

  .quiz-quad-grid > :nth-child(4) {
    border-bottom-left-radius: 0.8rem;
    border-bottom-right-radius: 0.8rem;
  }
}
</style>
