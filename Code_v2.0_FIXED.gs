/**
 * ФИНКАБ-бот 2.0 — ЗАПИСЬ + ПРОСМОТР
 * База: v1.4 (выбор даты, возврат HtmlService — без 302).
 * Добавлено: раздел «📊 Показать» — остаток, ЗП, долги, цели, трекер темпа.
 *
 * ИСПРАВЛЕНИЕ (22.08.2026): добавлена проверка OWNER_ID.
 * До этой правки ЛЮБОЙ человек в Telegram, нашедший бота, мог
 * читать баланс/долги/цели и записывать операции от твоего имени —
 * нигде не проверялось, кто именно пишет боту.
 *
 * ИСПРАВЛЕНИЕ (22.08.2026): токен бота больше не хранится в коде открытым
 * текстом — читается из PropertiesService. См. ONE_TIME_setToken() ниже
 * для разовой настройки.
 *
 * ИСПРАВЛЕНИЕ (22.08.2026): категории теперь читаются из листа
 * «⚙ Категории» (тот же источник, что использует сайт), отдельно для
 * расходов (столбец A) и доходов (столбец B) — раньше был один общий
 * список, и для дохода можно было случайно выбрать «Продукты».
 *
 * ДОБАВЛЕНО (22.08.2026): «🔁 Повторить» (копирует тип/категорию/цель/
 * описание последней операции, спрашивает только сумму, дата — сегодня)
 * и «📝 Последние записи» (последние 10 операций журнала — правка суммы/
 * категории-цели/описания или удаление; дата записи не редактируется —
 * для неё нужно удалить и создать заново). Удаление требует подтверждения
 * («✅ Да, удалить»/«❌ Нет»), остальные правки применяются сразу.
 *
 * ДОБАВЛЕНО (22.08.2026): запись «Расхода» с категорией, совпадающей с
 * колонкой «Категория» в листе 🔁 Регулярные (например «Аренда»), теперь
 * сама ставит галочку «Оплачено» для этого платежа — отдельно ходить в
 * Регулярные и щёлкать чекбокс не нужно.
 *
 * ДОБАВЛЕНО (22.08.2026): сброс кеша журнала на сайте при правках мимо сайта
 * (см. bumpSiteCache_ и onEditBumpCache ниже) — требует ОДНОРАЗОВОЙ настройки:
 * 1) Script Properties → добавить CRON_SECRET (то же значение, что в Vercel).
 * 2) Запустить createCacheBumpTrigger() один раз из редактора (▶ Run).
 *
 * ДОБАВЛЕНО (22.08.2026, P3 #35): защита от двойной записи операции —
 * дедупликация по update_id Telegram (см. блок в начале doPost). Защищает
 * от повторной обработки одного и того же сообщения, если Telegram
 * переотправил его из-за таймаута/ошибки ответа.
 */

var TOKEN = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
var OWNER_ID = 657837899; // твой личный Chat ID — только этому пользователю бот отвечает
var SHEET_JOURNAL = '💰 Журнал операций';
var SHEET_SHIFTS  = '📅 Смены';
var SHEET_CATEGORIES = '⚙ Категории';
var DEFAULT_EXPENSE_CATEGORIES = ['Продукты','Транспорт','Кафе и рестораны','Связь','Развлечения','Подписки','Здоровье','Покупки','Вредные привычки','Подарки','Прочее'];
var DEFAULT_INCOME_CATEGORIES  = ['Зарплата','Фриланс','Подработка','Кешбэк','Прочее'];

/**
 * ОДНОРАЗОВАЯ НАСТРОЙКА ТОКЕНА:
 * 1) Впиши токен вместо '...' ниже.
 * 2) В редакторе Apps Script выбери эту функцию в выпадающем списке сверху и нажми ▶ Run — один раз.
 * 3) Сотри токен отсюда (замени на '') и сохрани — он уже лежит в Script Properties, здесь больше не нужен.
 */
function ONE_TIME_setToken(){
  PropertiesService.getScriptProperties().setProperty('BOT_TOKEN', '');
}

function tgApi(method, payload){
return UrlFetchApp.fetch('https://api.telegram.org/bot'+TOKEN+'/'+method, {
method:'post', contentType:'application/json',
payload:JSON.stringify(payload), muteHttpExceptions:true
  });
}
function sendMessage(chatId, text, keyboard){
var p = { chat_id:chatId, text:text, parse_mode:'HTML' };
if (keyboard) p.reply_markup = JSON.stringify(keyboard);
tgApi('sendMessage', p);
}

// ====== КЛАВИАТУРЫ ======
function mainMenu(){ return {keyboard:[
  [{text:'🛒 Расход'},{text:'💵 Доход'}],
  [{text:'🏦 В накопления'},{text:'↩️ Из накоплений'}],
  [{text:'💳 Платёж по долгу'},{text:'📅 Смена'}],
  [{text:'⚖️ Корректировка'}],
  [{text:'🔁 Повторить'},{text:'📝 Последние записи'}],
  [{text:'📊 Показать'}],
  [{text:'❌ Отмена'}]], resize_keyboard:true }; }
function viewMenu(){ return {keyboard:[
  [{text:'💰 Остаток'},{text:'📊 Зарплата'}],
  [{text:'💳 Долги'},{text:'🎯 Цели'}],
  [{text:'🎯 Темп месяца'}],
  [{text:'⬅️ Назад'}]], resize_keyboard:true }; }
function dateMenu(){ return {keyboard:[
  [{text:'📅 Сегодня'},{text:'📅 Вчера'}],
  [{text:'✏️ Другая дата'}],
  [{text:'❌ Отмена'}]], resize_keyboard:true }; }
function catMenu(list){ var rows=[]; for(var i=0;i<list.length;i+=2){var r=[{text:list[i]}];if(list[i+1])r.push({text:list[i+1]});rows.push(r);} rows.push([{text:'❌ Отмена'}]); return {keyboard:rows,resize_keyboard:true}; }
function listMenu(items){ var rows=items.filter(String).map(function(x){return [{text:x}];}); rows.push([{text:'❌ Отмена'}]); return {keyboard:rows,resize_keyboard:true}; }
function skipMenu(){ return {keyboard:[[{text:'⏭ Пропустить'}],[{text:'❌ Отмена'}]],resize_keyboard:true}; }

// ====== ПОВТОР / РЕДАКТИРОВАНИЕ / УДАЛЕНИЕ ЗАПИСЕЙ — ДОБАВЛЕНО 22.08.2026 ======
function browseLabel(it,i){
var d=new Date(it.date);
var s=(i+1)+') '+fmtDate(d)+' · '+it.type+' · '+fmtMoney(it.amount)+'₽';
if(it.category) s+=' · '+it.category; else if(it.dest) s+=' · '+it.dest;
return s;
}
function browseListMenu(items){
var rows=items.map(function(it,i){ return [{text:browseLabel(it,i)}]; });
rows.push([{text:'⬅️ Назад'}]);
return {keyboard:rows,resize_keyboard:true};
}
function browseDetail(it){
var d=new Date(it.date);
var s='📆 '+fmtDate(d)+'\n<b>'+it.type+'</b> · '+fmtMoney(it.amount)+' ₽';
if(it.category) s+='\nКатегория: '+it.category;
if(it.dest) s+='\n→ '+it.dest;
if(it.desc) s+='\nОписание: '+it.desc;
return s;
}
function browseActionMenu(it){
// «Корректировка баланса» (P0 #45) не имеет категории/цели — кнопку правки не показываем.
if(it.type==='Корректировка баланса'){
return {keyboard:[
  [{text:'✏️ Сумма'}],
  [{text:'✏️ Описание'}],
  [{text:'🗑 Удалить'}],
  [{text:'⬅️ Назад'}]
],resize_keyboard:true};
  }
var catLabel=(it.type==='Расход'||it.type==='Доход')?'✏️ Категория':'✏️ Цель/Долг';
return {keyboard:[
  [{text:'✏️ Сумма'}],
  [{text:catLabel}],
  [{text:'✏️ Описание'}],
  [{text:'🗑 Удалить'}],
  [{text:'⬅️ Назад'}]
],resize_keyboard:true};
}

function props(){ return PropertiesService.getScriptProperties(); }
function getState(chatId){ var r=props().getProperty('ST_'+chatId); return r?JSON.parse(r):null; }
function setState(chatId,o){ props().setProperty('ST_'+chatId, JSON.stringify(o)); }
function clearState(chatId){ props().deleteProperty('ST_'+chatId); }

// Последние N операций журнала (для 🔁 Повторить и 📝 Последние записи).
// Сканирует снизу вверх и пропускает пустые строки — так список остаётся
// верным, даже если внутри журнала есть "дыры" от ранее удалённых записей.
function getRecentOperations(n){
var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_JOURNAL);
var lastRow=sh.getLastRow();
if(lastRow<5) return [];
var data=sh.getRange(5,2,lastRow-5+1,6).getValues(); // B:G
var items=[];
for(var i=data.length-1;i>=0 && items.length<n;i--){
if(data[i][0]){
items.push({row:5+i,date:data[i][0],type:data[i][1],amount:data[i][2],category:data[i][3],dest:data[i][4],desc:data[i][5]});
    }
  }
return items;
}
// Если категория записанного «Расхода» совпадает с колонкой «Категория» (E)
// какой-то строки в 🔁 Регулярные — автоматически ставим галочку «Оплачено» (F)
// для первой НЕоплаченной строки с таким же названием (без учёта регистра).
// Экономит отдельный поход в лист Регулярные ради одного чекбокса.
function markRegularPaidByCategory_(category){
if(!category) return;
var cat=String(category).trim().toLowerCase();
if(!cat) return;
var sh=SpreadsheetApp.getActive().getSheetByName('🔁 Регулярные');
if(!sh) return;
var data=sh.getRange('B6:F20').getValues();
for(var i=0;i<data.length;i++){
var rowCat=String(data[i][3]||'').trim().toLowerCase();
var paid=data[i][4]===true;
if(rowCat && rowCat===cat && !paid){ sh.getRange(6+i,6).setValue(true); return; }
  }
}
// ====== СБРОС КЕША ЖУРНАЛА НА САЙТЕ — ДОБАВЛЕНО 22.08.2026 (P3 #33) ======
// Кеш журнала на сайте (lib/useJournal.ts) живёт в браузере 60 сек. Если
// таблицу правят мимо сайта — вручную или через этого бота — сайт узнаёт
// об этом не сразу. Эта функция "бампает" версию журнала на сайте через
// /api/cache/version (POST), защищённый CRON_SECRET — так же, как cron-роуты.
//
// ВАЖНО: onEdit-триггер (см. onEditBumpCache ниже) НЕ срабатывает на правки,
// сделанные самим Apps Script (документированное ограничение Google — иначе
// был бы риск бесконечного цикла триггеров). Поэтому запись операций ботом
// не ловится через onEdit — здесь мы дёргаем bumpSiteCache_() явно, сразу
// после каждой записи в Журнал.
//
// ОДНОРАЗОВАЯ НАСТРОЙКА: Project Settings (⚙️ слева) → Script Properties →
// добавить свойство CRON_SECRET со значением, которое уже прописано в
// переменных окружения Vercel (Settings → Environment Variables → CRON_SECRET).
var CACHE_BUMP_URL = 'https://fincab.vercel.app/api/cache/version';

function bumpSiteCache_(){
try{
var secret=props().getProperty('CRON_SECRET');
if(!secret) return; // не настроено — тихо выходим, ничего не ломаем
UrlFetchApp.fetch(CACHE_BUMP_URL,{
method:'post',
headers:{'Authorization':'Bearer '+secret},
muteHttpExceptions:true
    });
  }catch(err){ /* сброс кеша не критичен — не мешаем остальной работе бота */ }
}

// Устанавливает onEdit-триггер — ловит РУЧНЫЕ правки таблицы (когда ты сам
// что-то поправил прямо в Google Таблице, как мы делали весь этот сеанс).
// Запусти этот метод ОДИН РАЗ из редактора Apps Script (выбрать в списке
// функций сверху → ▶ Run).
function createCacheBumpTrigger(){
ScriptApp.getProjectTriggers().forEach(function(t){
if(t.getHandlerFunction()==='onEditBumpCache') ScriptApp.deleteTrigger(t);
  });
ScriptApp.newTrigger('onEditBumpCache')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
Logger.log('Триггер onEdit для сброса кеша сайта установлен');
}
function onEditBumpCache(e){
bumpSiteCache_();
}

function getGoals(){ return SpreadsheetApp.getActive().getSheetByName('🎯 Цели').getRange('B6:B25').getValues().map(function(r){return r[0];}).filter(String); }
function getDebts(){ return SpreadsheetApp.getActive().getSheetByName('💳 Долги').getRange('B6:B25').getValues().map(function(r){return r[0];}).filter(String); }
function getExpenseCategories(){
var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_CATEGORIES);
if(!sh) return DEFAULT_EXPENSE_CATEGORIES;
var vals=sh.getRange('A1:A100').getValues().map(function(r){return r[0];}).filter(String);
return vals.length?vals:DEFAULT_EXPENSE_CATEGORIES;
}
function getIncomeCategories(){
var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_CATEGORIES);
if(!sh) return DEFAULT_INCOME_CATEGORIES;
var vals=sh.getRange('B1:B100').getValues().map(function(r){return r[0];}).filter(String);
return vals.length?vals:DEFAULT_INCOME_CATEGORIES;
}

function appendOperation(date,type,amount,category,dest,desc){
var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_JOURNAL);
var col=sh.getRange('B5:B5000').getValues(); var row=5;
for(var i=0;i<col.length;i++){ if(!col[i][0]){ row=5+i; break; } }
sh.getRange(row,2,1,6).setValues([[date,type,amount,category||'',dest||'',desc||'']]);
// ИСПРАВЛЕНИЕ (22.08.2026): Месяц/Год (H:I) — те же формулы, что и в остальных
// строках журнала. Без них эта операция невидима для Аналитики, Финансового
// рейтинга, Подушки и Прогноза до зарплаты — все они фильтруют журнал по H:I.
sh.getRange(row,8,1,2).setFormulas([[
  '=IF(B'+row+'="","",MONTH(B'+row+'))',
  '=IF(B'+row+'="","",YEAR(B'+row+'))'
]]);
}
function appendShift(date,iphone,android,acc,tech,serv){
var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_SHIFTS);
var col=sh.getRange('B5:B1500').getValues(); var row=5;
for(var i=0;i<col.length;i++){ if(!col[i][0]){ row=5+i; break; } }
// ИЗМЕНЕНО (P1 #75): «Телефоны» разделены на iPhone/Android — легаси-колонка C
// (общее число, использовалась для старых смен) для новых записей больше не
// заполняется (пишем 0), реальные данные — в J (iPhone) и K (Android).
sh.getRange(row,2,1,5).setValues([[date,0,acc,tech,serv]]);
sh.getRange(row,10,1,2).setValues([[iphone,android]]); // J:K
// ИСПРАВЛЕНИЕ (22.08.2026): ЗП за смену (G) + Месяц/Год (H:I) — те же формулы,
// что и в остальных строках. Без G смена не считается "заполненной" в счётчике
// Расчёт ЗП!E19 (там условие G<>""). Без H:I смена не попадает в помесячный
// расчёт зарплаты вообще. G теперь также учитывает J/K по базовой ставке —
// это только грубая оценка «на глаз», реальный тир считается в Расчёте ЗП.
sh.getRange(row,7,1,3).setFormulas([[
  '=N(C'+row+')*Ст_ТелБез+N(J'+row+')*Ст_ТелБез+N(K'+row+')*Ст_ТелБез+N(D'+row+')*Ст_АксМин+N(E'+row+')*Ст_ТехМин+N(F'+row+')*Ст_Услуги',
  '=IF(B'+row+'="","",MONTH(B'+row+'))',
  '=IF(B'+row+'="","",YEAR(B'+row+'))'
]]);
}

function done_(){ return HtmlService.createHtmlOutput(''); }

function resolveDate(text){
if(text==='📅 Сегодня') return new Date();
if(text==='📅 Вчера'){ var d=new Date(); d.setDate(d.getDate()-1); return d; }
var m=text.replace(/\//g,'.').match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
if(!m) return null;
var day=parseInt(m[1],10), mon=parseInt(m[2],10), yr=parseInt(m[3],10);
if(yr<100) yr+=2000;
if(day<1||day>31||mon<1||mon>12) return null;
var d=new Date(yr,mon-1,day);
if(d.getDate()!==day||d.getMonth()!==mon-1) return null;
return d;
}
function fmtDate(d){ return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear(); }
function fmtMoney(n){ if(n===''||n===null||isNaN(n)) return '0'; return Math.round(n).toLocaleString('ru-RU'); }

// ====== ПРОСМОТР ДАННЫХ ======
function viewBalance(){
var d=SpreadsheetApp.getActive().getSheetByName('🏠 Дашборд');
var bal=d.getRange('B4').getValue();
var sal=d.getRange('E4').getValue();
return '💰 <b>Остаток на счёте:</b> '+fmtMoney(bal)+' ₽\n📊 Зарплата (расчёт): '+fmtMoney(sal)+' ₽';
}
function viewSalary(){
var d=SpreadsheetApp.getActive().getSheetByName('🏠 Дашборд');
var sal=d.getRange('E4').getValue();
var mon=d.getRange('C2').getValue();
var names=['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
return '📊 <b>Зарплата за '+names[mon]+':</b>\n'+fmtMoney(sal)+' ₽';
}
function viewDebts(){
var sh=SpreadsheetApp.getActive().getSheetByName('💳 Долги');
var data=sh.getRange('B6:E25').getValues();
var total=sh.getRange('C2').getValue();
var lines=['💳 <b>Долги — остаток:</b>'];
for(var i=0;i<data.length;i++){
if(data[i][0] && data[i][3]>0){ lines.push('• '+data[i][0]+': '+fmtMoney(data[i][3])+' ₽'); }
  }
lines.push('\n<b>Всего:</b> '+fmtMoney(total)+' ₽');
return lines.join('\n');
}
function viewGoals(){
var sh=SpreadsheetApp.getActive().getSheetByName('🎯 Цели');
var data=sh.getRange('B6:F25').getValues();
var lines=['🎯 <b>Цели — прогресс:</b>'];
for(var i=0;i<data.length;i++){
if(data[i][0]){
var pct=Math.round((data[i][4]||0)*100);
lines.push('• '+data[i][0]+': '+fmtMoney(data[i][1])+' ₽ ('+pct+'%)');
    }
  }
return lines.join('\n');
}
function viewPace(){
var sh=SpreadsheetApp.getActive().getSheetByName('📊 Расчёт ЗП');
var hdr=sh.getRange('B87:G87').getValues()[0]; // смен в графике/отработано/осталось
var rows=sh.getRange('B89:H97').getValues();
// Колонки: [0]Показатель [1]Уровень [2]План [3]Факт [4]Осталось [5]Нужно/смену [6]Статус
var lines=['🎯 <b>Темп месяца</b>'];
lines.push('Смен: '+hdr[1]+' в графике · '+hdr[3]+' отработано · '+hdr[5]+' осталось');
for(var i=0;i<rows.length;i++){
var pok=rows[i][0], lvl=rows[i][1], fact=rows[i][3], need=rows[i][5], st=rows[i][6];
if(!lvl) continue;
if(pok){ lines.push(''); lines.push('<b>'+pok+'</b>'); }
lines.push('  '+lvl+': '+st+' (фактически '+fmtMoney(fact)+', нужно/смену '+fmtMoney(need)+')');
  }
return lines.join('\n');
}

function doPost(e){
try{
var update=JSON.parse(e.postData.contents);

// ══════════════════════════════════════════════════════════════
// ЗАЩИТА ОТ ДВОЙНОЙ ЗАПИСИ — ДОБАВЛЕНО 22.08.2026 (P3 #35)
// Telegram присылает уникальный update_id на каждое сообщение и
// повторяет доставку того же update_id, если наш ответ завис или
// пришёл с ошибкой/таймаутом. Без этой проверки такой повтор
// обрабатывается как новое сообщение — и мы задваиваем операцию
// в журнале. Кладём update_id в CacheService на 5 минут (этого с
// запасом хватает на любой реалистичный ретрай); если он там уже
// есть — тихо выходим, ничего не обрабатывая повторно.
// ══════════════════════════════════════════════════════════════
if(update.update_id!==undefined){
var cache=CacheService.getScriptCache();
var dupKey='upd_'+update.update_id;
if(cache.get(dupKey)) return done_();
cache.put(dupKey,'1',300);
}

if(!update.message) return done_();
var msg=update.message, chatId=msg.chat.id, text=(msg.text||'').trim();

// ══════════════════════════════════════════════════════════════
// ПРОВЕРКА ВЛАДЕЛЬЦА — ДОБАВЛЕНО 22.08.2026
// Без этой проверки бот отвечал ЛЮБОМУ пользователю Telegram.
// ══════════════════════════════════════════════════════════════
if (chatId != OWNER_ID) {
  sendMessage(chatId, '⛔ Это приватный бот.');
  return done_();
}

if(text==='❌ Отмена'||text==='/cancel'||text==='⬅️ Назад'){ clearState(chatId); sendMessage(chatId,'Главное меню:',mainMenu()); return done_(); }
if(text==='/start'){ clearState(chatId); sendMessage(chatId,'👋 <b>ФИНКАБ-бот</b>\nВыберите действие:',mainMenu()); return done_(); }

var st=getState(chatId);

// ===== РАЗДЕЛ ПРОСМОТРА =====
if(text==='📊 Показать'){ clearState(chatId); sendMessage(chatId,'Что показать?',viewMenu()); return done_(); }
if(text==='💰 Остаток'){ sendMessage(chatId,viewBalance(),viewMenu()); return done_(); }
if(text==='📊 Зарплата'){ sendMessage(chatId,viewSalary(),viewMenu()); return done_(); }
if(text==='💳 Долги'){ sendMessage(chatId,viewDebts(),viewMenu()); return done_(); }
if(text==='🎯 Цели'){ sendMessage(chatId,viewGoals(),viewMenu()); return done_(); }
if(text==='🎯 Темп месяца'){ sendMessage(chatId,viewPace(),viewMenu()); return done_(); }

if(!st){
if(text==='🛒 Расход'){ setState(chatId,{flow:'op',type:'Расход',step:'date'}); sendMessage(chatId,'📆 За какую дату?',dateMenu()); }
else if(text==='💵 Доход'){ setState(chatId,{flow:'op',type:'Доход',step:'date'}); sendMessage(chatId,'📆 За какую дату?',dateMenu()); }
else if(text==='🏦 В накопления'){ setState(chatId,{flow:'op',type:'В накопления',step:'date'}); sendMessage(chatId,'📆 За какую дату?',dateMenu()); }
else if(text==='↩️ Из накоплений'){ setState(chatId,{flow:'op',type:'Из накоплений',step:'date'}); sendMessage(chatId,'📆 За какую дату?',dateMenu()); }
else if(text==='💳 Платёж по долгу'){ setState(chatId,{flow:'op',type:'Платёж по долгу',step:'date'}); sendMessage(chatId,'📆 За какую дату?',dateMenu()); }
else if(text==='⚖️ Корректировка'){ setState(chatId,{flow:'op',type:'Корректировка баланса',step:'date'}); sendMessage(chatId,'📆 За какую дату?',dateMenu()); }
else if(text==='📅 Смена'){ setState(chatId,{flow:'shift',step:'date'}); sendMessage(chatId,'📆 За какую дату смена?',dateMenu()); }
else if(text==='🔁 Повторить'){
var last=getRecentOperations(1)[0];
if(!last){ sendMessage(chatId,'Нет предыдущих операций для повтора.',mainMenu()); }
else {
setState(chatId,{flow:'repeat',step:'amount',type:last.type,category:last.category,dest:last.dest,desc:last.desc});
var rline='🔁 Повторяю: <b>'+last.type+'</b>';
if(last.category) rline+=' · '+last.category;
if(last.dest) rline+=' → '+last.dest;
rline+='\n📆 Дата: сегодня\n💰 Введите сумму (₽):';
sendMessage(chatId,rline,{remove_keyboard:true});
      }
    }
else if(text==='📝 Последние записи'){
var items=getRecentOperations(10);
if(!items.length){ sendMessage(chatId,'Записей пока нет.',mainMenu()); }
else { setState(chatId,{flow:'browse',step:'pick',items:items}); sendMessage(chatId,'📝 Последние записи — выберите:',browseListMenu(items)); }
    }
else { sendMessage(chatId,'Выберите действие из меню:',mainMenu()); }
return done_();
    }

if(st.step==='date'){
if(text==='✏️ Другая дата'){ st.step='date_input'; setState(chatId,st); sendMessage(chatId,'Введите дату ДД.ММ.ГГГГ (например 01.06.2026):',{remove_keyboard:true}); return done_(); }
var d=resolveDate(text);
if(!d){ sendMessage(chatId,'Выберите дату кнопкой или «Другая дата»:',dateMenu()); return done_(); }
st.date=d.getTime();
if(st.flow==='op'){
if(st.type==='Расход'||st.type==='Доход'){ st.step='cat'; setState(chatId,st); sendMessage(chatId,'Выберите категорию:',catMenu(st.type==='Доход'?getIncomeCategories():getExpenseCategories())); }
else if(st.type==='Из накоплений'||st.type==='В накопления'){ st.step='dest'; setState(chatId,st); sendMessage(chatId,'Выберите цель:',listMenu(getGoals())); }
else if(st.type==='Платёж по долгу'){ st.step='dest'; setState(chatId,st); sendMessage(chatId,'Выберите долг:',listMenu(getDebts())); }
// ДОБАВЛЕНО (P0 #45): у «Корректировки баланса» нет категории/цели — сразу к сумме.
else if(st.type==='Корректировка баланса'){ st.step='amount'; setState(chatId,st); sendMessage(chatId,'💰 На сколько скорректировать баланс? Введите сумму (₽); если баланс нужно уменьшить — со знаком «-»:',{remove_keyboard:true}); }
      } else if(st.flow==='shift'){ st.step='iphone'; setState(chatId,st); sendMessage(chatId,'🍏 Сколько iPhone? (число)',skipMenu()); }
return done_();
    }
if(st.step==='date_input'){
var d2=resolveDate(text);
if(!d2){ sendMessage(chatId,'⚠️ Неверная дата. ДД.ММ.ГГГГ, например 01.06.2026:'); return done_(); }
st.date=d2.getTime();
if(st.flow==='op'){
if(st.type==='Расход'||st.type==='Доход'){ st.step='cat'; setState(chatId,st); sendMessage(chatId,'✅ '+fmtDate(d2)+'\nКатегория:',catMenu(st.type==='Доход'?getIncomeCategories():getExpenseCategories())); }
else if(st.type==='Из накоплений'||st.type==='В накопления'){ st.step='dest'; setState(chatId,st); sendMessage(chatId,'✅ '+fmtDate(d2)+'\nЦель:',listMenu(getGoals())); }
else if(st.type==='Платёж по долгу'){ st.step='dest'; setState(chatId,st); sendMessage(chatId,'✅ '+fmtDate(d2)+'\nДолг:',listMenu(getDebts())); }
else if(st.type==='Корректировка баланса'){ st.step='amount'; setState(chatId,st); sendMessage(chatId,'✅ '+fmtDate(d2)+'\n💰 На сколько скорректировать баланс? Сумма (₽), «-» если нужно уменьшить:',{remove_keyboard:true}); }
      } else if(st.flow==='shift'){ st.step='iphone'; setState(chatId,st); sendMessage(chatId,'✅ '+fmtDate(d2)+'\n🍏 Сколько iPhone?',skipMenu()); }
return done_();
    }

if(st.flow==='op'){
if(st.step==='cat'){ st.category=text; st.step='amount'; setState(chatId,st); sendMessage(chatId,'💰 Введите сумму (₽):',{remove_keyboard:true}); return done_(); }
if(st.step==='dest'){ st.dest=text; st.step='amount'; setState(chatId,st); sendMessage(chatId,'💰 Введите сумму (₽):',{remove_keyboard:true}); return done_(); }
if(st.step==='amount'){
var amt=parseFloat(text.replace(',','.').replace(/\s/g,''));
// ДОБАВЛЕНО (P0 #45): «Корректировка баланса» — единственный тип, где сумма
// может быть отрицательной (баланс подгоняется и вверх, и вниз).
var isAdj=(st.type==='Корректировка баланса');
if(isNaN(amt)||amt===0||(!isAdj&&amt<=0)){ sendMessage(chatId, isAdj?'⚠️ Введите число, не равное 0 (со знаком «-», если баланс нужно уменьшить)':'⚠️ Введите положительное число'); return done_(); }
st.amount=amt; st.step='desc'; setState(chatId,st); sendMessage(chatId,'📝 Описание (или «Пропустить»):',skipMenu()); return done_();
      }
if(st.step==='desc'){
var desc=(text==='⏭ Пропустить')?'':text;
var dd=st.date?new Date(st.date):new Date();
// «Корректировка баланса» — без категории (не 'Прочее' по умолчанию, как у остальных).
appendOperation(dd,st.type,st.amount,st.type==='Корректировка баланса'?'':(st.category||'Прочее'),st.dest||'',desc);
if(st.type==='Расход') markRegularPaidByCategory_(st.category);
bumpSiteCache_();
var line='✅ Записано:\n<b>'+st.type+'</b> · '+st.amount+' ₽\n📆 '+fmtDate(dd);
if(st.category) line+='\nКатегория: '+st.category;
if(st.dest) line+='\n→ '+st.dest;
clearState(chatId); sendMessage(chatId,line,mainMenu()); return done_();
      }
    }

if(st.flow==='shift'){
var num=(text==='⏭ Пропустить')?0:parseFloat(text.replace(',','.').replace(/\s/g,''));
if(text!=='⏭ Пропустить'&&isNaN(num)){ sendMessage(chatId,'⚠️ Введите число (или «Пропустить»)'); return done_(); }
// ИЗМЕНЕНО (P1 #75): «Телефоны» разделены на iPhone/Android — два отдельных шага вместо одного.
if(st.step==='iphone'){ st.iphone=num; st.step='android'; setState(chatId,st); sendMessage(chatId,'🤖 Сколько Android?',skipMenu()); }
else if(st.step==='android'){ st.android=num; st.step='acc'; setState(chatId,st); sendMessage(chatId,'🎧 Аксессуары (₽)?',skipMenu()); }
else if(st.step==='acc'){ st.acc=num; st.step='tech'; setState(chatId,st); sendMessage(chatId,'💻 Техника ВП (₽)?',skipMenu()); }
else if(st.step==='tech'){ st.tech=num; st.step='serv'; setState(chatId,st); sendMessage(chatId,'🛠 Услуги (₽)?',skipMenu()); }
else if(st.step==='serv'){ st.serv=num;
var ds=st.date?new Date(st.date):new Date();
appendShift(ds,st.iphone||0,st.android||0,st.acc||0,st.tech||0,st.serv||0); clearState(chatId);
sendMessage(chatId,'✅ Смена записана ('+fmtDate(ds)+'):\n🍏 '+(st.iphone||0)+' · 🤖 '+(st.android||0)+' · 🎧 '+(st.acc||0)+' · 💻 '+(st.tech||0)+' · 🛠 '+(st.serv||0),mainMenu()); }
return done_();
    }

// ===== 🔁 ПОВТОРИТЬ ПОСЛЕДНЮЮ ОПЕРАЦИЮ =====
if(st.flow==='repeat'){
if(st.step==='amount'){
var ramt=parseFloat(text.replace(',','.').replace(/\s/g,''));
var isAdjR=(st.type==='Корректировка баланса');
if(isNaN(ramt)||ramt===0||(!isAdjR&&ramt<=0)){ sendMessage(chatId, isAdjR?'⚠️ Введите число, не равное 0':'⚠️ Введите положительное число'); return done_(); }
var rtoday=new Date();
appendOperation(rtoday,st.type,ramt,st.category||'',st.dest||'',st.desc||'');
if(st.type==='Расход') markRegularPaidByCategory_(st.category);
bumpSiteCache_();
var rline2='✅ Записано (повтор):\n<b>'+st.type+'</b> · '+ramt+' ₽\n📆 '+fmtDate(rtoday);
if(st.category) rline2+='\nКатегория: '+st.category;
if(st.dest) rline2+='\n→ '+st.dest;
clearState(chatId); sendMessage(chatId,rline2,mainMenu()); return done_();
      }
    }

// ===== 📝 ПОСЛЕДНИЕ ЗАПИСИ: ПРОСМОТР / РЕДАКТИРОВАНИЕ / УДАЛЕНИЕ =====
if(st.flow==='browse'){
if(st.step==='pick'){
var pm=text.match(/^(\d+)\)/);
var pidx=pm?parseInt(pm[1],10)-1:-1;
var pitem=(pidx>=0 && st.items[pidx])?st.items[pidx]:null;
if(!pitem){ sendMessage(chatId,'Выберите запись из списка:',browseListMenu(st.items)); return done_(); }
st.selected=pitem; st.step='action'; setState(chatId,st);
sendMessage(chatId,browseDetail(pitem)+'\n\nЧто сделать?',browseActionMenu(pitem));
return done_();
      }
if(st.step==='action'){
var sel=st.selected;
if(text==='✏️ Сумма'){ st.step='edit_amount'; setState(chatId,st); sendMessage(chatId,'💰 Введите новую сумму (₽):',{remove_keyboard:true}); return done_(); }
if(text==='✏️ Категория'||text==='✏️ Цель/Долг'){
var isCat=(sel.type==='Расход'||sel.type==='Доход');
var elist=isCat?(sel.type==='Доход'?getIncomeCategories():getExpenseCategories()):(sel.type==='Платёж по долгу'?getDebts():getGoals());
st.step='edit_catdest'; setState(chatId,st);
sendMessage(chatId,isCat?'Выберите новую категорию:':'Выберите новую цель/долг:',isCat?catMenu(elist):listMenu(elist));
return done_();
        }
if(text==='✏️ Описание'){ st.step='edit_desc'; setState(chatId,st); sendMessage(chatId,'📝 Новое описание (или «Пропустить», чтобы очистить):',skipMenu()); return done_(); }
if(text==='🗑 Удалить'){
st.step='confirm_delete'; setState(chatId,st);
sendMessage(chatId,'⚠️ Удалить запись:\n'+browseDetail(sel)+'\n\nЭто нельзя отменить.',{keyboard:[[{text:'✅ Да, удалить'}],[{text:'❌ Нет'}]],resize_keyboard:true});
return done_();
        }
sendMessage(chatId,'Выберите действие:',browseActionMenu(sel)); return done_();
      }
if(st.step==='edit_amount'){
var newAmt=parseFloat(text.replace(',','.').replace(/\s/g,''));
if(isNaN(newAmt)||newAmt<=0){ sendMessage(chatId,'⚠️ Введите положительное число'); return done_(); }
SpreadsheetApp.getActive().getSheetByName(SHEET_JOURNAL).getRange(st.selected.row,4).setValue(newAmt);
bumpSiteCache_();
var amsg='✅ Сумма обновлена: '+fmtMoney(st.selected.amount)+' → '+fmtMoney(newAmt)+' ₽';
clearState(chatId); sendMessage(chatId,amsg,mainMenu()); return done_();
      }
if(st.step==='edit_catdest'){
var isCat2=(st.selected.type==='Расход'||st.selected.type==='Доход');
SpreadsheetApp.getActive().getSheetByName(SHEET_JOURNAL).getRange(st.selected.row,isCat2?5:6).setValue(text);
bumpSiteCache_();
clearState(chatId); sendMessage(chatId,'✅ Обновлено: '+text,mainMenu()); return done_();
      }
if(st.step==='edit_desc'){
var newDesc=(text==='⏭ Пропустить')?'':text;
SpreadsheetApp.getActive().getSheetByName(SHEET_JOURNAL).getRange(st.selected.row,7).setValue(newDesc);
bumpSiteCache_();
clearState(chatId); sendMessage(chatId,'✅ Описание обновлено'+(newDesc?': '+newDesc:' (очищено)'),mainMenu()); return done_();
      }
if(st.step==='confirm_delete'){
if(text==='✅ Да, удалить'){
SpreadsheetApp.getActive().getSheetByName(SHEET_JOURNAL).getRange(st.selected.row,2,1,8).clearContent();
bumpSiteCache_();
clearState(chatId); sendMessage(chatId,'🗑 Запись удалена.',mainMenu()); return done_();
        }
st.step='action'; setState(chatId,st);
sendMessage(chatId,browseDetail(st.selected)+'\n\nЧто сделать?',browseActionMenu(st.selected));
return done_();
      }
    }
return done_();
  }catch(err){ return done_(); }
}

function setWebhook(){
var url='https://script.google.com/macros/s/AKfycbyCrWOavQdzYZsTmqDki58SsNmFG5Ip3qktsF33lDSaBgmtrSUa_26JUfCV0pqf0iJ1eQ/exec';
Logger.log(tgApi('setWebhook',{url:url, drop_pending_updates:true}).getContentText());
}
function deleteWebhook(){ Logger.log(tgApi('deleteWebhook',{}).getContentText()); }

// ====== АВТОБЭКАП ======
function backupSpreadsheet() {
var ss = SpreadsheetApp.getActiveSpreadsheet();
// ИСПРАВЛЕНИЕ (22.08.2026): имя файла форматировалось в Europe/Moscow (UTC+3),
// хотя часовой пояс проекта — Asia/Dubai (UTC+4, совпадает с Самарой). Берём
// пояс проекта динамически, чтобы время в имени файла всегда совпадало с тем,
// когда бэкап реально создался.
var fileName = 'ФИНКАБ Backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
var folders = DriveApp.getFoldersByName('FinCab Backups');
var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('FinCab Backups');
DriveApp.getFileById(ss.getId()).makeCopy(fileName, folder);

// Удалить старые — оставить только 8 последних
var files = folder.getFiles();
var all = [];
while (files.hasNext()) all.push(files.next());
all.sort(function(a, b) { return b.getDateCreated() - a.getDateCreated(); });
for (var i = 8; i < all.length; i++) all[i].setTrashed(true);

Logger.log('Бэкап создан: ' + fileName);
}

function createBackupTrigger() {
// Удалить старые триггеры backupSpreadsheet (чтобы не дублировались)
ScriptApp.getProjectTriggers().forEach(function(t) {
if (t.getHandlerFunction() === 'backupSpreadsheet') ScriptApp.deleteTrigger(t);
  });
// ИСПРАВЛЕНИЕ (22.08.2026): раньше здесь стояло .atHour(19) в расчёте на то,
// что часовой пояс проекта — UTC (19:00 UTC = 22:00 МСК). На самом деле пояс
// проекта — Asia/Dubai (UTC+4, совпадает с Самарой), и atHour() считает время
// именно в этом поясе. Из-за этого бэкап реально срабатывал в 19:00 по Самаре,
// а не в 22:00, как предполагалось. Теперь напрямую 22 — без пересчёта в UTC,
// потому что пояс проекта уже самарский.
ScriptApp.newTrigger('backupSpreadsheet')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(22)
    .create();
Logger.log('Триггер установлен: каждую пятницу в 22:00 по Самаре');
}
