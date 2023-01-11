import Code from './code.js';

export default class User {
  constructor({ 
    id, 
    first_name,
    last_name,
    username, 
    codes,
  }) {
    this.id = id;
    this.firstName = first_name;
    this.lastName = last_name;
    this.userName = username;
    this.codes = Array.isArray(codes) ? codes : [];
  }

  get hasCodes() {
    return !!this.codes.length
  }

  get codeStatuses() {
    return this.codes.map((code) => code.status)
  }

  updateUserCodes(currentCode) {
    if (currentCode && currentCode instanceof Code) {
      const foundIndex = this.codes.findIndex(x => x.uid == currentCode.uid);

      if (foundIndex >= 0) {
        this.codes[foundIndex] = currentCode;
      } else {
        this.codes.push(currentCode)
      }
    }
  }
}