<script setup lang="ts">
/**
 * T-16: Playground — локальная демонстрация библиотеки.
 * Запуск: npm run playground (vite root = playground/)
 */
import { ref } from 'vue'
import dayjs from 'dayjs'
import Timeline from '../../src/components/Timeline.vue'
import type { TimelineEvent, TimelineResource, TimelineOptions } from '../../src/types'

const resources: TimelineResource[] = [
  { id: 'r1', title: 'Server A' },
  { id: 'r2', title: 'Server B' },
  { id: 'r3', title: 'Database' },
]

const events = ref<TimelineEvent[]>([
  {
    id: 'e1',
    start: dayjs().startOf('day').add(9, 'hour'),
    end: dayjs().startOf('day').add(10, 'hour').add(30, 'minute'),
    resourceId: 'r1',
    title: 'Deploy',
    color: '#4f8ef7',
  },
  {
    id: 'e2',
    start: dayjs().startOf('day').add(13, 'hour'),
    end: dayjs().startOf('day').add(15, 'hour'),
    resourceId: 'r2',
    title: 'Backup',
    color: '#34c759',
  },
])

const options = ref<TimelineOptions>({
  minCellMinutes: 15,
  canCreate: true,
  showCurrentTime: true,
  initialPxPerMin: 1.2,
})

const log = ref<string[]>([])
function pushLog(msg: string) {
  log.value.unshift(`${new Date().toLocaleTimeString()} ${msg}`)
  log.value = log.value.slice(0, 20)
}

function onCreate(p: { event: Omit<TimelineEvent, 'id'> }) {
  pushLog(`create: ${p.event.start.format('HH:mm')}–${p.event.end.format('HH:mm')}`)
  const ev: TimelineEvent = { ...p.event, id: `e${Date.now()}`, title: 'New event' }
  events.value.push(ev)
}

function onSave(p: { event: TimelineEvent; changes: { start?: dayjs.Dayjs; end?: dayjs.Dayjs } }) {
  pushLog(`save: ${p.event.id}`)
  const i = events.value.findIndex((e) => e.id === p.event.id)
  if (i !== -1) events.value[i] = { ...events.value[i], ...(p.changes as object) }
}

function onDelete(p: { event: TimelineEvent }) {
  pushLog(`delete: ${p.event.id}`)
  events.value = events.value.filter((e) => e.id !== p.event.id)
}
</script>

<template>
  <div class="page">
    <h1>vue-event-timeline playground</h1>
    <Timeline
      :events="events"
      :resources="resources"
      :options="options"
      locale="en"
      @create="onCreate"
      @save="onSave"
      @update="pushLog('update (drag in progress)')"
      @delete="onDelete"
    />
    <h3>Event log</h3>
    <ul class="log">
      <li v-for="(l, i) in log" :key="i">{{ l }}</li>
    </ul>
  </div>
</template>

<style scoped>
.page {
  font-family: system-ui, sans-serif;
  padding: 16px;
}
.log {
  font-size: 12px;
  color: #555;
}
</style>
