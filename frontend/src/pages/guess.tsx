import React from 'react';
import { useEffect } from 'react';
import CloverService from '../api';
import { GameType, AnswerType, CardType, GuessResponseType, BoardClientState } from '../api';

import { Container, Row, Col, Button, ListGroup } from 'react-bootstrap';

import {
  useParams
} from "react-router-dom";

enum CardState {
  Incorrect,
  Correct,
  CorrectPosition,
}

const pollInterval = 60000;

function rotateArray<T>(a: Array<T>, n: number): Array<T> {
  n = n % a.length;
  return a.slice(n, a.length).concat(a.slice(0, n));
}

type GuessProps = {
  id: string,
};

type GuessState = {
  game: null|GameType,
  guess: {
    cardPositions: Array<AnswerType>,
    currentSelectedCard: null|number,
  },
  previousGuesses: Array<[Array<AnswerType>,GuessResponseType]>,
  copiedToClipboard: boolean,
  guessSubmitted: boolean,
};

export class Guess extends React.Component<GuessProps, GuessState> {
  state: GuessState = {
    game: null,
    guess: {
      cardPositions: [],
      currentSelectedCard: null,
    },
    previousGuesses: [],
    copiedToClipboard: false,
    guessSubmitted: false,
  };

  interval: null|any = null;

  ws: null|WebSocket = null;

  stateKey(): string {
    return `${this.props.id}/state`;
  }

  pushClientState(): Promise<BoardClientState> {
    const data = {
      guess: {
        cardPositions: this.state.guess.cardPositions,
      },
      previousGuesses: this.state.previousGuesses,
      guessSubmitted: this.state.guessSubmitted,
    }
    return CloverService.updateClientState(this.props.id, data)
  }

  async pullClientState(inputClientState: null|BoardClientState = null): Promise<null> {
    let clientState: null|BoardClientState = inputClientState;
    if (clientState === null) {
      clientState = await CloverService.getClientState(this.props.id);
    }

    if (clientState !== null) {
      const newState = {
        ...this.state,
        guess: {
          ...this.state.guess,
          cardPositions: clientState.data.guess.cardPositions,
        },
        previousGuesses: clientState.data.previousGuesses,
        guessSubmitted: clientState.data.guessSubmitted,
      }

      this.setStateWithWrite(newState, false)
      if (this.interval !== null) {
        clearInterval(this.interval);
      }
      this.interval = setInterval(() => { this.pollPushPull() }, pollInterval);
    }

    return null;
  }

  async pollPushPull() {
    const currentClientState = await CloverService.getClientState(this.props.id);
    if (currentClientState === null || currentClientState.client_id === CloverService.getClientId()) {
      this.pushClientState();
    } else {
      this.pullClientState(currentClientState);
    }
  }

  async setStateWithWrite(state:any, shouldUpdateClientState:boolean = true): Promise<any>{
    return this.setState(state, () => {
      localStorage.setItem(this.stateKey(), JSON.stringify(this.state));
      if (shouldUpdateClientState) {
        this.pushClientState();
      }
    });
  }

  async submitGuess() {
    const guess = JSON.parse(JSON.stringify(this.state.guess.cardPositions.slice(0, 4)));
    const response = await CloverService.makeGuess(
      this.props.id,
      guess,
    );
    this.setStateWithWrite({
      previousGuesses: this.state.previousGuesses.concat([
        [guess, response],
      ]),
      copiedToClipboard: false,
      guessSubmitted: true,
    })
  }

  async componentDidMount() {
    const game = await CloverService.getGame(this.props.id);

    const saved = localStorage.getItem(this.stateKey());
    let savedState = {};
    if (saved !== null) {
      savedState = JSON.parse(saved)
    }

    const defaultGuessState = {
      guess: {
        cardPositions: (game?.suggested_possible_cards as Array<CardType>).map( (_, i) => [i, 0]),
        currentSelectedCard: null,
      }
    };

    if (this.interval === null) {
      this.interval = setInterval(() => { this.pollPushPull() }, pollInterval);
    }

    this.ws = new WebSocket(`ws://${window.location.host}/ws/listen/${this.props.id}`);
    this.ws.onmessage = (event) => {
      const message: any = JSON.parse(event.data);
      if (message.type === 'GAME_UPDATE') {
        this.pullClientState(message.data);
      }
    };

    await this.setStateWithWrite({
      ...defaultGuessState,
      ...savedState,
      game: game,
      copiedToClipboard: false,
    }, false);

    await this.pullClientState();
  }
  componentWillUnmount() {
    if (this.interval !== null) {
      clearInterval(this.interval);
    }
  }

  // [
  //   knowledge, set_of_applicable_cards,
  //   0, [[0,0], [1,1]],
  //   1, [[2,2]],
  //   2, [[3,3]],
  // ]
  positionKnowledge(): Array<[number, Array<AnswerType>]> {
    const init: Array<[number, Array<AnswerType>]> = Array(4).fill(
      [0, []],
    );
    return this.state.previousGuesses.reduce( (acc, cur) => {
      return cur[1].map( (r, i) => {
        if (r !== 0 && (acc[i][0] === 0 || r < acc[i][0])) {
          return [r, [cur[0][i]]];
        } else {
          return [acc[i][0], acc[i][1].concat([cur[0][i]])];
        }
      });
    }, init)
  }

  rotateCard(i: number, n: number, e: any) {
    e.stopPropagation();
    const newCardPositions = this.state.guess.cardPositions.slice();

    // https://stackoverflow.com/questions/4467539/javascript-modulo-gives-a-negative-result-for-negative-numbers
    const newRotation = (((this.state.guess.cardPositions[i][1] + n) % 4) + 4) % 4;
    newCardPositions[i][1] = newRotation;
    this.setStateWithWrite({
      guess: {
        ...this.state.guess,
        cardPositions: newCardPositions,
        currentSelectedCard: null,
      },
      guessSubmitted: false,
    });
  }

  handleCardClick(i: number, e: any) {
    if (this.state.guess.currentSelectedCard === null) {
      this.setState({
        guess: {
          ...this.state.guess,
          currentSelectedCard: i,
        },
      });
    } else {
      // Don't propagate any state change if unsetting card
      if (this.state.guess.currentSelectedCard === i) {
        this.setState({
          guess: {
            ...this.state.guess,
            currentSelectedCard: null,
          },
        });
        return;
      }

      const newCardPositions = this.state.guess.cardPositions.slice();
      const temp = newCardPositions[this.state.guess.currentSelectedCard];
      newCardPositions[this.state.guess.currentSelectedCard] = newCardPositions[i];
      newCardPositions[i] = temp;

      this.setStateWithWrite({
        guess: {
          ...this.state.guess,
          cardPositions: newCardPositions,
          currentSelectedCard: null,
        },
        guessSubmitted: false,
      });
    }
  }

  getCard(i: number): null|Array<string> {
    if (this.state.game === null) {
      return null;
    }
    const cardPosition = this.state.guess.cardPositions[i];
    const originalCard = this.state.game?.suggested_possible_cards?.[cardPosition[0]] as CardType;
    const card = rotateArray(
      originalCard.map((x, i) => x),
      cardPosition[1],
    );

    return card;
  }

  historyText(): Array<Array<string>> {
    return this.state.previousGuesses.map(
      (result, i) =>
        result[1].map( (x) => {
          if (x === 1) {
            return '🟩';
          } else if (x === 2) {
            return '🟨';
          } else {
            return '⬛';
          }
        })
    );
  }

  async copyToClipboard() {
    const text = `${this.state.game?.suggested_num_cards} card clover game\n${this.historyText().map((l) => l.join('')).join('\n')}\nPlay this puzzle at http://clover.marktai.com/games/${this.props.id}/guess`;
    this.setStateWithWrite({copiedToClipboard: true});

    if ('clipboard' in navigator) {
      await navigator.clipboard.writeText(text);
    } else {
      let textArea = document.createElement("textarea");
      textArea.value = text;
      // make the textarea out of viewport
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise<void>((res, rej) => {
          // here the magic happens
          document.execCommand('copy') ? res() : rej();
          textArea.remove();
      });
    }
  }

  renderCard(i: number, duplicated: boolean = false) {
    if (this.state.guess.cardPositions.length - 1 < i) {
      return null;
    }

    const card = this.getCard(i);

    const positionKnowledge = this.positionKnowledge();

    let cardState = null;
    if (i < 4) {
      // matching position
      if (
          positionKnowledge[i][1].some(j => j[0] === this.state.guess.cardPositions[i][0])
      ) {
        if (positionKnowledge[i][0] === 0) {
          cardState = CardState.Incorrect;
        } else if (positionKnowledge[i][0] === 1 &&
          // matching position and rotation
            positionKnowledge[i][1].some( (j) => j[0] === this.state.guess.cardPositions[i][0] && j[1] === this.state.guess.cardPositions[i][1] )
        ) {
          cardState = CardState.Correct;
        } else {
          cardState = CardState.CorrectPosition;
        }
      } else if (positionKnowledge[i][0] > 0) {
        cardState = CardState.Incorrect;
      }
    }


    let cardClasses = ['clover-card'];

    if (cardState === CardState.Correct) {
      cardClasses.push('correct-card');
    } else if (cardState === CardState.CorrectPosition) {
      cardClasses.push('correct-card-incorrect-rotation');
    } else if (cardState === CardState.Incorrect) {
      cardClasses.push('incorrect-card');
    }

    if (this.state.guess.currentSelectedCard === i) {
      cardClasses.push('selected');
    }

    if (duplicated) {
      cardClasses.push('duplicated');
    }

    return (
      <Container className={cardClasses.join(' ')}onClick={(e) => this.handleCardClick(i, e)}>
        <Row>
          <Col className="word-column" xs={4}>
            <div className="word left-word top-word">{card?.[0]}</div>
            <div className="word left-word bottom-word">{card?.[1]}</div>
          </Col>
          <Col className="button-column" xs={3}>
            <div>
              <Button size='sm' onClick={(e) => {this.rotateCard(i, 1, e)}}>↻</Button>
            </div>
            <div className="d-none d-xl-block d-xxl-block" >
              <Button size='sm' onClick={(e) => {this.rotateCard(i, -1, e)}}>↺</Button>
            </div>
          </Col>
          <Col className="word-column" xs={4}>
            <div className="word right-word top-word">{card?.[3]}</div>
            <div className="word right-word bottom-word">{card?.[2]}</div>
          </Col>
        </Row>
      </Container>
    );
  }

  renderLeftoverCards() {
    return this.state.guess.cardPositions.slice(4).map((_, i) => {
      return (<Col xs={9} md={5} key={i+4}>
        { this.renderCard(i + 4) }
      </Col>);
    })
  }

  renderHistory() {
    const items = this.historyText().map((emojiResults, i) => {
      return <ListGroup.Item key={i}>{emojiResults.join('')}</ListGroup.Item>;
    })

    return <ListGroup>{items}</ListGroup>
  }

  renderSubmitButton() {
    if(this.state.guessSubmitted) {
      return <Button variant="success" onClick={() => {this.submitGuess()}}>Submitted</Button>
    } else {
      return <Button onClick={() => {this.submitGuess()}}>Submit Guess</Button>
    }
  }

  renderShareButton() {
    if(this.state.copiedToClipboard) {
      return <Button variant="success" onClick={() => {this.copyToClipboard()}}>Copied!</Button>
    } else {
      return <Button onClick={() => {this.copyToClipboard()}}>Copy Score to Clipboard</Button>
    }
  }

  renderGame() {
    if (this.state.game !== null) {
      return (
        <Col xs={12} lg={8}>
          <Row>
            <Col xs={3}/>
            <Col xs={9} md={5}>{this.renderCard(0)}</Col>
          </Row>
          <Row>
            <Col className="clue" xs={3}>
              <div>{this.state.game?.clues?.[0]}</div>
            </Col>
            <Col xs={9} md={5}>{this.renderCard(1)}</Col>
          </Row>
          <Row>
            <Col className="clue" xs={3}>
              <div>{this.state.game?.clues?.[1]}</div>
            </Col>
            <Col xs={9} md={5}>{this.renderCard(2)}</Col>
          </Row>
          <Row>
            <Col className="clue" xs={3}>
              <div>{this.state.game?.clues?.[2]}</div>
            </Col>
            <Col xs={9} md={5}>{this.renderCard(3)}</Col>
          </Row>
          <Row>
            <Col className="clue" xs={3}>
              <div>{this.state.game?.clues?.[3]}</div>
            </Col>
            <Col xs={9} md={5}>{this.renderCard(0, true)}</Col>
          </Row>
          <Row>
            <Col>
              { this.renderSubmitButton() }
            </Col>
          </Row>
          <Row>
            { this.renderLeftoverCards() }
          </Row>

          <Row>
            { this.state.game?.suggested_num_cards } card clover game
            { this.renderHistory() }
            { this.renderShareButton() }
          </Row>
        </Col>
      );
    } else {
      return <Col xs={12} lg={8}>
        <img className="loader" src="https://www.marktai.com/download/54689/ZZ5H.gif"/>
      </Col>;
    }
  }

  render() {
    return (
      <div className="game">
        <Container>
          <Row>
            { this.renderGame() }
            <Col xs={12} lg={4}>
              <h2>Tutorial</h2>
              Rearrange the cards and figure out what {this.state.game?.author} had as their original card positions!
              <ListGroup as="ol" numbered>
                <ListGroup.Item as="li">
                  <div>
                    Each clue relates to the bolded work directly above and below the card
                  </div>
                  <div>
                    - {this.state.game?.clues?.[0]} currently relates to <strong>{this.getCard(0)?.[1]}</strong> and <strong>{this.getCard(1)?.[0]}</strong>
                  </div>
                  <div>
                    - {this.state.game?.clues?.[1]} currently relates to <strong>{this.getCard(1)?.[1]}</strong> and <strong>{this.getCard(2)?.[0]}</strong>
                  </div>
                  <ListGroup variant="flush">
                    <ListGroup.Item>
                      <div>
                        The first card is duplicated as the first and fifth card shown. This is for your convenience.
                      </div>
                      <div>
                        - {this.state.game?.clues?.[3]} currently relates to <strong>{this.getCard(3)?.[1]}</strong> and <strong>{this.getCard(0)?.[0]}</strong>
                      </div>
                    </ListGroup.Item>
                  </ListGroup>
                </ListGroup.Item>
                <ListGroup.Item as="li">
                  Click on one card, then another to swap them
                </ListGroup.Item>
                <ListGroup.Item as="li">
                  Click on the rotation buttons to rotate clockwise ↻ and counterclockwise ↺
                </ListGroup.Item>
                <ListGroup.Item as="li">
                  Press "Submit Guess" to check your guess
                </ListGroup.Item>
                <ListGroup.Item as="li">
                  <ListGroup variant="flush">
                    <ListGroup.Item>
                      Correct cards will show up with a <span className="correct-card-text">green</span> border
                    </ListGroup.Item>
                    <ListGroup.Item>
                      Correctly positioned cards, but incorrectly rotated cards will have a <span className="correct-card-incorrect-rotation-text">yellow</span> border.
                    </ListGroup.Item>
                    <ListGroup.Item>
                      Incorrect cards will have a <span className="incorrect-card-text">red</span> border.
                    </ListGroup.Item>
                  </ListGroup>
                </ListGroup.Item>
              </ListGroup>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

const GuessContainer = () => {
  const urlId = useParams().id as string;
  return <Guess id={urlId} />;
};

export default GuessContainer;
