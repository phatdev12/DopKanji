<script setup lang="ts">
import '~/assets/css/main.css'

useSeoMeta({
  title: 'Đớp Kanji - Hãy biến tiếng nhật thành trò chơi của riêng bạn',
  ogTitle: 'Đớp Kanji - Hãy biến tiếng nhật thành trò chơi của riêng bạn',
  description: 'Công cụ tra cứu và luyện tập chữ Kanji cho người học tiếng Nhật. Học mọi lúc mọi nơi với Đớp Kanji!',
  ogDescription: 'Công cụ tra cứu và luyện tập chữ Kanji cho người học tiếng Nhật. Học mọi lúc mọi nơi với Đớp Kanji!',
  ogImage: '/favicon.svg',
  ogUrl: 'https://dopkanji.com',
})

const isSidebarCollapsed = ref(true)

const navItems = [
  {
    id: 'kanji-grid',
    label: 'Bảng Kanji',
    description: 'Danh sách JLPT N5-N1',
    active: true
  },
]

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>

<template>
  <div :class="['app-shell', { 'is-collapsed': isSidebarCollapsed }]">
    <NuxtRouteAnnouncer />
    <aside class="sidebar">
      <div class="sidebar-top" style="position: absolute; right: -28px; top: 15px; padding: 0.5rem; z-index: 100;">
        <button
          class="sidebar-toggle"
          type="button"
          :aria-label="isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'"
          @click="toggleSidebar"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              v-if="isSidebarCollapsed"
              d="M8 5l8 7-8 7"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              v-else
              d="M16 5l-8 7 8 7"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <div class="brand">
        <div class="brand-mark">
          <img src="/favicon.svg" alt="Đớp Kanji" width="40" height="40" />
        </div>
        <div class="brand-copy">
          <p class="brand-kicker">JLPT N5 - N1</p>
          <h1>Đớp Kanji</h1>
        </div>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: item.active }"
          type="button"
          :title="item.label"
        >
          <span class="nav-icon" aria-hidden="true">
            <svg v-if="item.id === 'kanji-grid'" viewBox="0 0 24 24">
              <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
            </svg>
          </span>
          <span class="nav-copy" v-if="!isSidebarCollapsed">
            <span class="nav-label">{{ item.label }}</span>
            <span class="nav-desc">{{ item.description }}</span>
          </span>
        </button>
      </nav>

    </aside>

    <main class="main-content">
      <NuxtPage />
    </main>
  </div>
</template>
