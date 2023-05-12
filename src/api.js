import axios from 'axios'
import { API_KEY, API_ROUTE_LOGS, API_ROUTE_USERS } from './constants.js';

const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
]

export const axiosInstance = axios.create({
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    'user-agent': userAgents[Math.floor(Math.random()*userAgents.length)]
  },
});

export const logMessage = async (data = {}) => {
  try {
    await axiosInstance.post(API_ROUTE_LOGS, {
      type: String(data?.type || '-'),
      user: String(data?.user?.chatId || data?.user?.id || data?.user?.userName || '-'),
      message: String(data?.message || '-'),
    });
  } catch(e) {
    console.error('ERROR IN LOGSMESSAGE', e?.response?.data);
  }
}

export const getUsers = async () => {
  try {
    const res = (await axiosInstance.get(`${API_ROUTE_USERS}?populate[codes][populate][internalStatus]=*&populate[codes][populate][passportStatus]=*&pagination[limit]=-1`)).data
    return res;
  } catch(e) {
    console.error('ERROR at api.getUsers', e?.response?.data);
    return [];
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
