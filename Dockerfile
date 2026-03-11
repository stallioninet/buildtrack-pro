FROM node:20-slim

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy server package
COPY server/package.json server/

# Install only server dependencies
RUN npm install --workspace=server

# Copy server source
COPY server/ server/

# Seed the database
RUN cd server && node src/db/migrate.js

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server/src/index.js"]
