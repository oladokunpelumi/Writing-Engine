# Co-Create — single-service image: Express serves the API + the built client.
# Postgres is the datastore (via DATABASE_URL); no local DB file or image disk.
FROM node:22-slim

WORKDIR /app

# Install all deps first (dev included: tsx runs the server, vite builds the client).
# Copy only manifests so this layer caches until a dependency changes.
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci

# App source, then build the client bundle into client/dist.
COPY . .
RUN npm run build -w client

# Runtime config. NODE_ENV is set only now so npm ci above kept devDependencies.
# DATABASE_URL (managed Postgres) is provided by the host; PORT is host-injected.
ENV NODE_ENV=production
ENV PORT=4187

EXPOSE 4187
# tsx runs the TypeScript server directly (it imports the shared TS sources).
CMD ["npx", "tsx", "server/src/index.ts"]
