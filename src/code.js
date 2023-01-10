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
    return `
<b>Номер заявления:</b> <b>${this.uid || '-'}</b>

<b>Процент:</b> <b>${this.internalStatus.percent || '-'}</b>
<b>Документы поданы:</b> ${this.receptionDate || '-'}
<b>Статус:</b> ${this.passportStatus.name || '-'}
<b>Внутренний статус:</b> ${this.internalStatus.name || '-'}
    `
  }

  static isValid(uid = '') {
    return uid && String(uid).length === 25;
  }

  static isShortValid(shortUid = '') {
    return shortUid && String(shortUid).length === shortUidLength + 1;
  }
}