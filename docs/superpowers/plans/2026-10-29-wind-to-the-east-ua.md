# План реалізації проєкту Wind to the East

> **Для агентів-виконавців:** ОБОВ'ЯЗКОВИЙ ПІДСКІЛ: Використовуйте `superpowers:subagent-driven-development` (рекомендовано) або `superpowers:executing-plans` для покрокового виконання цього плану задача за задачею. Для відстеження кроків використовується синтаксис чекбоксів (`- [ ]`).

**Мета:** Створити автономний веб-додаток (SPA) у темній тактичній авіаційній стилістиці (`Wind to the East`) для моніторингу погоди у будь-якій точці світу. Сервіс забезпечує погодинний прогноз швидкості та поривів вітру (`м/с`), метеорологічного напрямку за флюгером (`стрілка + градуси`), температури (`°C`), хмарності (`%`), вологості (`%`) та опадів (`мм` / `%`) від поверхні землі до `5000 м AGL` з пошуком через `WGS 84`, `MGRS`, міжнародний геокодинг міст або інтерактивну мапу.

**Архітектура:** Клієнтський Single Page Application (SPA) на базі Vue 3 зі стилізацією через Tailwind CSS v4, чистими модульними ES-доменами (`coordinates`, `windVane`, `datetime`, `atmosphere`) та клієнтом відкритого API Open-Meteo (`openMeteo`). Усі вертикальні інтерполяції AGL (`0–5000 м`), авіаційне моделювання поривів (Wind Shear) та конвертація `WGS 84 ↔ MGRS` виконуються безпосередньо в браузері. Результатом збірки є статичний бандл (`dist/`), готовий до розгортання через Nginx або Docker.

**Технологічний стек:** Vue 3, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Leaflet (`leaflet` + карти OpenStreetMap), `mgrs`, Vitest + `@vue/test-utils` + `jsdom`, Nginx / Docker.

**Специфікація (дизайн-документ):** `docs/superpowers/specs/2026-10-29-wind-to-the-east-design.md`

## Глобальні обмеження та вимоги

- **Одиниці швидкості та поривів вітру:** виключно метри на секунду (`м/с`), параметр Open-Meteo `wind_speed_unit=ms`.
- **Одиниці температури:** градуси Цельсія (`°C`), параметр Open-Meteo `temperature_unit=celsius`.
- **Одиниці хмарності, вологості, ймовірності опадів:** відсотки (`%`).
- **Одиниці кількості опадів:** міліметри (`мм`), параметр Open-Meteo `precipitation_unit=mm`.
- **Напрямок вітру:** класичний метеорологічний флюгер («звідки дме вітер») із графічною стрілкою та точним числовим значенням у градусах `0°–359°` (наприклад, `↑ 0°` для північного вітру, `↗ 45°` для північно-східного).
- **Формат дат:** суворо `день\місяць\рік` зі зворотним слешем (наприклад, `29\10\2026`) у парі з вибором години від `00` до `23`.
- **Базис висот та рівні AGL:** відлік виключно над рівнем землі (`AGL — Above Ground Level`) за 15 ешелонами: `0` (`Земля`), `25`, `50`, `75`, `100`, `120`, `150`, `200`, `300`, `500`, `1000`, `1500`, `2000`, `3000`, `5000` метрів.
- **Робота без встановлення:** статичний веб-додаток, доступний за посиланням у будь-якому сучасному браузері без завантаження додатків, без реєстрацій та платних ключів.
- **Міжнародний геокодинг:** глобальний пошук населених пунктів по всій планеті (GeoNames + OpenStreetMap) без прив'язки до окремих країн, з підтримкою міжнародної латиниці та кирилиці.
- **Мова інтерфейсу:** усі підписи, вкладки, таблиці та повідомлення валідації українською мовою.

## Фокус тестування та критичні граничні випадки

1. **Підземні ізобаричні рівні тиску на висотах рельєфу (наприклад, гори `1400 м MSL`, де рівень `1000 hPa` лежить на висоті `110 м MSL` під землею):** Будь-який ізобаричний рівень із `geopotentialHeightMsl - elevationMeters <= 180` повинен автоматично відсікатися перед інтерполяцією, щоб підземні дані не спотворювали показники приземного вітру та хмарності. *(Закріплено в Задачі 3)*
2. **Інтерполяція кута вітру через північну межу 360°/0° (`350°` та `10°`):** Інтерполяція та зсув вітру повинні розраховуватися за найкоротшою дугою вектора (середина між `350°` та `10°` дорівнює `0°`, різниця `20°`), а не лінійним усередненням (`180°` — південь). *(Закріплено в Задачі 3)*
3. **Гнучкість і валідація форматів MGRS та WGS 84:** Координати MGRS із пробілами чи малим регістром (`"36u ua 65200 04800"`) та координати WGS 84 через кому або пробіл (`"50.4501, 30.5234"`) повинні успішно розпізнаватися. Невалідні координати (широта > 90°, полярні зони MGRS > 84° або < -80°) мають повертати зрозумілу помилку валідації замість збою або маркера на `[NaN, NaN]`. *(Закріплено в Задачі 1)*
4. **Перехід календарних дат та інвертовані інтервали `ДД\ММ\РРРР`:** Неіснуючі дати на кшталт `"31\\02\\2026"` повинні відхилятися (без неявного переносу JS на березень), а інтервали, де дата кінця раніша за дату початку, повинні сигналізувати про помилку українською мовою. *(Закріплено в Задачі 2)*
5. **Часткові значення `null` та мережеві помилки API:** Значення `null` у метеоданих повинні коректно відображатися як `"—"` без появи `NaN`, а у разі збою мережі інтерфейс повинен показувати банер із можливістю повтору, зберігаючи попередній успішний прогноз на екрані. *(Закріплено в Задачі 4 та Задачі 6)*

---

## Структура файлів проєкту

```text
wind_to_the_east/
├── index.html                          # Вхідний HTML (lang="uk", темний фон, Leaflet CSS, #app)
├── package.json                        # Скрипти (dev, build, preview, test) та залежності
├── vite.config.js                      # Конфігурація Vite + Vue + Tailwind v4 + Vitest
├── .gitignore                          # Ігнорування node_modules/, dist/, .tmp/, .env
├── Dockerfile                          # Мультистейдж збірка (node:22-alpine -> nginx:1.27-alpine)
├── nginx.conf                          # Конфігурація Nginx з підтримкою SPA та gzip
├── DEPLOY.md                           # Коротка інструкція розгортання на сервері (Nginx / Docker)
├── src/
│   ├── main.js                         # Точка входу Vue 3, імпорт стилів
│   ├── style.css                       # Базові стилі Tailwind v4 та темна авіаційна палітра
│   ├── App.vue                         # Головний компонент, вкладки («Прогноз», «Профіль вітру», «Карта»)
│   ├── domain/
│   │   ├── coordinates.js              # Конвертація та валідація WGS 84 <-> MGRS
│   │   ├── windVane.js                 # Форматування флюгера та стрілок напрямку вітру
│   │   ├── datetime.js                 # Парсинг ДД\ММ\РРРР + годин, фільтрація діапазонів
│   │   └── atmosphere.js               # 15 AGL рівнів, інтерполяція, пориви Wind Shear та хмарність
│   ├── services/
│   │   └── openMeteo.js                # Запити до Open-Meteo (14 днів + рівні тиску) та геокодинг міст
│   └── components/
│       ├── LocationControls.vue        # Пошук міст + перемикач вводу WGS 84 / MGRS
│       ├── TimeAltitudeFilters.vue     # Режими («Тут і зараз» / інтервал), дати ДД\ММ\РРРР, вибір AGL
│       ├── CurrentConditionsCard.vue   # Експрес-картка поточного стану на вибраній висоті
│       ├── ForecastTable.vue           # Вкладка «Прогноз»: погодинна таблиця для вибраної висоти AGL
│       ├── WindProfileTable.vue        # Вкладка «Профіль вітру»: зріз 15 рівнів (0–5000 м) на вибрану годину
│       └── WorldMapPicker.vue          # Вкладка «Карта»: інтерактивна мапа Leaflet із маркером
└── tests/
    ├── coordinates.test.js             # Тести для coordinates.js та windVane.js
    ├── datetime.test.js                # Тести для datetime.js
    ├── atmosphere.test.js              # Тести для atmosphere.js
    ├── openMeteo.test.js               # Тести для openMeteo.js
    ├── controls.test.js                # Тести компонентів керування та фільтрів
    └── dashboard.test.js               # Інтеграційні тести всього дашборду
```

---

### Задача 1: Налаштування оточення, модуль координат (`WGS 84 ↔ MGRS`) та флюгер

**Файли:**
- Створити: `.gitignore`
- Створити: `package.json`
- Створити: `vite.config.js`
- Створити: `src/domain/coordinates.js`
- Створити: `src/domain/windVane.js`
- Тест: `tests/coordinates.test.js`

**Інтерфейси:**
- Використовує: бібліотеку `mgrs` (`forward([lon, lat], accuracy)`, `toPoint(mgrsStr)`).
- Надає:
  - `src/domain/coordinates.js`:
    - `parseWgs84(input: string): { ok: true, lat: number, lon: number } | { ok: false, error: string }`
    - `formatWgs84(lat: number, lon: number, decimals?: number): string`
    - `wgs84ToMgrs(lat: number, lon: number, accuracy?: number): { ok: true, mgrs: string } | { ok: false, error: string }`
    - `parseMgrs(input: string): { ok: true, lat: number, lon: number, mgrs: string } | { ok: false, error: string }`
  - `src/domain/windVane.js`:
    - `normalizeDegrees(deg: number): number`
    - `degreesToVaneArrow(deg: number): string`
    - `formatWindDirection(deg: number | null | undefined): { arrow: string, degrees: number | null, label: string }`

- [ ] **Крок 1: Перевірити наявність Git і Node.js, ініціалізувати репозиторій та встановити пакети**

Перевірити `git --version` та `node --version`. За потреби інсталювати через winget або завантажити портативні бінарники, виконати `git init`, налаштувати `.gitignore`, створити `package.json` та `vite.config.js` з `@vitejs/plugin-vue`, `@tailwindcss/vite`, `jsdom`, встановити залежності: `vue`, `leaflet`, `mgrs`, `tailwindcss`, `vitest`, `@vue/test-utils`.

- [ ] **Крок 2: Написати падаючі тести в `tests/coordinates.test.js`**

Створити файл тестів, що перевіряє парсинг WGS 84 (через кому і пробіл), відхилення невалідних координат, двосторонній перехід WGS 84 ↔ MGRS (зокрема для координат Києва, з урахуванням пробілів та малого регістру MGRS), відхилення полярних широт та форматування стрілок флюгера (`0° -> ↑`, `45° -> ↗`, `90° -> →` тощо).

- [ ] **Крок 3: Запустити тест і переконатися у падінні**

Команда: `npx vitest run tests/coordinates.test.js`
Очікувано: FAIL (модулі ще не створені).

- [ ] **Крок 4: Реалізувати `src/domain/coordinates.js` та `src/domain/windVane.js`**

Написати логіку валідації широт/довгот, виклику функцій `mgrs.forward` та `mgrs.toPoint` з обробкою помилок, нормалізацію кутів у діапазон `0..359°` та мапінг стрілок флюгера `['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']`.

- [ ] **Крок 5: Запустити тести і переконатися в успішному проходженні**

Команда: `npx vitest run tests/coordinates.test.js`
Очікувано: PASS (усі тести зелені).

- [ ] **Крок 6: Закомітити зміни**

`git commit -m "feat: scaffold Vite project and add WGS84/MGRS & wind vane domain modules"`

---

### Задача 2: Парсер дат `ДД\ММ\РРРР` та фільтрація часових діапазонів

**Файли:**
- Створити: `src/domain/datetime.js`
- Тест: `tests/datetime.test.js`

**Інтерфейси:**
- Надає:
  - `formatDateSlashes(parts: { day: number, month: number, year: number }): string`
  - `parseDateSlashes(input: string): { ok: true, day: number, month: number, year: number, normalized: string } | { ok: false, error: string }`
  - `validateTimeRange(range: { startDate: string, startHour: number, endDate: string, endHour: number }): { ok: true, startIsoHour: string, endIsoHour: string } | { ok: false, error: string }`
  - `filterHoursByRange<T extends { timeIso: string }>(records: T[], range: { startIsoHour: string, endIsoHour: string }): T[]`
  - `isoHourToDisplay(timeIso: string): { dateStr: string, hourStr: string, fullLabel: string }`
  - `findCurrentHourRecord<T extends { timeIso: string }>(records: T[], nowIsoHour?: string): T | null`

- [ ] **Крок 1: Написати падаючі тести в `tests/datetime.test.js`**

Перевірка строгого форматування `ДД\ММ\РРРР`, відхилення неіснуючих дат (`31\02\2026`, `29\02\2026` для невисокосного року), валідація одночасових і багатоденних діапазонів, блокування ситуацій, коли кінець раніший за початок, інклюзивна фільтрація погодинних записів.

- [ ] **Крок 2: Запустити тест і переконатися у падінні**

Команда: `npx vitest run tests/datetime.test.js`
Очікувано: FAIL.

- [ ] **Крок 3: Реалізувати `src/domain/datetime.js`**

Реалізувати парсинг регулярним виразом `^(\d{1,2})[\\/](\d{1,2})[\\/](\d{4})$`, перевірку через `Date.UTC` на відсутність календарного перенесення, валідацію годин `0..23` та формування ISO-рядків виду `YYYY-MM-DDTHH:00`.

- [ ] **Крок 4: Запустити тест і підтвердити проходження**

Команда: `npx vitest run tests/datetime.test.js`
Очікувано: PASS.

- [ ] **Крок 5: Закомітити зміни**

`git commit -m "feat: add strict DD\\MM\\YYYY date-hour parser and interval filter"`

---

### Задача 3: Висотна атмосфера `0–5000 м AGL` та авіаційна модель поривів (Wind Shear)

**Файли:**
- Створити: `src/domain/atmosphere.js`
- Тест: `tests/atmosphere.test.js`

**Інтерфейси:**
- Використовує: `normalizeDegrees`, `formatWindDirection` з `src/domain/windVane.js`.
- Надає:
  - `AGL_TIERS_METERS: number[]` (15 рівнів: `[0, 25, 50, 75, 100, 120, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 5000]`)
  - `formatAglLabel(aglMeters: number): string` (`0 -> "Земля"`, `5000 -> "5 000 м"`)
  - `interpolateCircularDegrees(degA: number, degB: number, t: number): number`
  - `computeAltitudeProfile(rawHour: RawHourInput): Record<number, AltitudeTierMetrics>`

- [ ] **Крок 1: Написати падаючі тести в `tests/atmosphere.test.js`**

Тести на наявність усіх 15 висотних ешелонів, коректність інтерполяції кутів вітру через 0°/360° (наприклад, 350° та 10° дають 0°), фільтрацію підземних ізобаричних рівнів для гірської місцевості (висота рельєфу 1400 м MSL) та розрахунок поривів вітру за моделлю Wind Shear (рівність швидкості й поривів при ламінарному потоці та зростання поривів при зсуві вітру).

- [ ] **Крок 2: Запустити тест і переконатися у падінні**

Команда: `npx vitest run tests/atmosphere.test.js`
Очікувано: FAIL.

- [ ] **Крок 3: Реалізувати `src/domain/atmosphere.js`**

Побудова вузлів висоти AGL (поверхня, модельні рівні 80м/120м/180м та ізобаричні рівні тиску за мінусом висоти рельєфу), лінійна інтерполяція швидкості вітру, температури, вологості та хмарності, кругова векторна інтерполяція напрямку вітру, розрахунок поривів через згасання приземної турбулентності та градієнт зсуву між сусідніми шарами.

- [ ] **Крок 4: Запустити тест і підтвердити проходження**

Команда: `npx vitest run tests/atmosphere.test.js`
Очікувано: PASS.

- [ ] **Крок 5: Закомітити зміни**

`git commit -m "feat: add 0-5000m AGL atmospheric interpolation and Wind Shear gust model"`

---

### Задача 4: Клієнт Open-Meteo та всесвітній пошук населених пунктів

**Файли:**
- Створити: `src/services/openMeteo.js`
- Тест: `tests/openMeteo.test.js`

**Інтерфейси:**
- Використовує: `computeAltitudeProfile` з `src/domain/atmosphere.js`, `isoHourToDisplay` з `src/domain/datetime.js`.
- Надає:
  - `buildForecastUrl(lat: number, lon: number, forecastDays?: number): string`
  - `normalizeForecastResponse(json: object): { elevationMeters: number, timezone: string, hours: HourlyForecastRecord[] }`
  - `fetchWeatherForecast(lat: number, lon: number, fetchImpl?: typeof fetch): Promise<{ elevationMeters: number, timezone: string, hours: HourlyForecastRecord[] }>`
  - `searchLocations(query: string, fetchImpl?: typeof fetch): Promise<Array<{ id: string | number, name: string, admin1: string, country: string, lat: number, lon: number }>>`

- [ ] **Крок 1: Написати падаючі тести в `tests/openMeteo.test.js`**

Перевірка формування URL із параметрами `wind_speed_unit=ms`, `temperature_unit=celsius`, рівнями тиску 1000..400 hPa, нормалізації відповіді API за наявності часткових значень `null` (без появи `NaN`), викидання інформативної помилки українською мовою у разі недоступності сервера, тестування глобального геокодингу для пошуку міст по всьому світу.

- [ ] **Крок 2: Запустити тест і переконатися у падінні**

Команда: `npx vitest run tests/openMeteo.test.js`
Очікувано: FAIL.

- [ ] **Крок 3: Реалізувати `src/services/openMeteo.js`**

Реалізація запиту до прогнозу Open-Meteo на 14 діб з автоматичним часовим поясом, мапінгу погодинних масивів у масив об'єктів із повним профілем 15 висот AGL, та методу пошуку міст через геокодер Open-Meteo без обмеження країнами.

- [ ] **Крок 4: Запустити тест і підтвердити проходження**

Команда: `npx vitest run tests/openMeteo.test.js`
Очікувано: PASS.

- [ ] **Крок 5: Закомітити зміни**

`git commit -m "feat: add Open-Meteo 14-day pressure-level forecast and geocoding client"`

---

### Задача 5: Панель керування, фільтри, експрес-картка та інтерактивна карта Leaflet

**Файли:**
- Створити: `index.html`
- Створити: `src/style.css`
- Створити: `src/components/LocationControls.vue`
- Створити: `src/components/TimeAltitudeFilters.vue`
- Створити: `src/components/CurrentConditionsCard.vue`
- Створити: `src/components/WorldMapPicker.vue`
- Тест: `tests/controls.test.js`

**Інтерфейси:**
- Компоненти взаємодіють через Props та Emits:
  - `LocationControls.vue`: ввід WGS 84 / MGRS, випадаючий список пошуку міст, подія `select-location`.
  - `TimeAltitudeFilters.vue`: перемикання «Поточна погода» / «Часовий відрізок», поля дат `ДД\ММ\РРРР`, випадаючий список годин `00:00..23:00`, селектор висоти AGL.
  - `CurrentConditionsCard.vue`: зведена плашка «Тут і зараз» на вибраній висоті (вітер, пориви, напрямок флюгера, температура, вологість, опади, хмарність, висота AMSL).
  - `WorldMapPicker.vue`: карта OpenStreetMap з маркером точки, подія `pick-coordinates`.

- [ ] **Крок 1: Написати компонентні тести в `tests/controls.test.js`**

Тестування перемикання режимів WGS 84 / MGRS у полі вводу, валідація формату, відтворення списку з 15 рівнів висоти AGL та полів вибору дат.

- [ ] **Крок 2: Запустити тест і переконатися у падінні**

Команда: `npx vitest run tests/controls.test.js`
Очікувано: FAIL.

- [ ] **Крок 3: Створити стилі, розмітку та Vue-компоненти**

Підключення Tailwind CSS v4 з темною темою, реалізація компонентів керування, експрес-картки поточної погоди та карти на базі Leaflet із коректним викликом `map.invalidateSize()`.

- [ ] **Крок 4: Запустити тест і підтвердити проходження**

Команда: `npx vitest run tests/controls.test.js`
Очікувано: PASS.

- [ ] **Крок 5: Закомітити зміни**

`git commit -m "feat: add location controls, DD\\MM\\YYYY filters, current card, and Leaflet map"`

---

### Задача 6: Таблиці «Прогноз» і «Профіль вітру», дашборд та конфігурація розгортання

**Файли:**
- Створити: `src/components/ForecastTable.vue`
- Створити: `src/components/WindProfileTable.vue`
- Створити: `src/App.vue`
- Створити: `src/main.js`
- Створити: `Dockerfile`
- Створити: `nginx.conf`
- Створити: `DEPLOY.md`
- Тест: `tests/dashboard.test.js`

**Інтерфейси:**
- `ForecastTable.vue`: таблиця погодинного прогнозу на вибраній висоті AGL із флюгерними стрілками, градусами, поривами, опадами, хмарністю.
- `WindProfileTable.vue`: таблиця вертикального зрізу атмосфери (від 5000 м зверху до Землі знизу) на вибрану годину.
- `App.vue`: кореневий стан додатку, перемикання вкладок, координація компонентів, збереження попередніх даних у разі помилки мережі.
- `Dockerfile` та `nginx.conf`: конфігурація сервера для миттєвої віддачі статичних файлів з gzip та кешуванням.
- `DEPLOY.md`: покрокова інструкція запуску сайту на VPS через Nginx або Docker.

- [ ] **Крок 1: Написати інтеграційні тести в `tests/dashboard.test.js`**

Тестування повного циклу: рендеринг шапки з координатами WGS 84 та MGRS, перевірка значень у таблиці прогнозу (м/с, стрілки флюгера, градуси), перемикання на вкладку «Профіль вітру» та перевірка рядків від 5 000 м до Землі, збереження даних на екрані при збої оновлення з показом банера помилки.

- [ ] **Крок 2: Запустити тест і переконатися у падінні**

Команда: `npx vitest run tests/dashboard.test.js`
Очікувано: FAIL.

- [ ] **Крок 3: Реалізувати компоненти таблиць, App.vue, конфіги розгортання та інструкцію**

Створення таблиць у стилі UAV Forecast із виділенням рядків, інтеграція всього додатку в `App.vue`, створення `Dockerfile`, `nginx.conf` та `DEPLOY.md`.

- [ ] **Крок 4: Запустити повний тестовий набір та збірку проєкту**

Команда: `npm test && npm run build`
Очікувано: PASS (усі 6 тестових файлів успішно пройдені, `dist/` створено без помилок).

- [ ] **Крок 5: Закомітити фінальний стан проєкту**

`git commit -m "feat: complete Wind to the East dashboard, wind profile table, and Nginx/Docker config"`
