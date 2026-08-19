export const CATALOG_BRANDS = [
  "Aion", "AITO", "Alfa Romeo", "Aston Martin", "Audi", "AVATR", "Baojun", "Bentley", "Bestune", "BMW", "Buick", "BYD", "Changan", "Changan Qiyuan", "Chery", "Chery Fulwin", "Chevrolet", "Citroen", "Deepal", "Denza", "Dongfeng", "Exeed", "Fangchengbao", "Ferrari", "Fiat", "Ford", "GAC Trumpchi", "Geely", "Geely Galaxy", "Genesis", "GMC", "Haval", "Honda", "Hongqi", "Hyundai", "IM Motors", "Infiniti", "Jaguar", "Jeep", "Jetta", "Jetour", "Kia", "Land Rover", "Leapmotor", "Lexus", "Li Auto", "Lynk & Co", "Maserati", "Mazda", "McLaren", "Mercedes-Benz", "MG", "MINI", "Mitsubishi", "Neta", "NIO", "Nissan", "ORA", "Peugeot", "Polestar", "Porsche", "RAM", "Roewe", "SERES", "Skoda", "smart", "Subaru", "Tank", "Tesla", "Toyota", "Volkswagen", "Volvo", "WEY", "Wuling", "Xiaomi", "XPeng", "Zeekr"
];

export const CATALOG_BODIES = [
  "Седан",
  "Хэтчбек",
  "Лифтбек",
  "Универсал",
  "SUV",
  "Кроссовер",
  "MPV",
  "Купе / спорткар",
  "Кабриолет",
  "Пикап",
  "Минивэн / фургон",
  "Другое"
];

export const CATALOG_ENERGY_TYPES = [
  "Бензин",
  "Дизель",
  "Гибрид (HEV)",
  "Подключаемый гибрид (PHEV)",
  "Электро",
  "Гибрид с увеличителем запаса хода (EREV)",
  "Мягкий гибрид 48V",
  "Газ",
  "Метанол",
  "Прочее"
];

function key(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

const BRAND_ALIASES = new Map(Object.entries({
  "奥迪": "Audi", "audi": "Audi",
  "宝马": "BMW", "bmw": "BMW",
  "奔驰": "Mercedes-Benz", "mercedes benz": "Mercedes-Benz", "mercedes-benz": "Mercedes-Benz",
  "大众": "Volkswagen", "vw": "Volkswagen", "volkswagen": "Volkswagen",
  "丰田": "Toyota", "toyota": "Toyota",
  "本田": "Honda", "honda": "Honda",
  "比亚迪": "BYD", "byd": "BYD",
  "吉利": "Geely", "吉利汽车": "Geely", "geely": "Geely",
  "吉利银河": "Geely Galaxy", "geely galaxy": "Geely Galaxy",
  "长安": "Changan", "changan": "Changan",
  "长安启源": "Changan Qiyuan", "changan qiyuan": "Changan Qiyuan",
  "奇瑞": "Chery", "chery": "Chery",
  "奇瑞风云": "Chery Fulwin", "chery fulwin": "Chery Fulwin",
  "哈弗": "Haval", "haval": "Haval",
  "红旗": "Hongqi", "hongqi": "Hongqi",
  "特斯拉": "Tesla", "tesla": "Tesla",
  "蔚来": "NIO", "nio": "NIO",
  "小鹏": "XPeng", "小鹏汽车": "XPeng", "xpeng": "XPeng",
  "理想": "Li Auto", "理想汽车": "Li Auto", "li auto": "Li Auto",
  "极氪": "Zeekr", "zeekr": "Zeekr",
  "问界": "AITO", "aito 问界": "AITO", "aito": "AITO",
  "小米汽车": "Xiaomi", "xiaomi": "Xiaomi",
  "零跑": "Leapmotor", "零跑汽车": "Leapmotor", "leapmotor": "Leapmotor",
  "腾势": "Denza", "denza": "Denza",
  "方程豹": "Fangchengbao", "fangchengbao": "Fangchengbao",
  "阿维塔": "AVATR", "avatr": "AVATR",
  "深蓝汽车": "Deepal", "深蓝": "Deepal", "deepal": "Deepal",
  "埃安": "Aion", "广汽埃安": "Aion", "aion": "Aion",
  "欧拉": "ORA", "ora": "ORA",
  "魏牌": "WEY", "wey": "WEY",
  "坦克": "Tank", "tank": "Tank",
  "广汽传祺": "GAC Trumpchi", "gac trumpchi": "GAC Trumpchi",
  "荣威": "Roewe", "roewe": "Roewe",
  "名爵": "MG", "mg": "MG",
  "五菱汽车": "Wuling", "五菱": "Wuling", "wuling": "Wuling",
  "领克": "Lynk & Co", "lynk & co": "Lynk & Co", "lynk&co": "Lynk & Co",
  "智己汽车": "IM Motors", "智己": "IM Motors", "im motors": "IM Motors",
  "哪吒汽车": "Neta", "哪吒": "Neta", "neta": "Neta",
  "捷途": "Jetour", "jetour": "Jetour",
  "星途": "Exeed", "exeed": "Exeed",
  "沃尔沃": "Volvo", "volvo": "Volvo",
  "日产": "Nissan", "nissan": "Nissan",
  "马自达": "Mazda", "mazda": "Mazda",
  "现代": "Hyundai", "hyundai": "Hyundai",
  "起亚": "Kia", "kia": "Kia",
  "别克": "Buick", "buick": "Buick",
  "雪佛兰": "Chevrolet", "chevrolet": "Chevrolet",
  "福特": "Ford", "ford": "Ford",
  "保时捷": "Porsche", "porsche": "Porsche",
  "捷豹": "Jaguar", "jaguar": "Jaguar",
  "路虎": "Land Rover", "land rover": "Land Rover",
  "斯柯达": "Skoda", "skoda": "Skoda",
  "斯巴鲁": "Subaru", "subaru": "Subaru",
  "三菱": "Mitsubishi", "mitsubishi": "Mitsubishi",
  "标致": "Peugeot", "peugeot": "Peugeot",
  "雪铁龙": "Citroen", "citroën": "Citroen", "citroen": "Citroen",
  "玛莎拉蒂": "Maserati", "maserati": "Maserati",
  "宾利": "Bentley", "bentley": "Bentley",
  "法拉利": "Ferrari", "ferrari": "Ferrari",
  "阿斯顿·马丁": "Aston Martin", "aston martin": "Aston Martin",
  "迈凯伦": "McLaren", "mclaren": "McLaren",
  "英菲尼迪": "Infiniti", "infiniti": "Infiniti",
  "捷尼赛思": "Genesis", "genesis": "Genesis",
  "polestar极星": "Polestar", "极星": "Polestar", "polestar": "Polestar",
  "smart": "smart", "mini": "MINI", "jeep": "Jeep", "ram": "RAM", "gmc": "GMC"
}).map(([alias, canonical]) => [key(alias), canonical]));

const BODY_ALIASES = new Map(Object.entries({
  "轿车": "Седан", "三厢": "Седан", "三厢车": "Седан", "sedan": "Седан",
  "两厢": "Хэтчбек", "两厢车": "Хэтчбек", "hatchback": "Хэтчбек",
  "掀背": "Лифтбек", "掀背车": "Лифтбек", "liftback": "Лифтбек",
  "旅行版": "Универсал", "旅行车": "Универсал", "wagon": "Универсал", "estate": "Универсал",
  "suv": "SUV", "越野车": "SUV",
  "跨界车": "Кроссовер", "crossover": "Кроссовер",
  "mpv": "MPV",
  "跑车": "Купе / спорткар", "coupe": "Купе / спорткар", "sports car": "Купе / спорткар",
  "硬顶敞篷": "Кабриолет", "软顶敞篷": "Кабриолет", "敞篷": "Кабриолет", "convertible": "Кабриолет",
  "皮卡": "Пикап", "pickup": "Пикап",
  "微面": "Минивэн / фургон", "van": "Минивэн / фургон", "minivan": "Минивэн / фургон"
}).map(([alias, canonical]) => [key(alias), canonical]));

const ENERGY_ALIASES = new Map(Object.entries({
  "汽油": "Бензин", "gasoline": "Бензин", "petrol": "Бензин", "бензин": "Бензин",
  "柴油": "Дизель", "diesel": "Дизель", "дизель": "Дизель",
  "油电混合": "Гибрид (HEV)", "hev": "Гибрид (HEV)", "hybrid": "Гибрид (HEV)", "гибрид": "Гибрид (HEV)",
  "插电式混合动力": "Подключаемый гибрид (PHEV)", "插电混动": "Подключаемый гибрид (PHEV)", "phev": "Подключаемый гибрид (PHEV)",
  "纯电动": "Электро", "纯电": "Электро", "ev": "Электро", "bev": "Электро", "electric": "Электро", "электро": "Электро",
  "增程式": "Гибрид с увеличителем запаса хода (EREV)", "增程": "Гибрид с увеличителем запаса хода (EREV)", "erev": "Гибрид с увеличителем запаса хода (EREV)", "range extender": "Гибрид с увеличителем запаса хода (EREV)",
  "汽油+48v轻混系统": "Мягкий гибрид 48V", "48v轻混": "Мягкий гибрид 48V", "mhev": "Мягкий гибрид 48V", "mild hybrid": "Мягкий гибрид 48V",
  "天然气": "Газ", "cng": "Газ", "lng": "Газ", "gas": "Газ", "газ": "Газ",
  "甲醇": "Метанол", "methanol": "Метанол", "метанол": "Метанол"
}).map(([alias, canonical]) => [key(alias), canonical]));

export function canonicalBrand(value) {
  const raw = String(value ?? "").trim();
  return BRAND_ALIASES.get(key(raw)) || raw || null;
}

export function canonicalBody(value) {
  const raw = String(value ?? "").trim();
  return BODY_ALIASES.get(key(raw)) || raw || null;
}

export function canonicalEnergyType(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const direct = ENERGY_ALIASES.get(key(raw));
  if (direct) return direct;
  const normalized = key(raw);
  for (const [alias, canonical] of ENERGY_ALIASES.entries()) {
    if (normalized.includes(alias)) return canonical;
  }
  return "Прочее";
}
