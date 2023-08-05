import { Messages, FALSY_PASSPORT_STATUSES, CODE_UID_SHORT_LENGTH } from './constants.js';


export default class Code {
  constructor({ uid, sourceUid, receptionDate, passportStatus, internalStatus, updateTime, needUpdateTime = true }) {
    this.uid = uid;
    this.shortUid = `*${this.uid.slice(-CODE_UID_SHORT_LENGTH)}`;
    this.sourceUid = sourceUid;
    this.receptionDate = receptionDate || Code.parseReceptionDateFromUid(uid);
    this.passportStatus = {
      passportStatusId: passportStatus?.id,
      name: passportStatus?.name,
      description: passportStatus?.description,
      color: passportStatus?.color,
      subscription: passportStatus?.subscription,
    };
    this.internalStatus = {
      name: internalStatus?.name,
      percent: internalStatus?.percent,
    };
    this.updateTime = ((updateTime && !needUpdateTime) ? new Date(updateTime) : new Date()).toLocaleString('en-EN');
  }

  get status() {
    return (this.passportStatus?.name ? '' : Messages.CODE_STATUS_EMPTY) + Messages.CODE_STATUS(this);
  }

  get getUpdateTimeString() {
    return (new Date(this.updateTime)).toLocaleString('ru-RU', {
      timeStyle: 'medium',
      dateStyle: 'short',
      timeZone: 'Europe/Moscow'
    })
  }

  static isValid(uid = '') {
    return uid && String(uid).length === 25;
  }

  static isShortValid(shortUid = '') {
    return shortUid && String(shortUid).length === CODE_UID_SHORT_LENGTH + 1;
  }

  static isComplete(code = {}) {
    return code.internalStatus.percent === 0 && FALSY_PASSPORT_STATUSES.includes(code.internalStatus.name.toLowerCase())
  }

  static parseReceptionDateFromUid(uid = '') {
    try {
      const [
        ,, year, month, day
      ] = String(uid).match(/^(\d{9})(\d{4})(\d{2})(\d{2})/)
      return `${year}-${month}-${day}`
    } catch(e) {
      console.error(e);
    }
  }

  hasChangesWith(code = {}) {
    return this.internalStatus.percent !== code.internalStatus.percent
      || this.passportStatus.name !== code.passportStatus.name
      || this.internalStatus.name !== code.internalStatus.name;
  }
}
