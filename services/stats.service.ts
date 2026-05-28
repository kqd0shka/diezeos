import { create } from "domain";
import { db } from "../database/database";

export function createUser(userId: string) {

    const statement = db.prepare(`
            INSERT OR IGNORE INTO users (userId)
            VALUES (?)
        `);

    statement.run(userId)
}

export function addMessage(userId: string){
    createUser(userId);

    const statement = db.prepare(`
            UPDATE users
            SET messages = messages + 1
            WHERE userId = ?
        `);

    statement.run(userId);
}

export type userStats = {
    userId: string;
    userName: string;
    messages: number;
    voiceTime: number;
    coins: number;
    xp: number;
    level: number;
    status: string;
    userData: any;
    userAchievment: string;
};

export function getUserStat(userId: string): userStats | undefined {
    createUser(userId);

    const statement = db.prepare(`
            SELECT *
            FROM users
            WHERE userId = ?
        `);

        return statement.get(userId) as userStats | undefined;
}

export function addXP(userId: string, amount: number) {
    createUser(userId);

    const user = db.prepare(`
            SELECT xp, level
            FROM users
            WHERE userId = ?
        `).get(userId) as { xp: number; level: number };

    let xp = user.xp + amount;
    let level = user.level;

    const xpNeeded = 100 * level * level;

    let leveledUp = false;

    while (xp >= xpNeeded) {
        xp -= xpNeeded;
        level++;
        leveledUp = true;
    }

        db.prepare(`
            UPDATE users
            SET xp = ?, level = ?
            WHERE userid = ?
        `).run(xp, level, userId);

    return { leveledUp, level }
}

export function addVoiceTime(userId: string, seconds: number) {
    createUser(userId);

    db.prepare(`
        UPDATE users
        SET voiceTime = voiceTime + ?
        WHERE userId = ?
        `).run(seconds, userId);

}