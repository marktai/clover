from django.contrib import admin
from django.utils.html import mark_safe

from backend.games import models

# Register your models here.

# @admin.register(models.Game)
# class GameAdmin(admin.ModelAdmin):
#     fields = ('white_player', 'black_player', 'board_link', 'turn_count', 'created_time', 'last_updated_time')
#     readonly_fields = ('board', 'board_link', 'turn_count', 'created_time', 'last_updated_time')

#     def board_link(self, obj):
#         url = '../../../board/%d/change' % obj.board.id
#         return mark_safe('<a href="%s">%s</a>' % (url, obj.board.fen))


@admin.register(models.Board)
class BoardAdmin(admin.ModelAdmin):
    pass

@admin.register(models.BoardClientState)
class BoardClientStateAdmin(admin.ModelAdmin):
    pass

@admin.register(models.BoardGuess)
class BoardGuessAdmin(admin.ModelAdmin):
    pass
    # fields = ('fen', 'turn_count', 'game_link', 'created_time', 'last_updated_time')
    # readonly_fields = ('game_link', 'created_time', 'last_updated_time')

    # def game_link(self, obj):
    #     url = '../../../game/%d/change' % obj.game.id
    #     return mark_safe('<a href="%s">%s</a>' % (url, obj.game))


@admin.register(models.WordList)
class WordListAdmin(admin.ModelAdmin):
    pass
