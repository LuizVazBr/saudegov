#!/bin/bash

# Script to fix permissions and rebuild the application

echo "Starting fix process..."

# 1. Fix Permissions for Image Cache
echo "Fixing permissions for .next/cache..."
sudo chown -R $USER:$USER /var/www/cliv.app/html/triagem/.next/cache
sudo chmod -R 775 /var/www/cliv.app/html/triagem/.next/cache

# 2. Rebuild Application to fix potential corruption (returnNaN error)
echo "Rebuilding application..."
cd /var/www/cliv.app/html/triagem || exit
npm install
npm run build

# 3. Restart PM2 process
echo "Restarting application..."
pm2 restart pretriagem-anamnex

echo "Done! Check logs with: pm2 logs pretriagem-anamnex"
