import React from 'react';
import { useEffect } from 'react';
import CloverService from '../api';
import { GameType, AnswerType, CardType, GuessResponseType, BoardClientState } from '../api';
// import * as $ from 'jquery';

import { Container, Row, Col, Button, ListGroup } from 'react-bootstrap';

import {
  useParams
} from "react-router-dom";

enum CardState {
  Incorrect,
  Correct,
  CorrectPosition,
  CorrectPositionIncorrectRotation,
}

const pollInterval = 30000;

function rotateArray<T>(a: Array<T>, n: number): Array<T> {
  n = n % a.length;
  return a.slice(n, a.length).concat(a.slice(0, n));
}

type GuessProps = {
  id: string,
  syncState: boolean,
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
  disablePull: boolean,
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
    disablePull: false,
  };

  interval: null|any = null;

  ws: null|WebSocket = null;

  stateKey(): string {
    return `${this.props.id}/state`;
  }

  pushClientState(): Promise<null|BoardClientState> {
    if (!this.props.syncState) {
      return Promise.resolve(null);
    }
    const data = {
      guess: {
        cardPositions: this.state.guess.cardPositions,
      },
      previousGuesses: this.state.previousGuesses,
      guessSubmitted: this.state.guessSubmitted,
    }
    this.setState({
      ...this.state,
      disablePull: true,
    });
    setTimeout(() => {
      this.setState({disablePull: false});
    }, 50);
    return CloverService.updateClientState(this.props.id, data);
  }

  async pullClientState(inputClientState: null|BoardClientState = null): Promise<null> {
    if (!this.props.syncState || this.state.disablePull) {
      return Promise.resolve(null);
    }

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
    if (!this.props.syncState) {
      return;
    }

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
    // If the last guess was successful, disable the button
    if ((this.state.previousGuesses.at(-1) || null)?.[1]?.every((answer) => {
      return answer === 1;
    })) {
      return;
    }

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

    if (this.ws === null) {
      const ws_protocol = location.protocol === 'http:' ? 'ws:' : 'wss:';
      this.ws = new WebSocket(`${ws_protocol}//${window.location.host}/ws/listen/${this.props.id}`);
      this.ws.onmessage = (event) => {
        const message: any = JSON.parse(event.data);
        if (message.type === 'GAME_UPDATE') {
          this.pullClientState(message.data);
        }
      };
    }

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
  //   2, [[3,3], [3,1]],
  // ]
  positionKnowledge(): Array<[number, Array<AnswerType>]> {
    const init: Array<[number, Array<AnswerType>]> = Array(4).fill(
      [0, []],
    );
    return this.state.previousGuesses.reduce( (acc, cur) => {
      return cur[1].map( (r, i) => {
        if (r !== 0) {
          if ((acc[i][0] === 0 || r < acc[i][0])) {
            return [r, [cur[0][i]]];
          } else if(r == acc[i][0]){
            return [r, acc[i][1].concat([cur[0][i]])];
          } else {
            return acc[i];
          }
        } else {
          return [acc[i][0], acc[i][1].concat([cur[0][i]])];
        }
      });
    }, init);
  }

  rotateCard(i: number, n: number, e: any) {
    e.stopPropagation();
    const newCardPositions = this.state.guess.cardPositions.slice();

    // https://stackoverflow.com/questions/4467539/javascript-modulo-gives-a-negative-result-for-negative-numbers
    const newRotation = (((this.state.guess.cardPositions[i][1] + n) % 4) + 4) % 4;
    newCardPositions[i][1] = newRotation;
    // $.makeArray($(`.clover-card.card-${i.toString()}`)).map((card: any) => {
    //   card.style['transition-duration'] = '0.3s';
    //   setTimeout(() => {
    //     card.style['transition-duration'] = '0s';
    //   }, 300);
    // });
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
    const text = `${this.state.game?.suggested_num_cards} card clover game by ${this.state.game?.author}\n${this.historyText().map((l) => l.join('')).join('\n')}\nPlay this puzzle at http://clover.marktai.com/games/${this.props.id}/guess`;
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

  renderCard(i: number, duplicated: boolean = false, buttonsInside: boolean = false, additionalRotation: number = 0) {
    if (this.state.guess.cardPositions.length - 1 < i) {
      return null;
    }

    const cardPosition = this.state.guess.cardPositions[i];
    const originalCard = this.state.game?.suggested_possible_cards?.[cardPosition[0]] as CardType;
    const cardRotationsBeforeAdditional = rotateArray(
      [0, 1, 2, 3],
      -1 * (cardPosition[1]),
    );
    const cardRotations = rotateArray(
      [0, 1, 2, 3],
      -1 * (cardPosition[1] + additionalRotation),
    );

    const card = rotateArray(this.getCard(i) as Array<string>, additionalRotation);

    const positionKnowledge = this.positionKnowledge();

    let cardState = null;
    if (i < 4) {
      // matching position
      if (
          positionKnowledge[i][1].some(j => j[0] === this.state.guess.cardPositions[i][0])
      ) {
        if (positionKnowledge[i][0] === 0) {
          cardState = CardState.Incorrect;
        } else if (positionKnowledge[i][0] === 1) {
          if (
            // matching position and rotation
            positionKnowledge[i][1].some( (j) => j[0] === this.state.guess.cardPositions[i][0] && j[1] === this.state.guess.cardPositions[i][1] )
          ) {
            cardState = CardState.Correct;
          } else {
            cardState = CardState.CorrectPositionIncorrectRotation;
          }
        } else if (positionKnowledge[i][0] === 2) {
          if (
            // matching position and rotation
            positionKnowledge[i][1].some( (j) => j[0] === this.state.guess.cardPositions[i][0] && j[1] === this.state.guess.cardPositions[i][1] )
          ) {

            cardState = CardState.CorrectPositionIncorrectRotation;
          } else {
            cardState = CardState.CorrectPosition;
          }
        }
      } else if (positionKnowledge[i][0] > 0) {
        cardState = CardState.Incorrect;
      }
    }


    let cardClasses = ['clover-card', `card-${i}`,];

    let wordClasses = Array(4).fill(['word', 'shown-word']);
    for (let i = 0; i < 4; i++) {
      if (cardRotations[i] === 0){
        wordClasses[i] = wordClasses[i].concat(['left-word', 'top-word']);
      }
      else if (cardRotations[i] === 1){
        wordClasses[i] = wordClasses[i].concat(['left-word', 'bottom-word']);
      }
      else if (cardRotations[i] === 2){
        wordClasses[i] = wordClasses[i].concat(['right-word', 'bottom-word']);
      }
      else if (cardRotations[i] === 3){
        wordClasses[i] = wordClasses[i].concat(['right-word', 'top-word']);
      }
      if (cardRotationsBeforeAdditional[i] === 0 || cardRotationsBeforeAdditional[i] === 1) {
        wordClasses[i] = wordClasses[i].concat(['bold-word']);
      }
    }

    if (cardState === CardState.Correct) {
      cardClasses.push('correct-card');
    } else if (cardState === CardState.CorrectPosition) {
      cardClasses.push('correct-position');
    } else if (cardState === CardState.CorrectPositionIncorrectRotation) {
      cardClasses.push('correct-position-incorrect-rotation');
    } else if (cardState === CardState.Incorrect) {
      cardClasses.push('incorrect-card');
    }

    if (this.state.guess.currentSelectedCard === i) {
      cardClasses.push('selected');
    }

    if (duplicated) {
      cardClasses.push('duplicated');
    }

    const buttonCol = <Col className="button-column" xs={2} xl={3}>
      <div>
        <Button size='sm' onClick={(e) => {this.rotateCard(i, 1, e)}}>↻</Button>
      </div>
      <div className="d-none d-xl-block d-xxl-block" >
        <Button size='sm' onClick={(e) => {this.rotateCard(i, -1, e)}}>↺</Button>
      </div>
    </Col>


    return (
      <Container className="card-container" fluid>
        <Row>
          <Col xs={buttonsInside ? 12 : 10} xl={buttonsInside ? 12 : 9}>
            <div className={cardClasses.join(' ')} onClick={(e) => this.handleCardClick(i, e)}>
              <Row className="card-internal-row">
                <Col className="card-internal-col" xs={buttonsInside ? 5 : 6} xl={buttonsInside ? 4 : 6}>
                  <div className="word left-word bold-word top-word hidden-word">{card?.[0]}</div>
                  <div className="word left-word bold-word bottom-word hidden-word">{card?.[1]}</div>
                </Col>
                { buttonsInside ? buttonCol :null }
                <Col className="card-internal-col" xs={buttonsInside ? 5 : 6} xl={buttonsInside ? 4 : 6}>
                  <div className="word right-word top-word hidden-word">{card?.[3]}</div>
                  <div className="word right-word bottom-word hidden-word">{card?.[2]}</div>
                </Col>
              </Row>
              <div className={wordClasses[0].join(' ')}>{originalCard[0]}</div>
              <div className={wordClasses[1].join(' ')}>{originalCard[1]}</div>
              <div className={wordClasses[2].join(' ')}>{originalCard[2]}</div>
              <div className={wordClasses[3].join(' ')}>{originalCard[3]}</div>
            </div>
          </Col>
          { !buttonsInside ? buttonCol : null }
        </Row>
      </Container>
    );
  }

  renderLeftoverCards() {
    return this.state.guess.cardPositions.slice(4).map((_, i) => {
      return (<Col xs={12}>
        { this.renderCard(i + 4, false, false) }
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

  renderColumnCluesCards() {
    // return <div className="d-block d-xl-none d-xxl-none">
    return <div>
      <Row>
        <Col xs={12} lg={7}>
          <Row>
            <Col xs={3}/>
            <Col xs={9}>{this.renderCard(0, false, false)}</Col>
          </Row>
          <Row>
            <Col className="clue" xs={3}>
              <div>{this.state.game?.clues?.[0]}</div>
            </Col>
            <Col xs={9}>{this.renderCard(1, false, false)}</Col>
          </Row>
          <Row>
            <Col className="clue" xs={3}>
              <div>{this.state.game?.clues?.[1]}</div>
            </Col>
            <Col xs={9}>{this.renderCard(2, false, false)}</Col>
          </Row>
          <Row>
            <Col className="clue" xs={3}>
              <div>{this.state.game?.clues?.[2]}</div>
            </Col>
            <Col xs={9}>{this.renderCard(3, false, false)}</Col>
          </Row>
          <Row>
            <Col className="clue" xs={3}>
              <div>{this.state.game?.clues?.[3]}</div>
            </Col>
            <Col xs={9}>{this.renderCard(0, true, false)}</Col>
          </Row>
        </Col>
        <Col xs={12} lg={5}>
          <Row>
            <div>Unused cards</div>
            { this.renderLeftoverCards() }
          </Row>
        </Col>
      </Row>
    </div>
  }

  renderSquareCluesCards() {
    return <div className="d-none d-xl-block d-xxl-block">
      <Row>
        <Col className="clue" xl={12}>
          <div>{this.state.game?.clues?.[1]}</div>
        </Col>
      </Row>
      <Row>
        <Col className="clue" xl={2}>
          <div>{this.state.game?.clues?.[0]}</div>
        </Col>
        <Col xl={5}>{this.renderCard(0, false, true)}</Col>
        <Col xl={5}>{this.renderCard(1, false, true)}</Col>
        <Col className="clue" xl={2}>
          <div>{this.state.game?.clues?.[2]}</div>
        </Col>
      </Row>
      <Row>
        <Col xl={2}>
        </Col>
        <Col xl={5}>{this.renderCard(3, false, true)}</Col>
        <Col xl={5}>{this.renderCard(2, false, true)}</Col>
        <Col xl={2}>
        </Col>
      </Row>
      <Row>
        <Col className="clue" xl={12}>
          <div>{this.state.game?.clues?.[3]}</div>
        </Col>
      </Row>
      <Row>
        { this.renderLeftoverCards() }
      </Row>
    </div>
  }

  renderGame() {
    return (
      <Col xs={12} lg={9}>
        { this.renderColumnCluesCards() }
        {/*{ this.renderSquareCluesCards() }*/}
        <Row>
          <Col>
            { this.renderSubmitButton() }
          </Col>
        </Row>

        <Row>
          { this.state.game?.suggested_num_cards } card clover game by { this.state.game?.author }
          { this.renderHistory() }
          { this.renderShareButton() }
        </Row>
      </Col>
    );
  }

  render() {
    if (this.state.game !== null) {
      return (
        <div className="game">
          <Container>
            <Row>
              <div className="game-name">{ this.state.game.adult ? "Adult game" : "Game" } { this.state.game.id } by { this.state.game.author }</div>
              { this.renderGame() }
              <Col xs={12} lg={3}>
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
                        Correctly positioned cards will have a <span className="correct-position-text">yellow</span> border. This is basically rotations you haven't tried before but you know it's the right position.
                      </ListGroup.Item>
                      <ListGroup.Item>
                        Correctly positioned cards, but incorrectly rotated cards will have a <span className="correct-position-incorrect-rotation-text">orange</span> border. This is basically rotations you've already tried before.
                      </ListGroup.Item>
                      <ListGroup.Item>
                        Incorrect cards will have a <span className="incorrect-card-text">red</span> border
                      </ListGroup.Item>
                    </ListGroup>
                  </ListGroup.Item>
                </ListGroup>
              </Col>
            </Row>
          </Container>
        </div>
      );
    } else {
      return <img className="loader" src="https://www.marktai.com/download/54689/ZZ5H.gif"/>
    }
  }
}

const GuessContainer = () => {
  const urlId = useParams().id as string;
  return <Guess id={urlId} syncState={true}/>;
};

export default GuessContainer;
