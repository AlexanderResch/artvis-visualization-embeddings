FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm install

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]