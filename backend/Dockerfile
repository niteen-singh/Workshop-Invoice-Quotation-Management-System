FROM node:20-alpine

WORKDIR /backend

COPY package*.json ./

RUN npm ci

COPY . .

CMD ["sh", "-c", "npm run migrate && npm start"]