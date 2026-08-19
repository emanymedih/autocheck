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
- one-shot GitHub Actions live import.

### Global inventory pilot

Реальный live-import уже выполнен.

Цепочка:

`global catalog → detail cards → provider → normalizer → internal store → sanitized public snapshot → обычная cars.html`.

Парсер получает цену, валюту, год, регистрацию, пробег, силовую установку, двигатель, трансмиссию, город, кузов, цвет, привод, места/двери, массу/габариты, фото и явное состояние sold.

В public snapshot отсутствуют source URL, provider ID и исходный listing ID.

## Частично реализовано

### Production Catalog Collector

Нужно:
1. PostgreSQL вместо JSON store;
2. постоянный разрешённый inventory channel;
3. scheduler;
4. import jobs и audit log;
5. retries и обработка частичных ошибок;
6. object storage/CDN для фотографий;
7. повторная синхронизация и diff;
8. правило для исчезнувших объявлений без явного sold;
9. единая модель цены/валюты для нескольких источников;
10. дедупликация одной физической машины между источниками.

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
- production scheduler;
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

### Доказать повторяемую синхронизацию live inventory

Критерий:

`baseline → новый import → diff по vehicle_id → added / updated / disappeared / sold → изменения видны в обычной cars.html`.

План:
1. сохранить текущий snapshot как baseline;
2. повторить live-import;
3. построить diff;
4. сверить минимум 10 карточек;
5. проверить изменение цены, пробега и статуса;
6. определить правило deactivation;
7. увеличить batch до 100–500 автомобилей;
8. после стабильного цикла перейти на PostgreSQL + scheduler.
