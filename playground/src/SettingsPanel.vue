<script setup lang="ts">
/**
 * Панель настроек playground: управляет TimelineOptions и демо-данными.
 */
import { computed } from 'vue'
import type { TimelineOptions, TimelineResource } from '../../src/types'

const props = defineProps<{
  options: TimelineOptions
  resources: TimelineResource[]
  rowHeight: number
  locale: string
}>()

const emit = defineEmits<{
  (e: 'update:options', v: TimelineOptions): void
  (e: 'update:rowHeight', v: number): void
  (e: 'update:locale', v: string): void
  (e: 'add-resource'): void
  (e: 'remove-resource', id: string | number): void
  (e: 'reset'): void
}>()

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
      <div class="field">
        <span class="field-lbl">Высота строки: {{ rowHeight }}px</span>
        <input
          type="range" min="28" max="80" step="1" :value="rowHeight"
          @input="emit('update:rowHeight', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
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
