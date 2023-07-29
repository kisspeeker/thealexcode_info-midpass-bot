import { Messages, FALSY_PASSPORT_STATUSES } from './constants.js';

const shortUidLength = 6;

export default class Code {
  constructor({ uid, sourceUid, receptionDate, passportStatus, internalStatus, updateTime }) {
    this.uid = uid;
    this.shortUid = `*${this.uid.slice(-shortUidLength)}`;
    this.sourceUid = sourceUid;
    this.receptionDate = receptionDate;
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
    this.updateTime = (updateTime ? new Date(updateTime) : new Date()).toLocaleString('en-EN');
  }

  get status() {
    return Messages.CODE_STATUS(this);
  }

  static isValid(uid = '') {
    return uid && String(uid).length === 25;
  }

  static isShortValid(shortUid = '') {
    return shortUid && String(shortUid).length === shortUidLength + 1;
  }

  static isComplete(code = {}) {
    return code.internalStatus.percent === 0 && FALSY_PASSPORT_STATUSES.includes(code.internalStatus.name.toLowerCase())
  }

  hasChangesWith(code = {}) {
    return this.internalStatus.percent !== code.internalStatus.percent
      || this.passportStatus.name !== code.passportStatus.name
      || this.internalStatus.name !== code.internalStatus.name;
  }
}
