# Use a supported Node.js runtime (22 is current)
FROM node:22

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the rest of the source code
COPY . .

# Expose the port Cloud Run expects
EXPOSE 8080

# Start your app
CMD ["node", "index.js"]
