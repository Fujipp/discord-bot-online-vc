FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# prestart จะรัน deploy-commands ให้อัตโนมัติก่อน start
CMD ["npm", "start"]
