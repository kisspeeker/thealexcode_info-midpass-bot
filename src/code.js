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
}