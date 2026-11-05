FROM node:22-trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN npx firebase setup:emulators:firestore

COPY functions/package.json functions/package-lock.json ./functions/
RUN npm --prefix functions ci

COPY . .

EXPOSE 4000 5001 5175 5176 8180 9099

CMD ["npm", "run", "dev:staging"]
