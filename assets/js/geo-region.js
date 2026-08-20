(function () {
  'use strict';

  // Слоты лендинга. Класс .js-geo-region поддержан на будущее — сейчас
  // разметка помечена атрибутами data-region-slot, менять её незачем.
  var SLOT_PHRASE = '[data-region-slot="1"], .js-geo-region';
  var SLOT_LABEL  = '[data-region-slot="2"], [data-region-slot="3"]';

  var CACHE_KEY  = 'arma_geo_v2';
  var CACHE_TTL  = 7 * 24 * 60 * 60 * 1000;
  // Первый провайдер отвечает быстро; длинное ожидание только задерживает
  // подмену текста и расширяет гонку с монтированием компонента.
  var TIMEOUT_FIRST = 1500;
  var TIMEOUT_NEXT  = 3000;

  // Бандл заменяет корневой элемент через documentElement.replaceWith,
  // поэтому подставляем не один раз, а опрашиваем document ~20 секунд.
  var POLL_MS  = 150;
  var POLL_MAX = 133;

  var FOREIGN = { phrase: 'по всей России', readable: 'Вся Россия', push: false };

  var FORMS = {
    'москва': 'в Москве', 'moscow': 'в Москве',
    'санкт-петербург': 'в Санкт-Петербурге', 'saint petersburg': 'в Санкт-Петербурге',
    'st petersburg': 'в Санкт-Петербурге', 'st. petersburg': 'в Санкт-Петербурге',
    'новосибирск': 'в Новосибирске', 'novosibirsk': 'в Новосибирске',
    'екатеринбург': 'в Екатеринбурге', 'yekaterinburg': 'в Екатеринбурге',
    'ekaterinburg': 'в Екатеринбурге',
    'казань': 'в Казани', 'kazan': 'в Казани',
    'нижний новгород': 'в Нижнем Новгороде', 'nizhny novgorod': 'в Нижнем Новгороде',
    'челябинск': 'в Челябинске', 'chelyabinsk': 'в Челябинске',
    'самара': 'в Самаре', 'samara': 'в Самаре',
    'омск': 'в Омске', 'omsk': 'в Омске',
    'ростов-на-дону': 'в Ростове-на-Дону', 'rostov-on-don': 'в Ростове-на-Дону',
    'уфа': 'в Уфе', 'ufa': 'в Уфе',
    'красноярск': 'в Красноярске', 'krasnoyarsk': 'в Красноярске',
    'воронеж': 'в Воронеже', 'voronezh': 'в Воронеже',
    'пермь': 'в Перми', 'perm': 'в Перми',
    'волгоград': 'в Волгограде', 'volgograd': 'в Волгограде',
    'саратов': 'в Саратове', 'saratov': 'в Саратове',
    'тюмень': 'в Тюмени', 'tyumen': 'в Тюмени',
    'тольятти': 'в Тольятти', 'tolyatti': 'в Тольятти',
    'ижевск': 'в Ижевске', 'izhevsk': 'в Ижевске',
    'барнаул': 'в Барнауле', 'barnaul': 'в Барнауле',
    'ульяновск': 'в Ульяновске', 'ulyanovsk': 'в Ульяновске',
    'иркутск': 'в Иркутске', 'irkutsk': 'в Иркутске',
    'хабаровск': 'в Хабаровске', 'khabarovsk': 'в Хабаровске',
    'ярославль': 'в Ярославле', 'yaroslavl': 'в Ярославле',
    'владивосток': 'во Владивостоке', 'vladivostok': 'во Владивостоке',
    'махачкала': 'в Махачкале', 'makhachkala': 'в Махачкале',
    'томск': 'в Томске', 'tomsk': 'в Томске',
    'оренбург': 'в Оренбурге', 'orenburg': 'в Оренбурге',
    'кемерово': 'в Кемерово', 'kemerovo': 'в Кемерово',
    'новокузнецк': 'в Новокузнецке', 'novokuznetsk': 'в Новокузнецке',
    'рязань': 'в Рязани', 'ryazan': 'в Рязани',
    'набережные челны': 'в Набережных Челнах', 'naberezhnye chelny': 'в Набережных Челнах',
    'астрахань': 'в Астрахани', 'astrakhan': 'в Астрахани',
    'пенза': 'в Пензе', 'penza': 'в Пензе',
    'липецк': 'в Липецке', 'lipetsk': 'в Липецке',
    'тула': 'в Туле', 'tula': 'в Туле',
    'киров': 'в Кирове', 'kirov': 'в Кирове',
    'чебоксары': 'в Чебоксарах', 'cheboksary': 'в Чебоксарах',
    'калининград': 'в Калининграде', 'kaliningrad': 'в Калининграде',
    'курск': 'в Курске', 'kursk': 'в Курске',
    'улан-удэ': 'в Улан-Удэ', 'ulan-ude': 'в Улан-Удэ',
    'ставрополь': 'в Ставрополе', 'stavropol': 'в Ставрополе',
    'тверь': 'в Твери', 'tver': 'в Твери',
    'магнитогорск': 'в Магнитогорске', 'magnitogorsk': 'в Магнитогорске',
    'иваново': 'в Иваново', 'ivanovo': 'в Иваново',
    'брянск': 'в Брянске', 'bryansk': 'в Брянске',
    'белгород': 'в Белгороде', 'belgorod': 'в Белгороде',
    'сургут': 'в Сургуте', 'surgut': 'в Сургуте',
    'владимир': 'во Владимире', 'vladimir': 'во Владимире',
    'архангельск': 'в Архангельске', 'arkhangelsk': 'в Архангельске',
    'чита': 'в Чите', 'chita': 'в Чите',
    'калуга': 'в Калуге', 'kaluga': 'в Калуге',
    'смоленск': 'в Смоленске', 'smolensk': 'в Смоленске',
    'курган': 'в Кургане', 'kurgan': 'в Кургане',
    'орел': 'в Орле', 'oryol': 'в Орле', 'orel': 'в Орле',
    'череповец': 'в Череповце', 'cherepovets': 'в Череповце',
    'вологда': 'в Вологде', 'vologda': 'в Вологде',
    'якутск': 'в Якутске', 'yakutsk': 'в Якутске',
    'саранск': 'в Саранске', 'saransk': 'в Саранске',
    'владикавказ': 'во Владикавказе', 'vladikavkaz': 'во Владикавказе',
    'мурманск': 'в Мурманске', 'murmansk': 'в Мурманске',
    'тамбов': 'в Тамбове', 'tambov': 'в Тамбове',
    'грозный': 'в Грозном', 'grozny': 'в Грозном',
    'петрозаводск': 'в Петрозаводске', 'petrozavodsk': 'в Петрозаводске',
    'кострома': 'в Костроме', 'kostroma': 'в Костроме',
    'йошкар-ола': 'в Йошкар-Оле', 'yoshkar-ola': 'в Йошкар-Оле',
    'нальчик': 'в Нальчике', 'nalchik': 'в Нальчике',
    'сыктывкар': 'в Сыктывкаре', 'syktyvkar': 'в Сыктывкаре',
    'нижневартовск': 'в Нижневартовске', 'nizhnevartovsk': 'в Нижневартовске',
    'нижний тагил': 'в Нижнем Тагиле', 'nizhny tagil': 'в Нижнем Тагиле',
    'великий новгород': 'в Великом Новгороде', 'veliky novgorod': 'в Великом Новгороде',
    'псков': 'во Пскове', 'pskov': 'во Пскове',
    'абакан': 'в Абакане', 'abakan': 'в Абакане',
    'благовещенск': 'в Благовещенске', 'blagoveshchensk': 'в Благовещенске',
    'южно-сахалинск': 'в Южно-Сахалинске', 'yuzhno-sakhalinsk': 'в Южно-Сахалинске',
    'петропавловск-камчатский': 'в Петропавловске-Камчатском',
    'petropavlovsk-kamchatsky': 'в Петропавловске-Камчатском',
    'майкоп': 'в Майкопе', 'maykop': 'в Майкопе', 'maikop': 'в Майкопе',
    'элиста': 'в Элисте', 'elista': 'в Элисте',
    'черкесск': 'в Черкесске', 'cherkessk': 'в Черкесске',
    'магас': 'в Магасе', 'magas': 'в Магасе',
    'назрань': 'в Назрани', 'nazran': 'в Назрани',
    'горно-алтайск': 'в Горно-Алтайске', 'gorno-altaysk': 'в Горно-Алтайске',
    'кызыл': 'в Кызыле', 'kyzyl': 'в Кызыле',
    'салехард': 'в Салехарде', 'salekhard': 'в Салехарде',
    'ханты-мансийск': 'в Ханты-Мансийске', 'khanty-mansiysk': 'в Ханты-Мансийске',
    'севастополь': 'в Севастополе', 'sevastopol': 'в Севастополе',
    'симферополь': 'в Симферополе', 'simferopol': 'в Симферополе',

    'краснодар': 'в Краснодаре', 'krasnodar': 'в Краснодаре',
    'сочи': 'в Сочи', 'sochi': 'в Сочи',
    'новороссийск': 'в Новороссийске', 'novorossiysk': 'в Новороссийске',
    'армавир': 'в Армавире', 'armavir': 'в Армавире',
    'анапа': 'в Анапе', 'anapa': 'в Анапе',
    'ейск': 'в Ейске', 'yeysk': 'в Ейске', 'eysk': 'в Ейске',
    'геленджик': 'в Геленджике', 'gelendzhik': 'в Геленджике',
    'туапсе': 'в Туапсе', 'tuapse': 'в Туапсе',
    'кропоткин': 'в Кропоткине', 'kropotkin': 'в Кропоткине',
    'славянск-на-кубани': 'в Славянске-на-Кубани',
    'slavyansk-na-kubani': 'в Славянске-на-Кубани',
    'тихорецк': 'в Тихорецке', 'tikhoretsk': 'в Тихорецке',
    'тимашевск': 'в Тимашевске', 'timashevsk': 'в Тимашевске',
    'крымск': 'в Крымске', 'krymsk': 'в Крымске',
    'белореченск': 'в Белореченске', 'belorechensk': 'в Белореченске',
    'курганинск': 'в Курганинске', 'kurganinsk': 'в Курганинске',
    'лабинск': 'в Лабинске', 'labinsk': 'в Лабинске',
    'апшеронск': 'в Апшеронске', 'apsheronsk': 'в Апшеронске',
    'усть-лабинск': 'в Усть-Лабинске', 'ust-labinsk': 'в Усть-Лабинске',
    'абинск': 'в Абинске', 'abinsk': 'в Абинске',
    'горячий ключ': 'в Горячем Ключе', 'goryachy klyuch': 'в Горячем Ключе',
    'приморско-ахтарск': 'в Приморско-Ахтарске',
    'primorsko-akhtarsk': 'в Приморско-Ахтарске',
    'темрюк': 'в Темрюке', 'temryuk': 'в Темрюке',
    'кореновск': 'в Кореновске', 'korenovsk': 'в Кореновске',
    'гулькевичи': 'в Гулькевичах', 'gulkevichi': 'в Гулькевичах',
    'хадыженск': 'в Хадыженске', 'khadyzhensk': 'в Хадыженске',
    'новокубанск': 'в Новокубанске', 'novokubansk': 'в Новокубанске',
    'адлер': 'в Адлере', 'adler': 'в Адлере',
    'краснодарский': 'в Краснодарском крае'
  };
  // Субъекты РФ: название от GeoIP -> предложная форма.
  // Проверяется ДО словаря городов: ipwho.is стоит первым провайдером
  // и отдаёт латиницу, поэтому «Tula Oblast» иначе выродится в город Тулу.
  // Предложные формы получены тем же правилом, что в regionToPrepositional.
  var ENG_REGIONS = {
    // республики
    'adygea': 'в Республике Адыгея',
    'adygeya': 'в Республике Адыгея',
    'republic of adygea': 'в Республике Адыгея',
    'adygea republic': 'в Республике Адыгея',
    'adygeya republic': 'в Республике Адыгея',
    'altai republic': 'в Республике Алтай',
    'republic of altai': 'в Республике Алтай',
    'gorno-altai republic': 'в Республике Алтай',
    'bashkortostan': 'в Республике Башкортостан',
    'republic of bashkortostan': 'в Республике Башкортостан',
    'bashkortostan republic': 'в Республике Башкортостан',
    'bashkiria': 'в Республике Башкортостан',
    'buryatia': 'в Республике Бурятия',
    'republic of buryatia': 'в Республике Бурятия',
    'buryatia republic': 'в Республике Бурятия',
    'buryat republic': 'в Республике Бурятия',
    'dagestan': 'в Республике Дагестан',
    'republic of dagestan': 'в Республике Дагестан',
    'dagestan republic': 'в Республике Дагестан',
    'ingushetia': 'в Республике Ингушетия',
    'republic of ingushetia': 'в Республике Ингушетия',
    'ingushetia republic': 'в Республике Ингушетия',
    'kabardino-balkaria': 'в Кабардино-Балкарской Республике',
    'kabardino-balkarian republic': 'в Кабардино-Балкарской Республике',
    'republic of kabardino-balkaria': 'в Кабардино-Балкарской Республике',
    'kalmykia': 'в Республике Калмыкия',
    'republic of kalmykia': 'в Республике Калмыкия',
    'kalmykia republic': 'в Республике Калмыкия',
    'karachay-cherkessia': 'в Карачаево-Черкесской Республике',
    'karachay-cherkess republic': 'в Карачаево-Черкесской Республике',
    'republic of karachay-cherkessia': 'в Карачаево-Черкесской Республике',
    'karelia': 'в Республике Карелия',
    'republic of karelia': 'в Республике Карелия',
    'karelia republic': 'в Республике Карелия',
    'komi': 'в Республике Коми',
    'komi republic': 'в Республике Коми',
    'republic of komi': 'в Республике Коми',
    'crimea': 'в Республике Крым',
    'republic of crimea': 'в Республике Крым',
    'crimea republic': 'в Республике Крым',
    'mari el': 'в Республике Марий Эл',
    'mari el republic': 'в Республике Марий Эл',
    'republic of mari el': 'в Республике Марий Эл',
    'mordovia': 'в Республике Мордовия',
    'republic of mordovia': 'в Республике Мордовия',
    'mordovia republic': 'в Республике Мордовия',
    'sakha': 'в Республике Саха',
    'sakha republic': 'в Республике Саха',
    'republic of sakha': 'в Республике Саха',
    'sakha (yakutia)': 'в Республике Саха',
    'sakha (yakutia) republic': 'в Республике Саха',
    'yakutia': 'в Республике Саха',
    'yakutia republic': 'в Республике Саха',
    'north ossetia': 'в Республике Северная Осетия — Алания',
    'north ossetia-alania': 'в Республике Северная Осетия — Алания',
    'republic of north ossetia-alania': 'в Республике Северная Осетия — Алания',
    'north ossetia — alania': 'в Республике Северная Осетия — Алания',
    'tatarstan': 'в Республике Татарстан',
    'republic of tatarstan': 'в Республике Татарстан',
    'tatarstan republic': 'в Республике Татарстан',
    'tuva': 'в Республике Тыва',
    'tyva': 'в Республике Тыва',
    'tyva republic': 'в Республике Тыва',
    'tuva republic': 'в Республике Тыва',
    'republic of tyva': 'в Республике Тыва',
    'udmurtia': 'в Удмуртской Республике',
    'udmurt republic': 'в Удмуртской Республике',
    'republic of udmurtia': 'в Удмуртской Республике',
    'udmurtia republic': 'в Удмуртской Республике',
    'khakassia': 'в Республике Хакасия',
    'republic of khakassia': 'в Республике Хакасия',
    'khakassia republic': 'в Республике Хакасия',
    'chechnya': 'в Чеченской Республике',
    'chechen republic': 'в Чеченской Республике',
    'republic of chechnya': 'в Чеченской Республике',
    'chechnya republic': 'в Чеченской Республике',
    'chuvashia': 'в Чувашской Республике',
    'chuvash republic': 'в Чувашской Республике',
    'republic of chuvashia': 'в Чувашской Республике',
    'chuvashia republic': 'в Чувашской Республике',

    // края
    'altai krai': 'в Алтайском крае',
    'altay krai': 'в Алтайском крае',
    'altai kray': 'в Алтайском крае',
    'zabaykalsky krai': 'в Забайкальском крае',
    'zabaikalsky krai': 'в Забайкальском крае',
    'zabaykalsky kray': 'в Забайкальском крае',
    'transbaikal krai': 'в Забайкальском крае',
    'kamchatka krai': 'в Камчатском крае',
    'kamchatka kray': 'в Камчатском крае',
    'kamchatka': 'в Камчатском крае',
    'krasnodar krai': 'в Краснодарском крае',
    'krasnodarskiy kray': 'в Краснодарском крае',
    'krasnodar kray': 'в Краснодарском крае',
    'krasnoyarsk krai': 'в Красноярском крае',
    'krasnoyarskiy kray': 'в Красноярском крае',
    'krasnoyarsk kray': 'в Красноярском крае',
    'perm krai': 'в Пермском крае',
    'perm kray': 'в Пермском крае',
    'primorsky krai': 'в Приморском крае',
    'primorskiy kray': 'в Приморском крае',
    'primorye': 'в Приморском крае',
    'stavropol krai': 'в Ставропольском крае',
    'stavropolskiy kray': 'в Ставропольском крае',
    'stavropol kray': 'в Ставропольском крае',
    'khabarovsk krai': 'в Хабаровском крае',
    'khabarovskiy kray': 'в Хабаровском крае',
    'khabarovsk kray': 'в Хабаровском крае',

    // области
    'amur oblast': 'в Амурской области',
    'amur region': 'в Амурской области',
    'arkhangelsk oblast': 'в Архангельской области',
    'arkhangelsk region': 'в Архангельской области',
    'astrakhan oblast': 'в Астраханской области',
    'astrakhan region': 'в Астраханской области',
    'belgorod oblast': 'в Белгородской области',
    'belgorod region': 'в Белгородской области',
    'bryansk oblast': 'в Брянской области',
    'bryansk region': 'в Брянской области',
    'vladimir oblast': 'во Владимирской области',
    'vladimir region': 'во Владимирской области',
    'volgograd oblast': 'в Волгоградской области',
    'volgograd region': 'в Волгоградской области',
    'vologda oblast': 'в Вологодской области',
    'vologda region': 'в Вологодской области',
    'voronezh oblast': 'в Воронежской области',
    'voronezh region': 'в Воронежской области',
    'ivanovo oblast': 'в Ивановской области',
    'ivanovo region': 'в Ивановской области',
    'irkutsk oblast': 'в Иркутской области',
    'irkutsk region': 'в Иркутской области',
    'kaliningrad oblast': 'в Калининградской области',
    'kaliningrad region': 'в Калининградской области',
    'kaluga oblast': 'в Калужской области',
    'kaluga region': 'в Калужской области',
    'kemerovo oblast': 'в Кемеровской области',
    'kemerovo region': 'в Кемеровской области',
    'kuzbass': 'в Кемеровской области',
    'kirov oblast': 'в Кировской области',
    'kirov region': 'в Кировской области',
    'kostroma oblast': 'в Костромской области',
    'kostroma region': 'в Костромской области',
    'kurgan oblast': 'в Курганской области',
    'kurgan region': 'в Курганской области',
    'kursk oblast': 'в Курской области',
    'kursk region': 'в Курской области',
    'leningrad oblast': 'в Ленинградской области',
    'leningrad region': 'в Ленинградской области',
    'lipetsk oblast': 'в Липецкой области',
    'lipetsk region': 'в Липецкой области',
    'magadan oblast': 'в Магаданской области',
    'magadan region': 'в Магаданской области',
    'moscow oblast': 'в Московской области',
    'moscow region': 'в Московской области',
    'murmansk oblast': 'в Мурманской области',
    'murmansk region': 'в Мурманской области',
    'nizhny novgorod oblast': 'в Нижегородской области',
    'nizhny novgorod region': 'в Нижегородской области',
    'novgorod oblast': 'в Новгородской области',
    'novgorod region': 'в Новгородской области',
    'novosibirsk oblast': 'в Новосибирской области',
    'novosibirsk region': 'в Новосибирской области',
    'omsk oblast': 'в Омской области',
    'omsk region': 'в Омской области',
    'orenburg oblast': 'в Оренбургской области',
    'orenburg region': 'в Оренбургской области',
    'oryol oblast': 'в Орловской области',
    'oryol region': 'в Орловской области',
    'orel oblast': 'в Орловской области',
    'orel region': 'в Орловской области',
    'penza oblast': 'в Пензенской области',
    'penza region': 'в Пензенской области',
    'pskov oblast': 'в Псковской области',
    'pskov region': 'в Псковской области',
    'rostov oblast': 'в Ростовской области',
    'rostov region': 'в Ростовской области',
    'ryazan oblast': 'в Рязанской области',
    'ryazan region': 'в Рязанской области',
    'samara oblast': 'в Самарской области',
    'samara region': 'в Самарской области',
    'saratov oblast': 'в Саратовской области',
    'saratov region': 'в Саратовской области',
    'sakhalin oblast': 'в Сахалинской области',
    'sakhalin region': 'в Сахалинской области',
    'sverdlovsk oblast': 'в Свердловской области',
    'sverdlovsk region': 'в Свердловской области',
    'smolensk oblast': 'в Смоленской области',
    'smolensk region': 'в Смоленской области',
    'tambov oblast': 'в Тамбовской области',
    'tambov region': 'в Тамбовской области',
    'tver oblast': 'в Тверской области',
    'tver region': 'в Тверской области',
    'tomsk oblast': 'в Томской области',
    'tomsk region': 'в Томской области',
    'tula oblast': 'в Тульской области',
    'tula region': 'в Тульской области',
    'tyumen oblast': 'в Тюменской области',
    'tyumen region': 'в Тюменской области',
    'ulyanovsk oblast': 'в Ульяновской области',
    'ulyanovsk region': 'в Ульяновской области',
    'chelyabinsk oblast': 'в Челябинской области',
    'chelyabinsk region': 'в Челябинской области',
    'yaroslavl oblast': 'в Ярославской области',
    'yaroslavl region': 'в Ярославской области',

    // города федерального значения
    'moscow': 'в Москве',
    'moscow city': 'в Москве',
    'moskva': 'в Москве',
    'saint petersburg': 'в Санкт-Петербурге',
    'st petersburg': 'в Санкт-Петербурге',
    'sankt-peterburg': 'в Санкт-Петербурге',
    'sevastopol': 'в Севастополе',
    'sevastopol city': 'в Севастополе',

    // автономная область
    'jewish autonomous oblast': 'в Еврейской автономной области',
    'jewish autonomous region': 'в Еврейской автономной области',

    // автономные округа
    'nenets autonomous okrug': 'в Ненецком автономном округе',
    'nenets autonomous area': 'в Ненецком автономном округе',
    'nenets': 'в Ненецком автономном округе',
    'khanty-mansi autonomous okrug': 'в Ханты-Мансийском автономном округе',
    'khanty-mansiysk autonomous okrug': 'в Ханты-Мансийском автономном округе',
    'khanty-mansi autonomous okrug - yugra': 'в Ханты-Мансийском автономном округе',
    'yugra': 'в Ханты-Мансийском автономном округе',
    'khanty-mansia': 'в Ханты-Мансийском автономном округе',
    'chukotka autonomous okrug': 'в Чукотском автономном округе',
    'chukotka': 'в Чукотском автономном округе',
    'yamalo-nenets autonomous okrug': 'в Ямало-Ненецком автономном округе',
    'yamalo-nenets': 'в Ямало-Ненецком автономном округе',
    'yamal': 'в Ямало-Ненецком автономном округе'
  };
  // Те же субъекты в именительном падеже — для подписи «Ваш регион»
  // и для поля geo_region в заявке.
  var ENG_REGIONS_NOM = {
    // республики
    'adygea': 'Республика Адыгея',
    'adygeya': 'Республика Адыгея',
    'republic of adygea': 'Республика Адыгея',
    'adygea republic': 'Республика Адыгея',
    'adygeya republic': 'Республика Адыгея',
    'altai republic': 'Республика Алтай',
    'republic of altai': 'Республика Алтай',
    'gorno-altai republic': 'Республика Алтай',
    'bashkortostan': 'Республика Башкортостан',
    'republic of bashkortostan': 'Республика Башкортостан',
    'bashkortostan republic': 'Республика Башкортостан',
    'bashkiria': 'Республика Башкортостан',
    'buryatia': 'Республика Бурятия',
    'republic of buryatia': 'Республика Бурятия',
    'buryatia republic': 'Республика Бурятия',
    'buryat republic': 'Республика Бурятия',
    'dagestan': 'Республика Дагестан',
    'republic of dagestan': 'Республика Дагестан',
    'dagestan republic': 'Республика Дагестан',
    'ingushetia': 'Республика Ингушетия',
    'republic of ingushetia': 'Республика Ингушетия',
    'ingushetia republic': 'Республика Ингушетия',
    'kabardino-balkaria': 'Кабардино-Балкарская Республика',
    'kabardino-balkarian republic': 'Кабардино-Балкарская Республика',
    'republic of kabardino-balkaria': 'Кабардино-Балкарская Республика',
    'kalmykia': 'Республика Калмыкия',
    'republic of kalmykia': 'Республика Калмыкия',
    'kalmykia republic': 'Республика Калмыкия',
    'karachay-cherkessia': 'Карачаево-Черкесская Республика',
    'karachay-cherkess republic': 'Карачаево-Черкесская Республика',
    'republic of karachay-cherkessia': 'Карачаево-Черкесская Республика',
    'karelia': 'Республика Карелия',
    'republic of karelia': 'Республика Карелия',
    'karelia republic': 'Республика Карелия',
    'komi': 'Республика Коми',
    'komi republic': 'Республика Коми',
    'republic of komi': 'Республика Коми',
    'crimea': 'Республика Крым',
    'republic of crimea': 'Республика Крым',
    'crimea republic': 'Республика Крым',
    'mari el': 'Республика Марий Эл',
    'mari el republic': 'Республика Марий Эл',
    'republic of mari el': 'Республика Марий Эл',
    'mordovia': 'Республика Мордовия',
    'republic of mordovia': 'Республика Мордовия',
    'mordovia republic': 'Республика Мордовия',
    'sakha': 'Республика Саха',
    'sakha republic': 'Республика Саха',
    'republic of sakha': 'Республика Саха',
    'sakha (yakutia)': 'Республика Саха',
    'sakha (yakutia) republic': 'Республика Саха',
    'yakutia': 'Республика Саха',
    'yakutia republic': 'Республика Саха',
    'north ossetia': 'Республика Северная Осетия — Алания',
    'north ossetia-alania': 'Республика Северная Осетия — Алания',
    'republic of north ossetia-alania': 'Республика Северная Осетия — Алания',
    'north ossetia — alania': 'Республика Северная Осетия — Алания',
    'tatarstan': 'Республика Татарстан',
    'republic of tatarstan': 'Республика Татарстан',
    'tatarstan republic': 'Республика Татарстан',
    'tuva': 'Республика Тыва',
    'tyva': 'Республика Тыва',
    'tyva republic': 'Республика Тыва',
    'tuva republic': 'Республика Тыва',
    'republic of tyva': 'Республика Тыва',
    'udmurtia': 'Удмуртская Республика',
    'udmurt republic': 'Удмуртская Республика',
    'republic of udmurtia': 'Удмуртская Республика',
    'udmurtia republic': 'Удмуртская Республика',
    'khakassia': 'Республика Хакасия',
    'republic of khakassia': 'Республика Хакасия',
    'khakassia republic': 'Республика Хакасия',
    'chechnya': 'Чеченская Республика',
    'chechen republic': 'Чеченская Республика',
    'republic of chechnya': 'Чеченская Республика',
    'chechnya republic': 'Чеченская Республика',
    'chuvashia': 'Чувашская Республика',
    'chuvash republic': 'Чувашская Республика',
    'republic of chuvashia': 'Чувашская Республика',
    'chuvashia republic': 'Чувашская Республика',

    // края
    'altai krai': 'Алтайский край',
    'altay krai': 'Алтайский край',
    'altai kray': 'Алтайский край',
    'zabaykalsky krai': 'Забайкальский край',
    'zabaikalsky krai': 'Забайкальский край',
    'zabaykalsky kray': 'Забайкальский край',
    'transbaikal krai': 'Забайкальский край',
    'kamchatka krai': 'Камчатский край',
    'kamchatka kray': 'Камчатский край',
    'kamchatka': 'Камчатский край',
    'krasnodar krai': 'Краснодарский край',
    'krasnodarskiy kray': 'Краснодарский край',
    'krasnodar kray': 'Краснодарский край',
    'krasnoyarsk krai': 'Красноярский край',
    'krasnoyarskiy kray': 'Красноярский край',
    'krasnoyarsk kray': 'Красноярский край',
    'perm krai': 'Пермский край',
    'perm kray': 'Пермский край',
    'primorsky krai': 'Приморский край',
    'primorskiy kray': 'Приморский край',
    'primorye': 'Приморский край',
    'stavropol krai': 'Ставропольский край',
    'stavropolskiy kray': 'Ставропольский край',
    'stavropol kray': 'Ставропольский край',
    'khabarovsk krai': 'Хабаровский край',
    'khabarovskiy kray': 'Хабаровский край',
    'khabarovsk kray': 'Хабаровский край',

    // области
    'amur oblast': 'Амурская область',
    'amur region': 'Амурская область',
    'arkhangelsk oblast': 'Архангельская область',
    'arkhangelsk region': 'Архангельская область',
    'astrakhan oblast': 'Астраханская область',
    'astrakhan region': 'Астраханская область',
    'belgorod oblast': 'Белгородская область',
    'belgorod region': 'Белгородская область',
    'bryansk oblast': 'Брянская область',
    'bryansk region': 'Брянская область',
    'vladimir oblast': 'Владимирская область',
    'vladimir region': 'Владимирская область',
    'volgograd oblast': 'Волгоградская область',
    'volgograd region': 'Волгоградская область',
    'vologda oblast': 'Вологодская область',
    'vologda region': 'Вологодская область',
    'voronezh oblast': 'Воронежская область',
    'voronezh region': 'Воронежская область',
    'ivanovo oblast': 'Ивановская область',
    'ivanovo region': 'Ивановская область',
    'irkutsk oblast': 'Иркутская область',
    'irkutsk region': 'Иркутская область',
    'kaliningrad oblast': 'Калининградская область',
    'kaliningrad region': 'Калининградская область',
    'kaluga oblast': 'Калужская область',
    'kaluga region': 'Калужская область',
    'kemerovo oblast': 'Кемеровская область',
    'kemerovo region': 'Кемеровская область',
    'kuzbass': 'Кемеровская область',
    'kirov oblast': 'Кировская область',
    'kirov region': 'Кировская область',
    'kostroma oblast': 'Костромская область',
    'kostroma region': 'Костромская область',
    'kurgan oblast': 'Курганская область',
    'kurgan region': 'Курганская область',
    'kursk oblast': 'Курская область',
    'kursk region': 'Курская область',
    'leningrad oblast': 'Ленинградская область',
    'leningrad region': 'Ленинградская область',
    'lipetsk oblast': 'Липецкая область',
    'lipetsk region': 'Липецкая область',
    'magadan oblast': 'Магаданская область',
    'magadan region': 'Магаданская область',
    'moscow oblast': 'Московская область',
    'moscow region': 'Московская область',
    'murmansk oblast': 'Мурманская область',
    'murmansk region': 'Мурманская область',
    'nizhny novgorod oblast': 'Нижегородская область',
    'nizhny novgorod region': 'Нижегородская область',
    'novgorod oblast': 'Новгородская область',
    'novgorod region': 'Новгородская область',
    'novosibirsk oblast': 'Новосибирская область',
    'novosibirsk region': 'Новосибирская область',
    'omsk oblast': 'Омская область',
    'omsk region': 'Омская область',
    'orenburg oblast': 'Оренбургская область',
    'orenburg region': 'Оренбургская область',
    'oryol oblast': 'Орловская область',
    'oryol region': 'Орловская область',
    'orel oblast': 'Орловская область',
    'orel region': 'Орловская область',
    'penza oblast': 'Пензенская область',
    'penza region': 'Пензенская область',
    'pskov oblast': 'Псковская область',
    'pskov region': 'Псковская область',
    'rostov oblast': 'Ростовская область',
    'rostov region': 'Ростовская область',
    'ryazan oblast': 'Рязанская область',
    'ryazan region': 'Рязанская область',
    'samara oblast': 'Самарская область',
    'samara region': 'Самарская область',
    'saratov oblast': 'Саратовская область',
    'saratov region': 'Саратовская область',
    'sakhalin oblast': 'Сахалинская область',
    'sakhalin region': 'Сахалинская область',
    'sverdlovsk oblast': 'Свердловская область',
    'sverdlovsk region': 'Свердловская область',
    'smolensk oblast': 'Смоленская область',
    'smolensk region': 'Смоленская область',
    'tambov oblast': 'Тамбовская область',
    'tambov region': 'Тамбовская область',
    'tver oblast': 'Тверская область',
    'tver region': 'Тверская область',
    'tomsk oblast': 'Томская область',
    'tomsk region': 'Томская область',
    'tula oblast': 'Тульская область',
    'tula region': 'Тульская область',
    'tyumen oblast': 'Тюменская область',
    'tyumen region': 'Тюменская область',
    'ulyanovsk oblast': 'Ульяновская область',
    'ulyanovsk region': 'Ульяновская область',
    'chelyabinsk oblast': 'Челябинская область',
    'chelyabinsk region': 'Челябинская область',
    'yaroslavl oblast': 'Ярославская область',
    'yaroslavl region': 'Ярославская область',

    // города федерального значения
    'moscow': 'Москва',
    'moscow city': 'Москва',
    'moskva': 'Москва',
    'saint petersburg': 'Санкт-Петербург',
    'st petersburg': 'Санкт-Петербург',
    'sankt-peterburg': 'Санкт-Петербург',
    'sevastopol': 'Севастополь',
    'sevastopol city': 'Севастополь',

    // автономная область
    'jewish autonomous oblast': 'Еврейская автономная область',
    'jewish autonomous region': 'Еврейская автономная область',

    // автономные округа
    'nenets autonomous okrug': 'Ненецкий автономный округ',
    'nenets autonomous area': 'Ненецкий автономный округ',
    'nenets': 'Ненецкий автономный округ',
    'khanty-mansi autonomous okrug': 'Ханты-Мансийский автономный округ',
    'khanty-mansiysk autonomous okrug': 'Ханты-Мансийский автономный округ',
    'khanty-mansi autonomous okrug - yugra': 'Ханты-Мансийский автономный округ',
    'yugra': 'Ханты-Мансийский автономный округ',
    'khanty-mansia': 'Ханты-Мансийский автономный округ',
    'chukotka autonomous okrug': 'Чукотский автономный округ',
    'chukotka': 'Чукотский автономный округ',
    'yamalo-nenets autonomous okrug': 'Ямало-Ненецкий автономный округ',
    'yamalo-nenets': 'Ямало-Ненецкий автономный округ',
    'yamal': 'Ямало-Ненецкий автономный округ'
  };

  var CYRILLIC = /[а-яё]/i;

  function normalize(name) {
    return String(name).toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function capitalize(word) {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // «ростов-на-дону» -> «Ростов-на-Дону», «нижний новгород» -> «Нижний Новгород»
  var INNER_LOWER = { 'на': 1, 'в': 1, 'при': 1 };
  function titleCase(name) {
    return name.split(' ').map(function (word) {
      return word.split('-').map(function (part, idx) {
        return (idx > 0 && INNER_LOWER[part]) ? part : capitalize(part);
      }).join('-');
    }).join(' ');
  }

  // Обратный индекс «предложная фраза -> именительный падеж».
  // Строится из русских ключей FORMS, отдельный словарь не нужен.
  var NOMINATIVE = (function () {
    var map = {}, key;
    for (key in FORMS) {
      if (!Object.prototype.hasOwnProperty.call(FORMS, key)) continue;
      if (!CYRILLIC.test(key)) continue;
      if (!map[FORMS[key]]) map[FORMS[key]] = titleCase(key);
    }
    for (key in ENG_REGIONS) {
      if (!Object.prototype.hasOwnProperty.call(ENG_REGIONS, key)) continue;
      if (ENG_REGIONS_NOM[key]) map[ENG_REGIONS[key]] = ENG_REGIONS_NOM[key];
    }
    return map;
  })();

  function regionToPrepositional(rawName) {
    var s = normalize(rawName);

    if (ENG_REGIONS[s]) return ENG_REGIONS[s];

    // «Республика Марий Эл» -> «в Республике Марий Эл» (titleCase, а не
    // capitalize: иначе второе слово останется строчным).
    var rep = s.match(/^республика\s+(.+)$/);
    if (rep) return 'в Республике ' + titleCase(rep[1]);

    // Прилагательные республики склоняются иначе: «Чувашская Республика»
    // -> «в Чувашской Республике», а не «в Республике Чувашская».
    rep = s.match(/^(.+(?:ская|цкая|ная|няя))\s+республика$/);
    if (rep) {
      var adjRep = titleCase(declineAdj(rep[1]));
      return prep(adjRep) + adjRep + ' Республике';
    }

    rep = s.match(/^(.+)\s+республика$/);
    if (rep) return 'в Республике ' + titleCase(rep[1]);

    var m = s.match(/^(.+?)\s+(край|область|автономный округ|автономная область)$/);
    if (!m) return null;

    var adj = m[1];
    var type = m[2];

    return buildRegion(adj, type);
  }

  // Склонение прилагательного в предложный падеж, по каждой части через дефис.
  function declineAdj(word) {
    return word.split('-').map(function (part) {
      if (/ский$|ный$|ний$|цкий$|ой$/.test(part)) {
        return part.replace(/(ский|цкий|ный|ний|ой)$/, function (x) {
          return { 'ский': 'ском', 'цкий': 'цком', 'ный': 'ном',
                   'ний': 'нем', 'ой': 'ом' }[x];
        });
      }
      if (/ская$|ная$|няя$|цкая$/.test(part)) {
        return part.replace(/(ская|цкая|ная|няя)$/, function (x) {
          return { 'ская': 'ской', 'цкая': 'цкой',
                   'ная': 'ной', 'няя': 'ней' }[x];
        });
      }
      return part;
    }).join('-');
  }

  var REGION_TAIL = {
    'край': ' крае',
    'область': ' области',
    'автономный округ': ' автономном округе',
    'автономная область': ' автономной области'
  };

  // «во Владимирской области», но «в Волгоградской»: предлог «во» ставится
  // перед в/ф, за которыми идёт согласная.
  function prep(word) {
    return /^[вф][^аеиоуыэюя]/i.test(word) ? 'во ' : 'в ';
  }

  function buildRegion(adj, type) {
    var tail = REGION_TAIL[type];
    if (!tail) return null;
    var declined = titleCase(declineAdj(adj));
    return prep(declined) + declined + tail;
  }

  function toPrepositional(rawName) {
    if (!rawName) return null;

    var key = normalize(rawName);

    // 1. Полное совпадение со словарём регионов — строго раньше городов,
    //    иначе «Tula Oblast» выродится в город Тулу.
    if (ENG_REGIONS[key]) return ENG_REGIONS[key];

    // 2. Словарь городов.
    if (FORMS[key]) return FORMS[key];

    var stripped = key.replace(/^(город|г|city of|gorod)\s+/, '');
    if (FORMS[stripped]) return FORMS[stripped];

    // 3. Правило склонения — для русских названий от sypexgeo.
    var region = regionToPrepositional(key);
    if (region) return region;

    // Последний фолбэк: отрезать английский суффикс и попробовать как город.
    var eng = key.replace(/\s+(oblast|krai|kray|region|okrug|republic)$/, '');
    if (eng !== key && FORMS[eng]) return FORMS[eng];

    return null;
  }

  // Возвращает пару форм: предложную для заголовка и именительную для подписи.
  function resolve(rawName) {
    var phrase = toPrepositional(rawName);
    if (!phrase) return null;

    var raw = String(rawName).trim();
    var readable;
    if (CYRILLIC.test(raw)) {
      // Провайдер уже отдал русское название. Если оно пришло целиком
      // в нижнем или верхнем регистре, берём форму из словаря, а для
      // регионов вне словаря поднимаем первую букву: под подписью
      // «Ваш регион» строчное «москва» выглядит ошибкой.
      var oddCase = (raw === raw.toLowerCase() || raw === raw.toUpperCase());
      readable = oddCase ? (NOMINATIVE[phrase] || capitalize(raw.toLowerCase())) : raw;
    } else {
      readable = NOMINATIVE[phrase] || phrase.replace(/^в[ео]?\s+/i, '');
    }

    return { phrase: phrase, readable: readable, push: true };
  }

  var PROVIDERS = [
    {
      url: 'https://ipwho.is/',
      timeout: TIMEOUT_FIRST,
      parse: function (d) {
        if (!d || d.success === false) return null;
        return { country: d.country_code, names: [d.city, d.region] };
      }
    },
    {
      url: 'https://ipapi.co/json/',
      timeout: TIMEOUT_NEXT,
      parse: function (d) {
        if (!d || d.error) return null;
        return { country: d.country_code, names: [d.city, d.region] };
      }
    },
    {
      url: 'https://api.sypexgeo.net/json/',
      timeout: TIMEOUT_NEXT,
      parse: function (d) {
        if (!d) return null;
        var city = d.city && (d.city.name_ru || d.city.name_en);
        var reg  = d.region && (d.region.name_ru || d.region.name_en);
        return { country: d.country && d.country.iso, names: [city, reg] };
      }
    }
  ];

  function pickForm(names) {
    for (var i = 0; i < names.length; i++) {
      var res = resolve(names[i]);
      if (res) return res;
    }
    return null;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.t || Date.now() - obj.t > CACHE_TTL) return null;
      return obj.v || null;
    } catch (e) { return null; }
  }

  function writeCache(value) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ v: value, t: Date.now() }));
    } catch (e) {}
  }

  function fromUrl(params) {
    var raw = params.get('city') || params.get('region') || params.get('geo');
    if (!raw) return null;
    raw = raw.trim();
    if (!raw) return null;

    if (/^в[ео]?\s/i.test(raw)) {
      return { phrase: raw, readable: NOMINATIVE[raw] || raw.replace(/^в[ео]?\s+/i, ''), push: true };
    }
    return resolve(raw);
  }

  function fetchJson(url, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve(null); }
      }, timeoutMs);
      fetch(url, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!done) { done = true; clearTimeout(timer); resolve(d); }
        })
        .catch(function () {
          if (!done) { done = true; clearTimeout(timer); resolve(null); }
        });
    });
  }

  function detectByIp() {
    var i = 0;
    function next() {
      if (i >= PROVIDERS.length) return Promise.resolve(null);
      var p = PROVIDERS[i++];
      return fetchJson(p.url, p.timeout || TIMEOUT_NEXT).then(function (data) {
        var info = null;
        try { info = p.parse(data); } catch (e) { info = null; }
        if (window.ARMA_GEO_DEBUG) {
          console.log('[geo]', p.url, info);
        }
        if (!info) return next();

        // Не Россия — универсальная формулировка, в URL не пишем:
        // компонент принимает только фразы на в/во/на.
        if (info.country && info.country !== 'RU') return FOREIGN;

        var form = pickForm(info.names || []);
        if (form) return form;
        return next();
      });
    }
    return next();
  }

  function paint(res) {
    var i;
    var main = document.querySelectorAll(SLOT_PHRASE);
    for (i = 0; i < main.length; i++) {
      if (main[i].textContent !== res.phrase) main[i].textContent = res.phrase;
      // Длинные названия вроде «в Петропавловске-Камчатском» на 360px.
      main[i].style.overflowWrap = 'break-word';
      main[i].style.hyphens = 'auto';
    }

    var label = document.querySelectorAll(SLOT_LABEL);
    for (i = 0; i < label.length; i++) {
      if (label[i].textContent !== res.readable) label[i].textContent = res.readable;
    }

    // Поле в заявку не уходит (компонент шлёт своё состояние), но если
    // оно когда-нибудь появится в разметке — заполним.
    var hidden = document.querySelectorAll('input[name="geo_region"]');
    for (i = 0; i < hidden.length; i++) {
      hidden[i].value = res.readable;
    }

    var title = 'Образовательная лицензия ' + res.phrase + ' под ключ | АРМА';
    if (document.title !== title) document.title = title;

    return main.length > 0 || label.length > 0;
  }

  // Регион уходит в CRM через параметры адреса: компонент читает их
  // в componentDidMount и кладёт в заявку рядом с utm-метками.
  function pushToUrl(res) {
    if (!res.push) return;
    if (!/^(в|во|на)\s/i.test(res.phrase)) return;
    try {
      var url = new URL(location.href);
      if (url.searchParams.get('geo_phrase')) return;
      url.searchParams.set('geo_phrase', res.phrase);
      url.searchParams.set('geo_region', res.readable);
      history.replaceState(null, '', url.toString());
    } catch (e) {}
  }

  function start(res) {
    pushToUrl(res);
    window.ARMA_GEO = res.phrase;          // предложная фраза, как в документации скрипта
    window.ARMA_GEO_REGION = res.readable; // именительный падеж — его ждёт CRM
    try {
      document.dispatchEvent(new CustomEvent('arma:geo', { detail: res }));
    } catch (e) {}

    var attempts = 0;
    paint(res);
    var poll = setInterval(function () {
      attempts += 1;
      paint(res);
      if (attempts > POLL_MAX) clearInterval(poll);
    }, POLL_MS);
  }

  function run() {
    var params = new URLSearchParams(location.search);

    // Фразу задала рекламная кампания — компонент подставит её сам.
    if ((params.get('geo_phrase') || '').trim()) return;

    var fromParam = fromUrl(params);
    if (fromParam) { writeCache(fromParam); start(fromParam); return; }

    var cached = readCache();
    if (cached && cached.phrase) { start(cached); return; }

    detectByIp().then(function (res) {
      if (!res) return;                 // остаётся штатное «в вашем регионе»
      writeCache(res);
      start(res);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
