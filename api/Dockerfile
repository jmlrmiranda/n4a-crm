FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache su-exec

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY public ./public
COPY src ./src
COPY entrypoint.sh /app/entrypoint.sh
RUN mkdir -p /app/uploads \
  && chown -R node:node /app/uploads \
  && chmod +x /app/entrypoint.sh

EXPOSE 3000

CMD ["/app/entrypoint.sh"]
