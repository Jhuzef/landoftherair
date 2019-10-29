FROM node:8.9

RUN mkdir /landoftherair

COPY . /landoftherair

WORKDIR /landoftherair

RUN npm install --loglevel=error

EXPOSE 4567 3303

ENTRYPOINT npm run setup && npm start
