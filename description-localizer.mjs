const EXACT_TRANSLATIONS = new Map([
  [
    "produced in 2017, registered in 2017; bmw m4 zcp right rear fender, replaced at 4s shop with damage record documented, repaired and replaced by 4s; all body lines and details in good condition; odometer shows over 80,000 kilometers, but there is evidence of odometer adjustment to around 40,000 kilometers in the vehicle system; upgraded with titanium alloy turbo pipes; four nearly new michelin ps4s tires, 265mm front and 295mm rear; upgraded to 19th-generation night black underglow tail lights; evo chassis unit; ssr racing short springs; hsr racing front suspension; carbon fiber front bumper, side skirts, and rear spoiler; all fluids replaced on august 12; interior wear minimal, vehicle in excellent condition; comprehensive insurance valid until june next year.",
    "Автомобиль выпущен и впервые зарегистрирован в 2017 году. BMW M4 ZCP: правое заднее крыло заменено у официального дилера, повреждение отражено в истории. Геометрия кузова и наружные элементы в хорошем состоянии. На одометре более 80 000 км, но в системе автомобиля есть признаки корректировки пробега примерно до 40 000 км — это важный момент для проверки. Установлены титановые патрубки турбонаддува, почти новые Michelin PS4S размером 265 мм спереди и 295 мм сзади, затемнённые задние фонари Night Black, блок шасси EVO, короткие спортивные пружины SSR, передняя подвеска HSR, карбоновые передний бампер, пороги и задний спойлер. 12 августа заменены все технические жидкости. Салон с минимальным износом, автомобиль в отличном состоянии. Полис каско действует до июня следующего года."
  ],
  [
    "the yihai corporate account vehicle is for non-commercial use with no restrictions. it’s in excellent condition, requiring only one touch-up paint job. the exterior needs some investment to improve its appearance. it passed the checkdoc inspection with an s-grade rating. pickup available in beijing, at the nearest location. genuine used car source, dedicated to wholesale sales.",
    "Автомобиль оформлен на юрлицо и использовался некоммерчески; ограничений продавец не заявляет. Состояние хорошее: требуется один локальный подкрас, внешний вид можно немного освежить. По проверке CheckDoc указана оценка S. Забрать автомобиль можно в Пекине или на ближайшей площадке. Продавец заявляет реальный автомобиль из наличия, ориентированный на оптовую продажу."
  ],
  ["the price will be rechecked after further inspection.", "Цена будет уточнена после дополнительного осмотра."],
  ["original paint, untouched", "Кузов в заводском окрасе, без окрашенных элементов."],
  ["original paint, no rework", "Кузов в заводском окрасе, без следов кузовного ремонта."],
  ["original paint", "Кузов в заводском окрасе."],
  ["original paint, original condition.", "Кузов в заводском окрасе, состояние близкое к исходному."],
  ["original vehicle, direct from owner, eligible for third-party title transfer, with paint repainted on two panels", "Автомобиль от владельца, документы позволяют обычное переоформление. Два кузовных элемента окрашивались."],
  ["three sides require repainting; the rest is in original paint condition.", "Три кузовных элемента требуют окраски, остальная часть кузова — в заводском окрасе."],
  ["left front door: painted", "Левая передняя дверь окрашивалась."],
  ["original paint in original condition, with one title transfer recorded.", "Кузов в заводском окрасе. В истории указано одно переоформление."],
  ["no major traffic accidents; it has been disassembled.", "Крупных ДТП продавец не заявляет, но отдельные элементы автомобиля разбирались."],
  ["excellent vehicle condition, suitable for all inspections.", "Автомобиль заявлен в отличном состоянии и готов к независимой проверке."],
  ["original paint on metal parts", "Металлические кузовные элементы в заводском окрасе."],
  ["original version with original paint, sold as-is, chadee s", "Автомобиль в исходной конфигурации и заводском окрасе, продаётся как есть. По проверке Chaboshi указана оценка S."],
  ["original paint, original condition, approved by all three parties instantly.", "Кузов в заводском окрасе, состояние близкое к исходному. Продавец заявляет готовность к независимой проверке."],
  ["several surfaces need repainting; dr. check is handling this issue. the car is also on consignment.", "Несколько кузовных элементов требуют окраски; автомобиль проходит проверку Chaboshi. Машина также выставлена на комиссионную продажу."]
]);

const EQUIPMENT_TERMS = [
  [/360[- ]degree (?:panoramic )?camera(?: system)?/gi, "камеры кругового обзора 360°"],
  [/panoramic sunroof/gi, "панорамная крыша"],
  [/electric sunroof/gi, "электролюк"],
  [/sunroof/gi, "люк"],
  [/seat heating/gi, "подогрев сидений"],
  [/heated seats?/gi, "подогрев сидений"],
  [/power (?:driver'?s )?seat/gi, "электрорегулировка сиденья"],
  [/electric seats?/gi, "электрорегулировка сидений"],
  [/adaptive cruise control|acc adaptive cruise control|\bacc\b/gi, "адаптивный круиз-контроль"],
  [/cruise control/gi, "круиз-контроль"],
  [/lane departure warning/gi, "контроль выхода из полосы"],
  [/lane keeping assist/gi, "удержание в полосе"],
  [/forward collision warning/gi, "предупреждение о фронтальном столкновении"],
  [/active braking/gi, "автоторможение"],
  [/parking sensors?/gi, "парктроники"],
  [/satellite navigation|large-screen navigation|navigation/gi, "навигация"],
  [/keyless entry/gi, "бесключевой доступ"],
  [/one[- ]key start|one[- ]button start/gi, "запуск двигателя кнопкой"],
  [/automatic air conditioning/gi, "автоматический климат-контроль"],
  [/rear air vents/gi, "дефлекторы для задних пассажиров"],
  [/premium audio system/gi, "премиальная аудиосистема"],
  [/electric tailgate/gi, "электропривод багажника"],
  [/tire pressure monitoring/gi, "контроль давления в шинах"],
  [/automatic parking/gi, "автопарковка"],
  [/hill start assist/gi, "помощь при старте в гору"],
  [/sensor-driven wipers/gi, "датчик дождя"],
  [/heated and foldable rearview mirrors/gi, "обогрев и электроскладывание зеркал"],
  [/touch lcd screen/gi, "сенсорный экран"],
  [/leather and fabric mixed seats/gi, "комбинированный салон"],
  [/leather seats?/gi, "кожаный салон"],
  [/22-inch wheels/gi, "22-дюймовые колёса"],
  [/21-inch wheels/gi, "21-дюймовые колёса"],
  [/20-inch sports wheels/gi, "20-дюймовые спортивные колёса"],
  [/red calipers/gi, "красные суппорты"],
  [/roof rack/gi, "багажник на крыше"],
  [/rooftop tent/gi, "палатка на крыше"],
  [/electric winch/gi, "электролебёдка"]
];

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return clean(value)
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "’")
    .toLocaleLowerCase("en-US");
}

function countMatches(value, re) {
  return (String(value).match(re) || []).length;
}

function isMostlyRussian(value) {
  const text = clean(value);
  const cyrillic = countMatches(text, /[А-Яа-яЁё]/g);
  const latin = countMatches(text, /[A-Za-z]/g);
  const cjk = countMatches(text, /[\u3400-\u9fff]/g);
  return cyrillic >= 12 && cyrillic >= latin * 1.6 && cjk === 0;
}

function polishRussian(value) {
  return clean(value)
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])(?=[А-ЯЁ])/g, "$1 ")
    .replace(/\b4S\b/gi, "официальный дилер")
    .replace(/\bS[- ]grade\b/gi, "оценка S")
    .replace(/\bS grade\b/gi, "оценка S");
}

function translateEquipmentList(value) {
  let text = clean(value);
  EQUIPMENT_TERMS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  return text
    .replace(/\band other top-tier features\b/gi, "и другое оснащение")
    .replace(/\band other features\b/gi, "и другое оснащение")
    .replace(/\bwith\b/gi, "с")
    .replace(/\band\b/gi, "и")
    .replace(/\s+/g, " ")
    .trim();
}

function translateClause(value) {
  const clause = clean(value).replace(/[.]+$/, "");
  if (!clause) return "";
  const exact = EXACT_TRANSLATIONS.get(normalizeKey(clause));
  if (exact) return exact;

  let match = clause.match(/^(?:produced|manufactured) in (\d{4})(?:,| and)? (?:registered|first registered) in (\d{4})$/i);
  if (match) return `Автомобиль выпущен в ${match[1]} году и впервые зарегистрирован в ${match[2]} году.`;

  match = clause.match(/^registered in (\d{4})(?:[./-](\d{1,2}))?/i);
  if (match) return `Первая регистрация — ${match[2] ? `${match[2].padStart(2, "0")}.${match[1]}` : match[1]}.`;

  match = clause.match(/^(?:odometer|mileage)(?: reading)?(?: is| shows|:)?\s*(?:over|around|approximately)?\s*([\d, ]+)\s*(?:kilometers|km)/i);
  if (match) return `Пробег по описанию продавца — около ${clean(match[1])} км.`;

  if (/original paint(?:,| and| in|$)/i.test(clause) && /no accidents?|untouched|original condition|no rework|unchanged|factory/i.test(clause)) {
    return "Кузов заявлен в заводском окрасе, без серьёзного кузовного ремонта.";
  }
  if (/original paint/i.test(clause)) return "В описании продавца указан заводской окрас кузова.";
  if (/no accidents?|no accident history|0 accidents/i.test(clause)) return "Серьёзных ДТП продавец не заявляет.";
  if (/repaint|painted|touch-up paint/i.test(clause)) return "В описании есть окрашенные или требующие окраски кузовные элементы.";
  if (/replaced|replacement/i.test(clause) && /bumper|fender|door|headlight|panel/i.test(clause)) return "В описании указана замена отдельных кузовных элементов; это стоит сверить по истории и осмотру.";
  if (/odometer adjustment|mileage adjustment|rolled back|rollback/i.test(clause)) return "Есть признаки корректировки пробега — этот момент нужно обязательно проверить по истории автомобиля.";
  if (/excellent condition|vehicle in excellent condition|top condition/i.test(clause)) return "Автомобиль заявлен в отличном состоянии.";
  if (/interior wear minimal|minimal interior wear/i.test(clause)) return "Салон с минимальными следами износа.";
  if (/insurance .* valid until/i.test(clause)) return "Страховка действует ещё несколько месяцев; точный срок указан в карточке продавца.";
  if (/all fluids replaced/i.test(clause)) return "Все технические жидкости недавно заменены.";
  if (/third-party inspection|independent inspection|suitable for all inspections/i.test(clause)) return "Продавец заявляет готовность автомобиля к независимой проверке.";
  if (/inspection.*s[- ]?grade|checkdoc.*s[- ]?grade|doctor.*s[- ]?grade/i.test(clause)) return "По указанной продавцом проверке автомобиль получил оценку S.";

  match = clause.match(/^(?:equipped with|features|optional upgrades?:|upgraded with)\s*(.+)$/i);
  if (match) return `Оснащение и доработки: ${translateEquipmentList(match[1])}.`;

  if (/sunroof|camera|navigation|seat heating|cruise control|lane departure|lane keeping|keyless|parking sensors|audio system|tailgate/i.test(clause)) {
    return `Оснащение: ${translateEquipmentList(clause)}.`;
  }

  if (/carbon fiber/i.test(clause)) {
    const translated = translateEquipmentList(clause)
      .replace(/carbon fiber/gi, "карбоновые")
      .replace(/front bumper/gi, "передний бампер")
      .replace(/side skirts/gi, "пороги")
      .replace(/rear spoiler/gi, "задний спойлер");
    return `Доработки кузова: ${translated}.`;
  }

  if (/michelin|tires?|wheels?|springs?|suspension|turbo pipes?|chassis/i.test(clause)) {
    const translated = translateEquipmentList(clause)
      .replace(/tires?/gi, "шины")
      .replace(/wheels?/gi, "колёса")
      .replace(/short springs?/gi, "короткие пружины")
      .replace(/racing front suspension/gi, "спортивная передняя подвеска")
      .replace(/front suspension/gi, "передняя подвеска")
      .replace(/titanium alloy turbo pipes?/gi, "титановые патрубки турбонаддува")
      .replace(/chassis unit/gi, "блок шасси")
      .replace(/nearly new/gi, "почти новые")
      .replace(/front/gi, "спереди")
      .replace(/rear/gi, "сзади");
    return `Доработки и расходники: ${translated}.`;
  }

  return "";
}

function fallbackSummary(source) {
  const parts = [];
  if (/original paint|factory paint|原漆|原版/i.test(source)) parts.push("Кузов в основном заявлен в заводском окрасе.");
  if (/no accidents?|0 accidents|无事故/i.test(source)) parts.push("Серьёзных ДТП продавец не заявляет.");
  if (/repaint|painted|touch-up|喷漆|补漆/i.test(source)) parts.push("Есть упоминания окрашенных кузовных элементов.");
  if (/replaced|replacement|更换/i.test(source)) parts.push("Указана замена отдельных деталей — это стоит проверить по истории.");
  if (/odometer|mileage|kilometers|公里/i.test(source)) parts.push("В описании есть сведения о пробеге; их нужно сверить с отчётом.");
  if (/sunroof|camera|navigation|seat|cruise|audio|天窗|座椅|导航/i.test(source)) parts.push("Поставщик также перечисляет оснащение автомобиля.");
  if (/excellent condition|good condition|车况/i.test(source)) parts.push("Состояние автомобиля продавец оценивает как хорошее.");
  if (/insurance|保险/i.test(source)) parts.push("В карточке есть сведения о страховке.");
  if (!parts.length) parts.push("Поставщик передал дополнительное описание состояния автомобиля.");
  parts.push("Формулировка приведена в понятном для покупателя виде; ключевые факты стоит подтвердить отчётом и осмотром.");
  return [...new Set(parts)].join(" ");
}

export function localizeSupplierDescription(value) {
  const source = clean(value);
  if (!source) return "";
  if (isMostlyRussian(source)) return polishRussian(source);

  const exact = EXACT_TRANSLATIONS.get(normalizeKey(source));
  if (exact) return exact;

  const clauses = source
    .replace(/\r?\n+/g, "; ")
    .split(/\s*;\s*|(?<=[.!?])\s+(?=[A-ZА-ЯЁ\u3400-\u9fff])/)
    .map(clean)
    .filter(Boolean);

  const translated = clauses.map(translateClause).filter(Boolean);
  if (translated.length && translated.length >= Math.ceil(clauses.length * 0.7)) {
    return polishRussian(translated.join(" "));
  }

  return fallbackSummary(source);
}
