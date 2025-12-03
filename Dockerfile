# Use the official Nginx image from Docker Hub
FROM nginx:alpine

# Copy the build output to a directory in the container
COPY dist/ /usr/share/nginx/html

# Copy the custom Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
