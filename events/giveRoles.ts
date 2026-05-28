import { Client, GuildMember, EmbedBuilder } from "discord.js";
import { db } from "../database/database";

const ROLE_ID1000h = "1503696150253797416";

export async function giveVoiceRoles(
    client: Client,
    member: GuildMember,
    userId: string
) {
            const user = db.prepare(`
                SELECT voiceTime, notified_1000h
                FROM users
                WHERE userId = ?
            `).get(userId) as { 
                voiceTime: number;
                notified_1000h: number };
            // 1000 часов = 3 600 000 секунд
            if (user.voiceTime < 3600000){
                return;
            }else{
                    // уже есть роль
                if (member.roles.cache.has(ROLE_ID1000h)) return;

                const role = member.guild.roles.cache.get(ROLE_ID1000h);
                    if (!role) return;
                    await member.roles.add(role);
                    if (!user.notified_1000h) {
                            const embed = new EmbedBuilder()
                                .setTitle("🏆 Новая роль!")
                                .setDescription(`Ты получил **<@&${role.name}>** за 1000 часов в voice!`)
                                .setColor("Gold");
                            await member.user.send({ embeds: [embed] }).catch(() => {});
                        console.log(`${member.user.username} получил роль за 1000 часов`);
                        db.prepare(`
                            UPDATE users 
                            SET notified_1000h = 1 
                            WHERE userId = ?
                            `).run(userId);
                    }else{
                        return;
                    }
                };
    }
