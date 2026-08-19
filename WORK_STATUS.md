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

### Single-listing pilot

Подключена одна реально опубликованная карточка Audi A3 через `Che168PilotProvider`.

Проверена цепочка:

`detail URL → Provider → Normalizer → Catalog Store → PublicVehicleDTO → cars.html → vehicle.html`.

### Dealer inventory pilot adapter

Добавлен `Che168DealerInventoryProvider`.

Он умеет:
- принимать `dealer_id`;
- начинать discovery со страницы `/dealer/carlist.html?dealerid={dealer_id}`;
- находить detail URL формата `/dealer/{dealer_id}/{listing_id}.html`;
- находить ссылки пагинации внутри dealer inventory;
- дедуплицировать `listing_id`;
- ограничивать pilot параметром `--limit`;
- загружать detail cards с ограниченной concurrency;
- передавать каждую карточку существующему `Che168PilotProvider`;
- собирать ошибки по inventory pages и individual listings;
- вычислять `completeDiscovery` и `completeSnapshot`;
- запрещать массовую деактивацию при частичном обходе, лимите страниц или ошибках detail-card.

Команда первого массового pilot:

```bash
cd collector
npm run import:che168-dealer -- --dealer 123615 --limit 20 --max-pages 10 --concurrency 3
```

При таком ограниченном запуске Collector выполняет только upsert найденных машин. Snapshot-deactivation выключена автоматически.

Полный snapshot включается только после подтверждения объявленного количества inventory и успешной загрузки всех найденных detail cards.

Добавлены unit tests для discovery, пагинации и snapshot safety. Добавлен GitHub Actions workflow `Collector tests`.

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
- dealer inventory HTML pilot adapter;
- защита от ложной массовой деактивации;
- первая реальная карточка и реальные фотографии в pilot-контуре.

Для рабочего production-варианта:
1. выполнить разрешённый dealer pilot на 10–20 живых машин;
2. проверить фактическую пагинацию dealer `123615`;
3. сверить parsed data с исходными карточками;
4. получить разрешённый постоянный feed/API продавца;
5. заменить JSON store на PostgreSQL;
6. добавить scheduler;
7. добавить import jobs и audit log;
8. добавить retries и контроль частичных ошибок;
9. подключить object storage/CDN для фотографий;
10. проверить цикл `создание → обновление цены → обновление фото → снятие с продажи`;
11. после появления партнёрского feed вывести HTML pilot из production-контура.

### Каталог Авточек

Frontend и API-контракт готовы. Одна настоящая карточка доступна в pilot-режиме. Dealer adapter готов наполнить Store набором настоящих карточек после разрешённого запуска.

Для production-варианта:
1. подключить backend по стабильному URL;
2. загрузить реальный inventory продавца;
3. проверить фильтры на сотнях и тысячах машин;
4. при росте базы перенести фильтрацию/сортировку в SQL с индексами;
5. добавить SEO/серверный рендер позднее, если каталог должен индексироваться поиском.

### Карточка автомобиля

Основная data-driven логика готова и принимает реальную карточку.

Для production-варианта:
1. расширить DTO после получения полного dealer feed;
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

- разрешённый постоянный feed китайских машин;
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

### P0 — выполнить dealer pilot и доказать повторную синхронизацию

Критерий готовности:

`dealer inventory → discovery → 10–20 detail cards → Normalizer → Catalog Store → Авточек → повторный запуск → корректное обновление цены/статуса`.

Подзадачи:
1. запустить `--dealer 123615 --limit 20` в среде с разрешённым доступом к source pages;
2. сохранить audit результата: pages visited, listing IDs, success/fail;
3. вручную сверить минимум 10 машин;
4. повторить запуск спустя интервал;
5. сравнить цену, пробег, фотографии и статус;
6. отдельно выполнить полный discovery без `--limit`;
7. убедиться, что `completeSnapshot=true` достигается только при полном подтверждённом inventory;
8. после этого подключить PostgreSQL и scheduler;
9. параллельно запросить у продавца прямой feed/API.

Следующий рубеж ядра: доказанный многокарточный dealer sync с безопасным snapshot.
