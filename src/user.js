import axios from 'axios'

import {
  API_ROUTE_MIDPASS,
} from './constants.js';
import Code from './code.js';

export const axiosInstance = axios.create({
  headers: {
    Accept: 'application/json',
  },
});

export default class User {
  constructor({ 
    id, 
    first_name,
    last_name,
    username, 
    updateTime, 
    isStarted, 
    codes,
  }) {
    this.id = id;
    this.firstName = first_name;
    this.lastName = last_name;
    this.userName = username;
    this.updateTime = updateTime;
    this.isStarted = !!isStarted;
    this.codes = Array.isArray(codes) ? codes : [];
  }

  get hasCodes() {
    return Array.isArray(this.codes) && !!this.codes.length
  }

  static async requestCode(uid = '') {
    try {
      return new Code((await axiosInstance.get(`${API_ROUTE_MIDPASS}/${uid}`)).data)
    } catch(e) {
      throw e;
    }
  }

  updateCode(currentCode) {
    if (currentCode && currentCode instanceof Code) {
      const foundIndex = this.codes.findIndex(x => x.uid == currentCode.uid);

      if (foundIndex >= 0) {
        this.codes[foundIndex] = currentCode;
      } else {
        this.codes.push(currentCode)
      }

      this.updateTime = Date.now();
    }
  }
}