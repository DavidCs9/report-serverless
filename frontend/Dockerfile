FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./

# Install dependencies using npm ci for cleaner, more reliable builds
# This will install devDependencies by default.
RUN npm ci

# Copy the rest of your application code
# .dockerignore will prevent local node_modules from being copied
COPY . .

EXPOSE 5173

# Your CMD is correct for running Vite with --host
CMD ["npm", "run", "dev", "--", "--host"]