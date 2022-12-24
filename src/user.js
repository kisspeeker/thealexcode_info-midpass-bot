export default class User {
  constructor({ chatId, userName, isStarted, codes }) {
    this.chatId = chatId;
    this.userName = userName;
    this.isStarted = isStarted;
    this.codes = codes;
  }

  get hasCodes() {
    return Array.isArray(this.codes) && !!this.codes.length
  }
}