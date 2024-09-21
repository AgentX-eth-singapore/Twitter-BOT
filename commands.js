// commands.js
import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1, // Type 1 represents a slash command
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options for a rock-paper-scissors challenge
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3, // Type 3 represents a string choice
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// AGX command for general use
const AGX_COMMAND = {
  name: 'agx',
  description: 'AGX command', // Description of the command
  type: 1, // Slash command
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Verify command to handle user verification for gated access
const VERIFY_COMMAND = {
  name: 'verify',
  description: 'Verify yourself to gain access to restricted channels.',
  type: 1, // Slash command
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Collect all commands to be installed globally
const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, AGX_COMMAND, VERIFY_COMMAND];

// Install all commands globally using the provided utility function
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
