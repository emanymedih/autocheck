# Авточек — текущий статус и следующий план

Дата: 2026-08-19.

## Реализовано

### Каталог: серверные фильтры и пагинация

Готово:
- поиск `q`;
- марка;
- город;
- кузов;
- двигатель;
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
- data-driven detail fields.

Для рабочего production-варианта:
1. подключить первый реальный разрешённый feed;
2. заменить JSON store на PostgreSQL;
3. добавить автоматический scheduler;
4. добавить import jobs и audit log;
5. добавить retries и контроль частичных ошибок;
6. подключить object storage/CDN для фотографий;
7. проверить цикл `создание → обновление цены → обновление фото → снятие с продажи`.

### Каталог Авточек

Frontend и API-контракт готовы.

Для production-варианта:
1. подключить backend по стабильному URL;
2. загрузить реальный inventory;
3. проверить фильтры на тысячах машин;
4. при росте базы перенести фильтрацию/сортировку в SQL с индексами;
5. добавить SEO/серверный рендер позднее, если каталог должен индексироваться поиском.

### Карточка автомобиля

Основная data-driven логика готова.

Для production-варианта:
1. расширить DTO после получения первого реального feed;
2. согласовать поля разных продавцов;
3. добавить нормализацию единиц и комплектаций;
4. построить media pipeline;
5. добавить актуальность карточки `last_seen_at`;
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

### P0 — сделать Catalog Collector живым

Критерий готовности:

`реальный feed → автоматический импорт → PostgreSQL → реальные фото → реальные фильтры → vehicle.html → повторная синхронизация → изменение цены/статуса отображается на Авточек`.

Подзадачи:
1. получить первый feed хотя бы на 20–100 автомобилей;
2. сделать provider mapping;
3. импортировать;
4. сверить 10 карточек вручную;
5. повторить snapshot;
6. проверить снятие автомобиля;
7. перенести store в PostgreSQL;
8. поставить синхронизацию по расписанию;
9. добавить import log и alert по ошибкам;
10. после стабильного цикла перейти к `Report Availability`.

Это следующий рубеж ядра: после него каталог Авточек становится реально работающим продуктовым контуром.