import dotenv from "dotenv";

dotenv.config();
function getEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
    throw new Error("Ошибка! Потеряны значения в '.env'!");
    }

    return value;
}

export const config = {
    DISCORD_TOKEN: getEnv("DISCORD_TOKEN"),
    DISCORD_CLIENT_ID: getEnv("DISCORD_CLIENT_ID"),
};