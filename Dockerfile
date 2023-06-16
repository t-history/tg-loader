FROM ubuntu:20.04

RUN apt-get update && \
    apt-get install -y python3 make g++ openssl curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
