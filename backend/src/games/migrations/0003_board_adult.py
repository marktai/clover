# Generated by Django 4.0.4 on 2022-06-22 14:24

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0002_boardguess'),
    ]

    operations = [
        migrations.AddField(
            model_name='board',
            name='adult',
            field=models.BooleanField(default=False),
        ),
    ]