
FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npx", "tsx", "bot.ts"]
