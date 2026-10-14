/**
 * Лёгкий i18n для playground: словарь строк интерфейса по языкам + composable useI18n.
 * Язык — глобальный (reactive ref), переключается флагами в топбаре или селектом в настройках.
 */
import { computed, ref } from 'vue'
import dayjs from 'dayjs'

// dayjs-локали для языков playground: Timeline лениво подгружает только 'ru',
// остальные подгружаем здесь, чтобы линейка/тултип реально переводились при смене языка.
import 'dayjs/locale/de'
import 'dayjs/locale/fr'
import 'dayjs/locale/hy-am'

export interface LanguageMeta {
  code: string
  name: string   // короткое имя для кнопки с флагом
  title: string  // подсказка (полное название языка)
  flag: string   // SVG-флаг (data URI, без внешних зависимостей)
}

/** Флаг из трёх горизонтальных полос (CSS-градиент внутри SVG 3:2) */
const tri = (a: string, b: string, c: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">` +
      `<rect width="3" height="2" fill="${a}"/>` +
      `<rect y="0.667" width="3" height="0.667" fill="${b}"/>` +
      `<rect y="1.333" width="3" height="0.667" fill="${c}"/></svg>`,
  )

/** UK: Union Jack в упрощённой версии (синий фон, белый+красный диагональный и прямой кресты) */
const ukFlag =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">` +
      `<clipPath id="s"><path d="M0,0 v40 h60 v-40 z"/></clipPath>` +
      `<g clip-path="url(#s)">` +
      `<path d="M0,0 v40 h60 v-40 z" fill="#012169"/>` +
      `<path d="M0,0 l30,20 M30,20 l30,20 M0,40 l30,-20 M30,20 l30,-20" stroke="#fff" stroke-width="8"/>` +
      `<path d="M0,0 l30,20 M30,20 l30,20 M0,40 l30,-20 M30,20 l30,-20" stroke="#C8102E" stroke-width="4"/>` +
      `<path d="M30,0 v40 M0,20 h60" stroke="#fff" stroke-width="12"/>` +
      `<path d="M30,0 v40 M0,20 h60" stroke="#C8102E" stroke-width="8"/>` +
      `</g></svg>`,
  )

/** ARM: красный-синий-оранжевый + маленький гербовый мотив не рисуем — достаточно полос */
export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'EN', title: 'English', flag: ukFlag },
  { code: 'ru', name: 'RU', title: 'Русский', flag: tri('#ffffff', '#0039a6', '#d52b1e') },
  { code: 'hy', name: 'HY', title: 'Հայերեն', flag: tri('#d90012', '#0033a0', '#f2a800') },
  { code: 'de', name: 'DE', title: 'Deutsch', flag: tri('#000000', '#dd0000', '#ffce00') },
  { code: 'fr', name: 'FR', title: 'Français', flag: tri('#002395', '#ffffff', '#ed2939') },
]

type Dict = Record<string, string>

const en: Dict = {
  'app.subtitle': 'Playground — interactive demo & settings',
  'topbar.events': '{n} events',
  'topbar.resources': '{n} resources',
  'topbar.createGroup': 'Group on create',
  'topbar.noGroup': 'no group',
  'topbar.addEvent': '+ Event',
  'topbar.addGroupsDemo': '+ rental/service groups',
  'topbar.clear': 'Clear',
  'topbar.testLoading': 'Test loading',
  'topbar.stopLoading': 'Stop loading',
  'panel.settings': 'Settings',
  'panel.reset': 'Reset',
  'panel.behavior': 'Behavior',
  'panel.canCreate': 'Create by click',
  'panel.canEdit': 'Drag / resize',
  'panel.canDelete': 'Delete events',
  'panel.allowOverlap': 'Allow overlap (global)',
  'panel.groupsTitle': 'Event groups (eventGroups)',
  'panel.groupsHint': 'Per-group allowOverlap. Global "Allow overlap = false" overrides every group.',
  'panel.groupName': 'Group name',
  'panel.addGroup': '+ Add',
  'panel.deleteGroup': 'Delete group',
  'panel.overlapFor': 'allowOverlap',
  'panel.groupsDisabled': 'Global allowOverlap=false — group settings are ignored',
  'panel.zoom': 'Zoom',
  'panel.rows': 'Rows',
  'panel.currentGroup': 'Current group',
  'panel.allGroups': 'All groups',
  'panel.noGroupsYet': 'No groups yet',
  'panel.globalAllowOverlap': 'Global allowOverlap',
  'panel.on': 'on',
  'panel.off': 'off',
  'panel.true': 'true',
  'panel.false': 'false',
  'panel.localeInterface': 'Interface language',
  'panel.timezone': 'Timezone (options.timezone)',
  'panel.system': 'system',
  'panel.resourcesCount': 'Resources ({n})',
  'panel.removeResource': 'Remove resource',
  'panel.addResource': '+ Add resource',
  'panel.theme': 'Theme',
  'panel.dark': 'Dark theme',
  'panel.colors': 'Colors',
  'panel.resetColors': 'Reset colors',
  'panel.loading': 'Loading',
  'panel.showLoading': 'Show loading spinner',
  'panel.rowsSection': 'Rows',
  'panel.rowHeight': 'Row height',
  'panel.time': 'Time',
  'panel.minCell': 'Min cell (min)',
  'panel.minDuration': 'Min duration (min)',
  'panel.startZoom': 'Start zoom: {v} px/min',
  'panel.overlapPriority': 'Priority: global false > event override > group > global value',
  'panel.forNewGroup': 'for the new group',
  'panel.appearance': 'Appearance',
  'panel.showCurrentTime': 'Current time line',
  'panel.showGrid': 'Grid',
  'panel.loadingState': 'Loading state',
  'panel.themeColors': 'Theme & colors',
  'panel.tokens': 'tokens',
  'panel.darkTheme': 'Dark theme (data-theme)',
  'panel.resetColorsDefault': 'Reset colors to defaults',
  'panel.timeZoom': 'Time & zoom',
  'panel.minutes': 'min',
  'panel.localeTz': 'Locale & timezone',
  'info.viewport': 'Current viewport',
  'info.selected': 'Selected event',
  'info.none': 'not selected',
  'info.eventGroup': 'Event group:',
  'info.groupsCard': 'Groups (T-36)',
  'info.noEvents': 'no events',
  'info.groupsHint': 'rental — overlaps forbidden, service — allowed. But if global allowOverlap = false, it overrides the groups: no overlaps anywhere.',
  'info.log': 'Event log',
  'info.logHint': '(create / save / delete / select)',
  'info.logEmpty': 'empty — drag an event or click the canvas',
  'group.none': 'no group',
  'header.zoom': 'zoom {v}',
}

const ru: Dict = {
  'app.subtitle': 'Playground — интерактивная демонстрация и настройки',
  'topbar.events': '{n} событий',
  'topbar.resources': '{n} ресурсов',
  'topbar.createGroup': 'Группа при создании',
  'topbar.noGroup': 'без группы',
  'topbar.addEvent': '+ Событие',
  'topbar.addGroupsDemo': '+ Группы rental/service',
  'topbar.clear': 'Очистить',
  'topbar.testLoading': 'Тест loading',
  'topbar.stopLoading': 'Стоп loading',
  'panel.settings': 'Настройки',
  'panel.reset': 'Сбросить',
  'panel.behavior': 'Поведение',
  'panel.canCreate': 'Создание по клику',
  'panel.canEdit': 'Drag / resize',
  'panel.canDelete': 'Удаление событий',
  'panel.allowOverlap': 'Разрешить наложения (глобально)',
  'panel.groupsTitle': 'Группы событий (eventGroups)',
  'panel.groupsHint': 'allowOverlap для каждой группы. Глобальный «Разрешить наложения = false» перебивает любую группу.',
  'panel.groupName': 'Имя группы',
  'panel.addGroup': '+ Добавить',
  'panel.deleteGroup': 'Удалить группу',
  'panel.overlapFor': 'allowOverlap',
  'panel.groupsDisabled': 'Глобальный allowOverlap=false — настройки групп игнорируются',
  'panel.zoom': 'Зум',
  'panel.rows': 'Строки',
  'panel.currentGroup': 'Текущая группа',
  'panel.allGroups': 'Все группы',
  'panel.noGroupsYet': 'Групп пока нет',
  'panel.globalAllowOverlap': 'Глобальный allowOverlap',
  'panel.on': 'вкл',
  'panel.off': 'выкл',
  'panel.true': 'true',
  'panel.false': 'false',
  'panel.localeInterface': 'Язык интерфейса',
  'panel.timezone': 'Часовой пояс (options.timezone)',
  'panel.system': 'системный',
  'panel.resourcesCount': 'Ресурсы ({n})',
  'panel.removeResource': 'Удалить ресурс',
  'panel.addResource': '+ Добавить ресурс',
  'panel.theme': 'Тема',
  'panel.dark': 'Тёмная тема',
  'panel.colors': 'Цвета',
  'panel.resetColors': 'Сбросить цвета',
  'panel.loading': 'Загрузка',
  'panel.showLoading': 'Показать спиннер загрузки',
  'panel.rowsSection': 'Строки',
  'panel.rowHeight': 'Высота строки',
  'panel.time': 'Время',
  'panel.minCell': 'Мин. ячейка (мин)',
  'panel.minDuration': 'Мин. длительность (мин)',
  'panel.startZoom': 'Стартовый зум: {v} px/мин',
  'panel.overlapPriority': 'Приоритет: глобальный false > override события > группа > глобальное значение',
  'panel.forNewGroup': 'для новой группы',
  'panel.appearance': 'Внешний вид',
  'panel.showCurrentTime': 'Линия текущего времени',
  'panel.showGrid': 'Сетка',
  'panel.loadingState': 'Состояние loading',
  'panel.themeColors': 'Тема и цвета',
  'panel.tokens': 'токенов',
  'panel.darkTheme': 'Тёмная тема (data-theme)',
  'panel.resetColorsDefault': 'Сбросить цвета к дефолтным',
  'panel.timeZoom': 'Время и зум',
  'panel.minutes': 'мин',
  'panel.localeTz': 'Локаль и пояс',
  'info.viewport': 'Текущий viewport',
  'info.selected': 'Выбранное событие',
  'info.none': 'не выбрано',
  'info.eventGroup': 'Группа события:',
  'info.groupsCard': 'Группы (T-36)',
  'info.noEvents': 'нет событий',
  'info.groupsHint': 'rental — наложения запрещены, service — разрешены. Но если глобальный allowOverlap = false, он перебивает группы: накладываться нельзя нигде.',
  'info.log': 'Журнал событий',
  'info.logHint': '(create / save / delete / select)',
  'info.logEmpty': 'пусто — потягай событие или кликни по канвасу',
  'group.none': 'без группы',
  'header.zoom': 'зум {v}',
}

const hy: Dict = {
  ...en,
  'app.subtitle': 'Playground — ինտերակտիվ ցուցադրություն և կարգավորումներ',
  'topbar.addEvent': '+ Իրադարձություն',
  'topbar.clear': 'Մաքրել',
  'panel.settings': 'Կարգավորումներ',
  'panel.reset': 'Վերականգնել',
  'info.viewport': 'Ընթացիկ տեսահատված',
  'info.none': 'ընտրված չէ',
}

const de: Dict = {
  ...en,
  'app.subtitle': 'Playground — interaktive Demo & Einstellungen',
  'topbar.events': '{n} Ereignisse',
  'topbar.resources': '{n} Ressourcen',
  'topbar.createGroup': 'Gruppe beim Erstellen',
  'topbar.noGroup': 'ohne Gruppe',
  'topbar.addEvent': '+ Ereignis',
  'topbar.clear': 'Leeren',
  'panel.settings': 'Einstellungen',
  'panel.reset': 'Zurücksetzen',
  'panel.behavior': 'Verhalten',
  'panel.canCreate': 'Erstellen per Klick',
  'panel.canDelete': 'Ereignisse löschen',
  'panel.allowOverlap': 'Überlappung erlauben (global)',
  'panel.groupsTitle': 'Ereignisgruppen (eventGroups)',
  'panel.groupName': 'Gruppenname',
  'panel.addGroup': '+ Hinzufügen',
  'panel.deleteGroup': 'Gruppe löschen',
  'panel.localeInterface': 'Oberflächensprache',
  'panel.timezone': 'Zeitzone (options.timezone)',
  'panel.system': 'System',
  'panel.resourcesCount': 'Ressourcen ({n})',
  'panel.addResource': '+ Ressource hinzufügen',
  'panel.theme': 'Design',
  'panel.dark': 'Dunkles Design',
  'panel.colors': 'Farben',
  'panel.resetColors': 'Farben zurücksetzen',
  'panel.rowsSection': 'Zeilen',
  'panel.rowHeight': 'Zeilenhöhe',
  'panel.time': 'Zeit',
  'info.viewport': 'Aktueller Viewport',
  'info.selected': 'Ausgewähltes Ereignis',
  'info.none': 'nicht ausgewählt',
  'info.eventGroup': 'Ereignisgruppe:',
  'info.log': 'Ereignisprotokoll',
  'group.none': 'ohne Gruppe',
  'header.zoom': 'Zoom {v}',
}

const fr: Dict = {
  ...en,
  'app.subtitle': 'Playground — démo interactive et paramètres',
  'topbar.events': '{n} événements',
  'topbar.resources': '{n} ressources',
  'topbar.createGroup': 'Groupe à la création',
  'topbar.noGroup': 'sans groupe',
  'topbar.addEvent': '+ Événement',
  'topbar.clear': 'Effacer',
  'panel.settings': 'Paramètres',
  'panel.reset': 'Réinitialiser',
  'panel.behavior': 'Comportement',
  'panel.canCreate': 'Création au clic',
  'panel.canDelete': 'Supprimer les événements',
  'panel.allowOverlap': 'Autoriser le chevauchement (global)',
  'panel.groupsTitle': 'Groupes d’événements (eventGroups)',
  'panel.groupName': 'Nom du groupe',
  'panel.addGroup': '+ Ajouter',
  'panel.deleteGroup': 'Supprimer le groupe',
  'panel.localeInterface': 'Langue de l’interface',
  'panel.timezone': 'Fuseau horaire (options.timezone)',
  'panel.system': 'système',
  'panel.resourcesCount': 'Ressources ({n})',
  'panel.addResource': '+ Ajouter une ressource',
  'panel.theme': 'Thème',
  'panel.dark': 'Thème sombre',
  'panel.colors': 'Couleurs',
  'panel.resetColors': 'Réinitialiser les couleurs',
  'panel.rowsSection': 'Lignes',
  'panel.rowHeight': 'Hauteur de ligne',
  'panel.time': 'Temps',
  'info.viewport': 'Viewport actuel',
  'info.selected': 'Événement sélectionné',
  'info.none': 'aucune sélection',
  'info.eventGroup': 'Groupe de l’événement :',
  'info.log': 'Journal des événements',
  'group.none': 'sans groupe',
  'header.zoom': 'zoom {v}',
}

export const MESSAGES: Record<string, Dict> = { en, ru, hy, de, fr }

/** Глобальный язык playground (общий для топбара, панели настроек и info-карточек) */
export const currentLocale = ref<string>('en')

/** Код языка → имя dayjs-локали (у армянского в dayjs код 'hy-am', не 'hy') */
export function dayjsLocaleFor(code: string): string {
  return code === 'hy' ? 'hy-am' : code
}

/** Локаль dayjs, наследованная от глобального языка (Timeline получает её через prop locale) */
export const timelineDayjsLocale = computed(() => dayjsLocaleFor(currentLocale.value))

// dayjs не знает короткого кода 'hy' (его локаль называется 'hy-am'), поэтому
// регистрируем алиас-объект: любой код языка playground корректно локализирует даты.
dayjs.locale('hy', { ...dayjs.Ls['hy-am'], name: 'hy' })

/**
 * Смена глобального языка. Возвращает true, если язык поддерживается;
 * неизвестный код игнорируется (язык остаётся прежним).
 */
export function setLocale(code: string): boolean {
  if (!MESSAGES[code]) return false
  currentLocale.value = code
  return true
}

/** Перевод строки по ключу; неизвестный ключ/язык → en; подстановка {token} из params */
export function translate(key: string, params?: Record<string, string | number>): string {
  const dict = MESSAGES[currentLocale.value] ?? en
  const template = dict[key] ?? en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, t) => String(params[t] ?? ''))
}

export function useI18n() {
  const locale = computed(() => currentLocale.value)
  const t = (key: string, params?: Record<string, string | number>) => translate(key, params)
  return { locale, t, setLocale, languages: LANGUAGES }
}
