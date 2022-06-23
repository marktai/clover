FROM ubuntu:latest
RUN apt-get update && apt-get -y install cron curl

# Copy cron file to the cron.d directory
COPY cron /etc/cron.d/cron

# Give execution rights on the cron job
RUN chmod 0644 /etc/cron.d/cron

# Apply cron job
RUN crontab /etc/cron.d/cron

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

CMD ["cron", "-f"]
