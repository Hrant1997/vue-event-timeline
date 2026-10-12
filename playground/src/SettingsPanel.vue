<script setup lang="ts">
/**
 * Панель настроек playground: управляет TimelineOptions, демо-данными,
 * цветами темы (CSS custom properties) и тёмной темой.
 */
import { computed } from 'vue'
import type { TimelineOptions, TimelineResource } from '../../src/types'

const props = defineProps<{
  options: TimelineOptions
  resources: TimelineResource[]
  rowHeight: number
  locale: string
  loading: boolean
  themeDark: boolean
  colors: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'update:options', v: TimelineOptions): void
  (e: 'update:rowHeight', v: number): void
  (e: 'update:locale', v: string): void
  (e: 'update:loading', v: boolean): void
  (e: 'update:themeDark', v: boolean): void
  (e: 'update:colors', v: Record<string, string>): void
  (e: 'add-resource'): void
  (e: 'remove-resource', id: string | number): void
  (e: 'reset-colors'): void
  (e: 'reset'): void
}>()

/** Все CSS custom properties библиотеки — как в README → «Темизация» */
const COLOR_TOKENS: Array<{ name: string; label: string }> = [
  // Каркас / линейка
  { name: '--border-color', label: 'Границы (линии сетки)' },
  { name: '--ruler-line-color', label: 'Линии линейки времени' },
  { name: '--tl-row-height', label: 'Высота строки (px)' },
  { name: '--ra-text', label: 'Основной текст' },
  { name: '--text-secondary', label: 'Вторичный текст' },
  { name: '--ra-aside-bg', label: 'Фон сайдбара ресурсов' },
  // Ховер-состояния
  { name: '--hover-sidebar-bg', label: 'Ховер: сайдбар' },
  { name: '--hover-cell-bg', label: 'Ховер: ячейка канваса' },
  { name: '--hover-row-bg', label: 'Ховер: вся строка' },
  // Кнопка «+» создания события
  { name: '--plus-icon-color', label: 'Иконка «+»: цвет' },
  { name: '--plus-border-color', label: 'Иконка «+»: рамка' },
  // Карточка события
  { name: '--tl-event-text-color', label: 'Событие: цвет текста' },
  { name: '--tl-event-shadow', label: 'Событие: тень' },
  { name: '--tl-event-shadow-hover', label: 'Событие: тень (ховер)' },
  { name: '--tl-event-blocked-shadow', label: 'Событие: тень (нельзя дроп)' },
  { name: '--tl-event-handle-bg', label: 'Событие: ручки ресайза' },
  { name: '--tl-event-handle-bg-hover', label: 'Событие: ручки (ховер)' },
  { name: '--tl-event-delete-bg', label: 'Событие: кнопка удаления (фон)' },
  { name: '--tl-event-delete-color', label: 'Событие: кнопка удаления (текст)' },
]

function setColor(name: string, value: string) {
  emit('update:colors', { ...props.colors, [name]: value })
}

/** --tl-row-height — размер, а не цвет: для него числовое поле */
function isPx(name: string): boolean {
  return name === '--tl-row-height'
}

/** color input принимает только #rrggbb; конвертируем hex/rgba/hsl из значений темы */
function toHex(c?: string): string {
  if (!c) return '#000000'
  const s = c.trim()
  if (/^#[0-9a-f]{6}$/i.test(s)) return s
  const m4 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i)
  if (m4) return `#${m4[1]}${m4[1]}${m4[2]}${m4[2]}${m4[3]}${m4[3]}`
  const m6 = s.match(/^#([0-9a-f]{6})[0-9a-f]*$/i)
  if (m6) return `#${m6[1]}`
  const nums = s.match(/(\d+(?:\.\d+)?)/g)
  if (nums && nums.length >= 3) {
    const [r, g, b] = nums.map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))))
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  }
  return '#000000'
}

const opt = computed(() => props.options)

function patch(p: Partial<TimelineOptions>) {
  emit('update:options', { ...opt.value, ...p })
}

const timezones = [
  'Asia/Yerevan',
  'Europe/Amsterdam',
  'UTC',
  'America/New_York',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const locales = ['en', 'ru', 'hy', 'de', 'fr']
</script>

<template>
  <aside class="panel">
    <div class="panel-head">
      <span class="panel-title">Настройки</span>
      <button class="btn-reset" @click="emit('reset')">Сбросить</button>
    </div>

    <section class="group">
      <h4 class="group-title">Поведение</h4>
      <label class="switch">
        <input type="checkbox" :checked="opt.canCreate ?? true" @change="patch({ canCreate: ($event.target as HTMLInputElement).checked })" />
        <span class="slider"></span><span class="lbl">Создание по клику</span>
      </label>
      <label class="switch">
        <input type="checkbox" :checked="opt.canEdit ?? true" @change="patch({ canEdit: ($event.target as HTMLInputElement).checked })" />
        <span class="slider"></span><span class="lbl">Drag / resize</span>
      </label>
      <label class="switch">
        <input type="checkbox" :checked="opt.canDelete ?? true" @change="patch({ canDelete: ($event.target as HTMLInputElement).checked })" />
        <span class="slider"></span><span class="lbl">Удаление событий</span>
      </label>
      <label class="switch">
        <input type="checkbox" :checked="opt.allowOverlap ?? false" @change="patch({ allowOverlap: ($event.target as HTMLInputElement).checked })" />
        <span class="slider"></span><span class="lbl">Разрешить наложения</span>
      </label>
    </section>

    <section class="group">
      <h4 class="group-title">Внешний вид</h4>
      <label class="switch">
        <input type="checkbox" :checked="opt.showCurrentTime ?? true" @change="patch({ showCurrentTime: ($event.target as HTMLInputElement).checked })" />
        <span class="slider"></span><span class="lbl">Линия текущего времени</span>
      </label>
      <label class="switch">
        <input type="checkbox" :checked="opt.showGrid ?? true" @change="patch({ showGrid: ($event.target as HTMLInputElement).checked })" />
        <span class="slider"></span><span class="lbl">Сетка</span>
      </label>
      <label class="switch">
        <input type="checkbox" :checked="loading" @change="emit('update:loading', ($event.target as HTMLInputElement).checked)" />
        <span class="slider"></span><span class="lbl">Состояние loading</span>
      </label>
      <div class="field">
        <span class="field-lbl">Высота строки: {{ rowHeight }}px</span>
        <input
          type="range" min="28" max="80" step="1" :value="rowHeight"
          @input="emit('update:rowHeight', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </section>

    <section class="group">
      <h4 class="group-title">Тема и цвета</h4>
      <label class="switch">
        <input type="checkbox" :checked="themeDark" @change="emit('update:themeDark', ($event.target as HTMLInputElement).checked)" />
        <span class="slider"></span><span class="lbl">Тёмная тема (data-theme)</span>
      </label>
      <ul class="color-list">
        <li v-for="t in COLOR_TOKENS" :key="t.name" class="color-item">
          <input
            v-if="!isPx(t.name)"
            type="color"
            class="color-input"
            :value="toHex(colors[t.name])"
            @input="setColor(t.name, ($event.target as HTMLInputElement).value)"
          />
          <div class="color-meta">
            <span class="color-label">{{ t.label }}</span>
            <code class="color-name">{{ t.name }}</code>
          </div>
          <input
            v-if="isPx(t.name)"
            type="number"
            class="num-input"
            min="16" max="120" step="1"
            :value="parseInt(colors[t.name], 10) || 40"
            @input="setColor(t.name, (($event.target as HTMLInputElement).value || '40') + 'px')"
          />
        </li>
      </ul>
      <button class="btn-add" @click="emit('reset-colors')">↺ Сбросить цвета к дефолтным</button>
    </section>

    <section class="group">
      <h4 class="group-title">Время и зум</h4>
      <div class="field">
        <span class="field-lbl">Мин. ячейка: {{ opt.minCellMinutes ?? 15 }} мин</span>
        <input
type="range" min="1" max="120" step="1" :value="opt.minCellMinutes ?? 15"
          @input="patch({ minCellMinutes: Number(($event.target as HTMLInputElement).value) })"
/>
      </div>
      <div class="field">
        <span class="field-lbl">Мин. длительность: {{ opt.minDurationMinutes ?? 15 }} мин</span>
        <input
type="range" min="5" max="240" step="5" :value="opt.minDurationMinutes ?? 15"
          @input="patch({ minDurationMinutes: Number(($event.target as HTMLInputElement).value) })"
/>
      </div>
      <div class="field">
        <span class="field-lbl">Стартовый зум: {{ (opt.initialPxPerMin ?? 1.2).toFixed(1) }} px/мин</span>
        <input
type="range" min="0.2" max="6" step="0.1" :value="opt.initialPxPerMin ?? 1.2"
          @input="patch({ initialPxPerMin: Number(($event.target as HTMLInputElement).value) })"
/>
      </div>
    </section>

    <section class="group">
      <h4 class="group-title">Локаль и пояс</h4>
      <div class="field">
        <span class="field-lbl">Язык интерфейса</span>
        <select class="sel" :value="locale" @change="emit('update:locale', ($event.target as HTMLSelectElement).value)">
          <option v-for="l in locales" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>
      <div class="field">
        <span class="field-lbl">Часовой пояс (options.timezone)</span>
        <select class="sel" :value="opt.timezone ?? ''" @change="patch({ timezone: ($event.target as HTMLSelectElement).value || undefined })">
          <option value="">системный</option>
          <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
        </select>
      </div>
    </section>

    <section class="group">
      <h4 class="group-title">Ресурсы ({{ resources.length }})</h4>
      <ul class="res-list">
        <li v-for="r in resources" :key="r.id" class="res-item">
          <span class="res-dot" :style="{ background: r.color ?? '#7c89a6' }"></span>
          <span class="res-name">{{ r.title }}</span>
          <button class="btn-x" title="Удалить ресурс" @click="emit('remove-resource', r.id)">✕</button>
        </li>
      </ul>
      <button class="btn-add" @click="emit('add-resource')">+ Добавить ресурс</button>
    </section>
  </aside>
</template>

<style scoped>
.panel {
  width: 300px;
  flex-shrink: 0;
  background: var(--pg-surface);
  border: 1px solid var(--pg-border);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  max-height: calc(100vh - 150px);
  box-shadow: var(--pg-shadow);
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--pg-bg);
  border: 1px solid var(--pg-border);
  border-radius: 10px;
}
.group-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--pg-muted);
}
.switch {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.switch input {
  display: none;
}
.slider {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 20px;
  background: #cbd5e1;
  transition: background 0.18s ease;
  flex-shrink: 0;
}
.slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.3);
  transition: transform 0.18s ease;
}
.switch input:checked + .slider {
  background: var(--pg-accent);
}
.switch input:checked + .slider::after {
  transform: translateX(14px);
}
.lbl {
  font-size: 13px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.field-lbl {
  font-size: 12px;
  color: var(--pg-text);
  font-weight: 500;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--pg-accent);
}
.sel {
  padding: 7px 9px;
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
.res-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.res-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--pg-surface);
  border: 1px solid var(--pg-border);
}
.res-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.color-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 7px;
  border-radius: 8px;
  background: var(--pg-surface);
  border: 1px solid var(--pg-border);
}
.color-input {
  width: 26px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--pg-border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.num-input {
  width: 64px;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid var(--pg-border);
  background: var(--pg-bg);
  color: var(--pg-text);
  font-size: 12px;
}
.color-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.color-label {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.color-name {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10.5px;
  color: var(--pg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.res-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-x {
  border: none;
  background: transparent;
  color: var(--pg-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 5px;
}
.btn-x:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}
.btn-add,
.btn-reset {
  border: 1px dashed var(--pg-border);
  background: var(--pg-surface);
  color: var(--pg-text);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-add:hover,
.btn-reset:hover {
  border-color: var(--pg-accent);
  color: var(--pg-accent);
}
</style>
