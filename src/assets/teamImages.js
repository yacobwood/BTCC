// Bundled team background images keyed by team name for instant loading
const teamImages = {
  'NAPA Racing UK': require('./team_images/napa.jpg'),
  'Team VERTU': require('./team_images/vertu.png'),
  'Speedworks Corolla Racing': require('./team_images/speedworks.png'),
  'West Surrey Racing': require('./team_images/wsr.png'),
  'LKQ Euro Car Parts with Power Maxed Racing': require('./team_images/lkq.png'),
  'Cataclean Plato Racing': require('./team_images/plato.png'),
  'Restart Racing': require('./team_images/restart.png'),
  'Laser Tools Racing with MB Motorsport': require('./team_images/laser.png'),
  'Steel Seal with Power Maxed Racing': require('./team_images/pmr.png'),
};

const teamCarImages = {
  'NAPA Racing UK': require('./team_images/napa_car.png'),
  'Team VERTU': require('./team_images/vertu_car.png'),
  'Speedworks Corolla Racing': require('./team_images/speedworks_car.png'),
  'West Surrey Racing': require('./team_images/wsr_car.png'),
  'LKQ Euro Car Parts with Power Maxed Racing': require('./team_images/lkq_car.png'),
  'Cataclean Plato Racing': require('./team_images/plato_car.png'),
  'Restart Racing': require('./team_images/restart_car.png'),
  'Laser Tools Racing with MB Motorsport': require('./team_images/laser_car.png'),
  'Steel Seal with Power Maxed Racing': require('./team_images/pmr_car.png'),
};

export function getTeamImage(teamName) {
  return teamImages[teamName] || null;
}

export function getTeamCarImage(teamName) {
  return teamCarImages[teamName] || null;
}
