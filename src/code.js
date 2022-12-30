export default class Code {
  constructor({ uid, sourceUid, receptionDate, passportStatus, internalStatus }) {
    this.uid = uid;
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
<b>uid:</b> <b>${this.uid || '-'}</b>
<b>Процент:</b> <b>${this.internalStatus.percent || '-'}</b>
<b>Документы поданы:</b> ${this.receptionDate || '-'}
<b>Статус:</b> ${this.passportStatus.name || '-'}
<b>Внутренний статус:</b> ${this.internalStatus.name || '-'}
    `
  }
}