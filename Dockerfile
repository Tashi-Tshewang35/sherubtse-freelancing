FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
# bcrypt may compile on Alpine when a prebuilt binary is unavailable.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["node", "server.js"]
