FROM node:20

WORKDIR /app
EXPOSE 8090

COPY . .

RUN npm install
RUN npm run build

CMD ["node", "dist/app.js"]
