#:/bin/bash
rm -rf dist/*
echo "syncing" >dist/info.txt
rm -f .npmrc
rm -f package-lock.json
rm -f yarn.lock
mkdir dist

node index.js

cd dist
yarn cache clean
yarn config list
yarn --verbose
date +%s >info.txt
cat info.txt
cd .. || exit
