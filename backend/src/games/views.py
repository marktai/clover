# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import random, string, re

from django.shortcuts import render, get_object_or_404

# Create your views here.

from rest_framework import viewsets, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser

from django.contrib.auth.models import User, Group
from django.db import transaction
from django.conf import settings
from django.db.models import Q
from django.shortcuts import redirect
from django.http import Http404


from .serializers import *
from .models import *

import requests

class BoardViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows games to be viewed or edited
    """
    serializer_class = BoardSerializer
    queryset = Board.objects.all()

    def list(self, request):
        q = self.queryset.filter(clues__isnull=False).order_by('-last_updated_time')
        serializer = self.serializer_class(q, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        new_board = Board.objects.create_board()
        return Response(BoardSerializer(new_board).data)

    def update(self, *args, **kwargs):
        ret = super().update(*args, **kwargs)

        # update on websockets
        requests.post(
            'http://websockets/broadcast/list',
            json={'type': 'LIST_UPDATE'},
        )
        return ret


class MakeGuessView(APIView):
    def post(self, request, *args, **kwargs):
        board = get_object_or_404(Board, id=kwargs['game_id'])
        result = board.check_guess(request.data['guess'])

        BoardGuess.objects.create(
            board_id=board.id,
            data=request.data['guess'],
            client_id=request.data.get('client_id', ''),
        )

        return Response({'results': result})

class DailyGameView(APIView):
    def get(self, request, *args, **kwargs):
        daily = Board.objects.daily()

        return Response(BoardSerializer(daily).data)

class BoardClientStateView(APIView):
    def get(self, request, *args, **kwargs):
        client_state = BoardClientState.objects.get_latest(board_id=kwargs['game_id'])

        if client_state is None:
            raise Http404("Board %s has no client state" % kwargs['game_id'])

        return Response(BoardClientStateSerializer(client_state).data)


    def post(self, request, *args, **kwargs):
        client_state = BoardClientState.objects.create(board_id=kwargs['game_id'], **request.data)

        # update on websockets
        requests.post(
            'http://websockets/broadcast/%s' % kwargs['game_id'],
            json={'type': 'GAME_UPDATE', 'data': BoardClientStateSerializer(client_state).data},
        )

        return Response(BoardClientStateSerializer(client_state).data)
