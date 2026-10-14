<script setup lang="ts">
/**
 * Playground — локальная демонстрация библиотеки с панелью настроек.
 * Запуск: npm run dev (vite root = playground/)
 */
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'
import Timeline from '../../src/components/Timeline.vue'
import SettingsPanel from './SettingsPanel.vue'
import { useI18n, LANGUAGES, currentLocale, timelineDayjsLocale, setLocale as i18nSetLocale } from './i18n'
import type { TimelineEvent, TimelineResource, TimelineOptions } from '../../src/types'

/** Глобальный i18n playground: язык общий для UI-строк и dayjs-локали таймлайна */
const { t } = useI18n()

const PALETTE = ['#4f8ef7', '#34c759', '#f7a23b', '#e05d76', '#8b5cf6', '#14b8a6', '#f43f5e', '#0ea5e9']

/** Дефолты темы библиотеки (light) — совпадают с SCSS !default в Timeline.vue / TimelineEvent.vue */
const DEFAULT_LIGHT_COLORS: Record<string, string> = {
  '--border-color': '#5656563a',
  '--ruler-line-color': '#9ca3af',
  '--tl-row-height': '40px',
  '--ra-text': '#111827',
  '--text-secondary': '#6b7280',
  '--ra-aside-bg': '#ffffff',
  '--hover-sidebar-bg': '#e5e7eb',
  '--hover-cell-bg': '#b1c3e7ee',
  '--hover-row-bg': '#a1aebb51',
  '--plus-icon-color': '#3770cd',
  '--plus-border-color': '#93c5fd',
  '--tl-event-text-color': '#fff',
  '--tl-event-shadow': '0 2px 8px rgba(37, 99, 235, 0.3)',
  '--tl-event-shadow-hover': '0 4px 12px rgba(37, 99, 235, 0.4)',
  '--tl-event-blocked-shadow': '0 2px 10px rgba(239, 68, 68, 0.55)',
  '--tl-event-handle-bg': 'rgba(255, 255, 255, 0.2)',
  '--tl-event-handle-bg-hover': 'rgba(255, 255, 255, 0.5)',
  '--tl-event-delete-bg': '#ef4444',
  '--tl-event-delete-color': '#fff',
}

/** Базовые значения тёмной темы (:root[data-theme='dark']) */
const DEFAULT_DARK_COLORS: Record<string, string> = {
  '--border-color': '#676767',
  '--hover-sidebar-bg': '#37415174',
  '--hover-cell-bg': '#4d6d9991',
  '--hover-row-bg': '#3e526e91',
  '--plus-icon-color': '#60a5fa',
  '--plus-border-color': '#3b82f6',
  '--ra-text': '#f9fafb',
  '--text-secondary': '#9ca3af',
  '--ra-aside-bg': '#1f2937',
}

const defaultOptions = (): TimelineOptions => ({
  minCellMinutes: 15,
  minDurationMinutes: 15,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  allowOverlap: false,
  // T-36: per-group allowOverlap. Глобальный allowOverlap=false перебивает
  // группы: «service» сможет накладываться только при allowOverlap=true/undefined.
  eventGroups: {
    field: 'group',
    groups: {
      rental: { allowOverlap: false },
      service: { allowOverlap: true },
    },
  },
  showCurrentTime: true,
  showGrid: true,
  initialPxPerMin: 1.2,
})

/** Цвета по группам событий (T-36) */
const GROUP_COLORS: Record<string, string> = {
  rental: PALETTE[5],  // бирюзовый
  service: PALETTE[4], // фиолетовый
}
/** Локализованные подписи демо-групп; ключ 'group.<name>', fallback — само имя */
const GROUP_LABEL_KEYS: Record<string, string> = {
  rental: 'group.rental',
  service: 'group.service',
}

function groupLabel(group?: string): string {
  if (!group) return t('group.none')
  const key = GROUP_LABEL_KEYS[group]
  if (!key) return group
  const translated = t(key)
  // t() возвращает сам ключ, если перевода нет — показываем имя группы как есть
  return translated === key ? group : translated
}

const resources = ref<TimelineResource[]>([
  { id: 'r1', title: 'Server A', color: PALETTE[0] },
  { id: 'r2', title: 'Server B', color: PALETTE[1] },
  { id: 'r3', title: 'Database', color: PALETTE[2] },
  { id: 'r4', title: 'CI Runner', color: PALETTE[3] },
])

let resCounter = 5
function addResource() {
  resources.value.push({
    id: `r${resCounter}`,
    title: `Resource ${resCounter++}`,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  })
}
function removeResource(id: string | number) {
  resources.value = resources.value.filter((r) => r.id !== id)
  events.value = events.value.filter((e) => e.resourceId !== id)
}

const base = () => dayjs().startOf('day')
const events = ref<TimelineEvent[]>([
  { id: 'e1', start: base().add(9, 'hour'), end: base().add(10, 'hour').add(30, 'minute'), resourceId: 'r1', title: 'Deploy', color: PALETTE[0] },
  { id: 'e2', start: base().add(13, 'hour'), end: base().add(15, 'hour'), resourceId: 'r2', title: 'Backup', color: PALETTE[1] },
  { id: 'e3', start: base().add(8, 'hour').add(15, 'minute'), end: base().add(9, 'hour').add(15, 'minute'), resourceId: 'r3', title: 'Migration', color: PALETTE[2] },
  { id: 'e4', start: base().add(16, 'hour'), end: base().add(18, 'hour').add(30, 'minute'), resourceId: 'r4', title: 'Build pipeline', color: PALETTE[3] },
  { id: 'e5', start: base().add(20, 'hour'), end: base().add(22, 'hour'), resourceId: 'r1', title: 'Monitoring scan', color: PALETTE[4] },
])

/**
 * T-36: демо-набор «транспорт + сервис» с группами rental/service.
 * rental — allowOverlap:false (строгая группа), service — allowOverlap:true.
 * При глобальном options.allowOverlap=false наложения запрещены для ВСЕХ
 * групп (глобальный флаг перебивает групповые настройки); включите его в
* панели — и события service начнут перекрываться в нескольких дорожках.
 */
function addGroupDemo() {
  const mk = (
    id: string, group: 'rental' | 'service', resource: string,
    from: [number, number], to: [number, number], title: string,
  ): TimelineEvent => ({
    id, group, resourceId: resource, title,
    start: base().add(from[0], 'hour').add(from[1], 'minute'),
    end: base().add(to[0], 'hour').add(to[1], 'minute'),
    color: GROUP_COLORS[group],
  })
  const demo: TimelineEvent[] = [
    // Строгая группа rental — без наложений даже между собой
    mk('g-rental-1', 'rental', 'r1', [9, 0], [11, 0], 'Аренда: Vehicle A'),
    mk('g-rental-2', 'rental', 'r1', [13, 0], [15, 0], 'Аренда: Vehicle B'),
    // Мягкая группа service — перекрываются друг с другом и с rental
    mk('g-serv-1', 'service', 'r1', [10, 0], [12, 0], 'Сервис: ТО'),
    mk('g-serv-2', 'service', 'r1', [10, 30], [12, 30], 'Сервис: Мойка'),
    mk('g-serv-3', 'service', 'r2', [14, 0], [15, 30], 'Сервис: Диагностика'),
    mk('g-serv-4', 'service', 'r2', [14, 30], [16, 0], 'Сервис: Страховка'),
  ]
  for (const d of demo) {
    if (!events.value.some((e) => e.id === d.id)) events.value.push(d)
  }
  pushLog(`group demo added: ${demo.length} events (rental/service)`)
}

let evCounter = 100
function addRandomEvent() {
  const r = resources.value[Math.floor(Math.random() * resources.value.length)]
  if (!r) return
  const start = base().add(8 + Math.floor(Math.random() * 10), 'hour').add(Math.floor(Math.random() * 4) * 15, 'minute')
  const group = newEventGroup.value || undefined
  events.value.push({
    id: `e${evCounter}`,
    start,
    end: start.add(45 + Math.floor(Math.random() * 90), 'minute'),
    resourceId: r.id,
    title: `Task ${evCounter++}`,
    group,
    color: groupColor(group) ?? r.color ?? PALETTE[0],
  })
}
function clearEvents() {
  events.value = []
}

const options = ref<TimelineOptions>(defaultOptions())
const rowHeight = ref(40)
/** Локаль таймлайна (dayjs) наследуется от глобального языка playground */
const locale = computed(() => timelineDayjsLocale.value)
const loading = ref(false)

/** Переключение языка из топбара (флаги): меняет и UI-строки, и dayjs-локаль таймлайна */
function setLocale(code: string) {
  i18nSetLocale(code)
  pushLog(`locale: ${code}`)
}

/** T-36: группа, в которую попадёт событие, созданное кнопкой/кликом */
const newEventGroup = ref<string>('service')

/** Все известные группы: из eventGroups + зарезервированные демо-группы + «без группы» */
const knownGroups = computed(() => {
  const names = new Set(Object.keys(options.value.eventGroups?.groups ?? {}))
  for (const g of Object.keys(GROUP_COLORS)) names.add(g)
  return [...names]
})
// Если выбранная группа удалена из настроек — переключаемся на первую доступную
watch(knownGroups, (list) => {
  if (!list.includes(newEventGroup.value)) newEventGroup.value = list[0] ?? ''
})

function groupColor(group?: string): string {
  if (group && GROUP_COLORS[group]) return GROUP_COLORS[group]
  return PALETTE[Math.abs(hashCode(group ?? 'none')) % PALETTE.length]
}
function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

/** Пользовательские переопределения темы: name -> value (пусто = дефолты библиотеки) */
const colors = ref<Record<string, string>>({})
const themeDark = ref(false)

/** Итоговые значения токенов: дефолт темы + поверх — правки пользователя */
const effectiveColors = computed<Record<string, string>>(() => ({
  ...(themeDark.value ? { ...DEFAULT_LIGHT_COLORS, ...DEFAULT_DARK_COLORS } : DEFAULT_LIGHT_COLORS),
  ...colors.value,
}))

/** Живой <style>: переопределяем custom properties на .tl-root (специфичность 0,1,0 бьёт scoped-правило 0,2,0) */
watch(
  [effectiveColors, themeDark],
  () => {
    let el = document.getElementById('pg-theme-vars')
    if (!el) {
      el = document.createElement('style')
      el.id = 'pg-theme-vars'
      document.head.appendChild(el)
    }
    // !important гарантирует переопределение значений, объявленных внутри scoped-стилей компонента
    el.textContent = `.tl-root {\n${Object.entries(effectiveColors.value)
      .map(([k, v]) => `  ${k}: ${v} !important;`)
      .join('\n')}\n}`
    // синхронизируем демо-страницу с тёмной темой
    document.documentElement.setAttribute('data-theme', themeDark.value ? 'dark' : 'light')
    document.documentElement.style.background = themeDark.value ? '#111827' : ''
    document.documentElement.style.color = themeDark.value ? '#f9fafb' : ''
  },
  { immediate: true },
)

function resetColors() {
  colors.value = {}
  pushLog('colors reset to defaults')
}

const selected = ref<TimelineEvent | null>(null)

const log = ref<string[]>([])
function pushLog(msg: string) {
  log.value.unshift(`${new Date().toLocaleTimeString()} · ${msg}`)
  log.value = log.value.slice(0, 30)
}

function onCreate(p: { event: Omit<TimelineEvent, 'id'> }) {
  pushLog(`create: ${p.event.start.format('HH:mm')}–${p.event.end.format('HH:mm')} → ${p.event.resourceId}`)
  // T-36: группа берётся из селектора «Группа при создании» (по умолчанию service)
  const group = p.event.group ?? newEventGroup.value ?? undefined
  events.value.push({
    ...p.event,
    group,
    id: `e${evCounter++}`,
    title: 'New event',
    color: groupColor(group) ?? GROUP_COLORS.service ?? PALETTE[4],
  })
}
function onSave(p: { event: TimelineEvent; changes: { start?: dayjs.Dayjs; end?: dayjs.Dayjs } }) {
  pushLog(`save: ${p.event.id} → ${p.changes.start?.format('HH:mm')}–${p.changes.end?.format('HH:mm')}`)
  const i = events.value.findIndex((e) => e.id === p.event.id)
  if (i !== -1) events.value[i] = { ...events.value[i], ...(p.changes as object) }
}
function onDelete(p: { event: TimelineEvent }) {
  pushLog(`delete: ${p.event.id}`)
  events.value = events.value.filter((e) => e.id !== p.event.id)
  if (selected.value?.id === p.event.id) selected.value = null
}
function onSelect(p: { event: TimelineEvent | null }) {
  selected.value = p.event
  pushLog(p.event ? `select: ${p.event.title ?? p.event.id}` : 'select: −')
}
function onViewport(v: { start: dayjs.Dayjs; end: dayjs.Dayjs }) {
  viewportText.value = `${v.start.format('DD.MM HH:mm')} → ${v.end.format('DD.MM HH:mm')}`
}

const viewportText = ref('—')
const stats = computed(() => ({
  events: events.value.length,
  resources: resources.value.length,
}))

/** T-36: сводка по группам (для info-карточки) */
const groupStats = computed(() => {
  const map = new Map<string, number>()
  for (const e of events.value) {
    const g = typeof e.group === 'string' && e.group ? e.group : '—'
    map.set(g, (map.get(g) ?? 0) + 1)
  }
  return [...map.entries()].map(([g, n]) => `${groupLabel(g === '—' ? undefined : g)}: ${n}`).join(' · ')
})

/** T-36: смена группы выбранного события */
function changeSelectedGroup(group: string) {
  if (!selected.value) return
  const g = group || undefined
  const i = events.value.findIndex((e) => e.id === selected.value!.id)
  if (i === -1) return
  events.value[i] = { ...events.value[i], group: g, color: groupColor(g) }
  selected.value = events.value[i]
  pushLog(`group: ${selected.value.title ?? selected.value.id} → ${g ?? 'без группы'}`)
}

function resetAll() {
  options.value = defaultOptions()
  rowHeight.value = 40
  currentLocale.value = 'en'
  colors.value = {}
  themeDark.value = false
  log.value = []
  pushLog('settings reset')
}

function toggleLoading() {
  loading.value = !loading.value
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <span class="logo">◴</span>
        <div>
          <h1>vue-event-timeline</h1>
          <p>{{ t('app.subtitle') }}</p>
        </div>
      </div>
      <!-- Глобальный переключатель языка интерфейса — с флагами, сверху страницы -->
      <div class="lang-switch" role="group" :aria-label="t('panel.localeInterface')">
        <button
          v-for="l in LANGUAGES"
          :key="l.code"
          type="button"
          class="lang-btn"
          :class="{ active: locale === l.code }"
          :aria-pressed="locale === l.code"
          :title="l.title"
          @click="setLocale(l.code)"
        >
          <img class="lang-flag" :src="l.flag" :alt="l.name" loading="lazy" />
          <span class="lang-name">{{ l.name }}</span>
        </button>
      </div>
      <div class="top-actions">
        <span class="chip">{{ t('topbar.events', { n: stats.events }) }}</span>
        <span class="chip">{{ t('topbar.resources', { n: stats.resources }) }}</span>
        <label class="group-picker" :title="t('topbar.createGroup')">
          <span class="group-picker-lbl">{{ t('topbar.createGroup') }}</span>
          <select class="sel group-sel" v-model="newEventGroup">
            <option value="">{{ t('topbar.noGroup') }}</option>
            <option v-for="g in knownGroups" :key="g" :value="g">{{ groupLabel(g) }}</option>
          </select>
        </label>
        <button class="btn" @click="addRandomEvent">{{ t('topbar.addEvent') }}</button>
        <button class="btn btn-ghost" @click="addGroupDemo">{{ t('topbar.addGroupsDemo') }}</button>
        <button class="btn btn-ghost" @click="clearEvents">{{ t('topbar.clear') }}</button>
        <button class="btn btn-ghost" @click="toggleLoading">{{ loading ? t('topbar.stopLoading') : t('topbar.testLoading') }}</button>
      </div>
    </header>

    <main class="layout">
      <SettingsPanel
        v-model:options="options"
        v-model:row-height="rowHeight"
        v-model:loading="loading"
        v-model:theme-dark="themeDark"
        v-model:colors="colors"
        :resources="resources"
        @add-resource="addResource"
        @remove-resource="removeResource"
        @reset-colors="resetColors"
        @reset="resetAll"
      />

      <section class="content">
        <div class="timeline-card">
          <Timeline
            v-model:events="events"
            :resources="resources"
            :options="options"
            :loading="loading"
            :row-height="rowHeight"
            :locale="locale"
            :style="effectiveColors as Record<string, string>"
            @create="onCreate"
            @save="onSave"
            @update="() => {}"
            @delete="onDelete"
            @select="onSelect"
            @change-viewport="onViewport"
          >
            <template #header="{ viewStart, zoomLevel }">
              <div class="tl-header-demo">
                <strong>{{ viewStart.format('MMM YYYY') }}</strong>
                <span class="zoom-tag">{{ t('header.zoom', { v: zoomLevel }) }}</span>
              </div>
            </template>
          </Timeline>
        </div>

        <div class="info-row">
          <div class="info-card">
            <h4>{{ t('info.viewport') }}</h4>
            <code>{{ viewportText }}</code>
          </div>
          <div class="info-card">
            <h4>{{ t('info.selected') }}</h4>
            <code v-if="selected">
              {{ selected.title ?? selected.id }} · {{ selected.start.format('HH:mm') }}–{{ selected.end.format('HH:mm') }}
              <template v-if="selected.group"> · {{ t('info.eventGroup') }} {{ groupLabel(selected.group) }}</template>
            </code>
            <code v-else class="muted">{{ t('info.none') }}</code>
            <!-- T-36: смена группы выбранного события -->
            <div v-if="selected" class="sel-group-row">
              <span class="field-lbl">{{ t('info.eventGroup') }}</span>
              <select class="sel group-sel" :value="selected.group ?? ''" @change="changeSelectedGroup(($event.target as HTMLSelectElement).value)">
                <option value="">{{ t('topbar.noGroup') }}</option>
                <option v-for="g in knownGroups" :key="g" :value="g">{{ groupLabel(g) }}</option>
              </select>
            </div>
          </div>
          <div class="info-card">
            <h4>{{ t('info.groupsCard') }}</h4>
            <code>{{ groupStats || t('info.noEvents') }}</code>
            <p class="hint">{{ t('info.groupsHint') }}</p>
          </div>
        </div>

        <div class="log-card">
          <h4>{{ t('info.log') }} <span class="muted">{{ t('info.logHint') }}</span></h4>
          <ul class="log">
            <li v-for="(l, i) in log" :key="i" :class="{ first: i === 0 }">{{ l }}</li>
            <li v-if="!log.length" class="muted">{{ t('info.logEmpty') }}</li>
          </ul>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
:root {
  --pg-bg: #f1f5f9;
  --pg-surface: #ffffff;
  --pg-border: #e2e8f0;
  --pg-text: #0f172a;
  --pg-muted: #64748b;
  --pg-accent: #4f46e5;
  --pg-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 6px 24px rgba(15, 23, 42, 0.06);
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--pg-bg);
  color: var(--pg-text);
}
</style>

<style scoped>
.page {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  min-height: 100vh;
  padding: 20px 24px 32px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--pg-accent), #7c3aed);
  color: #fff;
  font-size: 20px;
  box-shadow: var(--pg-shadow);
}
.brand h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}
.brand p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--pg-muted);
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
/* T-36: селектор группы для создаваемых событий */
.group-picker {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--pg-surface);
  border: 1px solid var(--pg-border);
  border-radius: 9px;
  padding: 4px 8px;
}
.group-picker-lbl {
  font-size: 12px;
  font-weight: 600;
  color: var(--pg-muted);
  white-space: nowrap;
}
.sel {
  padding: 6px 9px;
  border-radius: 8px;
  border: 1px solid var(--pg-border);
  background: var(--pg-surface);
  color: var(--pg-text);
  font-size: 13px;
  outline: none;
}
.sel:focus {
  border-color: var(--pg-accent);
}
.group-sel {
  max-width: 160px;
}
.sel-group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.field-lbl {
  font-size: 12px;
  color: var(--pg-text);
  font-weight: 500;
  white-space: nowrap;
}
.chip {
  font-size: 12px;
  font-weight: 600;
  color: var(--pg-muted);
  background: var(--pg-surface);
  border: 1px solid var(--pg-border);
  border-radius: 999px;
  padding: 5px 11px;
}
.btn {
  border: 1px solid var(--pg-accent);
  background: var(--pg-accent);
  color: #fff;
  border-radius: 9px;
  padding: 7px 13px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.btn-ghost {
  background: var(--pg-surface);
  color: var(--pg-text);
  border-color: var(--pg-border);
}
.btn-ghost:hover {
  border-color: var(--pg-accent);
  color: var(--pg-accent);
}
.layout {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}
/* Глобальный переключатель языка с флагами (сверху страницы) */
.lang-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--pg-surface);
  border: 1px solid var(--pg-border);
  border-radius: 999px;
  padding: 4px;
  box-shadow: var(--pg-shadow);
}
.lang-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--pg-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.lang-btn:hover {
  background: rgba(79, 70, 229, 0.08);
  color: var(--pg-accent);
}
.lang-btn.active {
  background: var(--pg-accent);
  color: #fff;
}
.lang-flag {
  width: 20px;
  height: 13px;
  border-radius: 3px;
  object-fit: cover;
  display: block;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.15);
}
@media (max-width: 1100px) {
  .lang-name {
    display: none; /* на узких экранах — только флаги */
  }
}
.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.timeline-card {
  background: var(--pg-surface);
  border: 1px solid var(--pg-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--pg-shadow);
}
.tl-header-demo {
  /* Компактный адаптивный header: при малой высоте текст не обрезается —
     строки переносятся, а контейнер скроллится по вертикали (min-height:0) */
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-height: 0;
  max-height: 100%;
  padding: 3px 14px;
  font-size: 13px;
  line-height: 1.2;
  overflow: hidden auto;
}
.tl-header-demo > strong {
  overflow-wrap: anywhere;
  flex-shrink: 1;
  min-width: 0;
}
.zoom-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--pg-accent);
  background: rgba(79, 70, 229, 0.1);
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.3;
}
/* Узкий/низкий header: уменьшаем шрифт, чтобы текст оставался читаемым */
@media (max-width: 900px) {
  .tl-header-demo,
  .tl-header-demo > strong {
    font-size: 11.5px;
  }
}
.info-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.info-card,
.log-card {
  background: var(--pg-surface);
  border: 1px solid var(--pg-border);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: var(--pg-shadow);
}
.info-card h4,
.log-card h4 {
  margin: 0 0 8px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--pg-muted);
}
.info-card code {
  font-size: 13px;
  font-weight: 600;
}
.hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--pg-muted);
}
.hint code {
  font-size: 11.5px;
  font-weight: 600;
  background: var(--pg-bg);
  padding: 1px 5px;
  border-radius: 5px;
}
.muted {
  color: var(--pg-muted);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
.log {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.log li {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11.5px;
  color: var(--pg-muted);
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--pg-bg);
}
.log li.first {
  color: var(--pg-accent);
  background: rgba(79, 70, 229, 0.08);
  font-weight: 600;
}
@media (max-width: 900px) {
  .layout {
    flex-direction: column;
  }
  .info-row {
    grid-template-columns: 1fr;
  }
}
</style>
