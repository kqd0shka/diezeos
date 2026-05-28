export interface ParsedDuration {
    years: number;
    months: number;
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    totalMs: number;
    isPermanent: boolean;
    humanReadable: string;
}

export function parseDuration(input: string): ParsedDuration | null {
    const trimmed = input.trim().toLowerCase();

    if (trimmed === '0' || trimmed === 'perm' || trimmed === 'permanent' || trimmed === 'постоянно' || trimmed === 'навсегда' || trimmed === 'Навсегда') {
        return {
            years: 0,
            months: 0,
            weeks: 0,
            days: 0,
            hours: 0,
            minutes: 0,
            totalMs: 0,
            isPermanent: true,
            humanReadable: 'Навсегда'
        };
    }

    const regex = /(\d+)\s*(y|mo|w|d|h|m)/g;
    let match;
    const result: ParsedDuration = {
        years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, 
        totalMs: 0, 
        isPermanent: false, 
        humanReadable: ''
    };

    let hasMatch = false;
    while ((match = regex.exec(trimmed)) != null) {
        hasMatch = true;
        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 'y': result.years = value; break;
            case 'mo': result.months = value; break;
            case 'w': result.weeks = value; break;
            case 'd': result.days = value; break;
            case 'h': result.hours = value; break;
            case 'm': result.minutes = value; break;
        }
    }

    if (!hasMatch) return null;

    // Конвертация в миллисекунды (приблизительно)
    result.totalMs = 
        result.years * 365 * 24 * 60 * 60 * 1000 +
        result.months * 30 * 24 * 60 * 60 * 1000 +
        result.weeks * 7 * 24 * 60 * 60 * 1000 +
        result.days * 24 * 60 * 60 * 1000 +
        result.hours * 60 * 60 * 1000 +
        result.minutes * 60 * 1000;

    const parts: string[] = [];
    if (result.years) parts.push(`${result.years}г`);
    if (result.months) parts.push(`${result.months}мес`);
    if (result.weeks) parts.push(`${result.weeks}нед`);
    if (result.days) parts.push(`${result.days}д`);
    if (result.hours) parts.push(`${result.hours}ч`);
    if (result.minutes) parts.push(`${result.minutes}м`);
    result.humanReadable = parts.join(' ') || 'Мгновенно';
    return result;
}

export function formatRemainingTime(expiresAt: string | null): string {
    if (!expiresAt) return 'Навсегда';

    const now = Date.now();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;

    if (diff <= 0) return 'Истёк';

    const minutes = Math.floor(diff / 60000) % 60;
    const hours = Math.floor(diff / 3600000) % 24;
    const days = Math.floor(diff / 86400000) % 30;

    if (days > 0) return `${days}дн`;
    if (hours > 0) return `${hours}ч`;
    return `${minutes}мин`;   
}