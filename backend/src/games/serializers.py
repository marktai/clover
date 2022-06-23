from rest_framework import serializers

from . import models

class BoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Board
        fields = ('id', 'author', 'clues', 'cards', 'answer', 'answer_from_suggested_cards', 'answer_cards', 'suggested_num_cards', 'suggested_possible_cards', 'created_time', 'last_updated_time', 'daily_set_time', 'adult',)
        read_only_fields = ('id', 'answer_from_suggested_cards', 'answer_cards', 'suggested_possible_cards', 'created_time', 'last_updated_time', 'daily_set_time', 'adult',)

# class GameSerializer(serializers.ModelSerializer):
#     board = BoardSerializer()
#     turn_count = serializers.IntegerField()

#     class Meta:
#         model = models.Game
#         fields = ('id', 'white_player', 'black_player', 'board', 'created_time', 'last_updated_time', 'turn_count')
#         read_only_fields = ('id', 'turn_count')

class BoardClientStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.BoardClientState
        fields = ('id', 'board_id', 'created_time', 'data', 'client_id')
        read_only_fields = ('id', 'board_id', 'created_time', 'data', 'client_id')
