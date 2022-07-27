FROM node:16-buster
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y \
	build-essential\
	libcairo2-dev\
	libpango1.0-dev\
	libjpeg-dev\
	libgif-dev\
	librsvg2-dev\
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --omit=dev

COPY . .

CMD [ "node", "index.js" ]
