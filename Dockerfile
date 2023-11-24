FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/app/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
EXPOSE 3012
RUN chown -R node /usr/app/app
USER node
CMD ["npm","run", "dev"]
