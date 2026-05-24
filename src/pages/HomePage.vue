<script setup>
import symmetryBg from "@/assets/backgrounds/symmetry.png";
import groupsBg from "@/assets/backgrounds/groups.png";
import quizBg from "@/assets/backgrounds/quiz.png";

const cards = [
  {
    title: "Symmetry",
    description: "Symmetry elements and symmetry operations.",
    to: "/symmetry-elements",
    accent: "rgba(30, 64, 175, 0.74)",
    background: `url(${symmetryBg})`
  },
  {
    title: "Point Groups",
    description: "Point-group decision flow.",
    to: "/flowchart",
    accent: "rgba(15, 23, 42, 0.76)",
    background: `url(${groupsBg})`
  },
  {
    title: "Quiz",
    description: "Random point-group challenge.",
    to: "/quiz",
    accent: "rgba(30, 64, 175, 0.72)",
    background: `url(${quizBg})`
  }
];
</script>

<template>
  <section class="page">
    <div class="hero-panel">
      <div class="title-wrap">
        <h1 class="title"><span class="red">Visualizing</span> Molecular Point Groups</h1>
        <p class="author-line">by Lequan Wang and Haibei Li</p>
      </div>

      <div class="home-page">
        <div class="home-grid">
          <RouterLink
            v-for="card in cards"
            :key="card.title"
            :to="card.to"
            class="entry-card"
            :style="{ '--card-accent': card.accent, '--card-image': card.background }"
          >
            <span class="entry-card__media" aria-hidden="true"></span>
            <span class="entry-card__overlay" aria-hidden="true"></span>
            <span class="entry-card__content">
              <span class="entry-card__title">{{ card.title }}</span>
              <span class="entry-card__footer">
                <span class="entry-card__description">{{ card.description }}</span>
                <span class="entry-card__action">Open</span>
              </span>
            </span>
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-panel {
  position: relative;
  overflow: hidden;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  border-radius: 2rem;
  background:
    radial-gradient(circle at top left, rgba(84, 110, 255, 0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(214, 40, 57, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 247, 250, 0.96));
  box-shadow: 0 22px 60px rgba(17, 24, 39, 0.12);
}

.title-wrap {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
}

.title {
  text-align: center;
  font-size: clamp(2.2rem, 5vw, 3.1rem);
  line-height: 1.14;
  margin: 0;
}

.author-line {
  margin: 0;
  font-size: clamp(1rem, 1.8vw, 1.12rem);
  font-weight: 700;
  color: #4b5563;
  line-height: 1.5;
}

.red {
  color: #d62839;
}

.home-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 46vh;
  margin-top: clamp(1.5rem, 3vw, 2.5rem);
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.35rem;
  width: 100%;
}

.entry-card {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: flex-end;
  min-height: clamp(18rem, 34vw, 24rem);
  padding: 1.35rem;
  overflow: hidden;
  border-radius: 1.55rem;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: #0f172a;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.14);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.entry-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 28px 48px rgba(15, 23, 42, 0.2);
  border-color: rgba(255, 255, 255, 0.65);
}

.entry-card__media,
.entry-card__overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.entry-card__media {
  background-image: var(--card-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  transform: scale(1.02);
}

.entry-card__overlay {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.46) 48%, var(--card-accent) 100%),
    linear-gradient(0deg, rgba(15, 23, 42, 0.56), rgba(15, 23, 42, 0.12));
}

.entry-card__content,
.entry-card__action,
.entry-card__footer {
  position: relative;
  z-index: 1;
}

.entry-card__content {
  display: grid;
  gap: 0.45rem;
  width: 100%;
}

.entry-card__title {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  line-height: 1.15;
  color: #ffffff;
}

.entry-card__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.entry-card__description {
  display: block;
  flex: 1 1 auto;
  font-size: 0.92rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.92);
}

.entry-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4.1rem;
  padding: 0.62rem 0.88rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(10px);
  font-size: 0.86rem;
  font-weight: 600;
  color: #ffffff;
}

@media (max-width: 960px) {
  .home-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .entry-card {
    min-height: 15rem;
  }
}

@media (max-width: 740px) {
  .hero-panel {
    border-radius: 1.5rem;
    padding: 1.25rem;
  }

  .home-page {
    min-height: auto;
  }

  .home-grid {
    grid-template-columns: 1fr;
  }

  .entry-card {
    min-height: 13.5rem;
    padding: 1.1rem;
  }

  .entry-card__footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
