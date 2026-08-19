# Catalog Collector MVP

Первый рабочий backend-контур каталога Авточек.

## Что умеет

- импортировать `.csv` и `.xlsx` через адаптер `SpreadsheetProvider`;
- использовать отдельную mapping-конфигурацию под каждого продавца/партнёра;
- нормализовать входные поля в единую модель Авточек;
- выдавать стабильный внутренний `vehicle_id`;
- хранить техническую связь с источником только внутри backend-хранилища;
- обновлять существующие объявления по `provider + source_listing_id`;
- при `--snapshot` переводить исчезнувшие из очередной выгрузки объявления в `inactive`;
- отдавать публичный каталог через `GET /api/vehicles`;
- отдавать одну машину через `GET /api/vehicles/:id`;
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

Проверка:

```text
GET /api/health
GET /api/vehicles
GET /api/vehicles/:id
```

## Подключение реального продавца

Для каждого источника создаётся mapping-файл. Исходные названия колонок могут быть любыми, в том числе китайскими: они сопоставляются с каноническими полями Авточек в `columns`.

Минимально необходимы:

- `source_listing_id`;
- `title` либо сочетание `brand + model`.

Рекомендуются цена, пробег, город, год, характеристики, статус, `updated_at` и `photo_urls`.

Фотографии в одной CSV-ячейке по умолчанию разделяются `|`. Разделитель можно изменить через `photoSeparator`.

## Snapshot-режим

`--snapshot` используется только для полной выгрузки конкретного провайдера. Если автомобиль присутствовал в предыдущем полном snapshot и исчез из следующего, Collector ставит ему `status=inactive`.

Для частичных выгрузок `--snapshot` не использовать.

## Следующий production-шаг

JSON store здесь является MVP-хранилищем для проверки полного контура. Перед постоянной эксплуатацией его нужно заменить PostgreSQL-репозиторием, сохранив интерфейс Adapter → Normalizer → Store → Public API.

После получения официального API/feed партнёра добавляется новый Provider Adapter. Normalizer, Store и публичный API при этом не меняются.
