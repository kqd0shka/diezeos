// import puppeteer from 'puppeteer';

// export async function generateFromHTML(html: string): Promise<Buffer> {
//     // ⚠️ В продакшене браузер нужно запускать один раз и переиспользовать
//     const browser = await puppeteer.launch({
//         headless: true,
//         args: ['--no-sandbox', '--disable-setuid-sandbox'],
//     });

//     const page = await browser.newPage();
//     await page.setViewport({ width: 1000, height: 600 });
    
//     // Вставляем HTML напрямую
//     await page.setContent(html, { waitUntil: 'load' });
    
//     const buffer = await page.screenshot({ type: 'png' });
//     await browser.close();
//     return Buffer.from(buffer);
//     }

// // Пример вызова:
// // const html = `<style>body{background:#1e1e2e;color:#fff;font-family:sans-serif;padding:20px;}</style><h1>Статистика</h1>`;
// // const img = await generateFromHTML(html);