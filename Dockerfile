FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV LIBREOFFICE_PATH=/usr/bin/libreoffice
ENV PORT=10000

RUN npm run build

EXPOSE 10000

CMD ["npm", "run", "start"]