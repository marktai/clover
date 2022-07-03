FROM python:3.10-rc-alpine

####
# Install Poetry
####
RUN apk add curl
ENV BASE_POETRY_VERSION=1.1.13
RUN echo Installing poetry $BASE_POETRY_VERSION \
      && curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python3 - --version $BASE_POETRY_VERSION
ENV PATH /root/.poetry/bin:$PATH

ENV DJANGO_PRODUCTION=false
ENV PYTHONUNBUFFERED 1

RUN apk add --no-cache libpq postgresql-dev build-base zlib-dev jpeg-dev tiff-dev freetype-dev libwebp-dev py-boto postgresql-client

RUN mkdir /logs
RUN mkdir /logs/gunicorn

ADD . /app/backend
WORKDIR /app/backend

EXPOSE 80

RUN poetry install

CMD ["/bin/sh","/app/backend/initialize.sh"]
