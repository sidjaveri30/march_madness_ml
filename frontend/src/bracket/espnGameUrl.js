function getEspnGameUrl(gameId) {
  if (!gameId) return null;
  return `https://www.espn.com/mens-college-basketball/game/_/gameId/${gameId}`;
}

function getGameEspnUrl(game) {
  if (!game) return null;
  return game.espnUrl || getEspnGameUrl(game.gameId);
}

export { getEspnGameUrl, getGameEspnUrl };
