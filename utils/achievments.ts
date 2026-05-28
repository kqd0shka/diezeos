import { GuildMember } from 'discord.js';
import { db } from "../database/database";

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    roleId?: string;
    check: (userData: any, member: GuildMember | undefined) => boolean;
}

export const achievements: Achievement[] = [
        {
        id: 'beta_tester',
        name: 'Бета',
        description: 'Участник бета-тестирования',
        icon: '🧪',
        roleId: '1505844305149820968', // замените на ID роли
        check: (userData) => userData.isBetaTester === 1
    },
    {
        id: 'one_year',
        name: '1  год',
        description: 'На сервере от 1 года',
        icon: '📅',
        check: (userData) => {
            // 🔹 1. Проверка: есть ли дата вступления
            if (!userData.joinedAt) return false;
            
            const joinDate = new Date(userData.joinedAt);
            
            // 🔹 2. Проверка: валидна ли дата
            if (isNaN(joinDate.getTime())) return false;
            
            const now = new Date();
            
            // 🔹 3. Если дата в будущем — что-то не так (защита от ошибок)
            if (joinDate > now) return false;
            
            // 🔹 4. Считаем разницу (только прошлое, без Math.abs)
            const diffTime = now.getTime() - joinDate.getTime();
            
            // 🔹 5. Округляем ВНИЗ для точности (364.9 дня ≠ 365)
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays >= 365;
        }
    },
    {
        id: 'thousand_hours',
        name: '1к часов',
        description: '1000 часов в голосовом канале',
        icon: '🎙️',
        roleId: '1503600552553087046', // замените на ID роли
        check: (userData) => userData.voiceTime >= 3600000 // 1000 часов в секундах
    }
];

export interface UserAchievement {
    id: string;
    unlockedAt: Date | null;
}

export async function checkAndGrantAchievements(
    userId: string,
    member: GuildMember | undefined,
    userData: any,
): Promise<string[]> {
    let currentAchievements: string[] = [];
    try {
        if (userData?.achievements) {
            currentAchievements = JSON.parse(userData.achievements);
        }
    } catch {
        currentAchievements = [];
    }

    const newUnlocked: string[] = [];

    // 2. Проверяем каждое достижение
    for (const ach of achievements) {
        // Если уже получено → пропускаем
        if (currentAchievements.includes(ach.id)) continue;

        // Проверяем условие
        if (ach.check(userData, member)) {
            newUnlocked.push(ach.id);
        }
    }

    // 3. Если есть новые → сохраняем в БД
    if (newUnlocked.length > 0) {
        const updatedList = [...currentAchievements, ...newUnlocked];
        db.prepare(`
            UPDATE users 
            SET achievements = ? 
            WHERE userId = ?
        `).run(JSON.stringify(updatedList), userId);

        console.log(`🏆 ${member?.user.username} (${userId}) получил достижения:`, newUnlocked);
        return updatedList;
    }

    return currentAchievements;
}

export function getUserAchievements(userData: any): string[] {
    return userData.achievements?.map((a: UserAchievement) => a.id) || [];
}