# Авточек — текущий статус и следующий план

Дата: 2026-08-19.

## Реализовано

### Каталог Авточек

Готово:
- обычная `cars.html` показывает текущий live snapshot без специального query-параметра;
- на GitHub Pages `catalog-static-api.js` подменяет каталоговый `/api` локальным sanitized snapshot;
- при появлении настоящего backend тот же frontend может работать через `/api/vehicles` и `/api/vehicles/facets`;
- поиск;
- фильтры по марке, городу, кузову, силовой установке, году, цене, пробегу и статусу;
- сортировка;
- пагинация;
- URL хранит выбранные фильтры;
- поддержка CNY, USD, EUR и RUB;
- реальные фотографии и статусы автомобилей;
- переход в data-driven `vehicle.html`;
- карточка открывается по sessionStorage и напрямую по `vehicle_id` через тот же static/API bridge.

Текущий frontend-контур:

`live sanitized snapshot / backend API → catalog-static-api или /api → catalog-client → cars.html → vehicle.html`.

### Карточка автомобиля

Готово:
- заголовок, цена и валюта;
- год, пробег, город, регистрация;
- двигатель, коробка, кузов и силовая установка;
- цвета, VIN при наличии;
- дополнительные характеристики;
- фотографии;
- статус продажи;
- описание, предварительные факты, состояние и оснащение;
- empty-state для отсутствующих данных;
- блокировка CTA для снятой с продажи машины.

### Catalog Collector

Готово:
- CSV/XLSX adapter;
- mapping;
- normalizer;
- стабильный `vehicle_id`;
- JSON store;
- snapshot active/inactive;
- Public API;
- фильтры, facets и пагинация;
- single-listing pilot;
- dealer inventory pilot;
- global export catalog provider;
- sanitized public snapshot;
- защита от ложной массовой деактивации;
- CI tests;
- автоматический GitHub Actions live sync каждые 6 часов;
- ручной запуск live sync;
- блокировка параллельных sync-run;
- baseline перед каждым импортом;
- diff `added / updated / missing / sold` по стабильному `vehicle_id`;
- health gate перед публикацией;
- audit artifact каждого sync-run;
- публичный sanitized sync status без source IDs;
- безопасная публикация snapshot только после успешной проверки.

### Автоматический live sync

Текущий pilot-цикл:

`cron / manual trigger → tests → baseline → import 50 cards → diff → health gate → audit artifact → sanitized snapshot → cars.html`.

Расписание: раз в 6 часов, cron `17 */6 * * *` UTC.

Health gate проверяет:
- импорт завершился успешно;
- в новом batch минимум 35 машин;
- доля ошибок не выше 25%;
- отсутствуют duplicate vehicle_id;
- основные поля записей валидны;
- при наличии предыдущего baseline не исчезло более 85% выборки.

Если gate не проходит, новый snapshot в `main` не публикуется. Старый рабочий каталог остаётся доступным.

Diff фиксирует изменения полей автомобиля, включая цену, пробег, статус, фото и характеристики. Полный audit хранится как GitHub Actions artifact 14 дней.

### Global inventory pilot

Реальный live-import уже выполнен.

Цепочка:

`global catalog → detail cards → provider → normalizer → internal store → sanitized public snapshot → обычная cars.html`.

Парсер получает цену, валюту, год, регистрацию, пробег, силовую установку, двигатель, трансмиссию, город, кузов, цвет, привод, места/двери, массу/габариты, фото и явное состояние sold.

В public snapshot отсутствуют source URL, provider ID и исходный listing ID.

## Частично реализовано

### Production Catalog Collector

Pilot scheduler и audit уже работают через GitHub Actions. Для рабочего production-контура нужно:
1. PostgreSQL вместо JSON store;
2. постоянный разрешённый inventory channel;
3. перенести scheduler из GitHub Actions в backend/worker infrastructure при росте объёма;
4. постоянные `collector_runs` и audit log в БД;
5. retries/backoff и provider-level error policy;
6. object storage/CDN для фотографий;
7. правило для исчезнувших объявлений без явного sold;
8. единая модель цены/валюты для нескольких источников;
9. дедупликация одной физической машины между источниками;
10. мониторинг SLA источников и freshness inventory.

### Карточка автомобиля

Нужно:
1. улучшить нормализацию моделей и комплектаций;
2. извлекать полную галерею, когда источник отдаёт её отдельно;
3. добавить `last_seen_at` / `last_checked_at`;
4. построить media pipeline;
5. связать `vehicle_id` с `report_linkage`.

## Реализовано на малую часть

### Report Availability

Есть CTA и продуктовый сценарий.

Нужно:
`vehicle_id → report_linkage → availability → quote → public price`.

Целевой endpoint: `POST /api/report-quotes`.

### Order Service

Нужно:
`quote_id + vehicle_id + customer → report_order → payment → paid → queued`.

### Report Pipeline

Нужно:
`raw report → parser → translator → normalizer → analyzer → AvtocheckReport`.

## Пока отсутствует

- PostgreSQL;
- production worker scheduler вне GitHub Actions;
- постоянный партнёрский feed/API;
- production media storage/CDN;
- Vehicle Resolver по VIN;
- Report Quote Service;
- Order Service;
- платёжный провайдер;
- China Source Worker;
- автоматическая покупка исходного отчёта;
- raw report storage;
- production report parser/translator/normalizer;
- отдельный Report Viewer;
- аккаунты клиентов;
- история заказов;
- уведомления;
- refund flow;
- cross-source dedup;
- admin/monitoring.

## Следующая P0-задача

### Наблюдать автоматический sync и перейти к устойчивой актуальности

Критерий:

`несколько последовательных cron-run → audit healthy → stable vehicle_id → корректные price/mileage/status changes → безопасная публикация`.

План:
1. накопить несколько автоматических запусков;
2. сверить diff минимум по 10 карточкам;
3. проверить реальные price/mileage changes;
4. поймать и проверить явный `sold`;
5. определить правило для `missing` без `sold`;
6. увеличить batch до 100–500 автомобилей после подтверждения стабильности;
7. перенести inventory в PostgreSQL;
8. добавить persistent collector_runs, retries и provider health;
9. перейти на постоянный разрешённый feed/API.
