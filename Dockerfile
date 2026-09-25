FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_DIR=/data

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "server.js"]