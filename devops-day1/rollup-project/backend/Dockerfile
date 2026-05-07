FROM node:18-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Expose the application port
EXPOSE 3000

# Start the Node.js app
CMD ["npm", "start"]
