import React, { useState } from 'react';
import CloverService, { GameType } from '../api';
import { Guess } from './guess';


type DailyState = {
  game: null|GameType,
};

export class Daily extends React.Component<{}, DailyState> {
  state: DailyState = {
    game: null
  };

  async componentDidMount() {
    const game = await CloverService.getDailyGame();
    this.setState({
      game: game,
    });
  }

  render() {
    if (this.state.game === null){
      return <div> <img className="loader" src="https://www.marktai.com/download/54689/ZZ5H.gif"/> </div>
    } else {
      return <Guess id={this.state.game.id.toString()}/>
    }
  }
}

const DailyContainer = () => {
  return <Daily />;
};

export default DailyContainer;
