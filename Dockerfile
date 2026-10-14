# Use official lightweight Node.js 20 LTS on Alpine Linux
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment flag
ENV NODE_ENV=production
ENV PORT=3000

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm install --omit=dev=false

# Copy project source code
COPY . .

# Build the React frontend into /app/dist
RUN npm run build

# Remove development dependencies to keep the image lightweight
RUN npm prune --production

# Expose server port
EXPOSE 3000

# Start ChatHub Node.js backend & frontend server
CMD ["node", "index.js"]
