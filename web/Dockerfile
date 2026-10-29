# Web image: builds the React client (served at /) and the web export of the Expo app (served at /mobile/) and serves both
# with nginx, which also proxies /api and /health to the API service. Build context is the repository root (npm
# workspaces): docker build -f web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /src
ENV CI=1 EXPO_NO_TELEMETRY=1
COPY package.json .npmrc ./
COPY web/package.json web/
COPY mobile/package.json mobile/
RUN npm install --no-audit --no-fund
COPY web/ web/
COPY mobile/ mobile/
RUN npm run build --workspace web && npm run build --workspace mobile

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/web/dist /usr/share/nginx/html
COPY --from=build /src/mobile/dist /usr/share/nginx/html/mobile
EXPOSE 8080
