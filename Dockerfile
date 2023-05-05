ARG PLATFORM="linux/amd64"
ARG BASE_IMAGE="node:lts-alpine"

# Base image information
FROM --platform=${PLATFORM} ${BASE_IMAGE}

WORKDIR /app

# Copy the index from dist
COPY dist/* /app/

COPY openapi.yaml /app/

CMD ["node", "index.js"]
