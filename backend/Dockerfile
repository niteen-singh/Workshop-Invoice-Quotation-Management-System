FROM node:20-alpine

WORKDIR /backend

COPY package*.json ./

RUN apk add --no-cache curl
RUN npm ci

COPY . .

CMD ["sh", "-c", "npm run migrate && npm start"]