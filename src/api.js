import axios from 'axios'
import {
  API_KEY,
  API_ROUTE_MIDPASS,
  API_ROUTE_LOGS,
  API_ROUTE_USERS,
  API_USER_AGENTS,
  TIMEOUTS,
  MESSAGES,
  DEBUG
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
    await axiosInstance.post(API_ROUTE_LOGS, {
      type: String(data?.type || '-'),
      user: String(data?.user?.chatId || data?.user?.id || data?.user?.userName || '-'),
      message: `${String(data?.message || '-')}

META<<<${JSON.stringify(data?.meta || {})}>>>META
`,
    });
  } catch(e) {
    console.error('ERROR IN LOGSMESSAGE', e?.response?.data);
  }
}

export const getCodeFromMidpass = async (uid = '') => {
  try {
    const newCode = !DEBUG ? (await axiosInstance.get(`${API_ROUTE_MIDPASS}/${uid}`)).data : Promise.resolve({ uid });

    if (!newCode) {
      throw MESSAGES.errorRequestCode;
    }
    return new Code(newCode)
  } catch(e) {
    throw MESSAGES.errorRequestCode;
  }
}

// export const getUsers = async () => {
//   try {
//     const res = (await axiosInstance.get(`${API_ROUTE_USERS}?populate[codes][populate][internalStatus]=*&populate[codes][populate][passportStatus]=*&pagination[limit]=-1`)).data
//     console.warn(res);
//     return res;
//   } catch(e) {
//     console.error('ERROR at api.getUsers', e?.response?.data);
//     return [];
//   }
// }

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
      await new Promise(resolve => setTimeout(resolve, TIMEOUTS.getUsers));
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
