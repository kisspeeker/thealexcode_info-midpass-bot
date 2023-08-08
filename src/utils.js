export function declOfNum(number, titles) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[ (number%100>4 && number%100<20)? 2 : cases[(number%10<5)?number%10:5] ];
}

export function calculateTimeDifference(startDate, endDate = new Date()) {
  const diffInMilliseconds = endDate - startDate;
  const diffDate = new Date(diffInMilliseconds);

  return diffDate.toLocaleString('ru-RU', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZone: 'UTC'
  });
}
