FROM node:12-slim AS build

WORKDIR /usr/src/app

COPY . .

RUN npm install

RUN npm run build

FROM node:12-slim

COPY package*.json ./

COPY .env .

COPY --from=build /usr/src/app/dist .

RUN npm install --only=prod

CMD npm run prod
