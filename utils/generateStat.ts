import { createCanvas, GlobalFonts, Image } from "@napi-rs/canvas";
import path from "path";
import fs from 'fs';
import { formatTime } from "../commands/stats";
import { achievements } from './achievments';
import { getServerTimeInfo } from "./getServerTime";


const fontPath = path.join(__dirname, "../assets/fonts/", 'jacobSans.ttf');

const emojifontPath = path.join(__dirname, "../assets/fonts/", 'segoeEmoji.ttf');

if (fs.existsSync(fontPath)) {
    const registered = GlobalFonts.registerFromPath(fontPath, 'JacobSans');
        if (registered){
                console.log('✅ Шрифт зарегистрирован:', fontPath);
        }else {
            console.error('⚠️ Не удалось зарегестрировать шрифт (возможно поврежден):', fontPath);
        }
}else{
    console.error('❌ Шрифт не найден по пути:', fontPath);
    console.error('📂 Существующие файлы:', fs.readdirSync(path.dirname(fontPath)));
}

if (fs.existsSync(emojifontPath)) {
    const registered = GlobalFonts.registerFromPath(emojifontPath, 'NotoEmoji');
        if (registered){
                console.log('✅ Шрифт зарегистрирован:', emojifontPath);
        }else {
            console.error('⚠️ Не удалось зарегестрировать шрифт (возможно поврежден):', emojifontPath);
        }
}else{
    console.error('❌ Шрифт не найден по пути:', emojifontPath);
    console.error('📂 Существующие файлы:', fs.readdirSync(path.dirname(emojifontPath)));
}


    // Функция для скруглённых прямоугольников
    function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

function drawInfoBlock(
    ctx: any, 
    x: number, y: number, w: number, h: number, 
    icon: string, label: string, sublabel: string, value: string, 
    accentColor: string = '#6366f1'
) {
    ctx.save();

    // 1. Фон блока (полупрозрачный)
    ctx.fillStyle = 'rgba(20, 20, 40, 0.4)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();

    // 2. Обводка + лёгкое свечение
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.shadowBlur = 0; // Сброс свечения для остальных элементов

    // 3. Акцентная линия сверху
    ctx.beginPath();
    ctx.moveTo(x + 15, y);
    ctx.lineTo(x + w - 15, y);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 4. Иконка

        // Вычисляем центральную точку
    const centerX = x + w / 2;
    const centerY = y + h / 2 - 5;

    ctx.fillStyle = accentColor;
    ctx.font = '28px Segoe UI Emoji';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(icon, centerX, centerY - 45);

    // 5. Заголовок
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 24px JacobSans'
    ctx.textAlign = "center";
    ctx.textBaseline = 'top';
    ctx.fillText(label, centerX, y + 48);

    // Sublabel
    if (sublabel && sublabel.length > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px JacobSans';
        ctx.textAlign = 'center';
        ctx.fillText(sublabel, centerX, centerY + 50);
    }

    // 6. Значение
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px JacobSans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(value, centerX, y + 80);

    ctx.restore();
}

function drawDiscordRole(
    ctx: any,
    x: number,
    y: number,
    roleName: string,
    roleColor: string,
    hasDot: boolean = true,      // зелёная точка
    hasCross: boolean = true     // крестик справа
) {
    ctx.save();
    
    // Конвертируем цвет роли
    const hexColor = roleColor === '#000000' ? '#95a5a6' : roleColor;
    
    // Настройка шрифта
    ctx.font = 'bold 18px JacobSans';
    ctx.textBaseline = 'middle';
    
    // Измеряем текст
    const textMetrics = ctx.measureText(roleName);
    const textWidth = textMetrics.width;
    
    // Рассчитываем ширину pill
    const dotSize = 12;
    const dotGap = 8;
    const crossSize = 14;
    const crossGap = 8;
    const paddingH = 10;
    const paddingV = 8;
    
    const pillWidth = (hasDot ? dotSize + dotGap : 0) + textWidth + (hasCross ? crossGap + crossSize : 0) + (paddingH * 2);
    const pillHeight = 28;
    const pillX = x - pillWidth / 2;
    const pillY = y - pillHeight / 2;
    const cornerRadius = pillHeight / 2;
    
    // Фон pill (тёмный, как в Discord)
    ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
    roundRect(ctx, pillX, pillY, pillWidth, pillHeight, cornerRadius);
    ctx.fill();
    
    // Обводка pill (тонкая, с цветом роли)
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 1.5;
    roundRect(ctx, pillX, pillY, pillWidth, pillHeight, cornerRadius);
    ctx.stroke();
    
    // Зелёная точка-индикатор (слева)
    if (hasDot) {
        const dotX = pillX + paddingH + dotSize / 2;
        const dotY = pillY + pillHeight / 2;
        
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e'; // Discord online green
        ctx.fill();
    }
    
    // Текст роли (белый, как в Discord)
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(
        roleName, 
        pillX + paddingH + (hasDot ? dotSize + dotGap : 0), 
        pillY + pillHeight / 2 + 1
    );
    
    // Крестик × справа (как в Discord)
    if (hasCross) {
        const crossX = pillX + pillWidth - paddingH - crossSize / 2;
        const crossY = pillY + pillHeight / 2;
        const crossLen = 5;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        // Линия 1
        ctx.beginPath();
        ctx.moveTo(crossX - crossLen, crossY - crossLen);
        ctx.lineTo(crossX + crossLen, crossY + crossLen);
        ctx.stroke();
        
        // Линия 2
        ctx.beginPath();
        ctx.moveTo(crossX + crossLen, crossY - crossLen);
        ctx.lineTo(crossX - crossLen, crossY + crossLen);
        ctx.stroke();
    }
    
    ctx.restore();
}

export async function generateStatsCard(
    username: string, 
    messages: number, 
    voiceTime: number, 
    coins: number, 
    xp: number, 
    level: number, 
    avatarURL: string, 
    status: string, 
    joinedAt: string | null, 
    userAchievements: string[] | undefined, 
    moderatorStats: any,
    userRole: any = null,
    repStats: { received: number; given: number },
    warnCount: number,
    highestRole: any = null,
): Promise<Buffer> {

        // ==================== КОНФИГУРАЦИЯ ====================
    const serverTime = getServerTimeInfo(joinedAt);
    const config = {
        width: 1200,
        height: 800,
        avatar: { x: 100, y: 80, radius: 60 },
        header: { height: 130 },
        blocks: {
            width: 280,
            height: 140,
            gap: 20,
            padding: { top: 240, left: 25 },
            cols: 2 // Количество колонок
        },
        containers: {
            opacity: 0.4,
            strokeOpacity: 0.3,
            radius: 16
        }
    };

    const { width, height } = config;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
        // ==================== КОНФИГУРАЦИЯ ====================

    const statusColors: Record<string, string> = {
        online: '#22c55e',    // 🟢 Зелёный (в сети)
        idle: '#eab308',      // 🟡 Жёлтый (неактивен)
        dnd: '#ef4444',       // 🔴 Красный (не беспокоить)
        offline: '#6b7280',   // Серый (не в сети)
    }

    const statusColor = statusColors[status];


    // ==================== ФОН ====================
    // Градиентный фон
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Декор
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#6366f1";
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 3 + 1;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    ctx.globalAlpha = 1;
    // ==================== ФОН ====================

    // ==================== ДАННЫЕ ====================
    const blocksData = [
        { icon: '💢', label: 'РЕПУТАЦИЯ', subLabel: '', value: `${repStats.received}`, color: '#56e4f9' },
        { icon: '☠️', label: 'DEZ', subLabel: '', value: `${coins}`, color: '#8b5cf6' },
        { icon: '⏱️', label: 'ГОЛОС', subLabel: '(за все время)', value: formatTime(voiceTime), color: '#22c55e' },
        { icon: '💬', label: 'СООБЩЕНИЯ', subLabel: '(за все время)', value: `${messages}`, color: '#f59e0b' },
        { icon: '📜', label: 'ДНЕЙ НА СЕРВЕРЕ', subLabel: '(всего)', value: `${serverTime.days}`, color: '#64448c' },
        { icon: '💫', label: 'РОЛЬ', subLabel: '', value: ``, color: '#ff46ac' },
    ];
    // ==================== ДАННЫЕ ====================
        // ==================== РАСЧЁТ СЕТКИ ====================
    const { blocks: blockConfig } = config;
    const totalCols = blockConfig.cols;
    const totalRows = Math.ceil(blocksData.length / totalCols);
    
    // Автоматический расчёт ширины контейнера
    const leftContainerWidth = (blockConfig.width * totalCols) + (blockConfig.gap * (totalCols - 1));
    const leftContainerHeight = (blockConfig.height * totalRows) + (blockConfig.gap * (totalRows - 1));
    const leftContainerX = config.avatar.x - 66;
    const leftContainerY = blockConfig.padding.top;

    // ==================== ОТРИСОВКА КОНТЕЙНЕРА левый ====================
    ctx.fillStyle = `rgba(40, 40, 80, ${config.containers.opacity})`;
    ctx.strokeStyle = `rgba(150, 150, 255, ${config.containers.strokeOpacity})`;
    ctx.lineWidth = 2;
    roundRect(ctx, leftContainerX - 15, leftContainerY - 15, leftContainerWidth + 30, leftContainerHeight + 30, config.containers.radius);
    ctx.fill();
    ctx.stroke();

    const rightContainerTopWidth = (blockConfig.width * totalCols) + (blockConfig.gap * (totalCols - 1));
    const rightContainerTopHeight = (leftContainerHeight - config.blocks.gap) / 2;
    const rightContainerTopX = leftContainerX + leftContainerWidth + blockConfig.gap;
    const rightContainerTopY = blockConfig.padding.top;

        // ==================== ОТРИСОВКА КОНТЕЙНЕРА правый====================
    ctx.fillStyle = `rgba(40, 40, 80, ${config.containers.opacity})`;
    ctx.strokeStyle = `rgba(150, 150, 255, ${config.containers.strokeOpacity})`;
    ctx.lineWidth = 2;
    roundRect(ctx, rightContainerTopX + 30, rightContainerTopY - 15, rightContainerTopWidth - 60, rightContainerTopHeight, config.containers.radius);
    ctx.fill();
    ctx.stroke();

    const rightContainerBottomWidth = (blockConfig.width * totalCols) + (blockConfig.gap * (totalCols - 1));
    const rightContainerBottomHeight = (leftContainerHeight - config.blocks.gap) / 2;
    const rightContainerBottomX = leftContainerX + leftContainerWidth + blockConfig.gap;
    const rightContainerBottomY = blockConfig.padding.top + rightContainerTopY + blockConfig.gap;

        // ==================== ОТРИСОВКА КОНТЕЙНЕРА правый====================
    ctx.fillStyle = `rgba(40, 40, 80, ${config.containers.opacity})`;
    ctx.strokeStyle = `rgba(150, 150, 255, ${config.containers.strokeOpacity})`;
    ctx.lineWidth = 2;
    roundRect(ctx, rightContainerBottomX + 30, rightContainerBottomY - 5, rightContainerBottomWidth - 60, rightContainerBottomHeight, config.containers.radius);
    ctx.fill();
    ctx.stroke();


    async function drawAchievementsBlock(
        ctx: any, x: number, y: number, w: number, h: number, userAchievements: string[]) // массив ID разблокированных достижений 
        {
        ctx.save();
        
        // Вычисляем центральную точку
        const centerX = x + w / 2;
        const centerY = y + h / 2 - 5;

        // Заголовок
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = 'bold 24px JacobSans'
        ctx.textAlign = "center";
        ctx.textBaseline = 'top';
        ctx.fillText("Достижения", centerX, y);
    
        // Иконки достижений
        const iconSize = 60;
        const iconGap = 20;
        const startX = x + 45;
        const startY = y + 40;
        
        achievements.forEach((achievement, index) => {
            const isUnlocked = userAchievements.includes(achievement.id);
            const opacity = isUnlocked ? 1 : 0.4;
            
            const iconX = startX + (index * (iconSize + iconGap));
            const iconY = startY;
            
            // Фон иконки
            ctx.globalAlpha = opacity;
            ctx.fillStyle = isUnlocked ? 'rgba(100, 100, 100, 1)' : 'rgba(100, 100, 100, 0.2)';
            roundRect(ctx, iconX, iconY, iconSize, iconSize, 12);
            ctx.fill();
            
            // Обводка
            ctx.strokeStyle = isUnlocked ? achievement.id === 'beta_tester' ? '#a855f7' : 
                            achievement.id === 'one_year' ? '#3b82f6' : '#22c55e' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 2;
            roundRect(ctx, iconX, iconY, iconSize, iconSize, 12);
            ctx.stroke();
            
            // Иконка (emoji)
            ctx.font = '42px Segoe UI Emoji';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(achievement.icon, iconX + iconSize / 2, iconY + iconSize / 2);
            
            // Название под иконкой
            ctx.font = '18px JacobSans';
            ctx.fillStyle = isUnlocked ? '#ffffff' : 'rgba(255,255,255,0.4)';
            ctx.fillText(achievement.name, iconX + iconSize / 2, iconY + iconSize + 15);
        });
        
        ctx.globalAlpha = 1;
        ctx.restore();

        
    }
        // Отрисовка достижений в правом верхнем блоке
    await drawAchievementsBlock(ctx, rightContainerTopX, rightContainerTopY, rightContainerTopWidth, rightContainerTopHeight, userAchievements || []);

    // ==================== ОТРИСОВКА БЛОКОВ ====================
    blocksData.forEach((block, index) => {
        const col = index % totalCols;
        const row = Math.floor(index / totalCols);

        const x = leftContainerX + col * (blockConfig.width + blockConfig.gap);
        const y = leftContainerY + row * (blockConfig.height + blockConfig.gap);

        drawInfoBlock(ctx, x, y, blockConfig.width, blockConfig.height, 
            block.icon, block.label, block.subLabel, block.value, block.color);
    });

        // После отрисовки blocksData, найди координаты блока РОЛЬ (5-й блок, index 4)
    const roleBlockIndex = 5;
    const roleCol = roleBlockIndex % totalCols;
    const roleRow = Math.floor(roleBlockIndex / totalCols);
    const roleX = leftContainerX + roleCol * (blockConfig.width + blockConfig.gap) + blockConfig.width / 2;
    const roleY = leftContainerY + roleRow * (blockConfig.height + blockConfig.gap) + blockConfig.height / 2;

    // Рисуем Discord-роль
    if (highestRole && highestRole.id !== 'everyone') {
        drawDiscordRole(ctx, roleX, roleY + blockConfig.gap, highestRole.name, highestRole.hexColor, true, false);
    } else {
        // Если нет роли или @everyone
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '16px JacobSans';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Нет роли', roleX, roleY);
    }

    // ==================== АВATAR И HEADER ====================
    await drawHeaderAndAvatar(ctx, canvas, config, username, avatarURL, status, warnCount);

    return canvas.toBuffer('image/png');

// Вынесли отрисовку шапки в отдельную функцию
async function drawHeaderAndAvatar(
    ctx: any,
    canvas: any, 
    config: any, 
    username: string, 
    avatarURL: string, 
    status: string,
    warnCount: number,
) {
    const { width, height, avatar, header } = config;
    const statusColors: Record<string, string> = {
        online: '#22c55e',
        idle: '#eab308',
        dnd: '#ef4444',
        offline: '#6b7280',
    };
    const statusColor = statusColors[status];

    try {
        const avatarImg = new Image();
        avatarImg.src = avatarURL;
        await new Promise<void>((resolve, reject) => {
            avatarImg.onload = () => resolve();
            avatarImg.onerror = reject;
        });

        // Фон header
        const headerWidth = width - 30;
        const headerX = avatar.x - 85;
        const headerY = avatar.y - 70;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        roundRect(ctx, headerX, headerY + 5, headerWidth, header.height, 10);
        ctx.fill();
        ctx.stroke();

        // Аватар
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, avatar.x - avatar.radius, avatar.y - avatar.radius, 
            avatar.radius * 2, avatar.radius * 2);
        ctx.restore();

        // Обводка аватара
        ctx.beginPath();
        ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
        ctx.strokeStyle = statusColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.save();
        ctx.shadowColor = statusColor;
        ctx.shadowBlur = 40;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px JacobSans';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(username, avatar.x + avatar.radius + 10, avatar.y);

        // Статус
        let statusText = { online: 'В сети', idle: 'Неактивен', dnd: 'Не беспокоить', offline: 'Не в сети' }[status] || 'Не в сети';
        ctx.fillStyle = statusColor;
        ctx.font = 'bold 18px NotoEmoji';
        ctx.fillText('● ', avatar.x + avatar.radius + 10, avatar.y + 41);
        ctx.font = 'bold 24px JacobSans';
        ctx.fillText(statusText, avatar.x + avatar.radius + 30, avatar.y + 40);

            // 🔹 БАДЖ МОДЕРАТОРА (если есть рейтинг)
        if(userRole && userRole.id !== 'everyone') {
            ctx.save();
            const roleName = userRole.name;
            const roleColor = userRole.hexColor || '#95a5a6';

            ctx.fillStyle = roleColor;
            ctx.font = 'bold 18px NotoEmoji';
            ctx.fillText('🛡️ ', avatar.x + avatar.radius, avatar.y - 41);
            ctx.font = 'bold 20px JacobSans';
            ctx.fillText(roleName.toUpperCase(), avatar.x + avatar.radius + 25, avatar.y - 41);

            if (moderatorStats) {
                // Рейтинг звёздами
                const maxLengthRow = roleName.length;
                const starsCount = Math.round(moderatorStats.avg_rating || 0);
                const stars = '⭐'.repeat(Math.round(moderatorStats.avg_rating));
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 18px NotoEmoji';
                ctx.fillText(`${stars}`, avatar.x + avatar.radius + (maxLengthRow * 18), avatar.y - 41);
                ctx.font = 'bold 18px "JacobSans"';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`${moderatorStats.avg_rating.toFixed(1)}/5`, avatar.x + avatar.radius + (maxLengthRow * 18) + (starsCount * 32), avatar.y - 41);

                ctx.restore();
            }
        }
        if (warnCount > 0) {
            const padding = 40;
            const boxW = 95;
            const boxH = 55;
            const boxX = canvas.width - boxW - padding;
            const boxY = padding;

            // Фон (красный оттенок, как у предупреждений)
            ctx.fillStyle = "rgba(230, 60, 60, 0.12)";
            ctx.beginPath();
            roundRect(ctx, boxX, boxY, boxW, boxH, 10);
            ctx.fill();

            // Тонкая обводка
            ctx.strokeStyle = "rgba(230, 60, 60, 0.5)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Иконка ⚠️
            ctx.font = "18px NotoEmoji";
            ctx.fillStyle = "#FF5555";
            ctx.fillText("⚠️", boxX + 12, boxY + 28);

            // Число варнов
            ctx.font = "bold 20px JacobSans";
            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "right";
            ctx.fillText(`${warnCount.toString()}/3`, boxX + boxW - 14, boxY + 28);

            ctx.restore();
        }
        

    } catch (err) {
            // Заглушка если аватар не загрузился
            ctx.beginPath();
            ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#5865f2';
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 60px JacobSans';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(username.charAt(0).toUpperCase(), avatar.x, avatar.y);
        }
    }
}