import { v4 as uuidv4 } from 'uuid';

export type AnswerType = [number, number];
export type CardType = [string, string, string, string];

export type GameType = {
  id: number,
  clues: null|Array<string>,
  answer: [
    AnswerType,
    AnswerType,
    AnswerType,
    AnswerType,
  ],
  answer_cards: [
    CardType,
    CardType,
    CardType,
    CardType,
  ],
  suggested_num_cards: null|number,
  suggested_possible_cards: null|Array<CardType>,
  created_time: string,
  last_updated_time: string,
  author: string,
  daily_set_time: null|string,
  adult: boolean,
};

export type BoardClientState = {
  id: number,
  board_id: number,
  created_time: string,
  data: any,
  client_id: string,
};

export type GuessResponseType = Array<number>;

type GuessResponse = {
  results: GuessResponseType,
};

export async function httpJson<T>(
  request: RequestInfo
): Promise<T> {
  const response = await fetch(
    request
  );
  return await response.json();
}

export function getJson<T>(
  path: string,
  args: RequestInit = { method: "GET" }
): Promise<T> {
  return httpJson<T>(new Request(path, args));
};

export function postJson<T>(
  path: string,
  body: any,
  args: RequestInit = {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    },
  }
): Promise<T>  {
  return httpJson<T>(new Request(path, args));
};

export function patchJson<T>(
  path: string,
  body: any,
  args: RequestInit = {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    },
  }
): Promise<T>  {
  return httpJson<T>(new Request(path, args));
};

export default class CloverService {
  public static host = '/api';

  public static getGame(id: number|string): Promise<GameType> {
    return getJson<GameType>(`${this.host}/games/${id}`);
  }

  public static getDailyGame(): Promise<GameType> {
    return getJson<GameType>(`${this.host}/games/daily`);
  }

  public static async getGames(adult: boolean): Promise<Array<GameType>> {
    const gamesResponse = await getJson<Array<GameType>>(`${this.host}/games?adult=${adult}`);
    var sortedGames = gamesResponse.slice();
    sortedGames.sort((a, b) => {
      if (a.last_updated_time === b.last_updated_time) {
        return 0;
      } else if (a.last_updated_time < b.last_updated_time) {
        return 1;
      } else {
        return -1;
      };
    });
    return sortedGames;
  }

  public static newGame(adult: boolean): Promise<GameType> {
    return postJson<GameType>(`${this.host}/games`, {adult: adult});
  }

  public static submitClues(id: number|string, clues: Array<string>, suggestedNumCards: number, author: string): Promise<GameType> {
    const body = {
      clues: clues,
      suggested_num_cards: suggestedNumCards,
      author: author,
    }

    return patchJson<GameType>(`${this.host}/games/${id}`, body);
  }

  public static async makeGuess(id: number|string, guess: Array<AnswerType>): Promise<GuessResponseType> {
    const body = {
      guess: guess,
      client_id: this.getClientId(),
    }

    const response = await postJson<GuessResponse>(`${this.host}/games/${id}/guess`, body);
    return response.results;
  }

  public static authorKey = 'author';
  public static clientIdKey = 'client_id';

  public static getClientId(): string {
    let author = localStorage.getItem(this.authorKey);
    let clientId = localStorage.getItem(this.clientIdKey);
    if (clientId === null) {
      clientId = uuidv4();
      localStorage.setItem(this.clientIdKey, clientId as string);
    }
    return `${author ?? 'anon'}-${clientId}`;
  }

  public static async getClientState(id: number|string): Promise<null|BoardClientState> {
    const response: HttpResponse<BoardClientState> = await fetch(`${this.host}/games/${id}/client_state`, { method: "GET" });
    if (response.status === 404){
      return null;
    }
    return await response.json();
  }

  public static updateClientState(id: number|string, data: any):   Promise<BoardClientState> {
    const client_id = this.getClientId();

    const body = {
      data: data,
      client_id: client_id,
    }

    return postJson<BoardClientState>(`${this.host}/games/${id}/client_state`, body);
  }
}


interface HttpResponse<T> extends Response {
  parsedBody?: T;
}
