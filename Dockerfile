FROM node:12-alpine AS build

WORKDIR /usr/src/app

COPY . .

RUN npm install

RUN npm run build

FROM node:12-alpine

COPY package*.json ./

COPY .env .

COPY --from=build /usr/src/app/dist .

RUN npm install --only=prod

CMD npm run prod
