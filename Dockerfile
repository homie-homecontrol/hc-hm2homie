FROM  --platform=$BUILDPLATFORM node:18-alpine as serverbuild
ARG BUILDPLATFORM

COPY . /service/
WORKDIR /service/
RUN yarn --pure-lockfile
RUN yarn run gulp prod

FROM node:18-alpine
COPY --from=serverbuild /service/dist/ /service/
WORKDIR /service/
RUN yarn --pure-lockfile --production=true


EXPOSE 9125

WORKDIR /service/
CMD ["node", "service.js"]
