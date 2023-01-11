import { resolve } from 'path';
import dotenv from 'dotenv-flow';
dotenv.config();

export const DEBUG = false;

export const BOT_TOKEN = process.env.TG_BOT_TOKEN;
export const ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT_ID;
export const LOGS_PATH = resolve('./data/logs.json');
export const API_ROUTE_MIDPASS = 'https://info.midpass.ru/api/request';

export const API_KEY = process.env.API_KEY
export const API_ROUTE_USERS = process.env.API_ROOT + '/api/bot-users?sort[0]=id:DESC'


// Я умею отслеживать статус готовности загранпаспорта РФ и оповещать о его изменениях!
export const MESSAGES = {
  start: `
<b>Privet!</b>

Введи номер своего заявления
`,
  startForUser: `
<b>Privet!</b> 

Я нашел твои прошлые отслеживания
`,
  subscribeEnable: (uid = '') => `✅ Теперь я буду уведомлять тебя об изменениях статуса заявления <b>${uid}</b>.`,
  subscribeEnableAlready: (uid = '') => `✅ Заявление уже отслеживается <b>${uid}</b>`,
  codeHasChanges: (status = {}) => `<b>🔥 Статус заявления изменился!</b> \n\n${status}`,
  codeStatus: (code = {}) => 
`<b>#️⃣ Номер заявления:</b> ${code.uid || '-'}

<b>🟡 Процент:</b> <b>${code.internalStatus.percent || '-'}</b>

<b>🟡 Статус:</b> ${code.passportStatus.name || '-'}

<b>🟡 Внутренний статус:</b> ${code.internalStatus.name || '-'}

<b>📅 Дата подачи:</b> ${code.receptionDate || '-'}
`,
  newUser: (user = {}) => 
`🔥 Новый пользователь! 

<b>userName:</b> ${user.userName ? '@' + user.userName : '-'} 
<b>id:</b> ${user.id || '-'}
<b>firstName:</b> ${user.firstName || '-'}
<b>lastName:</b> ${user.lastName || '-'}
`,
  userMessageWithoutUid: (user = {}, message = '') => 
`⚠️ Сообщение от пользователя!

<b>userName:</b> ${user.userName ? '@' + user.userName : '-'} 
<b>id:</b> ${user.id || '-'}
<b>firstName:</b> ${user.firstName || '-'}
<b>lastName:</b> ${user.lastName || '-'}

<b>Message:</b> 
${message}
`,
  errorValidateCode: '❌ Некорректный формат номера заявления. Проверь правильность номера заявления и попробуй ещё раз.',
  errorRequestCode: '❌ Ошибка получения информации о заявлении с сервера МИД РФ. Проверь правильность номера заявления и попробуй ещё раз.',
}