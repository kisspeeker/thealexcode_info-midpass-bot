import { API_ROUTE_MIDPASS, MESSAGES, DEBUG } from './constants.js';
import { axiosInstance } from './api.js'

const shortUidLength = 6;

export default class Code {
  constructor({ uid, sourceUid, receptionDate, passportStatus, internalStatus }) {
    this.uid = uid;
    this.shortUid = `*${this.uid.slice(-shortUidLength)}`;
    this.sourceUid = sourceUid;
    this.receptionDate = receptionDate;
    this.passportStatus = {
      id: passportStatus?.id,
      name: passportStatus?.name,
      description: passportStatus?.description,
      color: passportStatus?.color,
      subscription: passportStatus?.subscription,
    };
    this.internalStatus = {
      name: internalStatus?.name,
      percent: internalStatus?.percent,
    };
    this.updateTime = Date.now();
  }

  get status() {
    return MESSAGES.codeStatus(this);
  }

  static isValid(uid = '') {
    return uid && String(uid).length === 25;
  }

  static isShortValid(shortUid = '') {
    return shortUid && String(shortUid).length === shortUidLength + 1;
  }

  static async requestCode(uid = '') {
    try {
      const newCode = !DEBUG ? (await axiosInstance.get(`${API_ROUTE_MIDPASS}/${uid}`)).data : Promise.resolve({ uid });

      if (!newCode) {
        throw MESSAGES.errorRequestCode
      }
      return new Code(newCode)
    } catch(e) {
      throw MESSAGES.errorRequestCode;
    }
  }

  hasChangesWith(code = {}) {
    return this.internalStatus.percent !== code.internalStatus.percent
      || this.passportStatus.name !== code.passportStatus.name
      || this.internalStatus.name !== code.internalStatus.name;
  }
}