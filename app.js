import "dotenv/config";
import express from "express";
import axios from "axios"; // Ensure axios is installed
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
app.use(express.json()); // Middleware to parse JSON requests
const PORT = process.env.PORT || 3000;

// Create a new Discord client with intents to track guild members
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// POST request to verify the user
app.post("/verify", async (req, res) => {
  const { discordId, username } = req.body;
  console.log(`Verifying user with ID: ${discordId}, Username: ${username}`);

  try {
    // Simulate successful verification response
    return res.json({ success: true });
  } catch (error) {
    console.error("Error during verification:", error);
    return res.json({ success: false });
  }
});

// Function to delete bot messages that tagged the user
async function deleteBotMessages(guild, userId) {
  try {
    // Fetch messages from the specified channel
    const channel = guild.channels.cache.get("1286788205001310229"); // Update with correct channel ID
    if (!channel) {
      console.error("Channel not found for deleting messages.");
      return;
    }

    // Fetch messages from the channel
    const messages = await channel.messages.fetch({ limit: 100 }); // Adjust the limit as necessary
    const taggedMessages = messages.filter(
      (msg) => msg.author.bot && msg.mentions.users.has(userId)
    );

    // Delete each message
    for (const msg of taggedMessages.values()) {
      await msg.delete();
      console.log(`Deleted message tagged with user ID: ${userId}`);
    }
  } catch (error) {
    console.error("Error deleting bot messages:", error);
  }
}

// Function to send the post with the "Claim Now" button and image after verification
async function sendClaimPost(channel, userId) {
  // Create a "Claim Now" button
  const claimButton = new ButtonBuilder()
    .setLabel("Claim Now")
    .setStyle(ButtonStyle.Primary)
    .setCustomId("claim_now_button"); // Custom ID for further interaction handling

  // Create an action row to hold the button
  const row = new ActionRowBuilder().addComponents(claimButton);

  // Create an embed with the image and a description
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("Claim Your Reward")
    .setDescription("Click the button below to claim your reward.")
    .setImage("https://shop.ogs.gg/cdn/shop/files/frontcap.png?v=1706630562&width=1400")
    .setFooter({ text: "Rewards Await!" });

  try {
    // Send the message with the button and embed
    await channel.send({
      content: `<@${userId}>`,
      embeds: [embed],
      components: [row],
    });

    console.log("Claim post sent to the user.");
  } catch (error) {
    console.error("Error sending claim post:", error);
  }
}

// Endpoint for Discord interactions
app.post(
  "/interactions",
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  async function (req, res) {
    const { type, data, member, guild_id } = req.body;

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
        console.log(`User ID: ${member.user.id}, Username: ${member.user.username}`);

        try {
          // Make a POST request to your verification endpoint (full URL)
          const response = await axios.post("https://discord-bot-1-7fgm.onrender.com/verify", {
            discordId: member.user.id,
            username: member.user.username,
          });

          // Check if the response is successful
          if (response.data.success) {
            // Grant access by assigning the required role to the user
            await guildMember.roles.add(requiredRoleID);

            // Remove tagged messages once verified
            await deleteBotMessages(guild, member.user.id);

            // Send a follow-up ephemeral message to confirm verification and remove the button and image
            await res.send({
              type: InteractionResponseType.UPDATE_MESSAGE,
              data: {
                content:
                  "✅ You have been verified! You now have access to the restricted channel.",
                embeds: [], // Remove the embed (image and other elements)
                components: [], // Remove all components (buttons)
                flags: 64, // Ephemeral response, only visible to the user
              },
            });

            // Wait for some time (e.g., 10 seconds) before showing the claim post
            setTimeout(async () => {
              const channel = guild.channels.cache.get("1286788205001310229"); // Use the correct channel ID
              if (channel) {
                await sendClaimPost(channel, member.user.id);
              } else {
                console.error("Channel for claim post not found.");
              }
            }, 2000);
          } else {
            // If verification fails, send a message with a button and a link
            const button = new ButtonBuilder()
              .setLabel("Buy AirDao Tokens")
              .setStyle(ButtonStyle.Link)
              .setURL("https://www.kucoin.com/how-to-buy/airdao");

            const row = new ActionRowBuilder().addComponents(button);

            await res.send({
              type: InteractionResponseType.UPDATE_MESSAGE,
              data: {
                content:
                  "Verification failed. Please check the instructions and try again.\nGo Get your AirDao Tokens",
                components: [row],
                flags: 64, // Ephemeral response, only visible to the user
              },
            });
          }
        } catch (error) {
          console.error("Error during verification process:", error);

          // Edit the original response in case of an error
          await res.send({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
              content:
                "An error occurred during the verification process. Please try again later.",
              components: [], // Remove all components in case of error
              flags: 64, // Ephemeral response, only visible to the user
            },
          });
        }

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
  const channel = member.guild.channels.cache.get("1286788205001310229"); // Update with correct channel ID

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
