FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
USER node
ENV WORLD_BIND_HOST=0.0.0.0 WORLD_PORT=8080
EXPOSE 8080
CMD ["node", "src/server.ts"]
