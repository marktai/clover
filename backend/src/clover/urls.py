"""clover URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path, re_path
from rest_framework import routers
from games import views
admin.autodiscover()
from rest_framework.routers import SimpleRouter


class OptionalSlashRouter(SimpleRouter):
    def __init__(self):
        super().__init__()
        self.trailing_slash = '/?'

router = OptionalSlashRouter()

router.register('games', views.BoardViewSet, basename='Board')

urlpatterns = [
    path('admin/', admin.site.urls),
    re_path('games/(?P<game_id>[0-9]+)/guess', views.MakeGuessView.as_view(), name='make_guess'),
    re_path('games/(?P<game_id>[0-9]+)/client_state', views.BoardClientStateView.as_view(), name='make_guess'),
    path('games/daily', views.DailyGameView.as_view(), name='daily'),
    path('', include(router.urls)),
]
