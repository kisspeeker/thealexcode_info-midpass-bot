import axios from 'axios'
import {
  API_KEY,
  API_ROUTE_MIDPASS,
  API_ROUTE_LOGS,
  API_ROUTE_USERS,
  API_USER_AGENTS,
  ADMIN_CHAT_ID,
  TIMEZONE_OFFSET_MSK,
  DEBUG,
  Timeouts,
  Messages,
  LogsTypes,
} from './constants.js';
import Code from './code.js'

export const axiosInstance = axios.create({
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    'user-agent': API_USER_AGENTS[Math.floor(Math.random()*API_USER_AGENTS.length)]
  },
});

export const logMessage = async (data = {}) => {
  try {
    const type = String(LogsTypes[data?.type] || '-');
    const logMethod = type.toLowerCase().includes('error') ? 'error' : 'log'
    const user = String(data?.user?.chatId || data?.user?.id || data?.user?.userName || '-');
    const header = `<b>${new Date().getUTCHours() + TIMEZONE_OFFSET_MSK}:${new Date().getMinutes()}</b> / ${type}`;
    const body = {
      type,
      user,
      message: `
${header}
${String(data?.message || '-')}
`
    }
    const messageWithMeta = `
${body.message}

META<<<${JSON.stringify(data?.meta || {})}>>>META
`

    await axiosInstance.post(API_ROUTE_LOGS, {
      type: body.type,
      user: body.user,
      message: messageWithMeta,
    });

    if (data?.messageToAdmin && globalThis.bot) {
      await globalThis.bot.telegram.sendMessage(ADMIN_CHAT_ID, data.messageToAdmin, {
        parse_mode: 'HTML',
      });
    }
    console[logMethod](body.message);
  } catch(e) {
    console.error('ERROR IN LOGSMESSAGE', e?.response?.data);
  }
}

export const getCodeFromMidpass = async (uid = '') => {
  try {
    const newCode = !DEBUG ? (await axiosInstance.get(`${API_ROUTE_MIDPASS}/${uid}`)).data : Promise.resolve({ uid });

    if (!newCode) {
      throw Messages.ERROR_REQUEST_CODE;
    }
    return new Code(newCode)
  } catch(e) {
    throw Messages.ERROR_REQUEST_CODE;
  }
}

export const getAllUsers = async (filterString = '') => {
  const pageSize = 100;
  const filter = filterString ? `${filterString}&` : ''

  let allValues = [];
  let page = 1;

  while (page) {
    try {
      const res = (await axiosInstance.get(`${API_ROUTE_USERS}?${filter}pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate[codes][populate][internalStatus]=*&populate[codes][populate][passportStatus]=*`)).data
      const pageCount = res?.meta?.pagination?.pageCount || page;
      allValues = allValues.concat(res.values);
      await new Promise(resolve => setTimeout(resolve, Timeouts.GET_USERS));
      page = pageCount > page ? page + 1 : 0;
    } catch (e) {
      console.error('ERROR at api.getUsers', e?.response?.data);
      break;
    }
  }

  return allValues;
}

export const getUsersWithCodes = async () => {
  try {
    return await getAllUsers('filters[codes][id][$ne]=null')
  } catch(e) {
    throw `ERROR at api.getUsersWithCodes: ${e}`
  }
}

export const getUserByChatId = async (chatId = '') => {
  try {
    if (chatId) {
      return (await getAllUsers(`filters[chatId][$eq]=${chatId}`))[0]
    }

    throw 'ERROR at api.getUsersWithCodes: Отсутствует chatId пользователя'
  } catch(e) {
    throw `ERROR at api.getUsersWithCodes: ${e}`
  }
}

export const createUser = async (user = {}) => {
  try {
    const res = (await axiosInstance.post(API_ROUTE_USERS, user)).data;
    return res;
  } catch(e) {
    console.error('ERROR at api.createUser', e?.response?.data);
    throw e;
  }
}

export const updateUser = async (user = {}) => {
  try {
    const res = (await axiosInstance.put(`${API_ROUTE_USERS}/${user.id}`, user)).data;
    return res;
  } catch(e) {
    console.error('ERROR at api.updateUser', e?.response?.data);
    throw e;
  }
}
