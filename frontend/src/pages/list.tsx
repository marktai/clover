import React from 'react';
import CloverService from '../api';
import { GameType } from '../api';
import {Container, Row, Col, ListGroup, Button} from 'react-bootstrap';
import {
  Link,
  useNavigate,
} from "react-router-dom";

type ListProps = {
  navigate: any,
}

type ListState = {
  games: null|Array<GameType>;
};

class List extends React.Component<ListProps, ListState> {
  state: ListState = {
    games: null,
  };

  async refresh() {
    const games = await CloverService.getGames();
    this.setState({
      games: games,
    })
  }

  async componentDidMount() {
    await this.refresh();
  }

  async newGame() {
    const newGame = await CloverService.newGame();
    this.props.navigate(`/games/${newGame.id}/clues`);
  }

  getLink(game: GameType) {
    return "/games/" + game.id + (game.clues === null ? "/clues" : "/guess");
  }

  render() {
    const [gamesWithoutClues, gamesWithClues] = [
      (this.state.games ?? []).filter((g) => g.clues === null),
      (this.state.games ?? []).filter((g) => g.clues !== null),
    ].map((list) => list.map(
      (game: GameType, i: number) => {
        let text = game.clues === null ?
          `Game ${game.id} without clues` :
          `Game ${game.id} by ${game.author} with ${game.suggested_num_cards} cards`;
        if (game.daily_set_time !== null) {
          const date = new Date(game.daily_set_time);
          text += ` (${date.getMonth() + 1}/${date.getDate()}'s daily puzzle)`
        }
        return <ListGroup.Item key={i}>
          <Link to={this.getLink(game)}>{text}</Link>
        </ListGroup.Item>;
    }));

    return (
      <Container className="list">
        <Row>
          <Col xs={12} md={6}>
            <Button onClick={() => {this.newGame()}}>New Game</Button>
            <div>
              Games with clues, ready to guess
            </div>
            <ListGroup>
              <ListGroup.Item key={"daily"}>
                <Link to={"/daily"}>Daily updated game</Link>
              </ListGroup.Item>
              {
                this.state.games === null ?
                  <img className="loader" src="https://www.marktai.com/download/54689/ZZ5H.gif"/> :
                  gamesWithClues
              }
            </ListGroup>
            {/*Games without clues
            <ListGroup>
              { gamesWithoutClues }
            </ListGroup>*/}
          </Col>
          <Col xs={12} md={6}>
            <ListGroup variant="flush">
              <ListGroup.Item>
                To give clues for a new game, click "New Game"
              </ListGroup.Item>
              <ListGroup.Item>
                To solve the clues for an existing game, click on any listed game
              </ListGroup.Item>
            </ListGroup>
          </Col>
        </Row>
      </Container>
    );
  }
}

const ListContainer = () => {
  const navigate = useNavigate();
  return (<List navigate={navigate}></List>)
}

export default ListContainer;
