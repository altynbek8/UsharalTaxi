// C:\Users\Duman\my-taxi-app\lib\utils.ts

export function normalizePhone(input: string) {
  // 1. Убираем все символы, кроме цифр
  let cleaned = input.replace(/\D/g, '');

  // 2. Если номер начинается с 8 и длина 11 (87011234567), меняем 8 на 7
  if (cleaned.length === 11 && cleaned.startsWith('8')) {
    cleaned = '7' + cleaned.substring(1);
  }

  // 3. Если номер короткий (7011234567), добавляем 7 в начало
  if (cleaned.length === 10) {
    cleaned = '7' + cleaned;
  }

  // Итог всегда: 77011234567
  return cleaned;
}