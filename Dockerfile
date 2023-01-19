FROM ubuntu:latest

RUN apt update && apt upgrade
RUN apt install wget -y
RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

RUN bash -c "source /root/.nvm/nvm.sh && nvm install 16"


WORKDIR /app

COPY package.json package-lock.json ./

RUN bash -c "source /root/.nvm/nvm.sh && nvm use 16 && npm install"

CMD [ "bash", "-c", " cd /root/.nvm && ls && source ./nvm.sh && echo ';' &&  command -v nvm" ]

# CMD ["bash", "-c", "export NVM_DIR=$HOME/.nvm; [ -s $NVM_DIR/nvm.sh ] && source && cd /root  ./nvm.sh install 16"]
