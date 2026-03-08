export function normalizePhone(input: string) {
  let cleaned = input.replace(/\D/g, '');

  if (cleaned.length === 11 && cleaned.startsWith('8')) {
    cleaned = '7' + cleaned.substring(1);
  }

  if (cleaned.length === 10) {
    cleaned = '7' + cleaned;
  }

  // Если после очистки номер меньше 11 цифр — это ошибка
  if (cleaned.length < 11) return "";

  return cleaned;
}