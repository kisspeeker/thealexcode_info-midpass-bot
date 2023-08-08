import { resolve } from 'path';
import { declOfNum } from './utils.js';
import dotenv from 'dotenv-flow';
dotenv.config();

export const DEBUG = false;
export const START_CRONJOB_IMMEDIATELY = false;

export const BOT_TOKEN = process.env.TG_BOT_TOKEN;
export const ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT_ID;
export const LOGS_PATH = resolve('./data/logs.json');
export const API_ROUTE_MIDPASS = 'https://info.midpass.ru/api/request';

export const API_KEY = process.env.API_KEY
export const API_ROUTE_LOGS = process.env.API_ROOT + '/api/bot-logs'
export const API_ROUTE_USERS = process.env.API_ROOT + '/api/bot-users'

export const CRONJOB_SCHEDULES = [
  '23 9,12,15,18,21 * * 1-5', // Weekdays 9:23,12:23...21:23
  '17 16,20 * * 0,6' // Weekends 16:17,20:17
]

export const USER_MAX_COUNT_CODES = 2;
export const CODE_UID_SHORT_LENGTH = 6;

export const LogsTypes = {
  ERROR: 'ERROR',
  ERROR_CRONJOB_ROOT: 'ERROR_CRONJOB_ROOT',
  ERROR_CRONJOB_USER_CODE: 'ERROR_CRONJOB_USER_CODE',
  ERROR_BLOCK_BY_USER: 'ERROR_BLOCK_BY_USER',
  USER_HAS_MAX_COUNT_CODES: 'USER_HAS_MAX_COUNT_CODES',
  SUCCESS_START: 'SUCCESS_START',
  START_CRONJOB: 'START_CRONJOB',
  END_CRONJOB: 'END_CRONJOB',
  AUTOUPDATE_WITHOUT_CHANGES: 'AUTOUPDATE_WITHOUT_CHANGES',
  AUTOUPDATE_WITH_CHANGES: 'AUTOUPDATE_WITH_CHANGES',
  SUBSCRIBE_ENABLE: 'SUBSCRIBE_ENABLE',
  SUBSCRIBE_ENABLE_ALREADY: 'SUBSCRIBE_ENABLE_ALREADY',
  UNSUBSCRIBE_ENABLE: 'UNSUBSCRIBE_ENABLE',
  SUCCESS_CODE_STATUS: 'SUCCESS_CODE_STATUS',
  SHOW_SCHEDULE: 'SHOW_SCHEDULE',
  SHOW_FAQ: 'SHOW_FAQ',
  MESSAGE: 'MESSAGE',
}

export const Timeouts = {
  START: 1000 * 2,
  TEXT: 1000 * 2,
  CRONJOB_NEXT_USER_CODE: 1000 * 15,
  CRONJOB_NEXT_USER: 1000 * 30,
  GET_USERS: 100,
}

export const MetaKeys = {
  CODE: 'CODE',
  CODE_UID: 'CODE_UID',
  COUNTER_USERS_WITH_CODES: 'COUNTER_USERS_WITH_CODES',
  COUNTER_USERS_CHECKED: 'COUNTER_USERS_CHECKED',
  COUNTER_CODES: 'COUNTER_CODES',
  COUNTER_CODES_UPDATED: 'COUNTER_CODES_UPDATED',
  COUNTER_CODES_ERROR: 'COUNTER_CODES_ERROR',
  CRONJOB_DURATION: 'CRONJOB_DURATION',
}

export const API_USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
]

export const FALSY_PASSPORT_STATUSES = [
  'паспорт выдан',
  'отмена изготовления паспорта'
]

export const Messages = {
  DEFAULT_START() {
    return `
<b>👨 Privet!</b>

<b>ℹ️ Я умею:</b>

  - отслеживать статус готовности загранпаспорта РФ
  - оповещать об изменениях статуса заявления

${this.FAQ_BASE}
${this.AUTOUPDATE_SCHEDULES}
`},
  START_FOR_USER() {
    return `
${this.DEFAULT_START()}

Введи номер своего заявления:
`},
  START_FOR_USER_EXIST() {
    return `
${this.DEFAULT_START()}
Раньше ты уже пользовался моими оповещениями, я отображу их (если они были).
Ты можешь ввести номер другого заявления:
`},
  AUTOUPDATE_SCHEDULES: `
🕔 <b>Автообновление</b> статусов заявлений происходит по расписанию (МСК):
Расписание построено по большой выборке, а заявление обновляется в самые актуальные моменты

- Будние дни:
  9:23-11:23,
  12:23-14:23,
  15:23-17:23,
  18:23-20:23,
  21:23-23:23

- Выходные дни:
  16:17-18:17,
  20:17-22:17
`,
  FAQ_BASE: `
<b>ℹ️ Как пользоваться ботом:</b>
  - заявления проверяются автоматически по расписанию (теперь нельзя прислать код и сразу получить статус), это нужно для минимизации возможности блокировки бота.
  - введи <b>25-значный</b> номер своего заявления, указанный в справке о приеме
  - я буду автоматически отслеживать изменения статуса этого заявления
  - при изменении статуса этого заявления я напишу тебе об этом
`,
  FAQ_STATUSES: `
<b>ℹ️ Значения статусов заявлений:</b>

<b>0%</b> "заявление создано" - начальный статус ("Заявление ожидает принятия в обработку")

<b>5%</b> "готово" - видимо про принятие заявления в консульстве (по косвенным признакам - ждет отправления диппочтой в РФ, видимо цифровой документооборот пока не дошел)

<b>10%</b> "отправлено" - видимо про отправку заявления диппочтой в РФ (в одном консульстве куча номеров заявлений копилась полтора месяца и только потом отправилась)

<b>20%</b> "принято в обработку" / "приостановлено" - что-то внутреннее

<b>30%</b> "отправлено на согласование" / "на согласовании" / "дополнительная проверка" - видимо, госбезопасность не спит

<b>60%</b> "согласовано письмом" / "согласовано" - видимо, госбезопасность убедилась, что доступа к гостайне у подавшего заявление нет

<b>70%</b> "персонализация разрешена" / "на персонализации" - по отрывочным сообщениям в интернете, "персонализация" - это печать паспорта Гознаком.

<b>80%</b> "паспорт поступил" / "паспорт отправлен в РКЗУ" - предположительно (первый со временем превращается во второй), первый - это то, что напечатанный паспорт приехал с Гознака в МИД, а второй - что он отправлен диппочтой в консульство (бывало, паспорта больше месяца копились в первом статусе, а потом все вместе переключились во второй).

<b>90%</b> "паспорт поступил" - имеется в виду в консульство из МИД

<b>100%</b> "паспорт верен" - выглядит как паспорт готовый к выдаче в консульстве / отправке по почте.

<b>0%</b> "паспорт выдан" / "отказ в согласовании" / "отмена изготовления паспорта" / "почтовое отправление" - конечные статусы
`,
  SUBSCRIBE_ENABLE: (uid = '') => `
✅ Теперь я буду уведомлять тебя об изменениях статуса заявления <b>${uid}</b>.
`,
  SUBSCRIBE_ENABLE_ALREADY(code = {}) {
    return `
<b>✅ Заявление уже отслеживается:</b>

${this.CODE_STATUS(code)}
`},
  UNSUBSCRIBE: `
Выбери заявление, которое не нужно отслеживать (оно будет удалено у меня):
`,
  UNSUBSCRIBE_ENABLE: (uid = '') => `
✅ Успешно отписался от отслеживания статуса заявления <b>${uid}</b>.
`,
  CODE_HAS_CHANGES: (status = {}) => `
<b>🔥 Статус заявления изменился!</b> \n\n${status}
`,
  CODE_STATUS: (code = {}) => `
<b>📅 Актуален на:</b> ${code?.getUpdateTimeString ? code.getUpdateTimeString + ' МСК' : '-'}

<b>#️⃣ Номер заявления:</b> ${code?.uid || '-'}

<b>🟡 Процент:</b> <b>${code?.internalStatus?.percent || '-'}</b>

<b>🟡 Статус:</b> ${code?.passportStatus?.name || '-'}

<b>🟡 Внутренний статус:</b> ${code?.internalStatus?.name || '-'}

<b>📅 Дата подачи:</b> ${code?.receptionDate || '-'}
`,
  CODE_STATUS_EMPTY: `
ℹ️ Статус будет доступен при следующей проверке сайта МИД РФ (Если заявление уже появилось на https://info.midpass.ru/)
`,
  ERROR_VALIDATE_CODE: `
❌ Некорректный формат номера заявления.

Для проверки готовности паспорта необходимо ввести <b>25-значный</b> номер своего заявления, указанного в справке о приеме.
Проверь правильность ввода и попробуй ещё раз.

Если ошибка повторяется, используй официальный сайт МИД РФ https://info.midpass.ru/
`,
  ERROR_REQUEST_CODE: `
❌ Ошибка получения информации о заявлении с сервера МИД РФ.

Если ошибка повторяется, используй официальный сайт МИД РФ https://info.midpass.ru/
`,
  MAX_COUNT_CODES: (codesCount = 0) => `
ℹ️ Ты уже отслеживаешь ${codesCount} ${declOfNum(codesCount, ['заявление', 'заявления', 'заявлений'])} - это максимум, чтобы понизить шансы блокировки бота. Отпишись от других заявлений, чтобы добавить новое
`,
// ============================
// LOG MESSAGES (NOT FOR USERS)
// ============================
  NEW_USER: (user = {}) =>
`🆕 Новый пользователь!

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> #${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}
`,
  SUCCESS_SEND_TO_USER: (userId, messageToUser) =>
`ℹ️ Успешно написал пользователю #${userId}. Сообщение: ${messageToUser}
`,
  SUCCESS_CODE_STATUS: (user = {}, codeUid = '') =>
`ℹ️ Пользователь #${user.chatId || user.id || user.userName} проверил #${codeUid} (из БД)
`,
  SUCCESS_SUBSCRIBE_ENABLE: (user = {}, codeUid = '') =>
`ℹ️ Пользователь #${user.chatId || user.id || user.userName} подписался на #${codeUid}
`,
  SUCCESS_UNSUBSCRIBE_ENABLE: (user = {}, codeUid = '') =>
`ℹ️ Пользователь #${user.chatId || user.id || user.userName} отписался от #${codeUid}
`,
  AUTOUPDATE_WITHOUT_CHANGES: (user = {}, code = {}, index = 0) =>
`ℹ️ ${index} У пользователя #${user.chatId || user.id || user.userName} не изменился статус заявления #${code.uid}.
`,
  AUTOUPDATE_WITH_CHANGES: (user = {}, code = {}, index = 0) =>
`ℹ️ ${index} У пользователя #${user.chatId || user.id || user.userName} изменился статус заявления #${code.uid}
`,
  USER_MESSAGE_WITHOUT_UID: (user = {}, message = '') =>
`ℹ️ Сообщение от пользователя  #${user?.chatId || '-'} userName: ${user?.userName ? '@' + user.userName : '-'}. Сообщение: ${message}
`,
  USER_HAS_MAX_COUNT_CODES: (user = {}) =>
`ℹ️ Пользователь #${user.chatId || user.id || user.userName} пытался превысить допустимое количество отслеживаемых заявлений
`,
  USER_SUBSCRIBE_ENABLE_ALREADY: (user = {}, codeUid = '') =>
`ℹ️ Пользователь #${user.chatId || user.id || user.userName} пытался повторно подписаться на #${codeUid}
`,
  USER_SHOW_SCHEDULE: (user = {}) =>
`ℹ️ Пользователь #${user.chatId || user.id || user.userName} посмотрел расписание
`,
  USER_SHOW_FAQ: (user = {}) =>
`ℹ️ Пользователь #${user.chatId || user.id || user.userName} посмотрел FAQ
`,
  ERROR_REQUEST_CODE_WITH_USER_CODE: (codeuid = '') =>
`❌ Ошибка при получении статуса завяления: #${codeuid}
`,
  ERROR_REQUEST_CODE_WITH_USER: (user = {}, message = '') =>
`❌ Ошибка у пользователя #${user?.chatId || '-'} userName: ${user?.userName ? '@' + user.userName : '-'}. Сообщение: ${message}
`,
  ERROR_SEND_TO_USER: (userId, e) =>
`❌ Ошибка при отправке сообщения пользователю #${userId}. Сообщение: ${e?.code || '-'}: ${e?.description || '-'}
`,
  ERROR_BLOCK_BY_USER: (user = {}) =>
`❌ Bot was blocked by the user #${user?.chatId || '-'}. Он больше не выпадает в выдаче, его коды удалены
`,
  ERROR_CRONJOB: (e, type = '-', obj = {}) =>
`❌ ERROR_CRONJOB (${type}):
${e}
ADDITIONAL DATA:
${JSON.stringify(obj)}
`,
  START_CRONJOB: (counterUserWithCodes = 0) =>
`⏰⏰⏰ START_CRONJOB
Количество пользователей: <b>${counterUserWithCodes}</b>
`,
  END_CRONJOB: (counterUsersChecked = 0, counterCodes = 0, counterCodesUpdated = 0, counterCodesError = 0, duration = '') =>
`✅✅✅ END_CRONJOB
Проверено пользователей: <b>${counterUsersChecked}</b>
Проверено заявлений: <b>${counterCodes}</b>
Обновлено заявлений: <b>${counterCodesUpdated}</b>
Ошибок: <b>${counterCodesError}</b>
Выполнено за: <b>${duration}</b>
`,
}
