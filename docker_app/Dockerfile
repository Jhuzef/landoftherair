FROM node:8.9

RUN mkdir /landoftherair

COPY . /landoftherair

WORKDIR /landoftherair

RUN npm install

EXPOSE 4567


ENTRYPOINT npm run setup && npm start
