#!/bin/bash
# This script initializes the Django project. It will be executed (from
# supervisord) every time the Docker image is run.

set -euxo pipefail

if [[ -z ${SECRET_KEY:-} ]]; then
  export SECRET_KEY='"$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)"'
  echo $(pwd)"SECRET_KEY generated"
fi

while ! pg_isready -U postgres -h db -p 5432; do
  sleep 5
done

poetry run python manage.py makemigrations
poetry run python manage.py migrate --noinput

printf "from django.contrib.auth.models import User;\nif not User.objects.all().exists(): User.objects.create_superuser('root', 'mark@marktai.com', password='password')" | poetry run python manage.py shell

poetry run python manage.py runserver 0.0.0.0:80
