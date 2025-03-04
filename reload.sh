#!/bin/bash

# Determine environment
env="development"
if [ "$1" == "production" ]; then
    env="production"
fi

pm2 stop ecosystem.config.js
pm2 flush

# In production, stop nginx, pull new changes, and update npm
if [ "$env" == "production" ]; then
    git pull
    npm install
fi

gulp migrate && gulp
pm2 restart ecosystem.config.js --env $env

echo "Commands executed successfully in $env environment."