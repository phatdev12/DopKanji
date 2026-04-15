<script setup lang="ts">
import type { KanjiTreeNode } from '../../shared/types/kanji'

defineProps<{
  node: KanjiTreeNode
}>()
</script>

<template>
  <li class="graph-item">
    <span class="graph-node">{{ node.element }}</span>
    <ul v-if="node.g?.length" class="graph-children">
      <KanjiGraphNode
        v-for="(child, index) in node.g"
        :key="`${node.element}-${child.element}-${index}`"
        :node="child"
      />
    </ul>
  </li>
</template>
