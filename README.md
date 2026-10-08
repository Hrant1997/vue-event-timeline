# vue-event-timeline

Легковесный и кастомизируемый компонент таймлайна для Vue 3.

## Установка
npm install vue-event-timeline

## Использование

vue
<template>
<EventTimeline
:events="events"
:resources="resources"
@create="handleCreate"
/>
</template>