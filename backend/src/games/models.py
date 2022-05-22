from django.db import models
import json, random, string, os

from django.db import models, transaction
from django_jsonform.models.fields import ArrayField

from rest_framework import exceptions as drf_exceptions
from datetime import datetime, timedelta
import pytz
from django.db.models import Q

dirname, filename = os.path.split(os.path.abspath(__file__))
words_path = os.path.join(dirname, 'words.json')
with open(words_path) as f:
    words = json.load(f)

def chunks(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

class BoardManager(models.Manager):
    def create_board(self, *args, **kwargs):
        cards = list(chunks(random.sample(words, k=Board.CARDS_GENERATED * Board.WORDS_PER_CARD), Board.WORDS_PER_CARD))
        answer = tuple((
            (
                card_index,
                random.randint(0, Board.WORDS_PER_CARD - 1),
            )
            for card_index in random.sample(range(Board.CARDS_GENERATED), k=Board.CARDS_IN_ANSWER)
        ))
        board = self.create(cards=cards, answer=answer, *args, **kwargs)

        return board

    def daily(self):
        la_tz = pytz.timezone('Etc/GMT-7')
        la_now = datetime.now(la_tz).astimezone(la_tz)
        la_day_begin = datetime(la_now.year, la_now.month, la_now.day, tzinfo=la_tz).astimezone(pytz.timezone('UTC'))

        existing = self.filter(
            daily_set_time__gte=la_day_begin,
        ).order_by(
            '-daily_set_time',
        ).first()

        if existing is not None:
            return existing

        new_daily = self.filter(
            ~Q(author=""),
        ).filter(
            daily_set_time__isnull=True,
        ).order_by(
            '-last_updated_time',
        ).first()

        new_daily.daily_set_time = la_now

        self.filter(id=new_daily.id).update(daily_set_time=la_now)

        return new_daily

class Board(models.Model):
    WORDS_PER_CARD = 4
    CARDS_IN_ANSWER = 4
    CARDS_GENERATED = 20

    objects = BoardManager()

    # game = models.ForeignKey(Game, on_delete=models.CASCADE)
    created_time = models.DateTimeField(auto_now_add=True)
    last_updated_time = models.DateTimeField(auto_now=True)
    clues = ArrayField(
        models.CharField(max_length=20, blank=True),
        size=CARDS_IN_ANSWER,
        null=True,
    )
    cards = ArrayField(
        ArrayField(
            models.CharField(max_length=20),
            size=WORDS_PER_CARD,
        ),
        size=CARDS_GENERATED,
    )

    # ( (card_index, word_rotation_offset), ... )
    # eg ((5, 2), (2, 1), (0, 1), (3, 0))
    answer = ArrayField(
        ArrayField(
            models.IntegerField(),
            size=2,
        ),
        size=CARDS_IN_ANSWER,
    )

    suggested_num_cards = models.IntegerField(null=True)
    author = models.CharField(max_length=50, blank=True)
    daily_set_time = models.DateTimeField(null=True)

    @property
    def answer_cards(self):
        return tuple((
            self.cards[card_index][word_rotation_offset:] + self.cards[card_index][:word_rotation_offset]
            for (card_index, word_rotation_offset) in self.answer
        ))

    @property
    def suggested_possible_cards(self):
        if self.suggested_num_cards is None:
            return None
        return self.possible_cards(self.suggested_num_cards)

    def possible_cards(self, n):
        answer_cards = tuple((
            tuple(self.cards[card_index]) for (card_index, _) in self.answer
        ))
        answer_cards_set = set(answer_cards)
        non_answer_cards = tuple((
            tuple(x) for x in self.cards if tuple(x) not in answer_cards
        ))

        num_non_answer_cards = min(
            max(
                n - len(answer_cards),
                0,
            ),
            len(self.cards) - len(answer_cards),
        )

        return tuple(sorted(
            tuple(answer_cards + non_answer_cards[0:num_non_answer_cards]),
            key = lambda x: hash(tuple(x)),
        ))

    @property
    def answer_from_suggested_cards(self):
        if self.suggested_num_cards is None:
            return None
        return self.answer_from_possible_cards(self.suggested_num_cards)

    def answer_from_possible_cards(self, n):
        possible_cards = self.possible_cards(n)

        return [
            [possible_cards.index(tuple(self.cards[ans[0]])), ans[1]]
            for ans in self.answer
        ]

    def __str__(self):
        return '%s\'s game %d with clues: %s and answer: %s' % (self.author, self.id, str(self.clues), str(self.answer_cards))

    def check_guess(self, guess_answers, n=None):
        if n is None:
            n = self.suggested_num_cards
        answer = self.answer_from_possible_cards(n)

        resp = []
        for i in range(len(answer)):
            cur = None
            if i >= len(guess_answers):
                cur = 0
            elif tuple(answer[i]) == tuple(guess_answers[i]):
                cur = 1
            elif answer[i][0] == guess_answers[i][0]:
                cur = 2
            else:
                cur = 0
            resp.append(cur)
        return resp


class BoardClientStateManager(models.Manager):
    def get_latest(self, board_id):
        return self.filter(board=board_id, created_time__gte=(datetime.now() - timedelta(minutes=5))).order_by('-id').first()

class BoardClientState(models.Model):
    objects = BoardClientStateManager()

    board = models.ForeignKey(Board, on_delete=models.CASCADE)
    created_time = models.DateTimeField(auto_now_add=True)
    data = models.JSONField()
    client_id = models.CharField(max_length=50)

