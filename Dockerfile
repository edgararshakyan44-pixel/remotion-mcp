FROM ghcr.io/remotion-dev/base:latest

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy server files
COPY server.js ./
COPY index.js ./

# Expose port
EXPOSE 3000

# Start HTTP server
CMD ["node", "server.js"]
