FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    PDF_OUTPUT_DIR=/data/pdfs

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY src-web ./src-web
COPY agents ./agents
COPY docs ./docs
COPY examples ./examples
COPY dist-v6/resources ./dist-v6/resources
COPY ui5.yaml AGENTS.md README.md README.es.md LICENSE NOTICE THIRD_PARTY_NOTICES.md ./

WORKDIR /workspace/examples/deferred/node
RUN npm install --omit=dev

RUN mkdir -p /data/pdfs && chown -R node:node /data /workspace
USER node
EXPOSE 3001
CMD ["node", "src/server.mjs"]
