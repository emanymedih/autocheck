# Catalog Collector MVP

Первый рабочий backend-контур каталога Авточек.

## Что умеет

- импортировать `.csv` и `.xlsx` через адаптер `SpreadsheetProvider`;
- использовать отдельную mapping-конфигурацию под каждого продавца/партнёра;
- нормализовать входные поля в единую модель Авточек;
- выдавать стабильный внутренний `vehicle_id`;
- хранить техническую связь с источником только внутри backend-хранилища;
- обновлять существующие объявления по `provider + source_listing_id`;
- при `--snapshot` переводить исчезнувшие из очередной полной выгрузки объявления в `inactive`;
- отдавать публичный каталог через `GET /api/vehicles`;
- отдавать одну машину через `GET /api/vehicles/:id`;
- отдавать значения для фильтров через `GET /api/vehicles/facets`;
- фильтровать на сервере по марке, городу, году, цене, пробегу, кузову, двигателю и статусу;
- сортировать на сервере;
- использовать нормальную page-based пагинацию;
- передавать в карточку автомобиля data-driven блоки характеристик, фактов, состояния и оснащения;
- не отдавать публичному frontend `providerId`, `source_listing_id` и `source_url`.

## Запуск

```bash
cd collector
npm install
npm test
npm run import -- --provider dealer-a --file ./data/incoming/example.csv --mapping ./config/providers/example.json --snapshot
npm start
```

По умолчанию API запускается на `http://localhost:8787`.

## Public API

### Каталог

```text
GET /api/vehicles
```

Поддерживаемые query-параметры:

- `q` — поиск по названию, марке, модели, комплектации, кузову, двигателю и городу;
- `brand`;
- `city`;
- `body`;
- `engine` — поиск по строке двигателя;
- `status=active|inactive|unknown|all`, по умолчанию `active`;
- `year`, `year_min`, `year_max`;
- `price_min`, `price_max`;
- `mileage_min`, `mileage_max`;
- `sort=updated-desc|year-desc|year-asc|price-asc|price-desc|mileage-asc|mileage-desc`;
- `page`, начиная с `1`;
- `page_size`, от `1` до `100`, по умолчанию `24`.

Ответ содержит:

```text
items
total
page
pageSize
totalPages
hasPrevious
hasNext
updatedAt
```

Старые `limit`, `offset` и `include_inactive=1` остаются совместимыми на переходный период.

### Значения фильтров

```text
GET /api/vehicles/facets
```

Возвращает марки, города, кузова, двигатели, диапазоны года/цены/пробега и количество автомобилей по статусам.

### Одна машина

```text
GET /api/vehicles/:id
```

Карточка доступна и для архивной записи, если пользователь открыл ранее сохранённый `vehicle_id`.

## Data-driven карточка автомобиля

Помимо базовых полей Collector умеет принимать дополнительные публичные сведения:

- `description`;
- `features`;
- `listing_facts`;
- `condition_checks`;
- `extra_specs`.

Для CSV/XLSX простые списки разделяются `|`.

Пример:

```text
features:
Круиз-контроль|Камера 360|Подогрев сидений

listing_facts:
Владение::Один владелец|Сервис::Есть сервисные записи

condition_checks:
Кузов::Есть окрашенные элементы::warning|Пожар::Признаки не заявлены::ok

extra_specs:
Привод::Полный|Мощность::245 л.с.
```

Разделители настраиваются через `detailSeparator` и `detailPartSeparator` в mapping-файле. JSON-массивы в ячейках также поддерживаются.

## Подключение реального продавца

Для каждого источника создаётся mapping-файл. Исходные названия колонок могут быть любыми, включая китайские. Они сопоставляются с каноническими полями Авточек в `columns`.

Минимально необходимы:

- `source_listing_id`;
- `title` либо сочетание `brand + model`.

Для полноценной карточки рекомендуются цена, пробег, город, год, кузов, двигатель, коробка, характеристики, статус, `updated_at`, `photo_urls` и расширенные data-driven поля.

Фотографии в одной CSV-ячейке по умолчанию разделяются `|`. Разделитель меняется через `photoSeparator`.

## Snapshot-режим

`--snapshot` используется только для полной выгрузки конкретного провайдера. Если автомобиль присутствовал в предыдущем полном snapshot и исчез из следующего, Collector ставит ему `status=inactive`.

Для частичных выгрузок `--snapshot` не используется.

## Следующий production-шаг

JSON store остаётся MVP-хранилищем для проверки полного контура. Следующий шаг — PostgreSQL-репозиторий с тем же интерфейсом `Adapter → Normalizer → Store → Public API`.

После получения официального API/feed партнёра добавляется новый Provider Adapter. Normalizer и публичный API сохраняют текущую модель.
