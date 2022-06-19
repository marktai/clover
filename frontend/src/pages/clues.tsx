import React from 'react';
import CloverService from '../api';
import { GameType } from '../api';

import { Container, Row, Col, Form, Button, ListGroup } from 'react-bootstrap';

import {
  useParams,
  useNavigate,
} from "react-router-dom";

type CluesProps = {
  id: string,
  navigate: any,
};

type CluesState = {
  game: null|GameType,
  formData: {
    clues: Array<string>,
    suggestedNumClues: string,
    author: string,
  },
  gameSubmitted: boolean,
};

class Clues extends React.Component<CluesProps, CluesState> {
  state: CluesState = {
    game: null,
    formData: {
      clues: ['', '', '', ''],
      suggestedNumClues: '1',
      author: '',
    },
    gameSubmitted: false,
  };

  async submitClues() {
    const game = await CloverService.submitClues(
      this.props.id,
      this.state.formData.clues,
      parseInt(this.state.formData.suggestedNumClues) + 4,
      this.state.formData.author,
    );
    this.setState({
      game: game,
      formData: {
        clues: game.clues ?? ['', '', '', ''],
        suggestedNumClues: ((game.suggested_num_cards ?? 5) - 4).toString(),
        author: game.author,
      },
      gameSubmitted: true,
    });
    // this.props.navigate(`/games/${game.id}/guess`);
  }

  async componentDidMount() {
    const game = await CloverService.getGame(this.props.id);
    this.setState({
      game: game,
      formData: {
        clues: game.clues ?? ['', '', '', ''],
        suggestedNumClues: ((game.suggested_num_cards ?? 5) - 4).toString(),
        author: game.author || (localStorage.getItem(CloverService.authorKey) ?? ''),
      },
    });
  }

  renderCard(i: number) {
    const card = this.state.game?.answer_cards?.[i]
    return (
      <div className="clover-card clue-card">
        <div className="word left-word bold-word top-word">{card?.[0]}</div>
        <div className="word right-word top-word">{card?.[3]}</div>
        <div className="word left-word bold-word bottom-word">{card?.[1]}</div>
        <div className="word right-word bottom-word">{card?.[2]}</div>
      </div>
    );
  }

  renderClueInput(i: number) {
    return (
      <Form.Control
        type="text"
        className="clue"
        value={this.state.formData.clues[i]}
        autoCapitalize="none"
        onChange={(e) => {
          const newClues = this.state.formData.clues.slice();
          newClues[i] = e.target.value;
          this.setState({
            ...this.state,
            formData: {
              ...this.state.formData,
              clues: newClues,
            },
            gameSubmitted: false,
          });
        }}
        placeholder={"Clue " + (i+1).toString()}
      />
    );
  }

  renderAuthorInput() {
    return (
      <Form.Control
        type="text"
        value={this.state.formData.author}
        onChange={(e) => {
          this.setState({
            ...this.state,
            formData: {
              ...this.state.formData,
              author: e.target.value,
            },
            gameSubmitted: false,
          });
          localStorage.setItem(CloverService.authorKey, e.target.value);
        }}
        placeholder="Your name"
      />
    );
  }

  renderNumCardsSelect() {
    return (
      <Form.Select
        value={this.state.formData.suggestedNumClues}
        aria-label="Default select example"
        onChange={(e) => {
          const newSuggestedNumClues = e.target.value;
          this.setState({
            ...this.state,
            formData: {
              ...this.state.formData,
              suggestedNumClues: newSuggestedNumClues,
            },
            gameSubmitted: false,
          });
        }}
      >
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>

      </Form.Select>
    );
  }

  renderSubmitCluesButton() {
    if (!this.state.gameSubmitted) {
      return <Button onClick={() => {this.submitClues()}}>{this.state.game?.clues == null ? "Submit Clues" : "Update Clues" }</Button>;
    } else {
      return <Button variant="success" onClick={() => {this.submitClues()}}>Submitted!</Button>;
    }
  }

  renderGame() {
    return (
      <Col xs={12} lg={8}>
        <Row>
          <Col xs={4}></Col>
          <Col xs={8}>{this.renderCard(0)}</Col>
        </Row>
        <Row>
          <Col xs={4} className="clue">
            {this.renderClueInput(0)}
          </Col>
          <Col xs={8}>{this.renderCard(1)}</Col>
        </Row>
        <Row>
          <Col xs={4} className="clue">
            {this.renderClueInput(1)}
          </Col>
          <Col xs={8}>{this.renderCard(2)}</Col>
        </Row>
        <Row>
          <Col xs={4} className="clue">
            {this.renderClueInput(2)}
          </Col>
          <Col xs={8}>{this.renderCard(3)}</Col>
        </Row>
        <Row>
          <Col xs={4} className="clue">
            {this.renderClueInput(3)}
          </Col>
          <Col xs={8}>{this.renderCard(0)}</Col>
        </Row>
        <Row>
          <Col>
            <span>Extra cards: </span>
            <span>{this.renderNumCardsSelect()}</span>
          </Col>
          <Col>{this.renderAuthorInput()}</Col>
          <Col>
            { this.renderSubmitCluesButton () }
          </Col>
        </Row>
        {
          this.state.game?.clues != null ?
            <Row>
              <Col>Clues submitted at {this.state.game?.last_updated_time}! To guess, go to <a href={`http://clover.marktai.com/games/${this.props.id}/guess`}>http://clover.marktai.com/games/{this.props.id}/guess</a>
              </Col>
            </Row>
          : null
        }
      </Col>
    );
  }

  render() {
    if (this.state.game !== null) {
      return (
        <div className="game">
          <Container>
            <Row>
              { this.renderGame() }
              <Col xs={12} lg={4}>
                <h2>Tutorial</h2>
                Create 1 word clues so that future people playing your puzzle will be able to figure out your original cards after they are all shuffled!
                <ListGroup as="ol" numbered>
                  <ListGroup.Item as="li">
                    <div>
                      Each clue relates to the bolded work directly above and below the clue.
                    </div>
                    <div>
                      - {this.state.formData.clues[0] || "Clue 1"} relates to <strong>{this.state.game?.answer_cards?.[0]?.[1]}</strong> and <strong>{this.state.game?.answer_cards?.[1]?.[0]}</strong>
                    </div>
                    <div>
                      - {this.state.formData.clues[1] || "Clue 2"} relates to <strong>{this.state.game?.answer_cards?.[1]?.[1]}</strong> and <strong>{this.state.game?.answer_cards?.[2]?.[0]}</strong>
                    </div>
                    <ListGroup variant="flush">
                      <ListGroup.Item>
                        <div>
                          The first card is duplicated as the first and fifth card shown. This is for your convenience.
                        </div>
                        <div>
                          - {this.state.formData.clues[3] || "Clue 4"} relates to <strong>{this.state.game?.answer_cards?.[3]?.[1]}</strong> and <strong>{this.state.game?.answer_cards?.[0]?.[0]}</strong>
                        </div>
                      </ListGroup.Item>
                    </ListGroup>
                  </ListGroup.Item>
                  <ListGroup.Item as="li">
                    <div>
                      When you are ready with all of your clues, select how many cards you will use in puzzle
                    </div>
                    <div>
                      - 1 extra card means there will be 5 cards total when guessing
                    </div>
                  </ListGroup.Item>
                  <ListGroup.Item as="li">
                    Add your name, and press "Submit Clues" when you are done!
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

const CluesContainer = () => {
  const navigate = useNavigate();
  const urlId = useParams().id as string;
  return <Clues id={urlId} navigate={navigate} />;
};

export default CluesContainer;
