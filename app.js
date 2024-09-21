import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from "discord-interactions";
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
} from "discord.js";

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create a new Discord client with intents to track guild members
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// Endpoint for Discord interactions
app.post(
  "/interactions",
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  async function (req, res) {
    const { type, data, member, guild_id, token } = req.body;

    // Handle verification requests
    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    // Handle slash command and button requests
    if (
      type === InteractionType.APPLICATION_COMMAND ||
      type === InteractionType.MESSAGE_COMPONENT
    ) {
      const { name, custom_id } = data;
      const requiredRoleID = process.env.REQUIRED_ROLE_ID;
      const guild = client.guilds.cache.get(guild_id);

      if (!guild) {
        return res.status(400).json({ error: "Guild not found." });
      }

      const guildMember = await guild.members.fetch(member.user.id);

      // Check if the user already has the required role or access
      if (guildMember.roles.cache.has(requiredRoleID)) {
        console.log(`${guildMember.user.tag} already verified.`);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "You already have access to the restricted channel.",
            flags: 64, // Ephemeral response, only visible to the user
          },
        });
      }

      // Handle the "verify" command or button click
      if (name === "verify" || custom_id === "verify_button") {
        // Acknowledge the interaction immediately to avoid timeout
        res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });

        setTimeout(async () => {
          try {
            // Grant access by assigning the required role to the user
            await guildMember.roles.add(requiredRoleID);

            // Send a follow-up ephemeral message to confirm verification
            await client.rest.patch(
              `/webhooks/${process.env.APP_ID}/${token}/messages/@original`,
              {
                body: {
                  content:
                    "You have been verified! You now have access to the restricted channel.",
                  flags: 64, // Ephemeral response, only visible to the user
                },
              }
            );
          } catch (error) {
            console.error("Error during role assignment:", error);

            // Edit the original response in case of an error
            await client.rest.patch(
              `/webhooks/${process.env.APP_ID}/${token}/messages/@original`,
              {
                body: {
                  content:
                    "An error occurred during the verification process. Please try again later.",
                  flags: 64, // Ephemeral response, only visible to the user
                },
              }
            );
          }
        }, 2000); // 2-second delay (2000 milliseconds)

        return;
      }

      console.error(`Unknown command or button interaction: ${name || custom_id}`);
      return res.status(400).json({ error: "Unknown command or interaction" });
    }

    console.error("Unknown interaction type", type);
    return res.status(400).json({ error: "Unknown interaction type" });
  }
);

// Function to handle sending a verification prompt in the channel
async function sendVerificationMessageInChannel(channel, member) {
  // Create a verify button
  const verifyButton = new ButtonBuilder()
    .setCustomId("verify_button")
    .setLabel("Verify Yourself")
    .setStyle(ButtonStyle.Primary);

  // Create an action row to hold the button
  const row = new ActionRowBuilder().addComponents(verifyButton);

  // Embed style container with an image and text
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Restricted Access Verification")
    .setDescription(
      "Click the button below to verify yourself and gain access to the restricted channel."
    )
    .setImage(
      "https://pbs.twimg.com/profile_images/1086793002104827904/UXjpiDIl_400x400.jpg"
    )
    .setFooter({ text: "Verification Required" });

  try {
    // Send a message in the channel mentioning the user with the verification prompt
    await channel.send({
      content: `<@${member.id}>`,
      embeds: [embed],
      components: [row],
    });

    console.log(`Verification prompt sent to ${member.user.tag}`);
  } catch (error) {
    console.error("Error sending verification message:", error);
  }
}

// Event listener when the bot is ready
client.once("ready", async () => {
  console.log("Bot is ready.");
});

// Listen for new members joining the server and prompt verification interaction
client.on("guildMemberAdd", async (member) => {
  console.log(`New member joined: ${member.user.tag}`);
  const channel = member.guild.systemChannel; // Replace with your specific channel ID if necessary

  if (channel) {
    await sendVerificationMessageInChannel(channel, member);
  } else {
    console.error("Verification channel not found.");
  }
});

// Log in the Discord bot
client.login(process.env.BOT_TOKEN);

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
