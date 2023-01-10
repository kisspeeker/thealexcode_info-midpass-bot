import { resolve } from 'path';
import dotenv from 'dotenv-flow';
dotenv.config();

export const DEBUG = false;

export const BOT_TOKEN = process.env.TG_BOT_TOKEN;
export const ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT_ID;
export const LOGS_PATH = resolve('./data/logs.json');
export const API_ROUTE_MIDPASS = 'https://info.midpass.ru/api/request';

export const API_KEY = process.env.API_KEY
export const API_ROUTE_LOGS = process.env.API_ROOT + '/api/funpics-bot-logs?sort[0]=id:DESC'


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
  subscribeEnable: (uid = '') => `Теперь я буду уведомлять тебя об изменениях статуса заявления <b>${uid}</b>.`,
  subscribeEnableAlready: (uid = '') => `Заявление <b>${uid}</b> уже отслеживается.`,
  errorValidateCode: 'Некорректный формат номера заявления.',
  errorRequestCode: 'Не удалось получить информацию о заявлении. Проверь правильность номера заявления или попробуй позже.',
}