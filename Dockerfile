FROM node:18

WORKDIR /app

RUN apt update && apt install -y \
    python

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]