# Авточек — текущий статус и следующий план

Дата: 2026-08-19.

## Реализовано

### Каталог: серверные фильтры и пагинация

Готово:
- поиск `q`;
- марка;
- город;
- кузов;
- тип силовой установки;
- статус;
- точный год и диапазон года;
- диапазон цены;
- диапазон пробега;
- серверная сортировка;
- page-based пагинация;
- endpoint facets для значений фильтров;
- URL каталога хранит выбранные фильтры и страницу;
- карточки `inactive` отображаются как снятые с продажи и блокируют новый заказ отчёта.

Рабочая схема:

`cars.html → query params → GET /api/vehicles → server filters → pagination → PublicVehicleDTO[] → catalog cards`

### Карточка автомобиля: data-driven

Готово:
- заголовок;
- цена;
- год;
- пробег;
- город;
- регистрация;
- двигатель;
- коробка;
- кузов;
- тип силовой установки;
- цвета;
- VIN;
- дополнительные характеристики;
- реальные фотографии;
- статус продажи;
- описание;
- предварительные факты;
- предварительное состояние;
- оснащение;
- empty-state для отсутствующих разделов;
- блокировка CTA для снятой с продажи машины.

Все публичные блоки формируются из `VehiclePublicDTO`. Статические сведения Audi используются только как демонстрационный fallback при открытии страницы без `vehicle_id`.

Расширенные поля Collector:
- `description`;
- `features`;
- `listing_facts`;
- `condition_checks`;
- `extra_specs`.

### Первый живой автомобиль — выполнен pilot

Подключена одна реально опубликованная карточка Audi A3 через отдельный single-listing adapter.

Сделано:
- `Che168PilotProvider` для одной detail URL;
- парсинг `dealer_id` и `listing_id`;
- цена, пробег, год, первая регистрация, коробка, двигатель, город регистрации и переоформления;
- извлечение массива фотографий;
- внутренний `vehicle_id`;
- сохранение source linkage только в backend-модели;
- sanitized public snapshot без provider name, source URL, dealer ID и listing ID;
- opt-in режим `cars.html?pilot=1` для проверки карточки на статическом frontend;
- переход `pilot catalog → vehicle.html` через публичный объект автомобиля.

Текущий pilot проверяет цепочку:

`живая URL-карточка → Provider → Normalizer → Catalog Store → PublicVehicleDTO → cars.html → vehicle.html`.

## Частично реализовано

### Catalog Collector

Есть:
- CSV/XLSX adapter;
- mapping;
- normalizer;
- стабильный `vehicle_id`;
- snapshot active/inactive;
- JSON store;
- Public API;
- фильтры;
- facets;
- пагинация;
- data-driven detail fields;
- single-listing HTML pilot adapter;
- первая реальная карточка и реальные фотографии в pilot-контуре.

Для рабочего production-варианта:
1. получить разрешённый постоянный feed/API хотя бы одного продавца;
2. заменить JSON store на PostgreSQL;
3. добавить автоматический scheduler;
4. добавить import jobs и audit log;
5. добавить retries и контроль частичных ошибок;
6. подключить object storage/CDN для фотографий;
7. проверить цикл `создание → обновление цены → обновление фото → снятие с продажи`;
8. отказаться от HTML pilot как основного канала после появления партнёрского feed.

### Каталог Авточек

Frontend и API-контракт готовы. Одна настоящая карточка доступна в pilot-режиме.

Для production-варианта:
1. подключить backend по стабильному URL;
2. загрузить реальный inventory продавца;
3. проверить фильтры на сотнях и тысячах машин;
4. при росте базы перенести фильтрацию/сортировку в SQL с индексами;
5. добавить SEO/серверный рендер позднее, если каталог должен индексироваться поиском.

### Карточка автомобиля

Основная data-driven логика готова и уже принимает первую реальную карточку.

Для production-варианта:
1. расширить DTO после получения первого полного dealer feed;
2. согласовать поля разных продавцов;
3. добавить нормализацию единиц и комплектаций;
4. построить media pipeline;
5. добавить актуальность карточки `last_seen_at` и `last_checked_at`;
6. связать `vehicle_id` с `report_linkage`.

## Реализовано на малую часть

### Report Availability

Есть CTA и место в пользовательском сценарии.

Нужно:
`vehicle_id → report_linkage → internal source availability → quote → public price`.

Целевой endpoint:
`POST /api/report-quotes`.

### Order Service

Есть продуктовая state machine, рабочего backend пока нет.

Нужно:
`quote_id + vehicle_id + customer → report_order → payment → paid → queued`.

### Report Pipeline

Есть архитектура и модель provenance.

Нужно реализовать первый конкретный parser:
`raw report → parser → translator → normalizer → analyzer → AvtocheckReport`.

## Пока отсутствует

- реальный постоянный feed китайских машин;
- PostgreSQL;
- scheduler Collector;
- production media storage/CDN;
- Vehicle Resolver по VIN;
- Report Quote service;
- Order Service;
- платёжный провайдер;
- China Source Worker;
- автоматическая покупка исходного отчёта;
- raw report storage;
- production parser/translator/normalizer;
- отдельный Report Viewer;
- аккаунты клиентов;
- история заказов;
- уведомления;
- refund flow;
- дедупликация одного физического автомобиля между несколькими источниками;
- admin/monitoring.

## Следующая план-задача

### P0 — перейти от одной живой карточки к живому inventory продавца

Критерий готовности:

`разрешённый dealer feed → автоматический импорт → PostgreSQL → реальные фото → реальные фильтры → vehicle.html → повторная синхронизация → изменение цены/статуса отображается на Авточек`.

Подзадачи:
1. повторно проверить pilot-карточку и зафиксировать изменение или сохранение состояния;
2. получить inventory feed хотя бы на 20–100 автомобилей одного продавца;
3. сделать provider mapping или API adapter;
4. импортировать весь набор;
5. сверить 10 карточек вручную;
6. повторить snapshot;
7. проверить снятие автомобиля;
8. перенести store в PostgreSQL;
9. поставить синхронизацию по расписанию;
10. добавить import log и alert по ошибкам;
11. после стабильного цикла перейти к `Report Availability`.

Это следующий рубеж ядра: после него Catalog Collector становится постоянно работающим продуктовым контуром.
