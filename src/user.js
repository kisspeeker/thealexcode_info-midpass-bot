import Code from './code.js';

export default class User {
  constructor({ 
    id, 
    chatId, 
    first_name,
    firstName,
    last_name,
    lastName,
    username, 
    userName, 
    codes,
    isNew
  }) {
    this.chatId = chatId ? String(chatId) : '';
    this.firstName = first_name || firstName;
    this.lastName = last_name || lastName;
    this.userName = username || userName;
    this.codes = Array.isArray(codes) ? codes : [];

    if (isNew) {
      this.chatId = String(id);
    } else {
      this.id = id;
    }
  }

  get hasCodes() {
    return !!(this.codes || []).length
  }

  get codeStatuses() {
    return (this.codes || []).map((code) => code.status)
  }

  updateUserCodes(currentCode) {
    if (currentCode && currentCode instanceof Code) {
      const foundIndex = (this.codes || []).findIndex(x => x.uid == currentCode.uid);

      if (foundIndex >= 0) {
        (this.codes || [])[foundIndex] = currentCode;
      } else {
        (this.codes || []).push(currentCode)
      }
    }
  }

  removeUserCode(uid = '') {
    this.codes = (this.codes || []).filter((code) => code.uid !== uid);
  }
}