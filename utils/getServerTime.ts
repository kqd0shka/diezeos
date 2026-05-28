/**
 * Форматирует время нахождения на сервере
 * @param joinedAt ISO строка даты вступления
 * @returns Объект с отформатированными данными
 */
export function getServerTimeInfo(joinedAt: string | null): {
    days: number;
    months: number;
    years: number;
    text: string;
} {
    if (!joinedAt) {
        return { days: 0, months: 0, years: 0, text: "Неизвестно" };
    }

    const joinDate = new Date(joinedAt);
    const now = new Date();
    
    // Проверяем валидность даты
    if (isNaN(joinDate.getTime())) {
        return { days: 0, months: 0, years: 0, text: "Ошибка" };
    }

    // Считаем разницу
    const diffTime = now.getTime() - joinDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30.44); // Среднее кол-во дней в месяце
    const diffYears = Math.floor(diffDays / 365.25); // С учётом високосных годов

    // Формируем красивый текст
    let text = "";
    if (diffYears > 0) {
        text += `${diffYears} г. `;
    }
    if (diffMonths % 12 > 0) {
        text += `${diffMonths % 12} м. `;
    }
    if (diffDays % 30 > 0) {
        text += `${diffDays % 30} д.`;
    }

    return {
        days: diffDays,
        months: diffMonths,
        years: diffYears,
        text: text || "0 д."
    };
}