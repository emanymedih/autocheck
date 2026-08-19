# Авточек — Global Catalog Pilot

Дата: 2026-08-19.

## Цель

Проверить многокарточный импорт из публичной международной экспортной витрины и прогнать данные через существующее ядро Catalog Collector.

Контур:

`export catalog pages → detail pages → Che168GlobalCatalogProvider → Normalizer → Global Catalog Store → PublicVehicleDTO → Авточек`

## Что реализовано

### Discovery каталога

`Che168GlobalCatalogProvider` начинает с:

```text
https://global.che168.com/en/used-cars?vehicle_list=1
```

и умеет:
- проходить несколько страниц каталога;
- собирать detail URL `/en/detail/{listing_id}`;
- дедуплицировать `listing_id`;
- ограничивать pilot по количеству автомобилей и страниц;
- фиксировать объявленное количество результатов;
- собирать ошибки catalog-page и detail-page отдельно.

### Detail parser

`Che168GlobalListingProvider` извлекает:
- название;
- марку и модель;
- модельный год;
- дату первой регистрации;
- пробег;
- цену;
- валюту;
- тип силовой установки;
- двигатель;
- коробку;
- город;
- кузов;
- цвет;
- привод;
- количество мест и дверей;
- массу и габариты;
- фотографии, если URL присутствуют в HTML;
- признаки предварительного inspection;
- статус `active/inactive` по состоянию detail-card.

Внешний URL и listing ID остаются во внутреннем объекте `source` и не попадают в `PublicVehicleDTO`.

### Валюта

Международная витрина публикует цену автомобиля в USD. Normalizer теперь поддерживает явную `currency`, поэтому такие машины хранятся как:

```text
price: 75340
currency: USD
```

Frontend каталога отображает CNY, USD, EUR и RUB соответствующим символом.

Global pilot хранится отдельно от CNY pilot:

```text
collector/data/global-catalog.json
collector/data/global-public-catalog.json
```

Это исключает некорректную сортировку цен между разными валютами внутри одного pilot-store.

### Нормализация силовых установок

Поддержаны текущие экспортные обозначения:

```text
Pure Electric → Электро
Plug-in Hybrid → Подключаемый гибрид (PHEV)
Extended Range → Гибрид с увеличителем запаса хода (EREV)
Hybrid → Гибрид (HEV)
Gasoline+48V / Mild Hybrid → Мягкий гибрид 48V
Gasoline → Бензин
Diesel → Дизель
```

## Первый запуск

```bash
cd collector
npm install
npm run import:che168-global -- --limit 20 --pages 2 --concurrency 3
```

Результат сохраняется в:

```text
data/global-catalog.json
data/global-public-catalog.json
```

Для запуска API именно на этом pilot-store:

```bash
CATALOG_STORE=./data/global-catalog.json npm start
```

После генерации public snapshot статический frontend можно открыть в режиме:

```text
cars.html?pilot=global
```

## Snapshot safety

Global pilot всегда работает с `snapshot=false`.

Причина: общий экспортный каталог содержит очень большой inventory, а pilot намеренно забирает только ограниченную выборку. Отсутствие автомобиля в первых N страницах не означает продажу.

Статус `inactive` можно ставить при явном состоянии sold на detail-page.

Для production потребуется отдельная стратегия актуальности:

```text
known listing → scheduled detail check → active/sold
```

и/или разрешённый партнёрский feed со стабильными событиями добавления, обновления и снятия.

## Критерий успешного pilot

1. Получить минимум 20 detail cards.
2. Успешно нормализовать минимум 90%.
3. Сверить вручную 10 машин: цена, регистрация, пробег, fuel type, body type, город и фотографии.
4. Отобразить выборку в `cars.html`.
5. Открыть несколько `vehicle.html` через внутренний `vehicle_id`.
6. Через интервал повторить import и сравнить изменения.
7. Отдельно проверить одну карточку, перешедшую в sold, и получить `inactive`.

После этого техническая гипотеза международного inventory-контура считается подтверждённой.
