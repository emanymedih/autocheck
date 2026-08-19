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
- карточки `inactive` отображаются как снятые с продажи и блокируют новый заказ отчёта;
- frontend поддерживает CNY, USD, EUR и RUB.

Рабочая схема:

`cars.html → query params → GET /api/vehicles → server filters → pagination → PublicVehicleDTO[] → catalog cards`

### Карточка автомобиля: data-driven

Готово:
- заголовок;
- цена и валюта;
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

### Global export catalog pilot

Добавлен `Che168GlobalCatalogProvider` для международной экспортной витрины.

Проверен реальный live-import через GitHub Actions:

`global catalog → detail cards → Global Provider → Normalizer → sanitized public snapshot → cars.html`.

Готово:
- discovery detail URL `/en/detail/{listing_id}`;
- лимит страниц и количества автомобилей;
- параллельная загрузка detail-card;
- разбор цены в USD;
- дата регистрации;
- модельный год;
- пробег;
- тип силовой установки;
- двигатель;
- трансмиссия;
- город;
- кузов;
- цвет;
- привод;
- места и двери;
- масса и габариты;
- реальные изображения;
- распознавание явного состояния sold;
- отдельный internal store;
- отдельный sanitized public snapshot;
- режим `cars.html?pilot=global`;
- GitHub Actions one-shot workflow для live-import;
- автоматические тесты перед импортом;
- автоматическая публикация только sanitized snapshot.

После первого live-run parser доработан на фактических данных:
- расширено определение марок;
- убраны повторения марки в title;
- Hardtop Coupe нормализуется в `Купе / спорткар`;
- Station Wagon нормализуется в `Универсал`;
- габариты очищаются от footer text;
- `--` в регистрации превращается в отсутствие значения;
- год из названия автомобиля получает приоритет при конфликте с техническим полем карточки.

Повторный live-run после этих исправлений успешно обновил sanitized snapshot.

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
- single-listing pilot adapter;
- dealer inventory pilot adapter;
- global export catalog pilot adapter;
- реальные multi-card данные и изображения;
- защита от ложной массовой деактивации;
- CI tests;
- one-shot live import workflow.

Для рабочего production-варианта:
1. заменить JSON store на PostgreSQL;
2. выбрать постоянный разрешённый канал inventory;
3. добавить scheduler;
4. добавить import jobs и audit log;
5. добавить retries и контроль частичных ошибок;
6. подключить object storage/CDN для фотографий;
7. проверить повторную синхронизацию на временном интервале;
8. проверить реальный переход active → sold;
9. определить production-правило цены и валюты;
10. после стабильного цикла подключить Report Availability.

### Каталог Авточек

Frontend и API-контракт готовы. Multi-card live snapshot уже формируется из экспортной витрины.

Для production-варианта:
1. подключить PostgreSQL-backed API по стабильному URL;
2. убрать pilot query parameter после появления постоянного backend;
3. прогнать фильтры на сотнях и тысячах машин;
4. перенести фильтрацию/сортировку в SQL с индексами;
5. определить единую валюту сортировки и фильтра цены;
6. добавить SEO/серверный рендер позднее при необходимости индексации.

### Карточка автомобиля

Основная data-driven логика готова и принимает реальные карточки.

Для production-варианта:
1. расширить DTO после накопления выборки разных автомобилей;
2. улучшить нормализацию названий моделей и комплектаций;
3. построить media pipeline;
4. добавить актуальность карточки `last_seen_at` и `last_checked_at`;
5. связать `vehicle_id` с `report_linkage`;
6. добавить полный набор фотографий, если detail source отдаёт галерею отдельным data-layer.

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

- постоянный production feed/API с согласованным режимом использования;
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

### P0 — доказать повторную синхронизацию Global inventory

Критерий готовности:

`Global catalog → live batch → vehicle_id → Авточек → повторный import → сравнение → корректные изменения цены/пробега/status`.

Подзадачи:
1. сохранить текущий live snapshot как baseline;
2. повторить импорт через выбранный интервал;
3. построить diff по `vehicle_id`;
4. показать added / updated / disappeared / sold;
5. вручную сверить 10 detail-card с данными Авточек;
6. улучшить извлечение полной галереи;
7. определить правило для missing listing без явного sold;
8. перенести inventory в PostgreSQL;
9. добавить scheduler и import audit;
10. параллельно готовить постоянный партнёрский feed.

Следующий рубеж ядра: автоматический повторяемый sync живого многокарточного inventory с контролируемой актуальностью.
