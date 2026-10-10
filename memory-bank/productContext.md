# Product context

- **Problem**: Operators need one workspace to generate software, sell, and paper-trade a simple market rule without silent live orders.
- **Primary users**: HexaWave admins (trading + approvals) and signed-in builders (King requests, IDE).
- **UX principles**: Explicit approval before external execution. Paper trading labelled as paper. Security copy is defensive, not attack-oriented. Builders can ask the IDE to generate or maintain a project; the bounded autonomous task may edit files, run supported checks/builds, and attempt limited repairs before returning files for review.
- **Constraints**: Trading live mode is blocked until a broker adapter exists. King excludes offensive tooling.
- **Trading availability**: Disabled by default; only the King administrator can enable it. Disabling stops active paper automation and hides the trading screen.
